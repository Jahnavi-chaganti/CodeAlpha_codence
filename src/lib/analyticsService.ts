import type {
  ProjectMember,
  ProjectMembership,
  Sprint,
  TaskCard,
  TaskPriority,
  TaskStatus,
} from '../types/pm';
import { addDaysIso, isDueSoonTask, isOverdueTask, localTodayIso } from './validationService';

export interface AnalyticsFilterOptions {
  dateFrom?: string;
  dateTo?: string;
  memberUid?: string;
  priority?: TaskPriority | 'all';
  status?: TaskStatus | 'all';
}

export interface StatusDistributionItem {
  status: TaskStatus;
  label: string;
  count: number;
  percentage: number;
}

export interface PriorityDistributionItem {
  priority: TaskPriority;
  label: string;
  count: number;
  percentage: number;
}

export interface MemberWorkloadItem {
  uid: string;
  name: string;
  photoURL: string;
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  loggedMinutes: number;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  created: number;
  completed: number;
}

export interface BurndownPoint {
  day: string;
  idealRemaining: number;
  actualRemaining: number;
}

export interface ProjectAnalyticsSummary {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  completionRate: number;
  activeMembers: number;
  totalLoggedMinutes: number;
  statusDistribution: StatusDistributionItem[];
  priorityDistribution: PriorityDistributionItem[];
  workloadByMember: MemberWorkloadItem[];
  weeklySeries: TimeSeriesPoint[];
  insights: {
    workloadImbalance: string | null;
    upcomingDeadlinesCount: number;
    overdueRate: number;
    velocity7d: number;
  };
}

function timestampToIsoDate(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof ts === 'string') return ts.slice(0, 10);
  if (typeof ts === 'object') {
    const sec = (ts as { seconds?: number }).seconds;
    if (typeof sec === 'number') {
      return localTodayIso(new Date(sec * 1000));
    }
  }
  return null;
}

export function filterTasksForAnalytics(
  tasks: TaskCard[],
  filters: AnalyticsFilterOptions
): TaskCard[] {
  return tasks.filter((t) => {
    if (filters.priority && filters.priority !== 'all' && t.priority !== filters.priority) {
      return false;
    }
    if (filters.status && filters.status !== 'all' && t.status !== filters.status) {
      return false;
    }
    if (filters.memberUid && filters.memberUid !== 'all') {
      if (filters.memberUid === 'unassigned' && t.assigneeUid !== '') return false;
      if (filters.memberUid !== 'unassigned' && t.assigneeUid !== filters.memberUid) return false;
    }
    const createdIso = timestampToIsoDate(t.createdAt) ?? t.dueDate ?? '';
    if (filters.dateFrom && createdIso && createdIso < filters.dateFrom) return false;
    if (filters.dateTo && createdIso && createdIso > filters.dateTo) return false;
    return true;
  });
}

export function computeProjectAnalytics(params: {
  memberships: ProjectMembership[];
  tasks: TaskCard[];
  members: ProjectMember[];
  referenceDate?: string;
}): ProjectAnalyticsSummary {
  const today = params.referenceDate ?? localTodayIso();
  const tasks = params.tasks;
  const totalTasks = tasks.length;

  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const pendingTasks = tasks.filter((t) => t.status === 'backlog' || t.status === 'todo').length;
  const overdueTasks = tasks.filter((t) => isOverdueTask(t, today)).length;
  const dueSoonTasks = tasks.filter((t) => isDueSoonTask(t, 3, today)).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalLoggedMinutes = tasks.reduce((acc, t) => acc + (t.actualMinutes ?? 0), 0);

  const statusMeta: { id: TaskStatus; label: string }[] = [
    { id: 'backlog', label: 'Backlog' },
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'done', label: 'Done' },
  ];
  const statusDistribution = statusMeta.map((s) => {
    const count = tasks.filter((t) => t.status === s.id).length;
    return {
      status: s.id,
      label: s.label,
      count,
      percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0,
    };
  });

  const priorityMeta: { id: TaskPriority; label: string }[] = [
    { id: 'urgent', label: 'Urgent' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ];
  const priorityDistribution = priorityMeta.map((p) => {
    const count = tasks.filter((t) => t.priority === p.id).length;
    return {
      priority: p.id,
      label: p.label,
      count,
      percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0,
    };
  });

  const memberMap = new Map<string, MemberWorkloadItem>();
  for (const m of params.members) {
    memberMap.set(m.uid, {
      uid: m.uid,
      name: m.displayName,
      photoURL: m.photoURL,
      total: 0,
      completed: 0,
      inProgress: 0,
      overdue: 0,
      loggedMinutes: 0,
    });
  }

  for (const t of tasks) {
    const uid = t.assigneeUid || 'unassigned';
    if (!memberMap.has(uid)) {
      memberMap.set(uid, {
        uid,
        name: t.assigneeName || 'Unassigned',
        photoURL: t.assigneePhoto || '',
        total: 0,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        loggedMinutes: 0,
      });
    }
    const row = memberMap.get(uid)!;
    row.total += 1;
    if (t.status === 'done') row.completed += 1;
    if (t.status === 'in_progress') row.inProgress += 1;
    if (isOverdueTask(t, today)) row.overdue += 1;
    row.loggedMinutes += t.actualMinutes ?? 0;
  }

  const workloadByMember = Array.from(memberMap.values()).sort((a, b) => b.total - a.total);

  // 7-day real activity time series using actual createdAt & updatedAt timestamps
  const weeklySeries: TimeSeriesPoint[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const dateIso = addDaysIso(today, offset);
    const created = tasks.filter((t) => timestampToIsoDate(t.createdAt) === dateIso).length;
    const completed = tasks.filter(
      (t) => t.status === 'done' && (timestampToIsoDate(t.updatedAt) ?? timestampToIsoDate(t.createdAt)) === dateIso
    ).length;
    weeklySeries.push({
      date: dateIso,
      label: dateIso.slice(5),
      created,
      completed,
    });
  }

  // Workload imbalance insight
  const assignedLoads = workloadByMember.filter((w) => w.uid !== 'unassigned').map((w) => w.total - w.completed);
  let workloadImbalance: string | null = null;
  if (assignedLoads.length >= 2) {
    const maxLoad = Math.max(...assignedLoads);
    const minLoad = Math.min(...assignedLoads);
    if (maxLoad - minLoad >= 3) {
      const busiest = workloadByMember.find((w) => w.uid !== 'unassigned' && w.total - w.completed === maxLoad);
      if (busiest) {
        workloadImbalance = `${busiest.name} carries ${maxLoad} open tasks (${maxLoad - minLoad} more than lowest-loaded teammate).`;
      }
    }
  }

  const velocity7d = weeklySeries.reduce((sum, pt) => sum + pt.completed, 0);
  const overdueRate = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  return {
    totalProjects: params.memberships.length,
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    overdueTasks,
    dueSoonTasks,
    completionRate,
    activeMembers: params.members.length,
    totalLoggedMinutes,
    statusDistribution,
    priorityDistribution,
    workloadByMember,
    weeklySeries,
    insights: {
      workloadImbalance,
      upcomingDeadlinesCount: dueSoonTasks,
      overdueRate,
      velocity7d,
    },
  };
}

export function computeSprintBurndown(sprint: Sprint, sprintTasks: TaskCard[]): BurndownPoint[] {
  const total = sprintTasks.length;
  if (!sprint.startDate || !sprint.endDate || sprint.endDate < sprint.startDate) {
    return [];
  }

  const start = new Date(`${sprint.startDate}T00:00:00`);
  const end = new Date(`${sprint.endDate}T00:00:00`);
  const diffDays = Math.max(1, Math.min(30, Math.round((end.getTime() - start.getTime()) / 86400000)));

  const points: BurndownPoint[] = [];
  const today = localTodayIso();

  for (let i = 0; i <= diffDays; i += 1) {
    const dayIso = addDaysIso(sprint.startDate, i);
    const idealRemaining = Math.max(0, Number((total - (total * i) / diffDays).toFixed(1)));

    let actualRemaining = total;
    if (dayIso <= today || sprint.status === 'completed') {
      const doneByDay = sprintTasks.filter((t) => {
        if (t.status !== 'done') return false;
        const doneDate = timestampToIsoDate(t.updatedAt) ?? sprint.startDate;
        return doneDate <= dayIso;
      }).length;
      actualRemaining = Math.max(0, total - doneByDay);
    } else {
      actualRemaining = Math.max(0, total - sprintTasks.filter((t) => t.status === 'done').length);
    }

    points.push({
      day: dayIso.slice(5),
      idealRemaining,
      actualRemaining,
    });
  }

  return points;
}

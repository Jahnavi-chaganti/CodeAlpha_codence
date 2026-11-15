import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Layers, Lightbulb } from 'lucide-react';
import {
  BOARD_COLUMNS,
  TASK_PRIORITIES,
  type ProjectMember,
  type ProjectMembership,
  type Sprint,
  type TaskCard,
  type TaskPriority,
  type TaskStatus,
} from '../types/pm';
import {
  computeProjectAnalytics,
  computeSprintBurndown,
  filterTasksForAnalytics,
} from '../lib/analyticsService';
import { formatMinutes } from '../lib/validationService';
import { StatCard } from './StatCard';
import { TaskCompletionChart } from './TaskCompletionChart';
import { WorkloadChart } from './WorkloadChart';
import { BurndownChart } from './BurndownChart';

interface AnalyticsDashboardProps {
  memberships: ProjectMembership[];
  tasks: TaskCard[];
  members: ProjectMember[];
  sprints: Sprint[];
}

export function AnalyticsDashboard({
  memberships,
  tasks,
  members,
  sprints,
}: AnalyticsDashboardProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [memberUid, setMemberUid] = useState('all');
  const [priority, setPriority] = useState<TaskPriority | 'all'>('all');
  const [status, setStatus] = useState<TaskStatus | 'all'>('all');

  const filteredTasks = useMemo(
    () =>
      filterTasksForAnalytics(tasks, {
        dateFrom,
        dateTo,
        memberUid,
        priority,
        status,
      }),
    [tasks, dateFrom, dateTo, memberUid, priority, status]
  );

  const summary = useMemo(
    () =>
      computeProjectAnalytics({
        memberships,
        tasks: filteredTasks,
        members,
      }),
    [memberships, filteredTasks, members]
  );

  const activeSprint = useMemo(
    () => sprints.find((s) => s.status === 'active') ?? sprints[0] ?? null,
    [sprints]
  );

  const burndownPoints = useMemo(() => {
    if (!activeSprint) return [];
    const sprintTasks = tasks.filter((t) => t.sprintId === activeSprint.id);
    return computeSprintBurndown(activeSprint, sprintTasks);
  }, [activeSprint, tasks]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#3D1023] dark:text-[#FFF5F6]">
              Workspace Analytics
            </h2>
            <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
              Live metrics computed directly from persisted Firestore project records
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Analytics start date"
              className="input-blush px-2.5 py-1.5 text-xs"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Analytics end date"
              className="input-blush px-2.5 py-1.5 text-xs"
            />
            <select
              value={memberUid}
              onChange={(e) => setMemberUid(e.target.value)}
              aria-label="Filter analytics by member"
              className="input-blush px-2.5 py-1.5 text-xs"
            >
              <option value="all">All members</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority | 'all')}
              aria-label="Filter analytics by priority"
              className="input-blush px-2.5 py-1.5 text-xs"
            >
              <option value="all">All priorities</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus | 'all')}
              aria-label="Filter analytics by status"
              className="input-blush px-2.5 py-1.5 text-xs"
            >
              <option value="all">All statuses</option>
              {BOARD_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <StatCard
            label="Total Tasks"
            value={summary.totalTasks}
            sublabel={`Across ${summary.totalProjects} workspace project(s)`}
            icon={<Layers className="w-4 h-4" />}
          />
          <StatCard
            label="Completion Rate"
            value={`${summary.completionRate}%`}
            sublabel={`${summary.completedTasks} done · ${summary.inProgressTasks} active`}
            tone="success"
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <StatCard
            label="Overdue Tasks"
            value={summary.overdueTasks}
            sublabel={`${summary.dueSoonTasks} due within 3 days`}
            tone={summary.overdueTasks > 0 ? 'danger' : 'default'}
            icon={<AlertTriangle className="w-4 h-4" />}
          />
          <StatCard
            label="Logged Effort"
            value={formatMinutes(summary.totalLoggedMinutes)}
            sublabel={`${summary.activeMembers} team collaborators`}
            tone="primary"
            icon={<Clock className="w-4 h-4" />}
          />
        </div>

        <div className="glass-card p-4 flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-2 font-bold text-[#7A2346] dark:text-[#F1BBC8]">
            <span className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/40 flex items-center justify-center">
              <Lightbulb className="w-4 h-4" />
            </span>
            <span>Delivery Insights</span>
          </span>
          <span className="text-[#513443] dark:text-[#F8DDE3] tabular-nums">
            7-day throughput: <strong className="text-[#3D1023] dark:text-white">{summary.insights.velocity7d} completed</strong>
          </span>
          <span className="text-[#D989A2]" aria-hidden="true">·</span>
          <span className="text-[#513443] dark:text-[#F8DDE3] tabular-nums">
            Overdue ratio: <strong className="text-[#3D1023] dark:text-white">{summary.insights.overdueRate}%</strong>
          </span>
          {summary.insights.workloadImbalance && (
            <>
              <span className="text-[#D989A2]" aria-hidden="true">·</span>
              <span className="text-[#D99A35] dark:text-[#F0BF67] font-medium">
                {summary.insights.workloadImbalance}
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TaskCompletionChart
            series={summary.weeklySeries}
            statusDistribution={summary.statusDistribution}
          />
          <WorkloadChart items={summary.workloadByMember} />
        </div>

        {activeSprint && (
          <BurndownChart sprintName={activeSprint.name} points={burndownPoints} />
        )}

        <div className="glass-card p-5 space-y-3.5">
          <h3 className="font-display text-sm font-bold text-[#7A2346] dark:text-[#FFF5F6]">
            Priority Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {summary.priorityDistribution.map((p) => (
              <div
                key={p.priority}
                className="p-3.5 rounded-[14px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-white/75 dark:bg-[#2A0D19]/65"
              >
                <span className="text-xs font-medium text-[#795D6B] dark:text-[#D9B7C4]">
                  {p.label}
                </span>
                <p className="mt-1 font-mono text-lg font-bold text-[#3D1023] dark:text-[#FFF5F6] tabular-nums">
                  {p.count}{' '}
                  <span className="text-xs font-normal text-[#A58C98] dark:text-[#D9B7C4]">
                    ({p.percentage}%)
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTER_CRITERIA,
  type Project,
  type ProjectMember,
  type Sprint,
  type TaskCard,
} from '../src/types/pm';
import {
  computeProjectAnalytics,
  computeSprintBurndown,
  filterTasksForAnalytics,
} from '../src/lib/analyticsService';
import { applyTaskFilters } from '../src/lib/searchService';
import {
  buildMembersCsv,
  buildProjectReportMarkdown,
  buildTasksCsv,
} from '../src/lib/exportService';

const MEMBERS: ProjectMember[] = [
  { uid: 'u1', displayName: 'Alice Chen', photoURL: '', role: 'owner', inviteCode: '' },
  { uid: 'u2', displayName: 'Bob Smith', photoURL: '', role: 'member', inviteCode: '' },
];

const TASKS: TaskCard[] = [
  {
    id: 't1',
    projectId: 'p1',
    taskKey: 'ENG-1',
    title: 'Design "API" schema, v2',
    description: 'Write OpenAPI spec',
    status: 'done',
    priority: 'high',
    position: 1000,
    assigneeUid: 'u1',
    assigneeName: 'Alice Chen',
    assigneePhoto: '',
    tags: ['api', 'backend'],
    dueDate: '2026-05-05',
    sprintId: 'sp1',
    actualMinutes: 90,
    subtasks: [
      { id: 's1', title: 'Draft', completed: true },
      { id: 's2', title: 'Review', completed: true },
    ],
    commentCount: 2,
    createdBy: 'u1',
    createdByName: 'Alice Chen',
    createdAt: '2026-05-01',
    updatedAt: '2026-05-03',
  },
  {
    id: 't2',
    projectId: 'p1',
    taskKey: 'ENG-2',
    title: 'Fix auth token refresh',
    description: 'Refresh WS tokens',
    status: 'in_progress',
    priority: 'urgent',
    position: 2000,
    assigneeUid: 'u2',
    assigneeName: 'Bob Smith',
    assigneePhoto: '',
    tags: ['security'],
    dueDate: '2026-05-04',
    sprintId: 'sp1',
    actualMinutes: 60,
    commentCount: 1,
    createdBy: 'u1',
    createdByName: 'Alice Chen',
    createdAt: '2026-05-02',
    updatedAt: '2026-05-04',
  },
  {
    id: 't3',
    projectId: 'p1',
    taskKey: 'ENG-3',
    title: 'Backlog planning',
    description: '',
    status: 'todo',
    priority: 'low',
    position: 3000,
    assigneeUid: 'u2',
    assigneeName: 'Bob Smith',
    assigneePhoto: '',
    tags: ['planning'],
    dueDate: '2026-05-12',
    sprintId: 'sp1',
    actualMinutes: 0,
    commentCount: 0,
    createdBy: 'u2',
    createdByName: 'Bob Smith',
    createdAt: '2026-05-03',
  },
  {
    id: 't4',
    projectId: 'p1',
    taskKey: 'ENG-4',
    title: 'Audit logs',
    description: '',
    status: 'backlog',
    priority: 'medium',
    position: 4000,
    assigneeUid: 'u2',
    assigneeName: 'Bob Smith',
    assigneePhoto: '',
    tags: ['security'],
    dueDate: '2026-05-20',
    actualMinutes: 0,
    commentCount: 0,
    createdBy: 'u1',
    createdByName: 'Alice Chen',
    createdAt: '2026-05-04',
  },
  {
    id: 't5',
    projectId: 'p1',
    taskKey: 'ENG-5',
    title: 'Rate limit telemetry',
    description: '',
    status: 'todo',
    priority: 'high',
    position: 5000,
    assigneeUid: 'u2',
    assigneeName: 'Bob Smith',
    assigneePhoto: '',
    tags: ['backend'],
    dueDate: '2026-05-22',
    actualMinutes: 30,
    commentCount: 0,
    createdBy: 'u1',
    createdByName: 'Alice Chen',
    createdAt: '2026-05-05',
  },
];

describe('Analytics & burndown calculations', () => {
  it('computes accurate KPI metrics, workload imbalance, and filters', () => {
    const summary = computeProjectAnalytics({
      memberships: [{ projectId: 'p1', projectName: 'Core', projectKey: 'ENG', role: 'owner' }],
      tasks: TASKS,
      members: MEMBERS,
      referenceDate: '2026-05-10',
    });

    expect(summary.totalTasks).toBe(5);
    expect(summary.completedTasks).toBe(1);
    expect(summary.completionRate).toBe(20);
    expect(summary.overdueTasks).toBe(1); // ENG-2 due 2026-05-04
    expect(summary.dueSoonTasks).toBe(1); // ENG-3 due 2026-05-12
    expect(summary.totalLoggedMinutes).toBe(180);
    expect(summary.insights.workloadImbalance).toContain('Bob Smith');

    const urgentOnly = filterTasksForAnalytics(TASKS, { priority: 'urgent' });
    expect(urgentOnly.map((t) => t.taskKey)).toEqual(['ENG-2']);
  });

  it('computes sprint burndown points across sprint duration', () => {
    const sprint: Sprint = {
      id: 'sp1',
      projectId: 'p1',
      name: 'Sprint 1',
      goal: 'Ship Auth & API',
      startDate: '2026-05-01',
      endDate: '2026-05-05',
      status: 'completed',
      retrospectiveNotes: '',
      createdBy: 'u1',
    };
    const points = computeSprintBurndown(
      sprint,
      TASKS.filter((t) => t.sprintId === 'sp1')
    );
    expect(points).toHaveLength(5);
    expect(points[0].idealRemaining).toBe(3);
    expect(points[4].idealRemaining).toBe(0);
    expect(points[4].actualRemaining).toBe(2);
  });
});

describe('Search filtering & CSV / Markdown exports', () => {
  it('filters tasks by search query, tags, sprint, and completion', () => {
    const res = applyTaskFilters(TASKS, {
      ...DEFAULT_FILTER_CRITERIA,
      search: 'openapi',
      tag: 'api',
      completion: 'completed',
    });
    expect(res.map((t) => t.taskKey)).toEqual(['ENG-1']);
  });

  it('escapes quotes and commas properly in CSV exports and builds Markdown reports', () => {
    const csv = buildTasksCsv(TASKS);
    expect(csv).toContain('"Design ""API"" schema, v2"');
    expect(csv).toContain('1h 30m');

    const membersCsv = buildMembersCsv(MEMBERS, TASKS);
    expect(membersCsv).toContain('Alice Chen,owner,1,1,0,1h 30m');

    const project: Project = {
      id: 'p1',
      name: 'Core Platform',
      key: 'ENG',
      description: 'Core services',
      ownerId: 'u1',
      taskCounter: 5,
    };
    const md = buildProjectReportMarkdown({
      project,
      members: MEMBERS,
      tasks: TASKS,
      sprints: [],
      reportType: 'workload',
    });
    expect(md).toContain('# Cadence WORKLOAD Report — Core Platform (ENG)');
    expect(md).toContain('Bob Smith');
  });
});

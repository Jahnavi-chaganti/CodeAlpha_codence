import type { Project, ProjectMember, Sprint, TaskCard } from '../types/pm';
import { computeProjectAnalytics } from './analyticsService';
import { formatMinutes } from './validationService';

function escapeCsvCell(value: string | number | boolean | undefined): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildTasksCsv(tasks: TaskCard[]): string {
  const headers = [
    'Key',
    'Title',
    'Status',
    'Priority',
    'Assignee',
    'Reporter',
    'Start Date',
    'Due Date',
    'Tags',
    'Subtasks Done',
    'Subtasks Total',
    'Estimated',
    'Logged',
    'Comments',
  ];

  const rows = tasks.map((t) => {
    const subtasks = t.subtasks ?? [];
    const doneSubtasks = subtasks.filter((s) => s.completed).length;
    return [
      escapeCsvCell(t.taskKey),
      escapeCsvCell(t.title),
      escapeCsvCell(t.status),
      escapeCsvCell(t.priority),
      escapeCsvCell(t.assigneeName || 'Unassigned'),
      escapeCsvCell(t.createdByName),
      escapeCsvCell(t.startDate || ''),
      escapeCsvCell(t.dueDate || ''),
      escapeCsvCell((t.tags ?? []).join('; ')),
      escapeCsvCell(doneSubtasks),
      escapeCsvCell(subtasks.length),
      escapeCsvCell(formatMinutes(t.estimatedMinutes)),
      escapeCsvCell(formatMinutes(t.actualMinutes)),
      escapeCsvCell(t.commentCount),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function buildMembersCsv(members: ProjectMember[], tasks: TaskCard[]): string {
  const headers = ['Member Name', 'Role', 'Assigned Tasks', 'Completed Tasks', 'Open Tasks', 'Logged Time'];
  const rows = members.map((m) => {
    const assigned = tasks.filter((t) => t.assigneeUid === m.uid);
    const completed = assigned.filter((t) => t.status === 'done').length;
    const open = assigned.length - completed;
    const logged = assigned.reduce((acc, t) => acc + (t.actualMinutes ?? 0), 0);
    return [
      escapeCsvCell(m.displayName),
      escapeCsvCell(m.role),
      escapeCsvCell(assigned.length),
      escapeCsvCell(completed),
      escapeCsvCell(open),
      escapeCsvCell(formatMinutes(logged)),
    ].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

export function buildProjectReportMarkdown(params: {
  project: Project;
  members: ProjectMember[];
  tasks: TaskCard[];
  sprints: Sprint[];
  reportType: 'progress' | 'completion' | 'workload' | 'sprint';
}): string {
  const summary = computeProjectAnalytics({
    memberships: [
      {
        projectId: params.project.id,
        projectName: params.project.name,
        projectKey: params.project.key,
        role: 'owner',
      },
    ],
    tasks: params.tasks,
    members: params.members,
  });

  const lines: string[] = [
    `# Cadence ${params.reportType.toUpperCase()} Report — ${params.project.name} (${params.project.key})`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `- Total Tasks: ${summary.totalTasks}`,
    `- Completed: ${summary.completedTasks} (${summary.completionRate}%)`,
    `- In Progress: ${summary.inProgressTasks}`,
    `- Overdue: ${summary.overdueTasks}`,
    `- Active Team Members: ${summary.activeMembers}`,
    `- Total Time Logged: ${formatMinutes(summary.totalLoggedMinutes)}`,
    '',
  ];

  if (params.reportType === 'workload') {
    lines.push('## Team Workload');
    for (const w of summary.workloadByMember) {
      lines.push(
        `- **${w.name}**: ${w.total} total (${w.completed} done, ${w.inProgress} active, ${w.overdue} overdue, ${formatMinutes(w.loggedMinutes)} logged)`
      );
    }
  } else if (params.reportType === 'sprint') {
    lines.push('## Sprints');
    for (const s of params.sprints) {
      const sTasks = params.tasks.filter((t) => t.sprintId === s.id);
      const sDone = sTasks.filter((t) => t.status === 'done').length;
      lines.push(`- **${s.name}** (${s.status}) [${s.startDate} → ${s.endDate}]: ${sDone}/${sTasks.length} tasks done`);
    }
  } else {
    lines.push('## Task Breakdown');
    for (const t of params.tasks) {
      lines.push(
        `- [${t.status.toUpperCase()}] **${t.taskKey}** ${t.title} — Priority: ${t.priority}, Assignee: ${t.assigneeName || 'Unassigned'}${t.dueDate ? `, Due: ${t.dueDate}` : ''}`
      );
    }
  }

  return lines.join('\n');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

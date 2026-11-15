import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import type { Project, ProjectMember, Sprint, TaskCard } from '../types/pm';
import {
  buildMembersCsv,
  buildProjectReportMarkdown,
  buildTasksCsv,
  triggerFileDownload,
} from '../lib/exportService';
import { computeProjectAnalytics } from '../lib/analyticsService';
import { formatMinutes } from '../lib/validationService';

interface ExportManagerProps {
  project: Project;
  members: ProjectMember[];
  tasks: TaskCard[];
  sprints: Sprint[];
}

export function ExportManager({
  project,
  members,
  tasks,
  sprints,
}: ExportManagerProps) {
  const [reportType, setReportType] = useState<'progress' | 'completion' | 'workload' | 'sprint'>(
    'progress'
  );

  const previewMarkdown = useMemo(
    () =>
      buildProjectReportMarkdown({
        project,
        members,
        tasks,
        sprints,
        reportType,
      }),
    [project, members, tasks, sprints, reportType]
  );

  const analytics = useMemo(
    () =>
      computeProjectAnalytics({
        memberships: [
          {
            projectId: project.id,
            projectName: project.name,
            projectKey: project.key,
            role: 'owner',
          },
        ],
        tasks,
        members,
      }),
    [project, tasks, members]
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#3D1023] dark:text-[#FFF5F6] tracking-tight">
              Export &amp; Printable Reports
            </h2>
            <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">
              Download CSV spreadsheets, Markdown summaries, or print clean PDF reports via your browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-burgundy inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>

        <div className="no-print grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() =>
              triggerFileDownload(
                `${project.key.toLowerCase()}-tasks.csv`,
                buildTasksCsv(tasks),
                'text/csv;charset=utf-8'
              )
            }
            className="glass-card glass-card-interactive p-5 text-left space-y-3 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-[12px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-[#7A2346] dark:text-[#E9A8B8]" />
              </div>
              <Download className="w-4 h-4 text-[#A58C98]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                Export Tasks CSV
              </p>
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">
                {tasks.length} task(s) with dates, subtasks, tags, and logged time.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerFileDownload(
                `${project.key.toLowerCase()}-team-workload.csv`,
                buildMembersCsv(members, tasks),
                'text/csv;charset=utf-8'
              )
            }
            className="glass-card glass-card-interactive p-5 text-left space-y-3 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-[12px] bg-[#21865B]/12 dark:bg-[#21865B]/25 border border-[#21865B]/20 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-[#21865B] dark:text-[#5FD09E]" />
              </div>
              <Download className="w-4 h-4 text-[#A58C98]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                Export Team Workload CSV
              </p>
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">
                {members.length} collaborator(s) with assigned, done, and logged hours.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerFileDownload(
                `${project.key.toLowerCase()}-${reportType}-report.md`,
                previewMarkdown,
                'text/markdown;charset=utf-8'
              )
            }
            className="glass-card glass-card-interactive p-5 text-left space-y-3 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-[12px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#C86B88] dark:text-[#F1BBC8]" />
              </div>
              <Download className="w-4 h-4 text-[#A58C98]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                Download Markdown Report
              </p>
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">
                Formatted {reportType} executive report ready for docs or wikis.
              </p>
            </div>
          </button>
        </div>

        <div className="glass-card p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 pb-4">
            <div>
              <h3 className="font-display text-base font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                {project.name} ({project.key}) — Report Preview
              </h3>
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums mt-0.5">
                {analytics.completedTasks}/{analytics.totalTasks} completed ({analytics.completionRate}%) ·{' '}
                {analytics.overdueTasks} overdue · {formatMinutes(analytics.totalLoggedMinutes)} logged
              </p>
            </div>

            <div className="no-print flex items-center gap-1 p-1 rounded-[12px] bg-[#FCE8EC]/80 dark:bg-[#2A0D19]/70 border border-[#EAD7DE] dark:border-[#E9A8B8]/18">
              {(['progress', 'completion', 'workload', 'sprint'] as const).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setReportType(rt)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[9px] capitalize transition-colors cursor-pointer ${
                    reportType === rt
                      ? 'bg-[#7A2346] text-[#FFF5F6] shadow-xs'
                      : 'text-[#513443] dark:text-[#D9B7C4] hover:text-[#3D1023] dark:hover:text-[#FFF5F6]'
                  }`}
                >
                  {rt}
                </button>
              ))}
            </div>
          </div>

          <pre className="text-xs font-mono text-[#513443] dark:text-[#F8DDE3] whitespace-pre-wrap leading-relaxed bg-[#FBEFF1]/85 dark:bg-[#2A0D19]/75 p-4 rounded-[14px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18">
            {previewMarkdown}
          </pre>
        </div>
      </div>
    </div>
  );
}

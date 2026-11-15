import type { MemberWorkloadItem } from '../lib/analyticsService';
import { formatMinutes } from '../lib/validationService';
import { Avatar } from './Avatar';

interface WorkloadChartProps {
  items: MemberWorkloadItem[];
}

export function WorkloadChart({ items }: WorkloadChartProps) {
  const maxTotal = Math.max(1, ...items.map((w) => w.total));

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <h3 className="font-display text-sm font-bold text-[#7A2346] dark:text-[#FFF5F6]">
          Team Workload Distribution
        </h3>
        <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
          Assigned tasks, completions, overdue items, and logged effort per collaborator
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] py-6 text-center">
          No workload data available for the active filter.
        </p>
      ) : (
        <div className="space-y-3.5">
          {items.map((m) => {
            const donePct = Math.round((m.completed / maxTotal) * 100);
            const activePct = Math.round(((m.total - m.completed) / maxTotal) * 100);
            return (
              <div key={m.uid} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={m.name} photoURL={m.photoURL} size="xs" />
                    <span className="font-semibold text-[#3D1023] dark:text-[#FFF5F6] truncate">
                      {m.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-[#795D6B] dark:text-[#D9B7C4] tabular-nums shrink-0">
                    <span>{m.completed}/{m.total} done</span>
                    {m.overdue > 0 && (
                      <span className="text-[#D94C65] dark:text-[#F68398] font-semibold">
                        · {m.overdue} overdue
                      </span>
                    )}
                    {m.loggedMinutes > 0 && (
                      <span>· {formatMinutes(m.loggedMinutes)}</span>
                    )}
                  </div>
                </div>

                <div className="h-2.5 w-full rounded-full bg-[#FCE8EC] dark:bg-[#2A0D19] overflow-hidden flex">
                  <div
                    className="h-full bg-[#7A2346]"
                    style={{ width: `${donePct}%` }}
                    title={`${m.completed} completed`}
                  />
                  <div
                    className="h-full bg-[#E9A8B8] dark:bg-[#C86B88]"
                    style={{ width: `${activePct}%` }}
                    title={`${m.total - m.completed} open`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

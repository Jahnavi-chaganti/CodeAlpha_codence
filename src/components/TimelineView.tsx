import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flag, ShieldAlert } from 'lucide-react';
import type { Milestone, TaskCard } from '../types/pm';
import { addDaysIso, getIncompleteBlockers, localTodayIso } from '../lib/validationService';
import { PriorityBadge } from './PriorityBadge';

interface TimelineViewProps {
  tasks: TaskCard[];
  milestones: Milestone[];
  onSelectTask: (task: TaskCard) => void;
  onUpdateDates: (task: TaskCard, startDate: string, dueDate: string) => Promise<void>;
}

function diffDays(startIso: string, endIso: string): number {
  const [y1, m1, d1] = startIso.split('-').map(Number);
  const [y2, m2, d2] = endIso.split('-').map(Number);
  const a = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const b = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((b - a) / 86400_000);
}

export function TimelineView({
  tasks,
  milestones,
  onSelectTask,
  onUpdateDates,
}: TimelineViewProps) {
  const [windowStart, setWindowStart] = useState(() => addDaysIso(localTodayIso(), -3));
  const [spanDays, setSpanDays] = useState<14 | 28>(14);
  const today = localTodayIso();

  const dates = useMemo(
    () => Array.from({ length: spanDays }, (_, i) => addDaysIso(windowStart, i)),
    [windowStart, spanDays]
  );

  const windowEnd = dates[dates.length - 1];

  const scheduledRows = useMemo(() => {
    return [...tasks].sort((a, b) =>
      (a.startDate || a.dueDate || '9999').localeCompare(b.startDate || b.dueDate || '9999')
    );
  }, [tasks]);

  return (
    <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWindowStart((d) => addDaysIso(d, -7))}
            aria-label="Shift timeline earlier"
            className="btn-blush p-2 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setWindowStart(addDaysIso(today, -3))}
            className="btn-blush px-3 py-1.5 text-xs font-semibold cursor-pointer"
          >
            Focus Today
          </button>
          <button
            type="button"
            onClick={() => setWindowStart((d) => addDaysIso(d, 7))}
            aria-label="Shift timeline later"
            className="btn-blush p-2 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs font-medium text-[#795D6B] dark:text-[#D9B7C4] ml-2 tabular-nums">
            {windowStart} → {windowEnd}
          </span>
        </div>

        <div className="inline-flex p-0.5 rounded-[12px] bg-[#FCE8EC]/85 dark:bg-[#2A0D19]/75 border border-[#EAD7DE] dark:border-[#E9A8B8]/20">
          {([14, 28] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setSpanDays(days)}
              className={`px-3 py-1 text-xs font-semibold rounded-[10px] transition-all cursor-pointer ${
                spanDays === days
                  ? 'bg-gradient-to-r from-[#8F3157] to-[#7A2346] text-white shadow-xs'
                  : 'text-[#513443] dark:text-[#D9B7C4] hover:text-[#7A2346] dark:hover:text-white'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {milestones.length > 0 && (
        <div className="glass-card flex flex-wrap items-center gap-3 px-4 py-3 text-xs">
          <span className="font-bold text-[#7A2346] dark:text-[#F1BBC8] flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-[#C86B88]" />
            <span>Milestones:</span>
          </span>
          {milestones.map((m) => (
            <span
              key={m.id}
              className={`font-mono text-[11px] tabular-nums ${
                m.completed
                  ? 'text-[#21865B] dark:text-[#5AD29D] line-through'
                  : 'text-[#513443] dark:text-[#F8DDE3]'
              }`}
            >
              {m.name} ({m.dueDate})
            </span>
          ))}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[260px_1fr] border-b border-[#EAD7DE] dark:border-[#E9A8B8]/15 bg-[#FBEFF1]/85 dark:bg-[#2A0D19]/65 text-[11px] font-bold text-[#7A2346] dark:text-[#F1BBC8]">
              <div className="px-4 py-2.5 border-r border-[#EAD7DE] dark:border-[#E9A8B8]/15">
                Task &amp; Dates
              </div>
              <div
                className="grid"
                style={{ gridTemplateColumns: `repeat(${spanDays}, minmax(28px, 1fr))` }}
              >
                {dates.map((d) => {
                  const isToday = d === today;
                  const hasMilestone = milestones.some((m) => m.dueDate === d);
                  return (
                    <div
                      key={d}
                      className={`py-2 text-center font-mono tabular-nums border-r border-[#EAD7DE]/60 dark:border-[#E9A8B8]/12 ${
                        isToday
                          ? 'bg-gradient-to-b from-[#8F3157] to-[#7A2346] text-white font-semibold'
                          : hasMilestone
                            ? 'bg-[#D99A35]/15 text-[#9E6A14] dark:text-[#F0BF67] font-semibold'
                            : ''
                      }`}
                      title={d}
                    >
                      {d.slice(8)}
                    </div>
                  );
                })}
              </div>
            </div>

            {scheduledRows.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#795D6B] dark:text-[#D9B7C4]">
                No tasks available to display on the timeline.
              </div>
            ) : (
              <div className="divide-y divide-[#EAD7DE]/60 dark:divide-[#E9A8B8]/12">
                {scheduledRows.map((task) => {
                  const effectiveDue = task.dueDate || task.startDate || today;
                  const effectiveStart =
                    task.startDate || addDaysIso(effectiveDue, -2);
                  const rawStartIdx = diffDays(windowStart, effectiveStart);
                  const rawEndIdx = diffDays(windowStart, effectiveDue);
                  const clampedStart = Math.max(0, rawStartIdx);
                  const clampedEnd = Math.min(spanDays - 1, Math.max(clampedStart, rawEndIdx));
                  const visible = rawEndIdx >= 0 && rawStartIdx < spanDays;
                  const incompleteBlockers = getIncompleteBlockers(task, tasks);

                  return (
                    <div
                      key={task.id}
                      className="grid grid-cols-[260px_1fr] items-center hover:bg-[#FCE8EC]/55 dark:hover:bg-[#8F3157]/18 transition-colors"
                    >
                      <div className="px-4 py-2.5 border-r border-[#EAD7DE] dark:border-[#E9A8B8]/15 space-y-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectTask(task)}
                            className="font-mono text-[11px] font-semibold text-[#7A2346] dark:text-[#F1BBC8] hover:underline cursor-pointer"
                          >
                            {task.taskKey}
                          </button>
                          <div className="flex items-center gap-1.5">
                            {incompleteBlockers.length > 0 && (
                              <ShieldAlert
                                className="w-3.5 h-3.5 text-[#D99A35]"
                                aria-label="Has incomplete blockers"
                              />
                            )}
                            <PriorityBadge priority={task.priority} />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectTask(task)}
                          className="block w-full text-left text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6] truncate cursor-pointer"
                        >
                          {task.title}
                        </button>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#795D6B] dark:text-[#D9B7C4]">
                          <input
                            type="date"
                            value={task.startDate || ''}
                            aria-label={`Start date for ${task.taskKey}`}
                            onChange={(e) =>
                              onUpdateDates(task, e.target.value, task.dueDate || e.target.value)
                            }
                            className="input-blush w-[104px] px-1.5 py-0.5 text-[10px]"
                          />
                          <span>→</span>
                          <input
                            type="date"
                            value={task.dueDate || ''}
                            aria-label={`Due date for ${task.taskKey}`}
                            onChange={(e) =>
                              onUpdateDates(task, task.startDate || e.target.value, e.target.value)
                            }
                            className="input-blush w-[104px] px-1.5 py-0.5 text-[10px]"
                          />
                        </div>
                      </div>

                      <div
                        className="relative h-12 grid items-center"
                        style={{ gridTemplateColumns: `repeat(${spanDays}, minmax(28px, 1fr))` }}
                      >
                        {dates.map((d) => (
                          <div
                            key={d}
                            className={`h-full border-r border-[#EAD7DE]/55 dark:border-[#E9A8B8]/10 ${
                              d === today ? 'bg-[#FCE8EC]/60 dark:bg-[#8F3157]/20' : ''
                            }`}
                          />
                        ))}

                        {visible && (
                          <button
                            type="button"
                            onClick={() => onSelectTask(task)}
                            style={{
                              gridColumn: `${clampedStart + 1} / ${clampedEnd + 2}`,
                              gridRow: 1,
                            }}
                            title={`${task.taskKey}: ${effectiveStart} → ${effectiveDue}`}
                            className={`mx-1 h-7 px-2.5 rounded-[10px] text-left text-[11px] font-semibold truncate shadow-xs cursor-pointer transition-opacity hover:opacity-90 ${
                              task.status === 'done'
                                ? 'bg-[#21865B] text-white'
                                : task.status === 'in_progress'
                                  ? 'bg-gradient-to-r from-[#8F3157] to-[#7A2346] text-white'
                                  : 'bg-[#C86B88] dark:bg-[#8F3157]/80 text-white'
                            }`}
                          >
                            {task.taskKey} · {task.title}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

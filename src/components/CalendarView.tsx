import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { TaskCard } from '../types/pm';
import { addDaysIso, isOverdueTask, localTodayIso } from '../lib/validationService';
import { PriorityBadge } from './PriorityBadge';

interface CalendarViewProps {
  tasks: TaskCard[];
  onSelectTask: (task: TaskCard) => void;
  onRescheduleTask: (task: TaskCard, newDueDate: string) => Promise<void>;
  onQuickCreateOnDate: (dateIso: string) => void;
}

type CalendarMode = 'month' | 'week' | 'day';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const offset = first.getDay();
  return new Date(year, month, 1 - offset);
}

export function CalendarView({
  tasks,
  onSelectTask,
  onRescheduleTask,
  onQuickCreateOnDate,
}: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarMode>('month');
  const [cursorIso, setCursorIso] = useState(() => localTodayIso());
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const today = localTodayIso();

  const cursorDate = useMemo(() => {
    const [y, m, d] = cursorIso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [cursorIso]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskCard[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [tasks]);

  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => !t.dueDate),
    [tasks]
  );

  const days = useMemo(() => {
    if (mode === 'day') {
      return [cursorIso];
    }
    if (mode === 'week') {
      const dow = cursorDate.getDay();
      const start = addDaysIso(cursorIso, -dow);
      return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
    }
    const start = startOfMonthGrid(cursorDate.getFullYear(), cursorDate.getMonth());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return localTodayIso(d);
    });
  }, [mode, cursorIso, cursorDate]);

  const shiftPeriod = (dir: -1 | 1) => {
    if (mode === 'day') {
      setCursorIso(addDaysIso(cursorIso, dir));
    } else if (mode === 'week') {
      setCursorIso(addDaysIso(cursorIso, dir * 7));
    } else {
      const next = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + dir, 1);
      setCursorIso(localTodayIso(next));
    }
  };

  const periodLabel = useMemo(() => {
    if (mode === 'day') {
      return cursorDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (mode === 'week') {
      return `Week of ${days[0]}`;
    }
    return cursorDate.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [mode, cursorDate, days]);

  const currentMonth = cursorDate.getMonth();

  const handleDropOnDate = async (dateIso: string) => {
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    setDraggedTaskId(null);
    if (task && task.dueDate !== dateIso) {
      await onRescheduleTask(task, dateIso);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftPeriod(-1)}
            aria-label="Previous period"
            className="btn-blush p-2 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursorIso(today)}
            className="btn-blush px-3 py-1.5 text-xs font-semibold cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftPeriod(1)}
            aria-label="Next period"
            className="btn-blush p-2 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="font-display text-sm sm:text-base font-bold text-[#3D1023] dark:text-[#FFF5F6] ml-2">
            {periodLabel}
          </h2>
        </div>

        <div className="inline-flex p-0.5 rounded-[12px] bg-[#FCE8EC]/85 dark:bg-[#2A0D19]/75 border border-[#EAD7DE] dark:border-[#E9A8B8]/20">
          {(['month', 'week', 'day'] as CalendarMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs font-semibold rounded-[10px] capitalize transition-all cursor-pointer ${
                mode === m
                  ? 'bg-gradient-to-r from-[#8F3157] to-[#7A2346] text-white shadow-xs'
                  : 'text-[#513443] dark:text-[#D9B7C4] hover:text-[#7A2346] dark:hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
        <div className="xl:col-span-3 glass-card overflow-hidden">
          {mode !== 'day' && (
            <div className="grid grid-cols-7 border-b border-[#EAD7DE] dark:border-[#E9A8B8]/15 bg-[#FBEFF1]/85 dark:bg-[#2A0D19]/65">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="py-2.5 px-2 text-center text-[11px] font-bold text-[#7A2346] dark:text-[#F1BBC8] uppercase tracking-wider"
                >
                  {w}
                </div>
              ))}
            </div>
          )}

          <div
            className={
              mode === 'day'
                ? 'p-4 space-y-2'
                : 'grid grid-cols-7 divide-x divide-y divide-[#EAD7DE]/65 dark:divide-[#E9A8B8]/12'
            }
          >
            {days.map((dateIso) => {
              const dayTasks = tasksByDate.get(dateIso) ?? [];
              const [, mStr, dStr] = dateIso.split('-');
              const isCurrentMonth = Number(mStr) - 1 === currentMonth;
              const isToday = dateIso === today;

              return (
                <div
                  key={dateIso}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropOnDate(dateIso)}
                  className={`${
                    mode === 'day' ? 'min-h-[260px]' : mode === 'week' ? 'min-h-[220px]' : 'min-h-[104px]'
                  } p-1.5 sm:p-2 transition-colors ${
                    !isCurrentMonth && mode === 'month'
                      ? 'bg-[#FBEFF1]/45 dark:bg-[#2A0D19]/40 opacity-65'
                      : ''
                  } ${isToday ? 'bg-[#FCE8EC]/70 dark:bg-[#8F3157]/25' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isToday
                          ? 'px-1.5 py-0.5 rounded-[8px] bg-gradient-to-r from-[#8F3157] to-[#7A2346] text-white font-semibold'
                          : 'text-[#795D6B] dark:text-[#D9B7C4]'
                      }`}
                    >
                      {mode === 'day' ? dateIso : Number(dStr)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuickCreateOnDate(dateIso)}
                      title={`Add task due ${dateIso}`}
                      aria-label={`Add task due ${dateIso}`}
                      className="p-0.5 rounded-[8px] text-[#A58C98] hover:text-[#7A2346] hover:bg-[#FCE8EC] dark:hover:bg-[#8F3157]/35 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {dayTasks.map((t) => {
                      const overdue = isOverdueTask(t, today);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          draggable
                          onDragStart={() => setDraggedTaskId(t.id)}
                          onClick={() => onSelectTask(t)}
                          className={`w-full text-left px-2 py-1 rounded-[10px] border text-[11px] transition-colors cursor-pointer ${
                            t.status === 'done'
                              ? 'border-[#21865B]/30 bg-[#21865B]/10 text-[#196846] dark:text-[#6EE0AF] line-through'
                              : overdue
                                ? 'border-[#D94C65]/40 bg-[#D94C65]/10 text-[#A3263E] dark:text-[#F8A5B4]'
                                : 'border-[#EAD7DE] dark:border-[#E9A8B8]/20 bg-white/90 dark:bg-[#2A0D19]/75 text-[#3D1023] dark:text-[#FFF5F6] hover:border-[#C86B88]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] opacity-80 shrink-0">
                              {t.taskKey}
                            </span>
                            {mode === 'day' && <PriorityBadge priority={t.priority} />}
                          </div>
                          <p className="truncate font-medium">{t.title}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xs font-bold text-[#7A2346] dark:text-[#FFF5F6]">
              Unscheduled Tasks
            </h3>
            <span className="font-mono text-xs font-semibold text-[#8F3157] dark:text-[#F1BBC8] tabular-nums">
              {unscheduledTasks.length}
            </span>
          </div>
          <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
            Drag onto a calendar day to assign a due date, or click to edit.
          </p>
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
            {unscheduledTasks.length === 0 ? (
              <p className="text-xs text-[#A58C98] dark:text-[#D9B7C4] py-4 text-center">
                All tasks have due dates.
              </p>
            ) : (
              unscheduledTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  draggable
                  onDragStart={() => setDraggedTaskId(t.id)}
                  onClick={() => onSelectTask(t)}
                  className="w-full text-left p-2.5 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 hover:border-[#C86B88] bg-white/75 dark:bg-[#2A0D19]/65 text-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#8F3157] dark:text-[#F1BBC8]">
                      {t.taskKey}
                    </span>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <p className="font-medium text-[#3D1023] dark:text-[#FFF5F6] truncate mt-0.5">
                    {t.title}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

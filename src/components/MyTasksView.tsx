import { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Clock, Plus } from 'lucide-react';
import type { User } from 'firebase/auth';
import { BOARD_COLUMNS, type TaskCard, type TaskStatus } from '../types/pm';
import { isDueSoonTask, isOverdueTask, localTodayIso } from '../lib/validationService';
import { PriorityBadge } from './PriorityBadge';

interface MyTasksViewProps {
  mode: 'my_tasks' | 'overdue';
  user: User;
  tasks: TaskCard[];
  onSelectTask: (task: TaskCard) => void;
  onQuickStatusChange: (task: TaskCard, nextStatus: TaskStatus) => void;
  onOpenNewTask: () => void;
}

type FocusTab = 'all' | 'overdue' | 'today' | 'upcoming' | 'high' | 'completed';

export function MyTasksView({
  mode,
  user,
  tasks,
  onSelectTask,
  onQuickStatusChange,
  onOpenNewTask,
}: MyTasksViewProps) {
  const [tab, setTab] = useState<FocusTab>(mode === 'overdue' ? 'overdue' : 'all');
  const today = localTodayIso();

  const baseTasks = useMemo(() => {
    if (mode === 'overdue') {
      return tasks.filter((t) => isOverdueTask(t, today));
    }
    return tasks.filter(
      (t) => t.assigneeUid === user.uid || t.createdBy === user.uid
    );
  }, [mode, tasks, user.uid, today]);

  const counts = useMemo(() => {
    return {
      all: baseTasks.length,
      overdue: baseTasks.filter((t) => isOverdueTask(t, today)).length,
      today: baseTasks.filter((t) => t.dueDate === today && t.status !== 'done').length,
      upcoming: baseTasks.filter((t) => isDueSoonTask(t, 7, today)).length,
      high: baseTasks.filter(
        (t) => (t.priority === 'high' || t.priority === 'urgent') && t.status !== 'done'
      ).length,
      completed: baseTasks.filter((t) => t.status === 'done').length,
    };
  }, [baseTasks, today]);

  const visibleTasks = useMemo(() => {
    if (mode === 'overdue') return baseTasks;
    return baseTasks.filter((t) => {
      if (tab === 'overdue') return isOverdueTask(t, today);
      if (tab === 'today') return t.dueDate === today && t.status !== 'done';
      if (tab === 'upcoming') return isDueSoonTask(t, 7, today);
      if (tab === 'high')
        return (t.priority === 'high' || t.priority === 'urgent') && t.status !== 'done';
      if (tab === 'completed') return t.status === 'done';
      return true;
    });
  }, [mode, baseTasks, tab, today]);

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#3D1023] dark:text-[#FFF5F6]">
              {mode === 'overdue' ? 'Overdue Tasks' : 'My Focus Tasks'}
            </h2>
            <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
              {mode === 'overdue'
                ? 'All tasks in this project past their scheduled due date.'
                : 'Tasks assigned to you or created by you in the active project.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewTask}
            className="btn-burgundy inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="glass-card glass-card-interactive p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#7A2346] dark:text-[#F1BBC8]">
              <span>Overdue</span>
              <span className="w-7 h-7 rounded-[10px] bg-[#D94C65]/12 text-[#D94C65] flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 font-display text-2xl font-bold text-[#D94C65] dark:text-[#F68398] tabular-nums">
              {counts.overdue}
            </p>
          </div>

          <div className="glass-card glass-card-interactive p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#7A2346] dark:text-[#F1BBC8]">
              <span>Due Today</span>
              <span className="w-7 h-7 rounded-[10px] bg-[#D99A35]/14 text-[#D99A35] flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 font-display text-2xl font-bold text-[#3D1023] dark:text-[#FFF5F6] tabular-nums">
              {counts.today}
            </p>
          </div>

          <div className="glass-card glass-card-interactive p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#7A2346] dark:text-[#F1BBC8]">
              <span>Next 7 Days</span>
              <span className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/40 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 font-display text-2xl font-bold text-[#3D1023] dark:text-[#FFF5F6] tabular-nums">
              {counts.upcoming}
            </p>
          </div>

          <div className="glass-card glass-card-interactive p-4">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#7A2346] dark:text-[#F1BBC8]">
              <span>Completed</span>
              <span className="w-7 h-7 rounded-[10px] bg-[#21865B]/12 text-[#21865B] flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="mt-1 font-display text-2xl font-bold text-[#21865B] dark:text-[#5AD29D] tabular-nums">
              {counts.completed}
            </p>
          </div>
        </div>

        {mode === 'my_tasks' && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#EAD7DE] dark:border-[#E9A8B8]/15 pb-2.5">
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'overdue', label: `Overdue (${counts.overdue})` },
                { id: 'today', label: `Due Today (${counts.today})` },
                { id: 'upcoming', label: `Upcoming (${counts.upcoming})` },
                { id: 'high', label: `High/Urgent (${counts.high})` },
                { id: 'completed', label: `Completed (${counts.completed})` },
              ] as { id: FocusTab; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-[12px] cursor-pointer transition-all ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-[#8F3157] to-[#7A2346] text-white shadow-xs'
                    : 'text-[#513443] dark:text-[#D9B7C4] hover:bg-[#FCE8EC] dark:hover:bg-[#8F3157]/30'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="glass-card divide-y divide-[#EAD7DE]/65 dark:divide-[#E9A8B8]/12 overflow-hidden">
          {visibleTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#795D6B] dark:text-[#D9B7C4]">
              {mode === 'overdue'
                ? 'Zero overdue tasks — your project is on schedule.'
                : 'No tasks match this personal focus view.'}
            </div>
          ) : (
            visibleTasks.map((task) => {
              const overdue = isOverdueTask(task, today);
              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FCE8EC]/70 dark:hover:bg-[#8F3157]/20 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[#8F3157] dark:text-[#F1BBC8] tabular-nums">
                        {task.taskKey}
                      </span>
                      <PriorityBadge priority={task.priority} />
                      {overdue && (
                        <span className="text-[11px] font-semibold text-[#D94C65] dark:text-[#F68398]">
                          Overdue ({task.dueDate})
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6] truncate mt-0.5">
                      {task.title}
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-3 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {task.dueDate && !overdue && (
                      <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                        {task.dueDate}
                      </span>
                    )}
                    <select
                      value={task.status}
                      onChange={(e) =>
                        onQuickStatusChange(task, e.target.value as TaskStatus)
                      }
                      aria-label={`Change status for ${task.taskKey}`}
                      className="input-blush text-xs px-2.5 py-1 cursor-pointer"
                    >
                      {BOARD_COLUMNS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

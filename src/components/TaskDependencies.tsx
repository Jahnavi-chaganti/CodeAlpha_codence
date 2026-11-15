import { useMemo, useState } from 'react';
import { AlertTriangle, Link2, Plus, ShieldAlert, X } from 'lucide-react';
import { LIMITS, type TaskCard } from '../types/pm';
import { getIncompleteBlockers, hasCircularDependency } from '../lib/validationService';

interface TaskDependenciesProps {
  task: TaskCard;
  allTasks: TaskCard[];
  blockedBy: string[];
  relatedTaskIds: string[];
  onChangeBlockedBy: (next: string[]) => void;
  onChangeRelated: (next: string[]) => void;
  onNavigateTask?: (taskId: string) => void;
}

export function TaskDependencies({
  task,
  allTasks,
  blockedBy,
  relatedTaskIds,
  onChangeBlockedBy,
  onChangeRelated,
  onNavigateTask,
}: TaskDependenciesProps) {
  const [selectedBlocker, setSelectedBlocker] = useState('');
  const [selectedRelated, setSelectedRelated] = useState('');
  const [depError, setDepError] = useState<string | null>(null);

  const taskMap = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);

  const incompleteBlockers = useMemo(
    () => getIncompleteBlockers({ ...task, blockedBy }, allTasks),
    [task, blockedBy, allTasks]
  );

  const blockingOtherTasks = useMemo(
    () => allTasks.filter((t) => t.id !== task.id && (t.blockedBy ?? []).includes(task.id)),
    [allTasks, task.id]
  );

  const candidateTasks = useMemo(
    () => allTasks.filter((t) => t.id !== task.id),
    [allTasks, task.id]
  );

  const handleAddBlocker = () => {
    setDepError(null);
    if (!selectedBlocker) return;
    if (blockedBy.includes(selectedBlocker)) return;
    if (blockedBy.length >= LIMITS.DEPENDENCY_MAX) {
      setDepError(`Maximum of ${LIMITS.DEPENDENCY_MAX} blockers per task.`);
      return;
    }
    if (hasCircularDependency(task.id, selectedBlocker, allTasks)) {
      setDepError('Circular dependency detected: adding this blocker would create a cycle.');
      return;
    }
    onChangeBlockedBy([...blockedBy, selectedBlocker]);
    setSelectedBlocker('');
  };

  const handleAddRelated = () => {
    if (!selectedRelated || relatedTaskIds.includes(selectedRelated)) return;
    if (relatedTaskIds.length >= LIMITS.DEPENDENCY_MAX) return;
    onChangeRelated([...relatedTaskIds, selectedRelated]);
    setSelectedRelated('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
          Dependencies &amp; Blockers
        </span>
        {incompleteBlockers.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C17A43] dark:text-[#F1BBC8]">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Blocked by {incompleteBlockers.length} open task(s)</span>
          </span>
        )}
      </div>

      {depError && (
        <div
          role="alert"
          className="p-2.5 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8] flex items-center gap-2"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{depError}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-[11px] font-medium text-[#795D6B] dark:text-[#D9B7C4]">
          Blocked By (must finish before this task)
        </label>

        {blockedBy.length > 0 && (
          <div className="space-y-1.5">
            {blockedBy.map((id) => {
              const target = taskMap.get(id);
              const isDone = target?.status === 'done';
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-[#FBEFF1]/75 dark:bg-[#2A0D19]/50 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => target && onNavigateTask?.(target.id)}
                    className="flex items-center gap-2 min-w-0 text-left hover:underline cursor-pointer"
                  >
                    <span className="font-mono text-[11px] text-[#7A2346] dark:text-[#F1BBC8] shrink-0">
                      {target?.taskKey ?? id}
                    </span>
                    <span className="truncate text-[#3D1023] dark:text-[#FFF5F6]">
                      {target?.title ?? 'Unknown task'}
                    </span>
                    <span
                      className={`text-[11px] font-medium shrink-0 ${
                        isDone
                          ? 'text-[#21865B] dark:text-[#5FD09E]'
                          : 'text-[#D99A35] dark:text-[#F1BBC8]'
                      }`}
                    >
                      {isDone ? 'Done' : 'Open'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeBlockedBy(blockedBy.filter((b) => b !== id))}
                    aria-label="Remove blocker"
                    className="p-1 text-[#A58C98] hover:text-[#D94C65] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <select
            value={selectedBlocker}
            onChange={(e) => {
              setDepError(null);
              setSelectedBlocker(e.target.value);
            }}
            aria-label="Select blocking task"
            className="input-blush flex-1 px-2.5 py-1.5 text-xs"
          >
            <option value="">Select task that blocks this one...</option>
            {candidateTasks
              .filter((c) => !blockedBy.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.taskKey} — {c.title.slice(0, 50)}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!selectedBlocker}
            onClick={handleAddBlocker}
            className="btn-blush inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {blockingOtherTasks.length > 0 && (
        <div className="space-y-1.5">
          <span className="block text-[11px] font-medium text-[#795D6B] dark:text-[#D9B7C4]">
            Blocks ({blockingOtherTasks.length})
          </span>
          <div className="space-y-1">
            {blockingOtherTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onNavigateTask?.(t.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-white/70 dark:bg-[#2A0D19]/45 text-xs text-left hover:border-[#C86B88] cursor-pointer"
              >
                <span className="font-mono text-[11px] text-[#7A2346] dark:text-[#F1BBC8] shrink-0">
                  {t.taskKey}
                </span>
                <span className="truncate text-[#513443] dark:text-[#F8DDE3]">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 pt-3 border-t border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15">
        <label className="block text-[11px] font-medium text-[#795D6B] dark:text-[#D9B7C4]">
          Related Tasks
        </label>

        {relatedTaskIds.length > 0 && (
          <div className="space-y-1">
            {relatedTaskIds.map((id) => {
              const target = taskMap.get(id);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-[#FBEFF1]/75 dark:bg-[#2A0D19]/50 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => target && onNavigateTask?.(target.id)}
                    className="flex items-center gap-2 min-w-0 text-left hover:underline cursor-pointer"
                  >
                    <Link2 className="w-3 h-3 text-[#C86B88] shrink-0" />
                    <span className="font-mono text-[11px] text-[#7A2346] dark:text-[#F1BBC8] shrink-0">
                      {target?.taskKey ?? id}
                    </span>
                    <span className="truncate text-[#3D1023] dark:text-[#FFF5F6]">
                      {target?.title ?? 'Unknown task'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeRelated(relatedTaskIds.filter((r) => r !== id))}
                    aria-label="Remove related task"
                    className="p-1 text-[#A58C98] hover:text-[#D94C65] cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <select
            value={selectedRelated}
            onChange={(e) => setSelectedRelated(e.target.value)}
            aria-label="Select related task"
            className="input-blush flex-1 px-2.5 py-1.5 text-xs"
          >
            <option value="">Link a related task...</option>
            {candidateTasks
              .filter((c) => !relatedTaskIds.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.taskKey} — {c.title.slice(0, 50)}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!selectedRelated}
            onClick={handleAddRelated}
            className="btn-blush inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Link</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Columns2,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  BOARD_COLUMNS,
  TASK_PRIORITIES,
  type ProjectMember,
  type ProjectRole,
  type TaskCard,
  type TaskPriority,
  type TaskStatus,
} from '../types/pm';
import { formatMinutes, isOverdueTask } from '../lib/validationService';
import { Avatar } from './Avatar';
import { PriorityBadge } from './PriorityBadge';

interface TaskListViewProps {
  tasks: TaskCard[];
  members: ProjectMember[];
  currentUserRole: ProjectRole;
  onSelectTask: (task: TaskCard) => void;
  onQuickStatusChange: (task: TaskCard, newStatus: TaskStatus) => void;
  onBulkUpdate: (
    selectedTasks: TaskCard[],
    updates: {
      status?: TaskStatus;
      priority?: TaskPriority;
      assignee?: ProjectMember | null;
    }
  ) => Promise<void>;
  onBulkDelete: (taskIds: string[]) => Promise<void>;
  onOpenNewTask: () => void;
}

type SortField = 'taskKey' | 'title' | 'status' | 'priority' | 'dueDate' | 'logged';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const PAGE_SIZE = 25;

export function TaskListView({
  tasks,
  members,
  currentUserRole,
  onSelectTask,
  onQuickStatusChange,
  onBulkUpdate,
  onBulkDelete,
  onOpenNewTask,
}: TaskListViewProps) {
  const [sortField, setSortField] = useState<SortField>('taskKey');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [colsOpen, setColsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    assignee: true,
    due: true,
    logged: true,
    replies: true,
  });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const canBulkDelete = currentUserRole === 'owner' || currentUserRole === 'admin';

  const sortedTasks = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'taskKey') cmp = a.taskKey.localeCompare(b.taskKey);
      else if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortField === 'priority')
        cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      else if (sortField === 'dueDate')
        cmp = (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99');
      else if (sortField === 'logged')
        cmp = (a.actualMinutes ?? 0) - (b.actualMinutes ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [tasks, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedTasks = useMemo(
    () => sortedTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedTasks, safePage]
  );

  const selectedTasks = useMemo(
    () => tasks.filter((t) => selectedIds.has(t.id)),
    [tasks, selectedIds]
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleAllVisible = () => {
    const allSelected = pagedTasks.length > 0 && pagedTasks.every((t) => selectedIds.has(t.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedTasks.map((t) => t.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="glass-card p-8 max-w-sm text-center space-y-3">
          <p className="font-display text-sm font-bold text-[#3D1023] dark:text-[#FFF5F6]">
            No matching tasks found
          </p>
          <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
            Create a new task card or clear active filters to view sprint items.
          </p>
          <button
            type="button"
            onClick={onOpenNewTask}
            className="btn-burgundy inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3 sm:p-6 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
          Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedTasks.length)} of{' '}
          {sortedTasks.length} tasks
        </span>

        <div className="relative">
          <button
            type="button"
            onClick={() => setColsOpen((prev) => !prev)}
            className="btn-blush inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Columns</span>
          </button>
          {colsOpen && (
            <div className="absolute right-0 mt-1.5 w-44 glass-strong rounded-[16px] z-30 p-3 space-y-2">
              {(
                [
                  { key: 'assignee', label: 'Assignee' },
                  { key: 'due', label: 'Due Date' },
                  { key: 'logged', label: 'Logged Time' },
                  { key: 'replies', label: 'Comments' },
                ] as const
              ).map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 text-xs font-medium text-[#3D1023] dark:text-[#FFF5F6] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleCols[c.key]}
                    onChange={(e) =>
                      setVisibleCols((prev) => ({ ...prev, [c.key]: e.target.checked }))
                    }
                    className="rounded border-[#EAD7DE] dark:border-[#E9A8B8]/30 accent-[#7A2346]"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTasks.length > 0 && (
        <div className="p-3.5 rounded-[16px] border border-[#C86B88]/45 bg-[#FCE8EC]/85 dark:bg-[#5B1733]/70 backdrop-blur-[20px] flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-xs font-bold text-[#7A2346] dark:text-[#FFF5F6] tabular-nums">
            {selectedTasks.length} selected
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <select
              defaultValue=""
              disabled={bulkBusy}
              onChange={async (e) => {
                const status = e.target.value as TaskStatus;
                if (!status) return;
                setBulkBusy(true);
                try {
                  await onBulkUpdate(selectedTasks, { status });
                  setSelectedIds(new Set());
                } finally {
                  setBulkBusy(false);
                  e.target.value = '';
                }
              }}
              aria-label="Bulk change status"
              className="input-blush px-2.5 py-1 text-xs"
            >
              <option value="">Set status...</option>
              {BOARD_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              defaultValue=""
              disabled={bulkBusy}
              onChange={async (e) => {
                const priority = e.target.value as TaskPriority;
                if (!priority) return;
                setBulkBusy(true);
                try {
                  await onBulkUpdate(selectedTasks, { priority });
                  setSelectedIds(new Set());
                } finally {
                  setBulkBusy(false);
                  e.target.value = '';
                }
              }}
              aria-label="Bulk change priority"
              className="input-blush px-2.5 py-1 text-xs"
            >
              <option value="">Set priority...</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>

            <select
              defaultValue=""
              disabled={bulkBusy}
              onChange={async (e) => {
                const val = e.target.value;
                if (!val) return;
                const assignee =
                  val === '__unassigned__' ? null : members.find((m) => m.uid === val) ?? null;
                setBulkBusy(true);
                try {
                  await onBulkUpdate(selectedTasks, { assignee });
                  setSelectedIds(new Set());
                } finally {
                  setBulkBusy(false);
                  e.target.value = '';
                }
              }}
              aria-label="Bulk assign"
              className="input-blush px-2.5 py-1 text-xs"
            >
              <option value="">Assign to...</option>
              <option value="__unassigned__">Unassigned</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName}
                </option>
              ))}
            </select>

            {canBulkDelete && !confirmBulkDelete && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-[12px] border border-[#D94C65]/40 text-[#D94C65] hover:bg-[#D94C65]/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            {confirmBulkDelete && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    setBulkBusy(true);
                    try {
                      await onBulkDelete(selectedTasks.map((t) => t.id));
                      setSelectedIds(new Set());
                      setConfirmBulkDelete(false);
                    } finally {
                      setBulkBusy(false);
                    }
                  }}
                  className="px-3 py-1 text-xs font-semibold rounded-[12px] bg-[#D94C65] hover:bg-[#B9354D] text-white cursor-pointer"
                >
                  Confirm Delete ({selectedTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(false)}
                  className="px-2 py-1 text-xs font-medium text-[#513443] dark:text-[#D9B7C4] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EAD7DE] dark:border-[#E9A8B8]/15 bg-[#FBEFF1]/85 dark:bg-[#2A0D19]/65 text-xs font-bold text-[#7A2346] dark:text-[#F1BBC8]">
                <th className="py-3 px-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={
                      pagedTasks.length > 0 && pagedTasks.every((t) => selectedIds.has(t.id))
                    }
                    onChange={toggleAllVisible}
                    aria-label="Select all visible tasks"
                    className="rounded border-[#EAD7DE] dark:border-[#E9A8B8]/30 accent-[#7A2346]"
                  />
                </th>
                <th className="py-3 px-3.5 w-24">
                  <button
                    type="button"
                    onClick={() => toggleSort('taskKey')}
                    className="inline-flex items-center gap-1 hover:text-[#5B1733] dark:hover:text-white cursor-pointer"
                  >
                    <span>Key</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5">
                  <button
                    type="button"
                    onClick={() => toggleSort('title')}
                    className="inline-flex items-center gap-1 hover:text-[#5B1733] dark:hover:text-white cursor-pointer"
                  >
                    <span>Title</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5 w-36">
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-1 hover:text-[#5B1733] dark:hover:text-white cursor-pointer"
                  >
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3.5 w-28">
                  <button
                    type="button"
                    onClick={() => toggleSort('priority')}
                    className="inline-flex items-center gap-1 hover:text-[#5B1733] dark:hover:text-white cursor-pointer"
                  >
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {visibleCols.assignee && <th className="py-3 px-3.5 w-44">Assignee</th>}
                {visibleCols.due && (
                  <th className="py-3 px-3.5 w-28 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('dueDate')}
                      className="inline-flex items-center gap-1 hover:text-[#5B1733] dark:hover:text-white cursor-pointer"
                    >
                      <span>Due</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {visibleCols.logged && (
                  <th className="py-3 px-3.5 w-24 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('logged')}
                      className="inline-flex items-center gap-1 hover:text-[#5B1733] dark:hover:text-white cursor-pointer"
                    >
                      <span>Logged</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                {visibleCols.replies && <th className="py-3 px-3.5 w-20 text-right">Replies</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAD7DE]/65 dark:divide-[#E9A8B8]/12 text-sm">
              {pagedTasks.map((task) => {
                const overdue = isOverdueTask(task);
                return (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="hover:bg-[#FCE8EC]/70 dark:hover:bg-[#8F3157]/20 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(task.id)}
                        onChange={() => toggleOne(task.id)}
                        aria-label={`Select ${task.taskKey}`}
                        className="rounded border-[#EAD7DE] dark:border-[#E9A8B8]/30 accent-[#7A2346]"
                      />
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-xs font-semibold text-[#8F3157] dark:text-[#F1BBC8] tabular-nums whitespace-nowrap">
                      {task.taskKey}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="font-medium text-[#3D1023] dark:text-[#FFF5F6] truncate max-w-md">
                        {task.title}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.status}
                        onChange={(e) =>
                          onQuickStatusChange(task, e.target.value as TaskStatus)
                        }
                        aria-label={`Change status for ${task.taskKey}`}
                        className="input-blush text-xs px-2.5 py-1 cursor-pointer"
                      >
                        {BOARD_COLUMNS.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3.5">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    {visibleCols.assignee && (
                      <td className="py-2.5 px-3.5">
                        {task.assigneeUid ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar
                              name={task.assigneeName || 'User'}
                              photoURL={task.assigneePhoto}
                              size="xs"
                            />
                            <span className="text-xs text-[#513443] dark:text-[#F8DDE3] truncate">
                              {task.assigneeName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#A58C98] dark:text-[#B891A1]">
                            Unassigned
                          </span>
                        )}
                      </td>
                    )}
                    {visibleCols.due && (
                      <td
                        className={`py-2.5 px-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap ${
                          overdue
                            ? 'text-[#D94C65] dark:text-[#F68398] font-semibold'
                            : 'text-[#795D6B] dark:text-[#D9B7C4]'
                        }`}
                      >
                        {task.dueDate || '—'}
                      </td>
                    )}
                    {visibleCols.logged && (
                      <td className="py-2.5 px-3.5 text-right font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums whitespace-nowrap">
                        {formatMinutes(task.actualMinutes)}
                      </td>
                    )}
                    {visibleCols.replies && (
                      <td className="py-2.5 px-3.5 text-right font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>{task.commentCount}</span>
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn-blush px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <span className="font-mono text-xs font-semibold text-[#7A2346] dark:text-[#F1BBC8] tabular-nums">
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="btn-blush px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

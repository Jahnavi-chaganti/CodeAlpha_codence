import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Check,
  Pencil,
  Repeat,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import {
  computeNextRecurrenceDate,
  getIncompleteBlockers,
  localTodayIso,
} from '../lib/validationService';
import {
  BOARD_COLUMNS,
  LIMITS,
  TASK_PRIORITIES,
  type Milestone,
  type ProjectActivity,
  type ProjectMember,
  type ProjectRole,
  type RecurrenceConfig,
  type RecurrenceFrequency,
  type Sprint,
  type SubtaskItem,
  type TaskCard,
  type TaskComment,
  type TaskPriority,
  type TaskStatus,
} from '../types/pm';
import { Avatar } from './Avatar';
import { SubtaskList } from './SubtaskList';
import { TaskDependencies } from './TaskDependencies';
import { TaskAttachments } from './TaskAttachments';
import { TimeTracker } from './TimeTracker';

interface TaskDetailDrawerProps {
  task: TaskCard | null;
  allTasks: TaskCard[];
  sprints: Sprint[];
  milestones: Milestone[];
  activities: ProjectActivity[];
  projectId: string;
  projectName: string;
  members: ProjectMember[];
  currentUser: User;
  currentUserRole: ProjectRole;
  onClose: () => void;
  onSelectOtherTask: (taskId: string) => void;
  onSaveTask: (updates: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    position: number;
    assignee: ProjectMember | null;
    tags: string[];
    dueDate: string;
    startDate: string;
    sprintId: string;
    milestoneId: string;
    estimatedMinutes: number;
    subtasks: SubtaskItem[];
    blockedBy: string[];
    relatedTaskIds: string[];
    recurrence: RecurrenceConfig | null;
    overrideReason: string;
  }) => Promise<void>;
  onDeleteTask: (task: TaskCard) => Promise<void>;
  onGenerateNextRecurrence: (task: TaskCard) => Promise<void>;
  onAddComment: (task: TaskCard, body: string, notifyUids: string[]) => Promise<void>;
  onUpdateComment: (taskId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (taskId: string, commentId: string) => Promise<void>;
}

type DrawerTab = 'overview' | 'subtasks' | 'time_files' | 'discussion';

function formatTimestamp(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return 'Just now';
  const seconds = (ts as { seconds?: number }).seconds;
  if (typeof seconds !== 'number') return 'Just now';
  return new Date(seconds * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderCommentWithMentions(body: string, members: ProjectMember[]) {
  const names = members.map((m) => `@${m.displayName}`).filter(Boolean);
  if (names.length === 0 || !body.includes('@')) {
    return body;
  }
  const escaped = names
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = body.split(regex);
  return parts.map((part, idx) =>
    part.startsWith('@') && names.some((n) => n.toLowerCase() === part.toLowerCase()) ? (
      <span
        key={idx}
        className="font-semibold text-[#7A2346] dark:text-[#F1BBC8] bg-[#FCE8EC] dark:bg-[#8F3157]/40 px-1.5 py-0.5 rounded-[6px]"
      >
        {part}
      </span>
    ) : (
      <span key={idx}>{part}</span>
    )
  );
}

export function TaskDetailDrawer({
  task,
  allTasks,
  sprints,
  milestones,
  activities,
  projectId,
  members,
  currentUser,
  currentUserRole,
  onClose,
  onSelectOtherTask,
  onSaveTask,
  onDeleteTask,
  onGenerateNextRecurrence,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: TaskDetailDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeUid, setAssigneeUid] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('0');
  const [tagsInput, setTagsInput] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [relatedTaskIds, setRelatedTaskIds] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState('');

  const [recActive, setRecActive] = useState(false);
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('weekly');
  const [recInterval, setRecInterval] = useState('1');
  const [recStart, setRecStart] = useState('');
  const [recEnd, setRecEnd] = useState('');

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTab('overview');
    setTitle(task.title);
    setDescription(task.description);
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeUid(task.assigneeUid);
    setStartDate(task.startDate ?? '');
    setDueDate(task.dueDate);
    setSprintId(task.sprintId ?? '');
    setMilestoneId(task.milestoneId ?? '');
    setEstimatedMinutes(String(task.estimatedMinutes ?? 0));
    setTagsInput((task.tags ?? []).join(', '));
    setSubtasks(task.subtasks ?? []);
    setBlockedBy(task.blockedBy ?? []);
    setRelatedTaskIds(task.relatedTaskIds ?? []);
    setOverrideReason(task.overrideReason ?? '');

    if (task.recurrence) {
      setRecActive(task.recurrence.active);
      setRecFreq(task.recurrence.frequency);
      setRecInterval(String(task.recurrence.interval || 1));
      setRecStart(task.recurrence.startDate || localTodayIso());
      setRecEnd(task.recurrence.endDate || '');
    } else {
      setRecActive(false);
      setRecFreq('weekly');
      setRecInterval('1');
      setRecStart(localTodayIso());
      setRecEnd('');
    }

    setConfirmDelete(false);
    setEditingCommentId(null);
    setError(null);
  }, [task]);

  useEffect(() => {
    if (!task) {
      setComments([]);
      return;
    }

    const path = `projects/${projectId}/tasks/${task.id}/comments`;
    const q = query(
      collection(db, 'projects', projectId, 'tasks', task.id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => d.data() as TaskComment));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );

    return () => unsub();
  }, [projectId, task?.id]);

  const taskActivities = useMemo(() => {
    if (!task) return [];
    return activities.filter((a) => a.taskId === task.id).slice(0, 20);
  }, [activities, task]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => m.displayName.toLowerCase().includes(q)).slice(0, 6);
  }, [members, mentionQuery]);

  if (!task) return null;

  const canDeleteTask =
    task.createdBy === currentUser.uid ||
    currentUserRole === 'owner' ||
    currentUserRole === 'admin';
  const canOverrideDependencies =
    currentUserRole === 'owner' || currentUserRole === 'admin';

  const incompleteBlockers = getIncompleteBlockers({ ...task, blockedBy }, allTasks);
  const blockedMoveAttempt =
    incompleteBlockers.length > 0 && (status === 'in_progress' || status === 'done');

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      setError('Due date cannot be earlier than start date.');
      return;
    }
    if (blockedMoveAttempt) {
      if (!canOverrideDependencies) {
        setError(
          `Blocked by ${incompleteBlockers.map((b) => b.taskKey).join(', ')}. Complete blockers first or ask a project admin to override.`
        );
        return;
      }
      if (!overrideReason.trim()) {
        setError(
          'This task has incomplete blockers. Enter an admin override reason to proceed.'
        );
        return;
      }
    }

    setSaving(true);
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((s) => s.trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, LIMITS.TAGS_MAX);
      const assignee = members.find((m) => m.uid === assigneeUid) ?? null;

      let recurrence: RecurrenceConfig | null = null;
      if (recActive) {
        const safeInterval = Math.max(1, Math.min(365, Number(recInterval) || 1));
        const baseStart = recStart || dueDate || localTodayIso();
        recurrence = {
          frequency: recFreq,
          interval: safeInterval,
          startDate: baseStart,
          endDate: recEnd,
          nextRunDate:
            task.recurrence?.nextRunDate ||
            computeNextRecurrenceDate(dueDate || baseStart, recFreq, safeInterval),
          active: true,
        };
      }

      await onSaveTask({
        title: title.trim(),
        description,
        status,
        priority,
        position: task.position,
        assignee,
        tags: parsedTags,
        dueDate,
        startDate,
        sprintId,
        milestoneId,
        estimatedMinutes: Math.max(0, Math.round(Number(estimatedMinutes) || 0)),
        subtasks,
        blockedBy,
        relatedTaskIds,
        recurrence,
        overrideReason: blockedMoveAttempt ? overrideReason.trim() : overrideReason,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCommentInputChange = (val: string) => {
    setCommentBody(val);
    const match = val.match(/(?:^|\s)@([a-zA-Z0-9_ ]{0,24})$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: ProjectMember) => {
    const replaced = commentBody.replace(
      /(?:^|\s)@([a-zA-Z0-9_ ]{0,24})$/,
      (full) => `${full.startsWith(' ') ? ' ' : ''}@${member.displayName} `
    );
    setCommentBody(replaced);
    setMentionQuery(null);
  };

  const handlePostComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    setError(null);
    try {
      const notifyUids = [task.assigneeUid, task.createdBy].filter(Boolean);
      await onAddComment(task, commentBody.trim(), notifyUids);
      setCommentBody('');
      setMentionQuery(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#2A0D19]/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Task ${task.taskKey}`}
        className="relative z-10 w-full max-w-2xl h-full glass-strong rounded-l-[20px] border-l border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex flex-col"
      >
        <div className="px-5 sm:px-6 py-4 border-b border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#795D6B] dark:text-[#D9B7C4]">
              <span className="font-mono font-semibold text-[#7A2346] dark:text-[#F1BBC8]">
                {task.taskKey}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">Reporter: {task.createdByName}</span>
            </div>
            <p className="text-[11px] text-[#A58C98] dark:text-[#B891A1] mt-0.5 tabular-nums">
              Created {formatTimestamp(task.createdAt)} · Updated {formatTimestamp(task.updatedAt)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canDeleteTask && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                title="Delete task"
                aria-label="Delete task"
                className="p-2 rounded-[10px] text-[#A58C98] hover:text-[#D94C65] hover:bg-[#D94C65]/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close task drawer"
              className="p-2 rounded-[10px] text-[#795D6B] hover:text-[#3D1023] hover:bg-[#FCE8EC] dark:text-[#D9B7C4] dark:hover:text-[#FFF5F6] dark:hover:bg-[#5B1733]/50 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 pt-2.5 border-b border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 flex items-center gap-1 overflow-x-auto shrink-0">
          {(
            [
              { id: 'overview', label: 'Overview' },
              {
                id: 'subtasks',
                label: `Subtasks & Deps (${subtasks.length + blockedBy.length})`,
              },
              { id: 'time_files', label: 'Time & Files' },
              { id: 'discussion', label: `Comments (${comments.length})` },
            ] as { id: DrawerTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                tab === t.id
                  ? 'border-[#7A2346] text-[#7A2346] dark:border-[#E9A8B8] dark:text-[#FFF5F6]'
                  : 'border-transparent text-[#795D6B] dark:text-[#D9B7C4] hover:text-[#3D1023] dark:hover:text-[#FFF5F6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {confirmDelete && (
          <div className="px-6 py-3 bg-[#D94C65]/10 border-b border-[#D94C65]/30 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs font-semibold text-[#D94C65] dark:text-[#F1BBC8]">
              Permanently delete {task.taskKey}?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-blush px-2.5 py-1 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDeleteTask(task);
                    onClose();
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="px-3 py-1 text-xs font-semibold rounded-[10px] bg-[#D94C65] hover:bg-[#C23953] text-white cursor-pointer disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]"
            >
              {error}
            </div>
          )}

          {tab === 'overview' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  maxLength={LIMITS.TASK_TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="input-blush w-full px-3.5 py-2 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="input-blush w-full px-3 py-2 text-xs"
                  >
                    {BOARD_COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="input-blush w-full px-3 py-2 text-xs"
                  >
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={assigneeUid}
                    onChange={(e) => setAssigneeUid(e.target.value)}
                    className="input-blush w-full px-3 py-2 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                    Estimated effort (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    className="input-blush w-full px-3 py-2 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-blush w-full px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="input-blush w-full px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                    Sprint
                  </label>
                  <select
                    value={sprintId}
                    onChange={(e) => setSprintId(e.target.value)}
                    className="input-blush w-full px-3 py-2 text-xs"
                  >
                    <option value="">Backlog (No Sprint)</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                    Milestone
                  </label>
                  <select
                    value={milestoneId}
                    onChange={(e) => setMilestoneId(e.target.value)}
                    className="input-blush w-full px-3 py-2 text-xs"
                  >
                    <option value="">No milestone</option>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.dueDate})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {blockedMoveAttempt && (
                <div className="p-3 rounded-[14px] border border-[#D99A35]/40 bg-[#D99A35]/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C17A43] dark:text-[#F1BBC8]">
                    <ShieldAlert className="w-4 h-4" />
                    <span>
                      Blocked by {incompleteBlockers.map((b) => b.taskKey).join(', ')}
                    </span>
                  </div>
                  {canOverrideDependencies ? (
                    <input
                      type="text"
                      value={overrideReason}
                      maxLength={300}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Admin override reason (required to move while blocked)..."
                      className="input-blush w-full px-3 py-1.5 text-xs"
                    />
                  ) : (
                    <p className="text-[11px] text-[#C17A43] dark:text-[#F1BBC8]">
                      Complete blocking tasks first, or ask an Owner/Admin to override.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                  Tags (comma separated, max 5)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="frontend, auth, sprint-4"
                  className="input-blush w-full px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  maxLength={LIMITS.TASK_DESC_MAX}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add acceptance criteria, implementation notes, or links..."
                  className="input-blush w-full px-3.5 py-2.5 text-sm resize-y"
                />
              </div>

              <div className="p-3.5 rounded-[16px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-[#FCE8EC]/55 dark:bg-[#2A0D19]/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recActive}
                      onChange={(e) => setRecActive(e.target.checked)}
                      className="rounded border-[#C86B88] accent-[#7A2346]"
                    />
                    <Repeat className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
                    <span>Recurring schedule</span>
                  </label>
                  {task.recurrence?.active && (
                    <button
                      type="button"
                      onClick={() => onGenerateNextRecurrence(task)}
                      className="text-[11px] font-medium text-[#7A2346] dark:text-[#F1BBC8] hover:underline cursor-pointer"
                    >
                      Generate next instance now
                    </button>
                  )}
                </div>

                {recActive && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[11px] text-[#795D6B] dark:text-[#D9B7C4] mb-1">
                        Frequency
                      </label>
                      <select
                        value={recFreq}
                        onChange={(e) => setRecFreq(e.target.value as RecurrenceFrequency)}
                        className="input-blush w-full px-2 py-1.5 text-xs"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom (days)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#795D6B] dark:text-[#D9B7C4] mb-1">
                        Interval
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={recInterval}
                        onChange={(e) => setRecInterval(e.target.value)}
                        className="input-blush w-full px-2 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#795D6B] dark:text-[#D9B7C4] mb-1">
                        Start
                      </label>
                      <input
                        type="date"
                        value={recStart}
                        onChange={(e) => setRecStart(e.target.value)}
                        className="input-blush w-full px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#795D6B] dark:text-[#D9B7C4] mb-1">
                        End (opt)
                      </label>
                      <input
                        type="date"
                        value={recEnd}
                        onChange={(e) => setRecEnd(e.target.value)}
                        className="input-blush w-full px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-burgundy px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          )}

          {tab === 'subtasks' && (
            <div className="space-y-6">
              <SubtaskList subtasks={subtasks} onChange={setSubtasks} />

              <div className="pt-4 border-t border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15">
                <TaskDependencies
                  task={task}
                  allTasks={allTasks}
                  blockedBy={blockedBy}
                  relatedTaskIds={relatedTaskIds}
                  onChangeBlockedBy={setBlockedBy}
                  onChangeRelated={setRelatedTaskIds}
                  onNavigateTask={onSelectOtherTask}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="btn-burgundy px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Subtasks & Dependencies'}
                </button>
              </div>
            </div>
          )}

          {tab === 'time_files' && (
            <div className="space-y-8">
              <TimeTracker
                projectId={projectId}
                task={task}
                currentUser={currentUser}
                currentUserRole={currentUserRole}
              />

              <div className="pt-6 border-t border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15">
                <TaskAttachments
                  projectId={projectId}
                  taskId={task.id}
                  currentUser={currentUser}
                  currentUserRole={currentUserRole}
                />
              </div>
            </div>
          )}

          {tab === 'discussion' && (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                    Comments &amp; @Mentions
                  </h3>
                  <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                    {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
                  </span>
                </div>

                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
                      No comments yet. Use @name to mention a teammate.
                    </p>
                  ) : (
                    comments.map((comment) => {
                      const isAuthor = comment.authorUid === currentUser.uid;
                      const canDeleteComment =
                        isAuthor ||
                        currentUserRole === 'owner' ||
                        currentUserRole === 'admin';
                      return (
                        <div key={comment.id} className="flex items-start gap-3">
                          <Avatar
                            name={comment.authorName}
                            photoURL={comment.authorPhoto}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6] truncate">
                                  {comment.authorName}
                                </span>
                                <span className="text-[11px] text-[#A58C98] dark:text-[#B891A1] tabular-nums shrink-0">
                                  {formatTimestamp(comment.createdAt)}
                                  {comment.edited ? ' · edited' : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isAuthor && editingCommentId !== comment.id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditingCommentBody(comment.body);
                                    }}
                                    title="Edit comment"
                                    className="text-[#A58C98] hover:text-[#7A2346] dark:hover:text-[#F1BBC8] p-1 cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                                {canDeleteComment && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteComment(task.id, comment.id)}
                                    title="Delete comment"
                                    className="text-[#A58C98] hover:text-[#D94C65] p-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {editingCommentId === comment.id ? (
                              <div className="mt-1.5 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingCommentBody}
                                  maxLength={LIMITS.COMMENT_BODY_MAX}
                                  onChange={(e) => setEditingCommentBody(e.target.value)}
                                  className="input-blush flex-1 px-2.5 py-1.5 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!editingCommentBody.trim()) return;
                                    await onUpdateComment(
                                      task.id,
                                      comment.id,
                                      editingCommentBody.trim()
                                    );
                                    setEditingCommentId(null);
                                  }}
                                  className="p-1.5 rounded-[8px] bg-[#21865B] text-white cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCommentId(null)}
                                  className="p-1.5 text-[#A58C98] cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-[#513443] dark:text-[#F8DDE3] leading-relaxed whitespace-pre-wrap">
                                {renderCommentWithMentions(comment.body, members)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="relative">
                  {mentionCandidates.length > 0 && (
                    <div className="mb-2 glass-strong rounded-[14px] p-1.5 space-y-0.5">
                      <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-[#795D6B] dark:text-[#D9B7C4]">
                        Mention teammate
                      </p>
                      {mentionCandidates.map((m) => (
                        <button
                          key={m.uid}
                          type="button"
                          onClick={() => insertMention(m)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[10px] text-xs text-left hover:bg-[#FCE8EC] dark:hover:bg-[#5B1733]/50 cursor-pointer"
                        >
                          <Avatar name={m.displayName} photoURL={m.photoURL} size="xs" />
                          <span className="font-medium text-[#3D1023] dark:text-[#FFF5F6]">
                            {m.displayName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handlePostComment} className="pt-1 flex gap-2.5 items-start">
                    <textarea
                      rows={2}
                      value={commentBody}
                      maxLength={LIMITS.COMMENT_BODY_MAX}
                      onChange={(e) => handleCommentInputChange(e.target.value)}
                      placeholder="Write a comment... Type @ to mention teammates"
                      className="input-blush flex-1 px-3.5 py-2 text-xs resize-none"
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !commentBody.trim()}
                      className="btn-burgundy inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              </section>

              {taskActivities.length > 0 && (
                <section className="pt-5 border-t border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 space-y-3">
                  <h4 className="text-xs font-semibold text-[#513443] dark:text-[#F8DDE3]">
                    Task Audit History
                  </h4>
                  <ul className="space-y-2">
                    {taskActivities.map((act) => (
                      <li
                        key={act.id}
                        className="text-xs text-[#795D6B] dark:text-[#D9B7C4] flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          <strong className="font-medium text-[#3D1023] dark:text-[#FFF5F6]">
                            {act.actorName}
                          </strong>{' '}
                          {act.summary}
                        </span>
                        <span className="text-[11px] text-[#A58C98] dark:text-[#B891A1] tabular-nums shrink-0">
                          {formatTimestamp(act.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

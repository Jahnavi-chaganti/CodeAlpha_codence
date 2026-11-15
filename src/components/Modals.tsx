import { useState, type FormEvent } from 'react';
import { Check, Copy, KeyRound, ShieldAlert, Trash2, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  BOARD_COLUMNS,
  LIMITS,
  TASK_PRIORITIES,
  type Milestone,
  type Project,
  type ProjectMember,
  type ProjectRole,
  type ProjectTemplate,
  type Sprint,
  type TaskCard,
  type TaskPriority,
  type TaskStatus,
} from '../types/pm';
import { roleLabel } from '../lib/firestoreService';
import { Avatar } from './Avatar';
import { ProjectTemplates } from './ProjectTemplates';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({ title, subtitle, onClose, children }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#2A0D19]/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col glass-strong rounded-[20px] overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-display text-base font-bold text-[#3D1023] dark:text-[#FFF5F6]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-[10px] text-[#795D6B] hover:text-[#3D1023] hover:bg-[#FCE8EC] dark:text-[#D9B7C4] dark:hover:text-[#FFF5F6] dark:hover:bg-[#5B1733]/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

interface CreateProjectModalProps {
  customTemplates: ProjectTemplate[];
  onDeleteCustomTemplate: (id: string) => void;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    key: string;
    description: string;
    includeStarterTasks: boolean;
    template?: ProjectTemplate | null;
  }) => Promise<void>;
}

export function CreateProjectModal({
  customTemplates,
  onDeleteCustomTemplate,
  onClose,
  onSubmit,
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [includeStarterTasks, setIncludeStarterTasks] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!keyEdited) {
      const derived = val
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 4);
      if (derived.length >= 2) {
        setKey(derived);
      } else {
        setKey(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
      }
    }
  };

  const handleSelectTemplate = (tpl: ProjectTemplate | null) => {
    setSelectedTemplate(tpl);
    if (tpl) {
      if (!name.trim()) setName(tpl.name);
      if (!keyEdited) setKey(tpl.suggestedKey);
      if (!description.trim()) setDescription(tpl.description);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    if (cleanKey.length < 2 || cleanKey.length > 6) {
      setError('Project key must be 2–6 uppercase letters or digits.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        key: cleanKey,
        description: description.trim(),
        includeStarterTasks: selectedTemplate ? false : includeStarterTasks,
        template: selectedTemplate,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Create Project"
      subtitle="Launch from a curated template or set up a custom Kanban workspace."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]">
            {error}
          </div>
        )}

        <ProjectTemplates
          customTemplates={customTemplates}
          selectedTemplateId={selectedTemplate?.id ?? null}
          onSelectTemplate={handleSelectTemplate}
          onDeleteCustomTemplate={onDeleteCustomTemplate}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
              Project name
            </label>
            <input
              type="text"
              value={name}
              maxLength={LIMITS.PROJECT_NAME_MAX}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Core Platform Q4"
              required
              autoFocus
              className="input-blush w-full px-3.5 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
              Key
            </label>
            <input
              type="text"
              value={key}
              maxLength={LIMITS.PROJECT_KEY_MAX}
              onChange={(e) => {
                setKeyEdited(true);
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              }}
              placeholder="CORE"
              required
              className="input-blush w-full px-3.5 py-2 font-mono text-sm uppercase"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
            Description
          </label>
          <textarea
            rows={2}
            value={description}
            maxLength={LIMITS.PROJECT_DESC_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Goals, sprint scope, or repository link..."
            className="input-blush w-full px-3.5 py-2 text-sm resize-none"
          />
        </div>

        {!selectedTemplate && (
          <label className="flex items-center gap-2.5 text-xs text-[#513443] dark:text-[#F8DDE3] cursor-pointer">
            <input
              type="checkbox"
              checked={includeStarterTasks}
              onChange={(e) => setIncludeStarterTasks(e.target.checked)}
              className="rounded border-[#C86B88] accent-[#7A2346]"
            />
            <span>Seed board with starter sprint tasks across all columns</span>
          </label>
        )}

        <div className="pt-2 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-blush px-4 py-2 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-burgundy px-4 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface CreateTaskModalProps {
  initialStatus: TaskStatus;
  initialDueDate?: string;
  members: ProjectMember[];
  sprints: Sprint[];
  milestones: Milestone[];
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee: ProjectMember | null;
    tags: string[];
    dueDate: string;
    startDate: string;
    sprintId: string;
    milestoneId: string;
    estimatedMinutes: number;
  }) => Promise<void>;
}

export function CreateTaskModal({
  initialStatus,
  initialDueDate = '',
  members,
  sprints,
  milestones,
  onClose,
  onSubmit,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeUid, setAssigneeUid] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [sprintId, setSprintId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
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
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((s) => s.trim().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, LIMITS.TAGS_MAX);
      const assignee = members.find((m) => m.uid === assigneeUid) ?? null;

      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assignee,
        tags,
        dueDate,
        startDate,
        sprintId,
        milestoneId,
        estimatedMinutes: Math.max(0, Math.round(Number(estimatedMinutes) || 0)),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="New Task Card"
      subtitle="Add a tracked work item to the active project."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={title}
            maxLength={LIMITS.TASK_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Implement WebSocket reconnect queue"
            required
            autoFocus
            className="input-blush w-full px-3.5 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
              Column
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
              Estimated effort (min)
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

          {sprints.length > 0 && (
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
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {milestones.length > 0 && (
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
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="api, design, release"
            className="input-blush w-full px-3.5 py-2 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            value={description}
            maxLength={LIMITS.TASK_DESC_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Scope, edge cases, or links..."
            className="input-blush w-full px-3.5 py-2 text-sm resize-none"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-blush px-4 py-2 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-burgundy px-4 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface TeamInviteModalProps {
  project: Project;
  members: ProjectMember[];
  currentUser: User;
  currentUserRole: ProjectRole;
  onClose: () => void;
  onOpenFullTeamView: () => void;
  onCreateInvite: (params: {
    role: 'admin' | 'member';
    singleUse: boolean;
    maxUses: number;
    expiresInDays: number;
    invitedEmail?: string;
  }) => Promise<string>;
  onUpdateRole: (memberUid: string, role: 'admin' | 'member') => Promise<void>;
  onRemoveMember: (memberUid: string) => Promise<void>;
}

export function TeamInviteModal({
  project,
  members,
  currentUser,
  currentUserRole,
  onClose,
  onOpenFullTeamView,
  onCreateInvite,
  onUpdateRole,
  onRemoveMember,
}: TeamInviteModalProps) {
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [singleUse, setSingleUse] = useState(true);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageInvites = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = currentUserRole === 'owner';

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const code = await onCreateInvite({
        role: inviteRole,
        singleUse,
        maxUses: singleUse ? 1 : 10,
        expiresInDays: 7,
      });
      setGeneratedCode(code);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate invite code.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <ModalShell
      title={`${project.name} Team`}
      subtitle="Share expiring 12-character invite codes or manage member roles."
      onClose={onClose}
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]">
            {error}
          </div>
        )}

        {canManageInvites && (
          <div className="p-4 rounded-[16px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-[#FCE8EC]/55 dark:bg-[#2A0D19]/50 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                Quick Invite Code (7-day expiry)
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullTeamView();
                }}
                className="text-[11px] font-medium text-[#7A2346] dark:text-[#F1BBC8] hover:underline cursor-pointer"
              >
                Advanced invite options
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="input-blush px-3 py-2 text-xs"
              >
                <option value="member">Role: Member</option>
                <option value="admin">Role: Admin</option>
              </select>

              <label className="inline-flex items-center gap-1.5 text-xs text-[#513443] dark:text-[#F8DDE3] cursor-pointer px-2">
                <input
                  type="checkbox"
                  checked={singleUse}
                  onChange={(e) => setSingleUse(e.target.checked)}
                  className="rounded border-[#C86B88] accent-[#7A2346]"
                />
                <span>Single-use</span>
              </label>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="btn-burgundy flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{generating ? 'Generating...' : 'Generate Code'}</span>
              </button>
            </div>

            {generatedCode && (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-[12px] border border-[#C86B88]/40 bg-white/85 dark:bg-[#2A0D19]/75">
                <div>
                  <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
                    Case-sensitive invite code:
                  </p>
                  <p className="font-mono text-base font-bold tracking-wider text-[#7A2346] dark:text-[#F1BBC8]">
                    {generatedCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-blush inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#21865B] dark:text-[#5FD09E]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#513443] dark:text-[#F8DDE3]">
              Members
            </h3>
            <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
              {members.length}
            </span>
          </div>

          <div className="divide-y divide-[#EAD7DE]/80 dark:divide-[#E9A8B8]/15 max-h-56 overflow-y-auto">
            {members.map((m) => (
              <div key={m.uid} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={m.displayName} photoURL={m.photoURL} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#3D1023] dark:text-[#FFF5F6] truncate">
                      {m.displayName}
                      {m.uid === currentUser.uid ? ' (You)' : ''}
                    </p>
                    <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
                      {roleLabel(m.role)}
                    </p>
                  </div>
                </div>

                {isOwner && m.uid !== currentUser.uid && m.role !== 'owner' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        onUpdateRole(m.uid, e.target.value as 'admin' | 'member')
                      }
                      aria-label={`Role for ${m.displayName}`}
                      className="input-blush px-2 py-1 text-xs"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onRemoveMember(m.uid)}
                      title="Remove member"
                      className="p-1.5 rounded-[8px] text-[#A58C98] hover:text-[#D94C65] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

interface JoinProjectModalProps {
  onClose: () => void;
  onSubmit: (inviteCode: string) => Promise<void>;
}

export function JoinProjectModal({ onClose, onSubmit }: JoinProjectModalProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = code.trim();
    if (cleaned.length < 10) {
      setError('Enter a valid 12-character invite code.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(cleaned);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Join Team Project"
      subtitle="Enter the case-sensitive invite code shared by a project admin or owner."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1.5">
            Invite code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            placeholder="e.g. aB9kM2pQx7Rz"
            required
            autoFocus
            className="input-blush w-full px-3.5 py-2.5 font-mono text-sm tracking-wider"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-blush px-4 py-2 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-burgundy px-4 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Joining...' : 'Join Project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface DependencyOverrideModalProps {
  task: TaskCard;
  blockers: TaskCard[];
  canOverride: boolean;
  onCancel: () => void;
  onConfirmOverride: (reason: string) => Promise<void>;
}

export function DependencyOverrideModal({
  task,
  blockers,
  canOverride,
  onCancel,
  onConfirmOverride,
}: DependencyOverrideModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalShell
      title={`Task ${task.taskKey} is Blocked`}
      subtitle="Incomplete prerequisite tasks detected."
      onClose={onCancel}
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-[14px] border border-[#D99A35]/40 bg-[#D99A35]/10 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#C17A43] dark:text-[#F1BBC8]">
            <ShieldAlert className="w-4 h-4" />
            <span>Open Blockers</span>
          </div>
          <ul className="text-xs text-[#513443] dark:text-[#F8DDE3] space-y-1">
            {blockers.map((b) => (
              <li key={b.id}>
                <span className="font-mono font-semibold text-[#7A2346] dark:text-[#F1BBC8]">
                  {b.taskKey}
                </span>{' '}
                — {b.title}
              </li>
            ))}
          </ul>
        </div>

        {canOverride ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!reason.trim()) return;
              setSubmitting(true);
              try {
                await onConfirmOverride(reason.trim());
              } finally {
                setSubmitting(false);
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-[#513443] dark:text-[#F8DDE3] mb-1">
                Admin Override Reason (required)
              </label>
              <input
                type="text"
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Hotfix approved by lead; dependency decoupled"
                required
                autoFocus
                className="input-blush w-full px-3.5 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="btn-blush px-3.5 py-2 text-xs font-medium cursor-pointer"
              >
                Cancel Move
              </button>
              <button
                type="submit"
                disabled={submitting || !reason.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-[12px] bg-[#D99A35] hover:bg-[#C18527] text-white disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Overriding...' : 'Override & Move'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
              Complete the blocking tasks above before moving {task.taskKey} into progress or done, or ask a Project Admin / Owner to override.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="btn-burgundy px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectRole = 'owner' | 'admin' | 'member';
export type SprintStatus = 'planned' | 'active' | 'completed';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';
export type WorkspaceView =
  | 'board'
  | 'list'
  | 'calendar'
  | 'timeline'
  | 'my_tasks'
  | 'overdue'
  | 'sprints'
  | 'analytics'
  | 'team'
  | 'activity'
  | 'export';

export type NotificationType =
  | 'task_assigned'
  | 'task_reassigned'
  | 'task_moved'
  | 'task_status_changed'
  | 'task_completed'
  | 'comment_added'
  | 'user_mentioned'
  | 'due_approaching'
  | 'task_overdue'
  | 'member_joined'
  | 'sprint_started'
  | 'sprint_completed'
  | 'dependency_blocked'
  | 'project_invitation';

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt?: string;
}

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate: string;
  nextRunDate: string;
  active: boolean;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  ownerId: string;
  taskCounter: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProjectMembership {
  projectId: string;
  projectName: string;
  projectKey: string;
  role: ProjectRole;
  joinedAt?: unknown;
}

export interface ProjectMember {
  uid: string;
  displayName: string;
  photoURL: string;
  role: ProjectRole;
  inviteCode: string;
  joinedAt?: unknown;
}

export interface TaskCard {
  id: string;
  projectId: string;
  taskKey: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assigneeUid: string;
  assigneeName: string;
  assigneePhoto: string;
  tags: string[];
  dueDate: string;
  commentCount: number;
  createdBy: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  // Backward-compatible optional extensions
  startDate?: string;
  sprintId?: string;
  milestoneId?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  subtasks?: SubtaskItem[];
  blockedBy?: string[];
  blocks?: string[];
  relatedTaskIds?: string[];
  recurrence?: RecurrenceConfig | null;
  overrideReason?: string;
}

export interface TaskComment {
  id: string;
  projectId: string;
  taskId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  body: string;
  mentions?: string[];
  edited?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TaskAttachment {
  id: string;
  projectId: string;
  taskId: string;
  name: string;
  size: number;
  contentType: string;
  storagePath: string;
  downloadUrl: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt?: unknown;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  taskId: string;
  userUid: string;
  userName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  note: string;
  isManual: boolean;
  createdAt?: unknown;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  retrospectiveNotes: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  dueDate: string;
  completed: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  actorUid: string;
  actorName: string;
  actorPhoto: string;
  action: string;
  taskId: string;
  taskKey: string;
  summary: string;
  createdAt?: unknown;
}

export interface ProjectInvite {
  code: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  createdBy: string;
  role: 'admin' | 'member';
  active: boolean;
  singleUse?: boolean;
  maxUses?: number;
  useCount?: number;
  invitedEmail?: string;
  expiresAt?: unknown;
  createdAt?: unknown;
}

export interface AppNotification {
  id: string;
  recipientUid: string;
  actorUid: string;
  actorName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskKey: string;
  type: NotificationType;
  message: string;
  read: boolean;
  dedupeKey?: string;
  createdAt?: unknown;
}

export interface NotificationPreference {
  all: boolean;
  assignments: boolean;
  mentions: boolean;
  reminders: boolean;
  projectActivity: boolean;
  updatedAt?: unknown;
}

export interface FilterCriteria {
  search: string;
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  assigneeUid: string;
  reporterUid: string;
  tag: string;
  overdueOnly: boolean;
  completion: 'all' | 'open' | 'completed';
  dueDateFrom: string;
  dueDateTo: string;
  sprintId: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  projectId: string;
  criteriaJson: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TemplateTaskSpec {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  estimatedMinutes?: number;
  subtasks?: string[];
  dueOffsetDays?: number;
}

export interface TemplateMilestoneSpec {
  name: string;
  description: string;
  dueOffsetDays: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  suggestedKey: string;
  isCustom?: boolean;
  milestones: TemplateMilestoneSpec[];
  tasks: TemplateTaskSpec[];
}

export interface PresenceMember {
  uid: string;
  displayName: string;
  photoURL: string;
  color: string;
  role?: string | null;
}

export interface RemoteDragState {
  taskId: string;
  taskKey: string;
  actorUid: string;
  actorName: string;
  color: string;
}

export interface BoardActivityEvent {
  id: string;
  projectId: string;
  eventType: string;
  actorUid: string;
  actorName: string;
  actorPhoto?: string;
  taskId?: string;
  taskKey?: string;
  summary: string;
  timestamp: number;
}

export const BOARD_COLUMNS: { id: TaskStatus; label: string; description: string }[] = [
  { id: 'backlog', label: 'Backlog', description: 'Scoped & queued items' },
  { id: 'todo', label: 'To Do', description: 'Committed for this sprint' },
  { id: 'in_progress', label: 'In Progress', description: 'Active development' },
  { id: 'done', label: 'Done', description: 'Verified & shipped' },
];

export const TASK_PRIORITIES: {
  id: TaskPriority;
  label: string;
  textClass: string;
}[] = [
  { id: 'urgent', label: 'Urgent', textClass: 'text-red-600 dark:text-red-400' },
  { id: 'high', label: 'High', textClass: 'text-amber-600 dark:text-amber-400' },
  { id: 'medium', label: 'Medium', textClass: 'text-blue-600 dark:text-blue-400' },
  { id: 'low', label: 'Low', textClass: 'text-slate-500 dark:text-slate-400' },
];

export const DEFAULT_FILTER_CRITERIA: FilterCriteria = {
  search: '',
  status: 'all',
  priority: 'all',
  assigneeUid: 'all',
  reporterUid: 'all',
  tag: 'all',
  overdueOnly: false,
  completion: 'all',
  dueDateFrom: '',
  dueDateTo: '',
  sprintId: 'all',
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreference = {
  all: true,
  assignments: true,
  mentions: true,
  reminders: true,
  projectActivity: true,
};

export const LIMITS = {
  PROJECT_NAME_MAX: 80,
  PROJECT_KEY_MIN: 2,
  PROJECT_KEY_MAX: 6,
  PROJECT_DESC_MAX: 500,
  TASK_TITLE_MAX: 160,
  TASK_DESC_MAX: 4000,
  COMMENT_BODY_MAX: 2000,
  TAGS_MAX: 5,
  TAG_LEN_MAX: 24,
  SUBTASKS_MAX: 25,
  DEPENDENCY_MAX: 15,
  NAME_MAX: 80,
  ATTACHMENT_MAX_BYTES: 10 * 1024 * 1024,
};

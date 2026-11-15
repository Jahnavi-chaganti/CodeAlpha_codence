import {
  LIMITS,
  type ProjectMember,
  type RecurrenceConfig,
  type RecurrenceFrequency,
  type TaskCard,
  type TaskPriority,
  type TaskStatus,
} from '../types/pm';

export function cleanText(value: string | null | undefined, maxLen: number): string {
  return (value ?? '').trim().slice(0, maxLen);
}

export function sanitizeProjectKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LIMITS.PROJECT_KEY_MAX);
}

export function isValidProjectKey(key: string): boolean {
  return /^[A-Z0-9]{2,6}$/.test(key);
}

export function isValidStatus(status: string): status is TaskStatus {
  return status === 'backlog' || status === 'todo' || status === 'in_progress' || status === 'done';
}

export function isValidPriority(priority: string): priority is TaskPriority {
  return priority === 'low' || priority === 'medium' || priority === 'high' || priority === 'urgent';
}

export function localTodayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return localTodayIso();
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localTodayIso(dt);
}

export function isOverdueTask(task: TaskCard, referenceDate = localTodayIso()): boolean {
  return Boolean(task.dueDate && task.dueDate < referenceDate && task.status !== 'done');
}

export function isDueSoonTask(task: TaskCard, daysAhead = 2, referenceDate = localTodayIso()): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  const limit = addDaysIso(referenceDate, daysAhead);
  return task.dueDate >= referenceDate && task.dueDate <= limit;
}

/**
 * Checks whether adding `blockerId` as a blocker of `taskId` would create a dependency cycle.
 * Graph edge: task -> blockedBy (task depends on blocker).
 */
export function hasCircularDependency(
  taskId: string,
  candidateBlockerId: string,
  allTasks: TaskCard[]
): boolean {
  if (!taskId || !candidateBlockerId) return false;
  if (taskId === candidateBlockerId) return true;

  const byId = new Map<string, TaskCard>();
  for (const t of allTasks) byId.set(t.id, t);

  const visited = new Set<string>();
  const stack: string[] = [candidateBlockerId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (currentId === taskId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = byId.get(currentId);
    if (!node) continue;
    for (const parentId of node.blockedBy ?? []) {
      if (!visited.has(parentId)) {
        stack.push(parentId);
      }
    }
  }

  return false;
}

export function getIncompleteBlockers(task: TaskCard, allTasks: TaskCard[]): TaskCard[] {
  const blockerIds = task.blockedBy ?? [];
  if (blockerIds.length === 0) return [];
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  return blockerIds
    .map((id) => byId.get(id))
    .filter((b): b is TaskCard => Boolean(b && b.status !== 'done'));
}

export function computeNextRecurrenceDate(
  currentDateIso: string,
  frequency: RecurrenceFrequency,
  interval: number
): string {
  const safeInterval = Math.max(1, Math.min(365, Math.floor(interval || 1)));
  const [y, m, d] = currentDateIso.split('-').map(Number);
  if (!y || !m || !d) return localTodayIso();

  const dt = new Date(y, m - 1, d);
  if (frequency === 'daily') {
    dt.setDate(dt.getDate() + safeInterval);
  } else if (frequency === 'weekly') {
    dt.setDate(dt.getDate() + safeInterval * 7);
  } else if (frequency === 'monthly') {
    dt.setMonth(dt.getMonth() + safeInterval);
  } else {
    dt.setDate(dt.getDate() + safeInterval);
  }
  return localTodayIso(dt);
}

export function shouldGenerateRecurrence(
  recurrence: RecurrenceConfig | null | undefined,
  referenceDate = localTodayIso()
): boolean {
  if (!recurrence || !recurrence.active) return false;
  if (!recurrence.nextRunDate) return false;
  if (recurrence.endDate && recurrence.nextRunDate > recurrence.endDate) return false;
  return recurrence.nextRunDate <= referenceDate;
}

/**
 * Extracts mentioned member UIDs from comment body matching `@Display Name` or `@firstName`.
 */
export function extractMentionedMembers(
  body: string,
  members: ProjectMember[]
): ProjectMember[] {
  if (!body.includes('@')) return [];
  const lower = body.toLowerCase();
  const matched: ProjectMember[] = [];
  const seen = new Set<string>();

  for (const member of members) {
    const fullHandle = `@${member.displayName.toLowerCase()}`;
    const compactHandle = `@${member.displayName.toLowerCase().replace(/\s+/g, '')}`;
    const firstHandle = `@${member.displayName.toLowerCase().split(/\s+/)[0]}`;
    if (
      lower.includes(fullHandle) ||
      lower.includes(compactHandle) ||
      (firstHandle.length > 2 && new RegExp(`(^|\\s)${escapeRegex(firstHandle)}(\\b|\\s|$)`).test(lower))
    ) {
      if (!seen.has(member.uid)) {
        seen.add(member.uid);
        matched.push(member);
      }
    }
  }
  return matched;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateCryptoInviteCode(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

export function formatMinutes(minutes: number | undefined): string {
  const total = Math.max(0, Math.round(minutes || 0));
  if (total === 0) return '0m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

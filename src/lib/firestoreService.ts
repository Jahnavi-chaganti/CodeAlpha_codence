import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import {
  LIMITS,
  type ProjectInvite,
  type ProjectMember,
  type ProjectRole,
  type ProjectTemplate,
  type RecurrenceConfig,
  type SubtaskItem,
  type TaskCard,
  type TaskPriority,
  type TaskStatus,
} from '../types/pm';
import {
  addDaysIso,
  cleanText,
  computeNextRecurrenceDate,
  extractMentionedMembers,
  generateCryptoInviteCode,
  localTodayIso,
} from './validationService';
import { logProjectActivity, sendNotification } from './notificationService';
import { createMilestone } from './sprintService';

export function generateSafeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function deriveDisplayName(user: User): string {
  const raw = user.displayName || user.email?.split('@')[0] || 'Team Member';
  return cleanText(raw, LIMITS.NAME_MAX) || 'Team Member';
}

export async function syncUserProfile(user: User): Promise<void> {
  const displayName = deriveDisplayName(user);
  const photoURL = cleanText(user.photoURL, 500);
  const email = cleanText(user.email, 254);

  const userPath = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email,
        displayName,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        email,
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  const profilePath = `userProfiles/${user.uid}`;
  try {
    const profileRef = doc(db, 'userProfiles', user.uid);
    const snap = await getDoc(profileRef);
    if (!snap.exists()) {
      await setDoc(profileRef, {
        uid: user.uid,
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(profileRef, {
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export async function createProject(params: {
  name: string;
  key: string;
  description: string;
  includeStarterTasks: boolean;
  template?: ProjectTemplate | null;
  user: User;
}): Promise<string> {
  const name = cleanText(params.name, LIMITS.PROJECT_NAME_MAX);
  const key = params.key.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LIMITS.PROJECT_KEY_MAX);
  const description = cleanText(params.description, LIMITS.PROJECT_DESC_MAX);

  if (!name) throw new Error('Project name is required.');
  if (key.length < LIMITS.PROJECT_KEY_MIN) throw new Error('Project key must be 2–6 characters.');

  const projectId = generateSafeId('proj');
  const displayName = deriveDisplayName(params.user);
  const photoURL = cleanText(params.user.photoURL, 500);

  const path = `projects/${projectId}`;
  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'projects', projectId), {
      id: projectId,
      name,
      key,
      description,
      ownerId: params.user.uid,
      taskCounter: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'projects', projectId, 'members', params.user.uid), {
      uid: params.user.uid,
      displayName,
      photoURL,
      role: 'owner',
      inviteCode: '',
      joinedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', params.user.uid, 'projectMemberships', projectId), {
      projectId,
      projectName: name,
      projectKey: key,
      role: 'owner',
      joinedAt: serverTimestamp(),
    });

    await batch.commit();
    await logProjectActivity({
      projectId,
      user: params.user,
      action: 'project:created',
      summary: `Created project ${name} (${key})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  const today = localTodayIso();
  const ownerMember: ProjectMember = {
    uid: params.user.uid,
    displayName,
    photoURL,
    role: 'owner',
    inviteCode: '',
  };

  if (params.template) {
    let firstMilestoneId = '';
    for (let i = 0; i < params.template.milestones.length; i += 1) {
      const ms = params.template.milestones[i];
      const msId = await createMilestone({
        projectId,
        name: ms.name,
        description: ms.description,
        dueDate: addDaysIso(today, ms.dueOffsetDays || 7),
        user: params.user,
      });
      if (i === 0) firstMilestoneId = msId;
    }

    for (let i = 0; i < params.template.tasks.length; i += 1) {
      const item = params.template.tasks[i];
      const subtasks: SubtaskItem[] = (item.subtasks ?? []).map((title, idx) => ({
        id: `sub_${Date.now()}_${idx}`,
        title: cleanText(title, 160),
        completed: false,
      }));
      await createTask({
        projectId,
        projectName: name,
        projectKey: key,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        position: (i + 1) * 1000,
        assignee: ownerMember,
        tags: item.tags,
        dueDate: item.dueOffsetDays ? addDaysIso(today, item.dueOffsetDays) : '',
        startDate: today,
        milestoneId: firstMilestoneId,
        estimatedMinutes: item.estimatedMinutes ?? 0,
        subtasks,
        user: params.user,
        skipSelfNotify: true,
      });
    }
  } else if (params.includeStarterTasks) {
    const starterTasks: {
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      tags: string[];
      dueOffset: number;
      est: number;
    }[] = [
      {
        title: 'Define API rate limiting & caching strategy',
        description: 'Document token-bucket thresholds per workspace tier and review fallback metrics.',
        status: 'backlog',
        priority: 'medium',
        tags: ['backend', 'architecture'],
        dueOffset: 7,
        est: 180,
      },
      {
        title: 'Audit workspace invitation & role permissions',
        description: 'Verify expiring invite codes and server-side membership checks.',
        status: 'todo',
        priority: 'high',
        tags: ['auth', 'security'],
        dueOffset: 3,
        est: 120,
      },
      {
        title: 'Ship real-time WebSocket board presence sync',
        description: 'Broadcast active room collaborators and live drag indicators over /ws.',
        status: 'in_progress',
        priority: 'urgent',
        tags: ['realtime', 'websockets'],
        dueOffset: 2,
        est: 240,
      },
      {
        title: 'Configure persistent Firestore workspace rules',
        description: 'Enforce member-gated subcollection access and PII isolation.',
        status: 'done',
        priority: 'high',
        tags: ['database', 'qa'],
        dueOffset: 0,
        est: 90,
      },
    ];

    for (let i = 0; i < starterTasks.length; i += 1) {
      const item = starterTasks[i];
      await createTask({
        projectId,
        projectName: name,
        projectKey: key,
        title: item.title,
        description: item.description,
        status: item.status,
        priority: item.priority,
        position: (i + 1) * 1000,
        assignee: ownerMember,
        tags: item.tags,
        dueDate: addDaysIso(today, item.dueOffset),
        startDate: today,
        estimatedMinutes: item.est,
        user: params.user,
        skipSelfNotify: true,
      });
    }
  }

  return projectId;
}

export async function saveCustomTemplate(params: {
  uid: string;
  template: ProjectTemplate;
}): Promise<string> {
  const templateId = `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${params.uid}/templates/${templateId}`;
  try {
    await setDoc(doc(db, 'users', params.uid, 'templates', templateId), {
      id: templateId,
      name: cleanText(params.template.name, 80),
      description: cleanText(params.template.description, 500),
      category: cleanText(params.template.category, 40) || 'Custom',
      payloadJson: JSON.stringify({ ...params.template, id: templateId, isCustom: true }),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return templateId;
}

export async function deleteCustomTemplate(params: {
  uid: string;
  templateId: string;
}): Promise<void> {
  const path = `users/${params.uid}/templates/${params.templateId}`;
  try {
    await deleteDoc(doc(db, 'users', params.uid, 'templates', params.templateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateProjectDetails(params: {
  projectId: string;
  name: string;
  description: string;
  user: User;
}): Promise<void> {
  const name = cleanText(params.name, LIMITS.PROJECT_NAME_MAX);
  const description = cleanText(params.description, LIMITS.PROJECT_DESC_MAX);
  if (!name) throw new Error('Project name is required.');

  const path = `projects/${params.projectId}`;
  try {
    await updateDoc(doc(db, 'projects', params.projectId), {
      name,
      description,
      updatedAt: serverTimestamp(),
    });
    await logProjectActivity({
      projectId: params.projectId,
      user: params.user,
      action: 'project:updated',
      summary: `Updated project settings for ${name}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createTask(params: {
  projectId: string;
  projectName: string;
  projectKey: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assignee: ProjectMember | null;
  tags: string[];
  dueDate: string;
  startDate?: string;
  sprintId?: string;
  milestoneId?: string;
  estimatedMinutes?: number;
  subtasks?: SubtaskItem[];
  blockedBy?: string[];
  relatedTaskIds?: string[];
  recurrence?: RecurrenceConfig | null;
  user: User;
  skipSelfNotify?: boolean;
}): Promise<{ taskId: string; taskKey: string }> {
  const title = cleanText(params.title, LIMITS.TASK_TITLE_MAX);
  if (!title) throw new Error('Task title is required.');

  const description = cleanText(params.description, LIMITS.TASK_DESC_MAX);
  const tags = params.tags
    .map((t) => cleanText(t, LIMITS.TAG_LEN_MAX))
    .filter(Boolean)
    .slice(0, LIMITS.TAGS_MAX);
  const dueDate = cleanText(params.dueDate, 20);
  const startDate = cleanText(params.startDate ?? '', 20);
  const taskId = generateSafeId('task');
  const createdByName = deriveDisplayName(params.user);

  const assigneeUid = params.assignee ? cleanText(params.assignee.uid, 128) : '';
  const assigneeName = params.assignee ? cleanText(params.assignee.displayName, LIMITS.NAME_MAX) : '';
  const assigneePhoto = params.assignee ? cleanText(params.assignee.photoURL, 500) : '';

  const path = `projects/${params.projectId}/tasks/${taskId}`;
  let taskKey = `${params.projectKey}-1`;

  try {
    await runTransaction(db, async (tx) => {
      const projectRef = doc(db, 'projects', params.projectId);
      const projectSnap = await tx.get(projectRef);
      if (!projectSnap.exists()) throw new Error('Project not found.');
      const currentCounter = Number(projectSnap.data().taskCounter || 0);
      const nextCounter = currentCounter + 1;
      const keyPrefix = String(projectSnap.data().key || params.projectKey);
      taskKey = `${keyPrefix}-${nextCounter}`;

      tx.update(projectRef, {
        taskCounter: nextCounter,
        updatedAt: serverTimestamp(),
      });

      tx.set(doc(db, 'projects', params.projectId, 'tasks', taskId), {
        id: taskId,
        projectId: params.projectId,
        taskKey,
        title,
        description,
        status: params.status,
        priority: params.priority,
        position: params.position,
        assigneeUid,
        assigneeName,
        assigneePhoto,
        tags,
        dueDate,
        startDate,
        sprintId: cleanText(params.sprintId ?? '', 128),
        milestoneId: cleanText(params.milestoneId ?? '', 128),
        estimatedMinutes: Math.max(0, Math.round(params.estimatedMinutes ?? 0)),
        actualMinutes: 0,
        subtasks: (params.subtasks ?? []).slice(0, LIMITS.SUBTASKS_MAX),
        blockedBy: (params.blockedBy ?? []).slice(0, LIMITS.DEPENDENCY_MAX),
        blocks: [],
        relatedTaskIds: (params.relatedTaskIds ?? []).slice(0, LIMITS.DEPENDENCY_MAX),
        recurrence: params.recurrence ?? null,
        overrideReason: '',
        commentCount: 0,
        createdBy: params.user.uid,
        createdByName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await logProjectActivity({
      projectId: params.projectId,
      user: params.user,
      action: 'task:created',
      taskId,
      taskKey,
      summary: `Created ${taskKey}: ${title}`,
    });

    if (assigneeUid && assigneeUid !== params.user.uid && !params.skipSelfNotify) {
      await sendNotification({
        recipientUid: assigneeUid,
        actorUid: params.user.uid,
        actorName: createdByName,
        projectId: params.projectId,
        projectName: params.projectName,
        taskId,
        taskKey,
        type: 'task_assigned',
        message: `${createdByName} assigned ${taskKey}: "${title.slice(0, 80)}" to you`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return { taskId, taskKey };
}

export async function moveTask(params: {
  projectId: string;
  taskId: string;
  status: TaskStatus;
  position: number;
  overrideReason?: string;
}): Promise<void> {
  const path = `projects/${params.projectId}/tasks/${params.taskId}`;
  try {
    const payload: Record<string, unknown> = {
      status: params.status,
      position: params.position,
      updatedAt: serverTimestamp(),
    };
    if (params.overrideReason !== undefined) {
      payload.overrideReason = cleanText(params.overrideReason, 300);
    }
    await updateDoc(doc(db, 'projects', params.projectId, 'tasks', params.taskId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTaskDates(params: {
  projectId: string;
  taskId: string;
  startDate: string;
  dueDate: string;
}): Promise<void> {
  const path = `projects/${params.projectId}/tasks/${params.taskId}`;
  try {
    await updateDoc(doc(db, 'projects', params.projectId, 'tasks', params.taskId), {
      startDate: cleanText(params.startDate, 20),
      dueDate: cleanText(params.dueDate, 20),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTaskSubtasks(params: {
  projectId: string;
  taskId: string;
  subtasks: SubtaskItem[];
}): Promise<void> {
  const path = `projects/${params.projectId}/tasks/${params.taskId}`;
  try {
    await updateDoc(doc(db, 'projects', params.projectId, 'tasks', params.taskId), {
      subtasks: params.subtasks.slice(0, LIMITS.SUBTASKS_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTask(params: {
  projectId: string;
  projectName: string;
  taskId: string;
  taskKey: string;
  previousAssigneeUid: string;
  previousStatus: TaskStatus;
  updates: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    position: number;
    assignee: ProjectMember | null;
    tags: string[];
    dueDate: string;
    startDate?: string;
    sprintId?: string;
    milestoneId?: string;
    estimatedMinutes?: number;
    subtasks?: SubtaskItem[];
    blockedBy?: string[];
    blocks?: string[];
    relatedTaskIds?: string[];
    recurrence?: RecurrenceConfig | null;
    overrideReason?: string;
  };
  actor: User;
}): Promise<void> {
  const title = cleanText(params.updates.title, LIMITS.TASK_TITLE_MAX);
  if (!title) throw new Error('Task title cannot be empty.');

  const description = cleanText(params.updates.description, LIMITS.TASK_DESC_MAX);
  const tags = params.updates.tags
    .map((t) => cleanText(t, LIMITS.TAG_LEN_MAX))
    .filter(Boolean)
    .slice(0, LIMITS.TAGS_MAX);

  const assigneeUid = params.updates.assignee ? cleanText(params.updates.assignee.uid, 128) : '';
  const assigneeName = params.updates.assignee
    ? cleanText(params.updates.assignee.displayName, LIMITS.NAME_MAX)
    : '';
  const assigneePhoto = params.updates.assignee
    ? cleanText(params.updates.assignee.photoURL, 500)
    : '';

  const path = `projects/${params.projectId}/tasks/${params.taskId}`;
  try {
    await updateDoc(doc(db, 'projects', params.projectId, 'tasks', params.taskId), {
      title,
      description,
      status: params.updates.status,
      priority: params.updates.priority,
      position: params.updates.position,
      assigneeUid,
      assigneeName,
      assigneePhoto,
      tags,
      dueDate: cleanText(params.updates.dueDate, 20),
      startDate: cleanText(params.updates.startDate ?? '', 20),
      sprintId: cleanText(params.updates.sprintId ?? '', 128),
      milestoneId: cleanText(params.updates.milestoneId ?? '', 128),
      estimatedMinutes: Math.max(0, Math.round(params.updates.estimatedMinutes ?? 0)),
      subtasks: (params.updates.subtasks ?? []).slice(0, LIMITS.SUBTASKS_MAX),
      blockedBy: (params.updates.blockedBy ?? []).slice(0, LIMITS.DEPENDENCY_MAX),
      blocks: (params.updates.blocks ?? []).slice(0, LIMITS.DEPENDENCY_MAX),
      relatedTaskIds: (params.updates.relatedTaskIds ?? []).slice(0, LIMITS.DEPENDENCY_MAX),
      recurrence: params.updates.recurrence ?? null,
      overrideReason: cleanText(params.updates.overrideReason ?? '', 300),
      updatedAt: serverTimestamp(),
    });

    const actorName = deriveDisplayName(params.actor);

    await logProjectActivity({
      projectId: params.projectId,
      user: params.actor,
      action:
        params.previousStatus !== params.updates.status ? 'task:moved' : 'task:updated',
      taskId: params.taskId,
      taskKey: params.taskKey,
      summary: `Updated ${params.taskKey}: ${title}`,
    });

    if (
      assigneeUid &&
      assigneeUid !== params.previousAssigneeUid &&
      assigneeUid !== params.actor.uid
    ) {
      await sendNotification({
        recipientUid: assigneeUid,
        actorUid: params.actor.uid,
        actorName,
        projectId: params.projectId,
        projectName: params.projectName,
        taskId: params.taskId,
        taskKey: params.taskKey,
        type: params.previousAssigneeUid ? 'task_reassigned' : 'task_assigned',
        message: `${actorName} assigned ${params.taskKey}: "${title.slice(0, 80)}" to you`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function generateNextRecurringTask(params: {
  task: TaskCard;
  projectName: string;
  projectKey: string;
  members: ProjectMember[];
  user: User;
}): Promise<string | null> {
  const rec = params.task.recurrence;
  if (!rec || !rec.active) return null;

  const baseDate = rec.nextRunDate || params.task.dueDate || localTodayIso();
  const nextDue = computeNextRecurrenceDate(baseDate, rec.frequency, rec.interval);
  if (rec.endDate && nextDue > rec.endDate) {
    // Deactivate recurrence when past endDate
    await updateDoc(doc(db, 'projects', params.task.projectId, 'tasks', params.task.id), {
      recurrence: { ...rec, active: false },
      updatedAt: serverTimestamp(),
    });
    return null;
  }

  const assignee = params.members.find((m) => m.uid === params.task.assigneeUid) ?? null;

  // First disable active recurrence on the completed instance so duplicates cannot be spawned
  await updateDoc(doc(db, 'projects', params.task.projectId, 'tasks', params.task.id), {
    recurrence: { ...rec, active: false },
    updatedAt: serverTimestamp(),
  });

  const nextRecurrence: RecurrenceConfig = {
    ...rec,
    nextRunDate: computeNextRecurrenceDate(nextDue, rec.frequency, rec.interval),
    active: true,
  };

  const { taskId } = await createTask({
    projectId: params.task.projectId,
    projectName: params.projectName,
    projectKey: params.projectKey,
    title: params.task.title,
    description: params.task.description,
    status: 'todo',
    priority: params.task.priority,
    position: params.task.position + 500,
    assignee,
    tags: params.task.tags ?? [],
    dueDate: nextDue,
    startDate: baseDate,
    sprintId: params.task.sprintId ?? '',
    milestoneId: params.task.milestoneId ?? '',
    estimatedMinutes: params.task.estimatedMinutes ?? 0,
    subtasks: (params.task.subtasks ?? []).map((s, idx) => ({
      id: `sub_${Date.now()}_${idx}`,
      title: s.title,
      completed: false,
    })),
    recurrence: nextRecurrence,
    user: params.user,
  });

  return taskId;
}

export async function bulkUpdateTasks(params: {
  projectId: string;
  tasks: TaskCard[];
  updates: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee?: ProjectMember | null;
  };
}): Promise<void> {
  if (params.tasks.length === 0) return;
  const batch = writeBatch(db);
  for (const t of params.tasks) {
    const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (params.updates.status) patch.status = params.updates.status;
    if (params.updates.priority) patch.priority = params.updates.priority;
    if (params.updates.assignee !== undefined) {
      patch.assigneeUid = params.updates.assignee?.uid ?? '';
      patch.assigneeName = params.updates.assignee?.displayName ?? '';
      patch.assigneePhoto = params.updates.assignee?.photoURL ?? '';
    }
    batch.update(doc(db, 'projects', params.projectId, 'tasks', t.id), patch);
  }
  await batch.commit();
}

export async function bulkDeleteTasks(params: {
  projectId: string;
  taskIds: string[];
}): Promise<void> {
  if (params.taskIds.length === 0) return;
  const batch = writeBatch(db);
  for (const id of params.taskIds) {
    batch.delete(doc(db, 'projects', params.projectId, 'tasks', id));
  }
  await batch.commit();
}

export async function deleteTask(params: {
  projectId: string;
  taskId: string;
  taskKey?: string;
  user?: User;
}): Promise<void> {
  const path = `projects/${params.projectId}/tasks/${params.taskId}`;
  try {
    await deleteDoc(doc(db, 'projects', params.projectId, 'tasks', params.taskId));
    if (params.user && params.taskKey) {
      await logProjectActivity({
        projectId: params.projectId,
        user: params.user,
        action: 'task:deleted',
        taskId: params.taskId,
        taskKey: params.taskKey,
        summary: `Deleted task ${params.taskKey}`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addComment(params: {
  projectId: string;
  projectName: string;
  taskId: string;
  taskKey: string;
  body: string;
  members: ProjectMember[];
  user: User;
  notifyUids: string[];
}): Promise<{ commentId: string; mentionedUids: string[] }> {
  const body = cleanText(params.body, LIMITS.COMMENT_BODY_MAX);
  if (!body) throw new Error('Comment cannot be empty.');

  const commentId = generateSafeId('cmt');
  const authorName = deriveDisplayName(params.user);
  const authorPhoto = cleanText(params.user.photoURL, 500);
  const mentionedMembers = extractMentionedMembers(body, params.members);
  const mentionedUids = mentionedMembers.map((m) => m.uid);
  const path = `projects/${params.projectId}/tasks/${params.taskId}/comments/${commentId}`;

  try {
    await runTransaction(db, async (tx) => {
      const taskRef = doc(db, 'projects', params.projectId, 'tasks', params.taskId);
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists()) throw new Error('Task no longer exists.');
      const nextCommentCount = Number(taskSnap.data().commentCount || 0) + 1;

      tx.update(taskRef, {
        commentCount: nextCommentCount,
        updatedAt: serverTimestamp(),
      });

      tx.set(
        doc(db, 'projects', params.projectId, 'tasks', params.taskId, 'comments', commentId),
        {
          id: commentId,
          projectId: params.projectId,
          taskId: params.taskId,
          authorUid: params.user.uid,
          authorName,
          authorPhoto,
          body,
          mentions: mentionedUids.slice(0, 10),
          edited: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    });

    await logProjectActivity({
      projectId: params.projectId,
      user: params.user,
      action: 'comment:added',
      taskId: params.taskId,
      taskKey: params.taskKey,
      summary: `Commented on ${params.taskKey}: "${body.slice(0, 70)}"`,
    });

    // Notify mentioned users first
    const mentionSet = new Set(mentionedUids);
    for (const uid of mentionSet) {
      if (uid !== params.user.uid) {
        await sendNotification({
          recipientUid: uid,
          actorUid: params.user.uid,
          actorName: authorName,
          projectId: params.projectId,
          projectName: params.projectName,
          taskId: params.taskId,
          taskKey: params.taskKey,
          type: 'user_mentioned',
          message: `${authorName} mentioned you on ${params.taskKey}: "${body.slice(0, 80)}"`,
        });
      }
    }

    const otherRecipients = Array.from(new Set(params.notifyUids)).filter(
      (uid) => uid && uid !== params.user.uid && !mentionSet.has(uid)
    );
    await Promise.all(
      otherRecipients.map((recipientUid) =>
        sendNotification({
          recipientUid,
          actorUid: params.user.uid,
          actorName: authorName,
          projectId: params.projectId,
          projectName: params.projectName,
          taskId: params.taskId,
          taskKey: params.taskKey,
          type: 'comment_added',
          message: `${authorName} commented on ${params.taskKey}: "${body.slice(0, 90)}"`,
        })
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return { commentId, mentionedUids };
}

export async function updateComment(params: {
  projectId: string;
  taskId: string;
  commentId: string;
  body: string;
  members: ProjectMember[];
}): Promise<void> {
  const body = cleanText(params.body, LIMITS.COMMENT_BODY_MAX);
  if (!body) throw new Error('Comment cannot be empty.');
  const mentions = extractMentionedMembers(body, params.members).map((m) => m.uid).slice(0, 10);
  const path = `projects/${params.projectId}/tasks/${params.taskId}/comments/${params.commentId}`;
  try {
    await updateDoc(
      doc(db, 'projects', params.projectId, 'tasks', params.taskId, 'comments', params.commentId),
      {
        body,
        mentions,
        edited: true,
        updatedAt: serverTimestamp(),
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteComment(params: {
  projectId: string;
  taskId: string;
  commentId: string;
}): Promise<void> {
  const path = `projects/${params.projectId}/tasks/${params.taskId}/comments/${params.commentId}`;
  try {
    await deleteDoc(
      doc(db, 'projects', params.projectId, 'tasks', params.taskId, 'comments', params.commentId)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createProjectInvite(params: {
  projectId: string;
  projectName: string;
  projectKey: string;
  role: 'admin' | 'member';
  singleUse: boolean;
  maxUses: number;
  expiresInDays: number;
  invitedEmail?: string;
  user: User;
}): Promise<string> {
  const code = generateCryptoInviteCode(12);
  const expiresAtDate = new Date(Date.now() + Math.max(1, params.expiresInDays) * 86400_000);
  const expiresAt = Timestamp.fromDate(expiresAtDate);
  const maxUses = params.singleUse ? 1 : Math.max(0, Math.round(params.maxUses));
  const invitedEmail = cleanText(params.invitedEmail ?? '', 254).toLowerCase();

  const inviteDoc = {
    code,
    projectId: params.projectId,
    projectName: cleanText(params.projectName, LIMITS.PROJECT_NAME_MAX),
    projectKey: params.projectKey,
    createdBy: params.user.uid,
    role: params.role,
    active: true,
    singleUse: params.singleUse,
    maxUses,
    useCount: 0,
    invitedEmail,
    expiresAt,
    createdAt: serverTimestamp(),
  };

  const path = `projectInvites/${code}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'projectInvites', code), inviteDoc);
    batch.set(doc(db, 'projects', params.projectId, 'invites', code), inviteDoc);
    await batch.commit();

    await logProjectActivity({
      projectId: params.projectId,
      user: params.user,
      action: 'invite:created',
      summary: `Created ${params.role} invitation code (${params.singleUse ? 'single-use' : 'reusable'})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return code;
}

export async function revokeProjectInvite(params: {
  projectId: string;
  code: string;
  user: User;
}): Promise<void> {
  const path = `projects/${params.projectId}/invites/${params.code}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'projectInvites', params.code), { active: false });
    batch.update(doc(db, 'projects', params.projectId, 'invites', params.code), { active: false });
    await batch.commit();

    await logProjectActivity({
      projectId: params.projectId,
      user: params.user,
      action: 'invite:revoked',
      summary: `Revoked invitation code ${params.code.slice(0, 4)}••••`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function joinProjectByInvite(params: {
  inviteCode: string;
  user: User;
}): Promise<{ projectId: string; projectName: string }> {
  const code = params.inviteCode.trim();
  if (code.length < 10) {
    throw new Error('Invalid invite code format. Codes are at least 10 characters.');
  }

  const invitePath = `projectInvites/${code}`;
  let inviteData: ProjectInvite | null = null;
  try {
    const inviteSnap = await getDoc(doc(db, 'projectInvites', code));
    if (!inviteSnap.exists()) {
      throw new Error('Invite code not found. Double-check the code and try again.');
    }
    inviteData = inviteSnap.data() as ProjectInvite;
    if (!inviteData.active) {
      throw new Error('This invitation has been revoked by a project admin.');
    }
    const exp = inviteData.expiresAt as { toMillis?: () => number; seconds?: number } | undefined;
    const expMs = exp?.toMillis ? exp.toMillis() : exp?.seconds ? exp.seconds * 1000 : 0;
    if (expMs > 0 && Date.now() > expMs) {
      throw new Error('This invitation code has expired.');
    }
    const maxUses = inviteData.maxUses ?? 0;
    const useCount = inviteData.useCount ?? 0;
    if (maxUses > 0 && useCount >= maxUses) {
      throw new Error('This invitation code has reached its maximum usage limit.');
    }
    if (
      inviteData.invitedEmail &&
      inviteData.invitedEmail.toLowerCase() !== (params.user.email ?? '').toLowerCase()
    ) {
      throw new Error('This invitation is restricted to a different email address.');
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Invite') || error.message.includes('invitation'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, invitePath);
  }

  if (!inviteData) throw new Error('Invalid invite code.');

  const memberRef = doc(db, 'projects', inviteData.projectId, 'members', params.user.uid);
  const existingMember = await getDoc(memberRef);
  if (existingMember.exists()) {
    return {
      projectId: inviteData.projectId,
      projectName: inviteData.projectName,
    };
  }

  const displayName = deriveDisplayName(params.user);
  const photoURL = cleanText(params.user.photoURL, 500);
  const memberPath = `projects/${inviteData.projectId}/members/${params.user.uid}`;

  try {
    const nextUseCount = (inviteData.useCount ?? 0) + 1;
    const batch = writeBatch(db);
    batch.set(memberRef, {
      uid: params.user.uid,
      displayName,
      photoURL,
      role: inviteData.role,
      inviteCode: code,
      joinedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', params.user.uid, 'projectMemberships', inviteData.projectId), {
      projectId: inviteData.projectId,
      projectName: inviteData.projectName,
      projectKey: inviteData.projectKey,
      role: inviteData.role,
      joinedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'projectInvites', code), { useCount: nextUseCount });
    batch.update(doc(db, 'projects', inviteData.projectId, 'invites', code), {
      useCount: nextUseCount,
    });
    await batch.commit();

    await logProjectActivity({
      projectId: inviteData.projectId,
      user: params.user,
      action: 'member:joined',
      summary: `${displayName} joined as ${inviteData.role}`,
    });

    if (inviteData.createdBy !== params.user.uid) {
      await sendNotification({
        recipientUid: inviteData.createdBy,
        actorUid: params.user.uid,
        actorName: displayName,
        projectId: inviteData.projectId,
        projectName: inviteData.projectName,
        taskId: '',
        taskKey: '',
        type: 'member_joined',
        message: `${displayName} joined ${inviteData.projectName} via invite code`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, memberPath);
  }

  return {
    projectId: inviteData.projectId,
    projectName: inviteData.projectName,
  };
}

export async function updateMemberRole(params: {
  projectId: string;
  memberUid: string;
  role: 'admin' | 'member';
  actor?: User;
}): Promise<void> {
  const path = `projects/${params.projectId}/members/${params.memberUid}`;
  try {
    await updateDoc(doc(db, 'projects', params.projectId, 'members', params.memberUid), {
      role: params.role,
    });
    if (params.actor) {
      await logProjectActivity({
        projectId: params.projectId,
        user: params.actor,
        action: 'member:role_updated',
        summary: `Updated member role to ${params.role}`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeMember(params: {
  projectId: string;
  memberUid: string;
  memberName?: string;
  actor?: User;
}): Promise<void> {
  const path = `projects/${params.projectId}/members/${params.memberUid}`;
  try {
    await deleteDoc(doc(db, 'projects', params.projectId, 'members', params.memberUid));
    if (params.actor) {
      await logProjectActivity({
        projectId: params.projectId,
        user: params.actor,
        action: 'member:removed',
        summary: `Removed ${params.memberName || 'member'} from project`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function roleLabel(role: ProjectRole): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

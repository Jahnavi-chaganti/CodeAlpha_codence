import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import {
  DEFAULT_NOTIFICATION_PREFS,
  LIMITS,
  type AppNotification,
  type NotificationPreference,
  type NotificationType,
  type TaskCard,
} from '../types/pm';
import { cleanText, isDueSoonTask, isOverdueTask, localTodayIso } from './validationService';

export function shouldDeliverByPrefs(
  type: NotificationType,
  prefs: NotificationPreference
): boolean {
  if (!prefs.all) return false;
  if (type === 'task_assigned' || type === 'task_reassigned') return prefs.assignments;
  if (type === 'comment_added' || type === 'user_mentioned') return prefs.mentions;
  if (type === 'due_approaching' || type === 'task_overdue') return prefs.reminders;
  return prefs.projectActivity;
}

export async function loadNotificationPreferences(uid: string): Promise<NotificationPreference> {
  const path = `users/${uid}/preferences/notifications`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'preferences', 'notifications'));
    if (!snap.exists()) return DEFAULT_NOTIFICATION_PREFS;
    const data = snap.data() as Partial<NotificationPreference>;
    return {
      all: data.all ?? true,
      assignments: data.assignments ?? true,
      mentions: data.mentions ?? true,
      reminders: data.reminders ?? true,
      projectActivity: data.projectActivity ?? true,
    };
  } catch (error) {
    console.warn('Unable to load notification prefs:', path, error);
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export async function saveNotificationPreferences(
  uid: string,
  prefs: NotificationPreference
): Promise<void> {
  const path = `users/${uid}/preferences/notifications`;
  try {
    await setDoc(doc(db, 'users', uid, 'preferences', 'notifications'), {
      all: prefs.all,
      assignments: prefs.assignments,
      mentions: prefs.mentions,
      reminders: prefs.reminders,
      projectActivity: prefs.projectActivity,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function sendNotification(params: {
  recipientUid: string;
  actorUid: string;
  actorName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskKey: string;
  type: NotificationType;
  message: string;
  dedupeKey?: string;
}): Promise<void> {
  const notificationId = params.dedupeKey
    ? params.dedupeKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
    : `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const path = `users/${params.recipientUid}/notifications/${notificationId}`;
  try {
    await setDoc(doc(db, 'users', params.recipientUid, 'notifications', notificationId), {
      id: notificationId,
      recipientUid: params.recipientUid,
      actorUid: params.actorUid,
      actorName: cleanText(params.actorName, LIMITS.NAME_MAX) || 'Collaborator',
      projectId: params.projectId,
      projectName: cleanText(params.projectName, LIMITS.PROJECT_NAME_MAX) || 'Project',
      taskId: cleanText(params.taskId, 128),
      taskKey: cleanText(params.taskKey, 16),
      type: params.type,
      message: cleanText(params.message, 300),
      read: false,
      dedupeKey: cleanText(params.dedupeKey ?? '', 160),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Notification write skipped:', path, error);
  }
}

export async function deleteNotification(params: {
  uid: string;
  notificationId: string;
}): Promise<void> {
  const path = `users/${params.uid}/notifications/${params.notificationId}`;
  try {
    await deleteDoc(doc(db, 'users', params.uid, 'notifications', params.notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function markNotificationRead(params: {
  uid: string;
  notificationId: string;
}): Promise<void> {
  const path = `users/${params.uid}/notifications/${params.notificationId}`;
  try {
    await updateDoc(doc(db, 'users', params.uid, 'notifications', params.notificationId), {
      read: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(params: {
  uid: string;
  notificationIds: string[];
}): Promise<void> {
  if (params.notificationIds.length === 0) return;
  const path = `users/${params.uid}/notifications`;
  try {
    const batch = writeBatch(db);
    for (const id of params.notificationIds) {
      batch.update(doc(db, 'users', params.uid, 'notifications', id), { read: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Generates deduplicated deadline reminders (due today/within 2 days or overdue)
 * for tasks assigned to the current user.
 */
export async function syncDeadlineReminders(params: {
  user: User;
  projectId: string;
  projectName: string;
  tasks: TaskCard[];
  existingNotifications: AppNotification[];
  prefs: NotificationPreference;
}): Promise<void> {
  if (!params.prefs.all || !params.prefs.reminders) return;

  const today = localTodayIso();
  const existingKeys = new Set(
    params.existingNotifications.map((n) => n.dedupeKey || n.id)
  );

  for (const task of params.tasks) {
    if (task.assigneeUid !== params.user.uid) continue;

    if (isOverdueTask(task, today)) {
      const dedupeKey = `overdue_${task.id}_${today}`;
      if (!existingKeys.has(dedupeKey)) {
        await sendNotification({
          recipientUid: params.user.uid,
          actorUid: params.user.uid,
          actorName: 'Deadline Reminder',
          projectId: params.projectId,
          projectName: params.projectName,
          taskId: task.id,
          taskKey: task.taskKey,
          type: 'task_overdue',
          message: `${task.taskKey} "${task.title.slice(0, 60)}" is overdue (was due ${task.dueDate})`,
          dedupeKey,
        });
      }
    } else if (isDueSoonTask(task, 2, today)) {
      const dedupeKey = `duesoon_${task.id}_${today}`;
      if (!existingKeys.has(dedupeKey)) {
        await sendNotification({
          recipientUid: params.user.uid,
          actorUid: params.user.uid,
          actorName: 'Deadline Reminder',
          projectId: params.projectId,
          projectName: params.projectName,
          taskId: task.id,
          taskKey: task.taskKey,
          type: 'due_approaching',
          message: `${task.taskKey} "${task.title.slice(0, 60)}" is due on ${task.dueDate}`,
          dedupeKey,
        });
      }
    }
  }
}

export async function logProjectActivity(params: {
  projectId: string;
  user: User;
  action: string;
  taskId?: string;
  taskKey?: string;
  summary: string;
}): Promise<void> {
  const activityId = `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const actorName = cleanText(
    params.user.displayName || params.user.email?.split('@')[0] || 'Member',
    LIMITS.NAME_MAX
  );
  const path = `projects/${params.projectId}/activities/${activityId}`;

  try {
    await setDoc(doc(db, 'projects', params.projectId, 'activities', activityId), {
      id: activityId,
      projectId: params.projectId,
      actorUid: params.user.uid,
      actorName,
      actorPhoto: cleanText(params.user.photoURL, 500),
      action: cleanText(params.action, 64),
      taskId: cleanText(params.taskId ?? '', 128),
      taskKey: cleanText(params.taskKey ?? '', 16),
      summary: cleanText(params.summary, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Activity log skipped:', path, error);
  }
}

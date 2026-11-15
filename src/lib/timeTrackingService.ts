import {
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { LIMITS } from '../types/pm';
import { cleanText } from './validationService';

export interface ActiveTimerState {
  projectId: string;
  taskId: string;
  taskKey: string;
  startedAtMs: number;
  pausedAccumulatedMs: number;
  isPaused: boolean;
}

const TIMER_STORAGE_KEY = 'cadence-active-timer';

export function loadActiveTimer(): ActiveTimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveTimerState;
    if (!parsed.projectId || !parsed.taskId || typeof parsed.startedAtMs !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveTimer(timer: ActiveTimerState | null): void {
  try {
    if (!timer) {
      localStorage.removeItem(TIMER_STORAGE_KEY);
    } else {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
    }
  } catch {
    // ignore storage errors
  }
}

export function getElapsedSeconds(timer: ActiveTimerState, nowMs = Date.now()): number {
  const activeMs = timer.isPaused ? 0 : Math.max(0, nowMs - timer.startedAtMs);
  return Math.floor((timer.pausedAccumulatedMs + activeMs) / 1000);
}

export async function logTimeEntry(params: {
  projectId: string;
  taskId: string;
  durationMinutes: number;
  startTimeIso: string;
  endTimeIso: string;
  note: string;
  isManual: boolean;
  user: User;
}): Promise<string> {
  const minutes = Math.max(1, Math.min(14400, Math.round(params.durationMinutes)));
  const entryId = `time_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const userName = cleanText(
    params.user.displayName || params.user.email?.split('@')[0] || 'Member',
    LIMITS.NAME_MAX
  );

  const path = `projects/${params.projectId}/tasks/${params.taskId}/timeEntries/${entryId}`;
  try {
    await runTransaction(db, async (tx) => {
      const taskRef = doc(db, 'projects', params.projectId, 'tasks', params.taskId);
      const taskSnap = await tx.get(taskRef);
      if (!taskSnap.exists()) throw new Error('Task no longer exists.');
      const currentActual = Number(taskSnap.data().actualMinutes || 0);

      tx.update(taskRef, {
        actualMinutes: currentActual + minutes,
        updatedAt: serverTimestamp(),
      });

      tx.set(
        doc(db, 'projects', params.projectId, 'tasks', params.taskId, 'timeEntries', entryId),
        {
          id: entryId,
          projectId: params.projectId,
          taskId: params.taskId,
          userUid: params.user.uid,
          userName,
          startTime: params.startTimeIso,
          endTime: params.endTimeIso,
          durationMinutes: minutes,
          note: cleanText(params.note, 300),
          isManual: params.isManual,
          createdAt: serverTimestamp(),
        }
      );
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return entryId;
}

export async function deleteTimeEntry(params: {
  projectId: string;
  taskId: string;
  entryId: string;
  durationMinutes: number;
}): Promise<void> {
  const path = `projects/${params.projectId}/tasks/${params.taskId}/timeEntries/${params.entryId}`;
  try {
    await runTransaction(db, async (tx) => {
      const taskRef = doc(db, 'projects', params.projectId, 'tasks', params.taskId);
      const taskSnap = await tx.get(taskRef);
      if (taskSnap.exists()) {
        const currentActual = Number(taskSnap.data().actualMinutes || 0);
        tx.update(taskRef, {
          actualMinutes: Math.max(0, currentActual - params.durationMinutes),
          updatedAt: serverTimestamp(),
        });
      }
      tx.delete(
        doc(db, 'projects', params.projectId, 'tasks', params.taskId, 'timeEntries', params.entryId)
      );
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

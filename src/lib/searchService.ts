import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import type { FilterCriteria, TaskCard } from '../types/pm';
import { cleanText, isOverdueTask, localTodayIso } from './validationService';

export function applyTaskFilters(
  tasks: TaskCard[],
  criteria: FilterCriteria,
  projectName = ''
): TaskCard[] {
  const q = criteria.search.trim().toLowerCase();
  const today = localTodayIso();

  return tasks.filter((t) => {
    if (criteria.status !== 'all' && t.status !== criteria.status) return false;
    if (criteria.priority !== 'all' && t.priority !== criteria.priority) return false;

    if (criteria.assigneeUid === 'unassigned' && t.assigneeUid !== '') return false;
    if (
      criteria.assigneeUid !== 'all' &&
      criteria.assigneeUid !== 'unassigned' &&
      t.assigneeUid !== criteria.assigneeUid
    ) {
      return false;
    }

    if (criteria.reporterUid !== 'all' && t.createdBy !== criteria.reporterUid) return false;
    if (criteria.tag !== 'all' && !(t.tags ?? []).includes(criteria.tag)) return false;
    if (criteria.sprintId !== 'all') {
      if (criteria.sprintId === 'backlog_none' && (t.sprintId ?? '') !== '') return false;
      if (criteria.sprintId !== 'backlog_none' && (t.sprintId ?? '') !== criteria.sprintId) {
        return false;
      }
    }

    if (criteria.overdueOnly && !isOverdueTask(t, today)) return false;
    if (criteria.completion === 'completed' && t.status !== 'done') return false;
    if (criteria.completion === 'open' && t.status === 'done') return false;

    if (criteria.dueDateFrom && (!t.dueDate || t.dueDate < criteria.dueDateFrom)) return false;
    if (criteria.dueDateTo && (!t.dueDate || t.dueDate > criteria.dueDateTo)) return false;

    if (q) {
      const hay = [
        t.taskKey,
        t.title,
        t.description,
        t.assigneeName,
        t.createdByName,
        projectName,
        ...(t.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

export async function saveFilterPreset(params: {
  uid: string;
  name: string;
  projectId: string;
  criteria: FilterCriteria;
}): Promise<string> {
  const name = cleanText(params.name, 60);
  if (!name) throw new Error('Filter preset name is required.');
  const filterId = `flt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `users/${params.uid}/savedFilters/${filterId}`;
  try {
    await setDoc(doc(db, 'users', params.uid, 'savedFilters', filterId), {
      id: filterId,
      name,
      projectId: params.projectId,
      criteriaJson: JSON.stringify(params.criteria),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return filterId;
}

export async function renameFilterPreset(params: {
  uid: string;
  filterId: string;
  name: string;
  projectId: string;
  criteriaJson: string;
}): Promise<void> {
  const name = cleanText(params.name, 60);
  if (!name) throw new Error('Filter preset name is required.');
  const path = `users/${params.uid}/savedFilters/${params.filterId}`;
  try {
    await updateDoc(doc(db, 'users', params.uid, 'savedFilters', params.filterId), {
      name,
      projectId: params.projectId,
      criteriaJson: params.criteriaJson,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFilterPreset(params: {
  uid: string;
  filterId: string;
}): Promise<void> {
  const path = `users/${params.uid}/savedFilters/${params.filterId}`;
  try {
    await deleteDoc(doc(db, 'users', params.uid, 'savedFilters', params.filterId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

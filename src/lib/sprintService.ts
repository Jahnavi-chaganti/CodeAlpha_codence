import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import type { Milestone, Sprint, SprintStatus, TaskCard } from '../types/pm';
import { cleanText } from './validationService';

function safeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createSprint(params: {
  projectId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  existingSprints: Sprint[];
  user: User;
}): Promise<string> {
  const name = cleanText(params.name, 80);
  if (!name) throw new Error('Sprint name is required.');
  if (!params.startDate || !params.endDate) throw new Error('Start and end dates are required.');
  if (params.endDate < params.startDate) {
    throw new Error('Sprint end date cannot be earlier than start date.');
  }
  if (
    params.status === 'active' &&
    params.existingSprints.some((s) => s.status === 'active')
  ) {
    throw new Error('Another sprint is already active. Complete it before starting a new active sprint.');
  }

  const sprintId = safeId('spr');
  const path = `projects/${params.projectId}/sprints/${sprintId}`;
  try {
    await setDoc(doc(db, 'projects', params.projectId, 'sprints', sprintId), {
      id: sprintId,
      projectId: params.projectId,
      name,
      goal: cleanText(params.goal, 500),
      startDate: params.startDate,
      endDate: params.endDate,
      status: params.status,
      retrospectiveNotes: '',
      createdBy: params.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return sprintId;
}

export async function updateSprint(params: {
  projectId: string;
  sprintId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  retrospectiveNotes: string;
  existingSprints: Sprint[];
}): Promise<void> {
  const name = cleanText(params.name, 80);
  if (!name) throw new Error('Sprint name is required.');
  if (params.endDate < params.startDate) {
    throw new Error('Sprint end date cannot be earlier than start date.');
  }
  if (
    params.status === 'active' &&
    params.existingSprints.some((s) => s.status === 'active' && s.id !== params.sprintId)
  ) {
    throw new Error('Only one sprint can be active at a time in this project.');
  }

  const path = `projects/${params.projectId}/sprints/${params.sprintId}`;
  try {
    await updateDoc(doc(db, 'projects', params.projectId, 'sprints', params.sprintId), {
      name,
      goal: cleanText(params.goal, 500),
      startDate: params.startDate,
      endDate: params.endDate,
      status: params.status,
      retrospectiveNotes: cleanText(params.retrospectiveNotes, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSprint(params: {
  projectId: string;
  sprintId: string;
  sprintTasks: TaskCard[];
}): Promise<void> {
  const path = `projects/${params.projectId}/sprints/${params.sprintId}`;
  try {
    const batch = writeBatch(db);
    for (const task of params.sprintTasks) {
      batch.update(doc(db, 'projects', params.projectId, 'tasks', task.id), {
        sprintId: '',
        updatedAt: serverTimestamp(),
      });
    }
    batch.delete(doc(db, 'projects', params.projectId, 'sprints', params.sprintId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function assignTaskToSprint(params: {
  projectId: string;
  taskId: string;
  sprintId: string;
}): Promise<void> {
  const path = `projects/${params.projectId}/tasks/${params.taskId}`;
  try {
    await updateDoc(doc(db, 'projects', params.projectId, 'tasks', params.taskId), {
      sprintId: params.sprintId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createMilestone(params: {
  projectId: string;
  name: string;
  description: string;
  dueDate: string;
  user: User;
}): Promise<string> {
  const name = cleanText(params.name, 80);
  if (!name) throw new Error('Milestone name is required.');
  if (!params.dueDate) throw new Error('Milestone due date is required.');

  const milestoneId = safeId('ms');
  const path = `projects/${params.projectId}/milestones/${milestoneId}`;
  try {
    await setDoc(doc(db, 'projects', params.projectId, 'milestones', milestoneId), {
      id: milestoneId,
      projectId: params.projectId,
      name,
      description: cleanText(params.description, 500),
      dueDate: params.dueDate,
      completed: false,
      createdBy: params.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return milestoneId;
}

export async function updateMilestone(params: {
  projectId: string;
  milestone: Milestone;
  updates: Partial<Pick<Milestone, 'name' | 'description' | 'dueDate' | 'completed'>>;
}): Promise<void> {
  const path = `projects/${params.projectId}/milestones/${params.milestone.id}`;
  try {
    await updateDoc(doc(db, 'projects', params.projectId, 'milestones', params.milestone.id), {
      name: cleanText(params.updates.name ?? params.milestone.name, 80),
      description: cleanText(params.updates.description ?? params.milestone.description, 500),
      dueDate: params.updates.dueDate ?? params.milestone.dueDate,
      completed: params.updates.completed ?? params.milestone.completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMilestone(params: {
  projectId: string;
  milestoneId: string;
}): Promise<void> {
  const path = `projects/${params.projectId}/milestones/${params.milestoneId}`;
  try {
    await deleteDoc(doc(db, 'projects', params.projectId, 'milestones', params.milestoneId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, storage } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { LIMITS, type TaskAttachment } from '../types/pm';
import { cleanText } from './validationService';

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.',
  'application/zip',
];

export function validateAttachmentFile(file: File): string | null {
  if (file.size <= 0) return 'File is empty.';
  if (file.size > LIMITS.ATTACHMENT_MAX_BYTES) {
    return 'File exceeds the 10 MB maximum attachment size.';
  }
  const type = file.type || 'application/octet-stream';
  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => type.startsWith(prefix));
  if (!allowed) {
    return `Unsupported file type (${type}). Allowed: images, PDF, TXT, CSV, Office docs, ZIP.`;
  }
  return null;
}

export async function uploadTaskAttachment(params: {
  projectId: string;
  taskId: string;
  file: File;
  user: User;
  onProgress?: (percent: number) => void;
}): Promise<TaskAttachment> {
  const validationError = validateAttachmentFile(params.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const attachmentId = `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const safeFileName = cleanText(params.file.name, 160).replace(/[^a-zA-Z0-9._ -]/g, '_') || 'file';
  const storagePath = `projects/${params.projectId}/tasks/${params.taskId}/${attachmentId}_${safeFileName}`;
  const storageRef = ref(storage, storagePath);

  const downloadUrl = await new Promise<string>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, params.file, {
      contentType: params.file.type || 'application/octet-stream',
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && params.onProgress) {
          params.onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (err) => {
        const msg = err?.message || 'Storage upload failed.';
        if (msg.includes('storage/unauthorized') || msg.includes('retry-limit-exceeded')) {
          reject(
            new Error(
              'Firebase Storage upload was rejected. Ensure Firebase Storage is enabled and storage.rules are deployed.'
            )
          );
          return;
        }
        reject(new Error(msg));
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      }
    );
  });

  const uploadedByName = cleanText(
    params.user.displayName || params.user.email?.split('@')[0] || 'Member',
    LIMITS.NAME_MAX
  );

  const path = `projects/${params.projectId}/tasks/${params.taskId}/attachments/${attachmentId}`;
  const record: TaskAttachment = {
    id: attachmentId,
    projectId: params.projectId,
    taskId: params.taskId,
    name: safeFileName,
    size: params.file.size,
    contentType: params.file.type || 'application/octet-stream',
    storagePath,
    downloadUrl,
    uploadedBy: params.user.uid,
    uploadedByName,
  };

  try {
    await setDoc(
      doc(db, 'projects', params.projectId, 'tasks', params.taskId, 'attachments', attachmentId),
      {
        ...record,
        createdAt: serverTimestamp(),
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return record;
}

export async function deleteTaskAttachment(params: {
  projectId: string;
  taskId: string;
  attachment: TaskAttachment;
}): Promise<void> {
  try {
    await deleteObject(ref(storage, params.attachment.storagePath));
  } catch (err) {
    console.warn('Storage object removal skipped or unauthorized:', err);
  }

  const path = `projects/${params.projectId}/tasks/${params.taskId}/attachments/${params.attachment.id}`;
  try {
    await deleteDoc(
      doc(db, 'projects', params.projectId, 'tasks', params.taskId, 'attachments', params.attachment.id)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import {
  deleteTaskAttachment,
  formatBytes,
  uploadTaskAttachment,
} from '../lib/attachmentService';
import type { ProjectRole, TaskAttachment } from '../types/pm';

interface TaskAttachmentsProps {
  projectId: string;
  taskId: string;
  currentUser: User;
  currentUserRole: ProjectRole;
}

export function TaskAttachments({
  projectId,
  taskId,
  currentUser,
  currentUserRole,
}: TaskAttachmentsProps) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'projects', projectId, 'tasks', taskId, 'attachments'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAttachments(snap.docs.map((d) => d.data() as TaskAttachment));
      },
      (err) => {
        console.warn('Attachments listener warning:', err);
      }
    );
    return () => unsub();
  }, [projectId, taskId]);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      await uploadTaskAttachment({
        projectId,
        taskId,
        file,
        user: currentUser,
        onProgress: setProgress,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload attachment.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
          <Paperclip className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
          <span>Attachments</span>
          <span className="font-mono text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
            ({attachments.length})
          </span>
        </div>
      </div>

      {/* Blush upload area */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) {
            void handleFileChange(e.dataTransfer.files?.[0] ?? null);
          }
        }}
        className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-[16px] border-2 border-dashed transition-colors cursor-pointer ${
          dragOver
            ? 'border-[#7A2346] bg-[#F8DDE3] dark:border-[#E9A8B8] dark:bg-[#5B1733]/65'
            : 'border-[#C86B88]/45 bg-[#FCE8EC]/70 dark:bg-[#3D1023]/55 hover:border-[#C86B88]'
        }`}
      >
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="w-9 h-9 rounded-[12px] bg-white/85 dark:bg-[#2A0D19]/75 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center shrink-0">
            <Upload className="w-4 h-4 text-[#7A2346] dark:text-[#E9A8B8]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
              {uploading ? `Uploading file (${progress}%)...` : 'Drop a file or click to upload'}
            </p>
            <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
              Specs, screenshots, PDFs, or CSVs up to 10 MB
            </p>
          </div>
        </div>
        <span className="btn-blush px-3 py-1.5 text-xs font-semibold shrink-0">
          {uploading ? `${progress}%` : 'Upload File'}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          disabled={uploading}
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
      </label>

      {uploading && (
        <div className="h-2 w-full rounded-full bg-[#FCE8EC] dark:bg-[#2A0D19]/75 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7A2346] to-[#C86B88] rounded-full transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-2.5 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]"
        >
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] py-1">
          No attachments yet.
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => {
            const isImage = att.contentType.startsWith('image/');
            const canDelete =
              att.uploadedBy === currentUser.uid ||
              currentUserRole === 'owner' ||
              currentUserRole === 'admin';
            return (
              <div
                key={att.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-[#FBEFF1]/75 dark:bg-[#2A0D19]/50"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isImage ? (
                    <img
                      src={att.downloadUrl}
                      alt={att.name}
                      className="w-9 h-9 rounded-[10px] object-cover border border-[#EAD7DE] dark:border-[#E9A8B8]/20 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center text-[#7A2346] dark:text-[#E9A8B8] shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#3D1023] dark:text-[#FFF5F6] truncate">
                      {att.name}
                    </p>
                    <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                      {formatBytes(att.size)} · {att.uploadedByName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={att.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Download file"
                    aria-label={`Download ${att.name}`}
                    className="p-1.5 rounded-[8px] text-[#795D6B] hover:text-[#7A2346] dark:text-[#D9B7C4] dark:hover:text-[#F1BBC8]"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        deleteTaskAttachment({ projectId, taskId, attachment: att })
                      }
                      title="Delete attachment"
                      aria-label={`Delete ${att.name}`}
                      className="p-1.5 rounded-[8px] text-[#A58C98] hover:text-[#D94C65] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

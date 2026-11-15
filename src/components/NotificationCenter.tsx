import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Settings2, Trash2 } from 'lucide-react';
import type { AppNotification } from '../types/pm';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  onSelectTask: (projectId: string, taskId: string) => void;
  onOpenPreferences: () => void;
}

type NotifFilter = 'all' | 'unread' | 'mentions' | 'assignments' | 'deadlines';

function formatRelativeTime(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return 'Just now';
  const maybeSeconds = (ts as { seconds?: number }).seconds;
  if (typeof maybeSeconds !== 'number') return 'Just now';
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - maybeSeconds));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function NotificationCenter({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onSelectTask,
  onOpenPreferences,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotifFilter>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === 'unread') return !n.read;
      if (filter === 'mentions') return n.type === 'user_mentioned' || n.type === 'comment_added';
      if (filter === 'assignments') return n.type === 'task_assigned' || n.type === 'task_reassigned';
      if (filter === 'deadlines') return n.type === 'due_approaching' || n.type === 'task_overdue';
      return true;
    });
  }, [notifications, filter]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative p-2 rounded-[12px] text-[#7A2346] dark:text-[#F1BBC8] hover:bg-[#FCE8EC] dark:hover:bg-[#8F3157]/35 transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-br from-[#8F3157] to-[#5B1733] text-[#FFF5F6] text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-[400px] max-w-[calc(100vw-1.5rem)] glass-strong rounded-[20px] z-50 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[#EAD7DE] dark:border-[#E9A8B8]/15 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="font-mono text-[11px] font-semibold text-[#7A2346] dark:text-[#F1BBC8] tabular-nums">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7A2346] dark:text-[#F1BBC8] hover:text-[#C86B88] hover:underline cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenPreferences();
                }}
                title="Notification preferences"
                aria-label="Notification preferences"
                className="p-1.5 rounded-[10px] text-[#795D6B] hover:text-[#7A2346] dark:text-[#D9B7C4] dark:hover:text-white hover:bg-[#FCE8EC] dark:hover:bg-[#8F3157]/35 transition-colors cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-[#EAD7DE]/70 dark:border-[#E9A8B8]/12 flex items-center gap-1 overflow-x-auto bg-[#FBEFF1]/65 dark:bg-[#3D1023]/55">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
                { id: 'assignments', label: 'Assigned' },
                { id: 'mentions', label: 'Mentions' },
                { id: 'deadlines', label: 'Deadlines' },
              ] as { id: NotifFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-[10px] whitespace-nowrap transition-all cursor-pointer ${
                  filter === tab.id
                    ? 'bg-gradient-to-r from-[#8F3157] to-[#7A2346] text-white shadow-xs'
                    : 'text-[#513443] dark:text-[#D9B7C4] hover:bg-[#FCE8EC] dark:hover:bg-[#8F3157]/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#EAD7DE]/60 dark:divide-[#E9A8B8]/12">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#795D6B] dark:text-[#D9B7C4]">
                No notifications match this filter.
              </div>
            ) : (
              filtered.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 flex items-start gap-2.5 hover:bg-[#FCE8EC]/70 dark:hover:bg-[#8F3157]/20 transition-colors ${
                    !n.read ? 'bg-[#FBEFF1]/85 dark:bg-[#5B1733]/40' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) onMarkRead(n.id);
                      if (n.taskId) {
                        onSelectTask(n.projectId, n.taskId);
                      }
                      setOpen(false);
                    }}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[#3D1023] dark:text-[#FFF5F6] leading-relaxed">
                        {n.message}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 mt-1 rounded-full bg-[#C86B88] shrink-0" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
                      <span className="truncate">{n.projectName}</span>
                      {n.taskKey && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[#7A2346] dark:text-[#F1BBC8]">
                            {n.taskKey}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums shrink-0">{formatRelativeTime(n.createdAt)}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(n.id)}
                    aria-label="Delete notification"
                    title="Delete notification"
                    className="p-1.5 rounded-[10px] text-[#A58C98] hover:text-[#D94C65] hover:bg-[#FCE8EC] dark:hover:bg-[#8F3157]/30 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

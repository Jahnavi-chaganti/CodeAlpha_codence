import { History, Radio, Users } from 'lucide-react';
import type { BoardActivityEvent, PresenceMember, ProjectActivity } from '../types/pm';
import { Avatar } from './Avatar';

interface ActivityFeedViewProps {
  wsConnected: boolean;
  presenceMembers: PresenceMember[];
  events: BoardActivityEvent[];
  persistedActivities: ProjectActivity[];
  onSelectTask?: (taskId: string) => void;
}

function formatClock(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatFirestoreTimestamp(ts: unknown): string {
  if (!ts || typeof ts !== 'object') return 'Just now';
  const seconds = (ts as { seconds?: number }).seconds;
  if (typeof seconds !== 'number') return 'Just now';
  return new Date(seconds * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityFeedView({
  wsConnected,
  presenceMembers,
  events,
  persistedActivities,
  onSelectTask,
}: ActivityFeedViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                  <Radio className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
                </div>
                <h2 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                  Live WebSocket Stream
                </h2>
              </div>
              <span
                className={`text-xs font-medium ${
                  wsConnected
                    ? 'text-[#21865B] dark:text-[#5FD09E]'
                    : 'text-[#C17A43] dark:text-[#E9A8B8]'
                }`}
              >
                {wsConnected ? 'Connected' : 'Reconnecting'}
              </span>
            </div>

            {events.length === 0 ? (
              <div className="px-5 py-8 text-center space-y-1.5">
                <p className="text-xs font-medium text-[#513443] dark:text-[#F8DDE3]">
                  Listening for real-time project events
                </p>
                <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] max-w-sm mx-auto">
                  Live card drags, sprint updates, and teammate edits stream here instantaneously.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#EAD7DE]/70 dark:divide-[#E9A8B8]/12">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-[#FCE8EC]/35 dark:hover:bg-[#5B1733]/25 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar name={ev.actorName} photoURL={ev.actorPhoto} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs text-[#3D1023] dark:text-[#FFF5F6] leading-relaxed">
                          {ev.summary}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
                          <span>{ev.actorName}</span>
                          {ev.taskKey && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() => ev.taskId && onSelectTask?.(ev.taskId)}
                                className="font-mono font-semibold text-[#7A2346] dark:text-[#F1BBC8] hover:underline cursor-pointer"
                              >
                                {ev.taskKey}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-[#A58C98] dark:text-[#B891A1] tabular-nums shrink-0">
                      {formatClock(ev.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                  <History className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
                </div>
                <h2 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                  Persistent Project Audit History
                </h2>
              </div>
              <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                {persistedActivities.length}
              </span>
            </div>

            {persistedActivities.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-[#795D6B] dark:text-[#D9B7C4]">
                No recorded project activity yet.
              </div>
            ) : (
              <ul className="divide-y divide-[#EAD7DE]/70 dark:divide-[#E9A8B8]/12 max-h-[420px] overflow-y-auto">
                {persistedActivities.map((act) => (
                  <li
                    key={act.id}
                    className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-[#FCE8EC]/35 dark:hover:bg-[#5B1733]/25 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar name={act.actorName} photoURL={act.actorPhoto} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs text-[#3D1023] dark:text-[#FFF5F6] leading-relaxed">
                          <span className="font-semibold">{act.actorName}</span>{' '}
                          <span className="text-[#513443] dark:text-[#F8DDE3]">{act.summary}</span>
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
                          <span className="font-mono">{act.action}</span>
                          {act.taskKey && (
                            <>
                              <span aria-hidden="true">·</span>
                              <button
                                type="button"
                                onClick={() => act.taskId && onSelectTask?.(act.taskId)}
                                className="font-mono font-semibold text-[#7A2346] dark:text-[#F1BBC8] hover:underline cursor-pointer"
                              >
                                {act.taskKey}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-[#A58C98] dark:text-[#B891A1] tabular-nums shrink-0">
                      {formatFirestoreTimestamp(act.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="glass-card overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
              </div>
              <h2 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                Active in Room
              </h2>
            </div>
            <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
              {presenceMembers.length}
            </span>
          </div>

          <div className="p-4 space-y-3">
            {presenceMembers.length === 0 ? (
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
                Connecting to room presence...
              </p>
            ) : (
              presenceMembers.map((member) => (
                <div key={member.uid} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      name={member.displayName}
                      photoURL={member.photoURL}
                      size="sm"
                      ringColor={member.color}
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-medium text-[#3D1023] dark:text-[#FFF5F6] truncate">
                        {member.displayName}
                      </span>
                      {member.role && (
                        <span className="block text-[10px] text-[#795D6B] dark:text-[#D9B7C4] capitalize">
                          {member.role}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#21865B] dark:text-[#5FD09E] shrink-0">
                    Online
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

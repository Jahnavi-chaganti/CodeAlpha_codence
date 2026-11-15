import { useEffect, useRef } from 'react';
import { Menu, Plus, Search, Users, WifiOff } from 'lucide-react';
import type { AppNotification, PresenceMember, Project } from '../types/pm';
import { Avatar } from './Avatar';
import { NotificationCenter } from './NotificationCenter';

interface TopBarProps {
  project: Project | null;
  wsConnected: boolean;
  isOnline: boolean;
  presenceMembers: PresenceMember[];
  notifications: AppNotification[];
  searchQuery: string;
  onChangeSearch: (q: string) => void;
  onOpenMobileSidebar: () => void;
  onOpenTeamModal: () => void;
  onOpenNewTaskModal: () => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onSelectTaskFromNotification: (projectId: string, taskId: string) => void;
  onOpenNotificationPreferences: () => void;
}

export function TopBar({
  project,
  wsConnected,
  isOnline,
  presenceMembers,
  notifications,
  searchQuery,
  onChangeSearch,
  onOpenMobileSidebar,
  onOpenTeamModal,
  onOpenNewTaskModal,
  onMarkNotificationRead,
  onMarkAllRead,
  onDeleteNotification,
  onSelectTaskFromNotification,
  onOpenNotificationPreferences,
}: TopBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="no-print h-16 px-3 sm:px-6 glass-nav flex items-center justify-between gap-3 shrink-0 z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open project sidebar"
          className="lg:hidden p-2 -ml-1 rounded-[12px] text-[#7A2346] dark:text-[#F1BBC8] hover:bg-[#FCE8EC] dark:hover:bg-[#8F3157]/30 transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        {project ? (
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="hidden xl:inline text-[#795D6B] dark:text-[#D9B7C4] whitespace-nowrap">
              Projects
            </span>
            <span className="hidden xl:inline text-[#D989A2] dark:text-[#8F3157]" aria-hidden="true">
              /
            </span>
            <h1 className="font-display font-bold text-[#3D1023] dark:text-[#FFF5F6] truncate max-w-[140px] sm:max-w-[240px]">
              {project.name}
            </h1>
            <span className="font-mono text-xs font-semibold text-[#8F3157] dark:text-[#E9A8B8] shrink-0">
              {project.key}
            </span>
          </div>
        ) : (
          <span className="font-display text-sm font-bold text-[#3D1023] dark:text-[#FFF5F6]">
            Workspace
          </span>
        )}
      </div>

      {project && (
        <div className="hidden md:flex relative flex-1 max-w-xs mx-2">
          <Search className="w-3.5 h-3.5 text-[#8F3157] dark:text-[#E9A8B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder="Quick search tasks (Ctrl+K)..."
            aria-label="Quick search tasks"
            className="input-blush w-full pl-9 pr-3 py-1.5 text-xs"
          />
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {!isOnline && (
          <div
            role="status"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[12px] bg-[#D99A35]/12 border border-[#D99A35]/35 text-[11px] font-semibold text-[#9E6A14] dark:text-[#F0BF67]"
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}

        {project && isOnline && (
          <div
            className="hidden sm:flex items-center gap-2.5 pr-2.5 border-r border-[#EAD7DE] dark:border-[#E9A8B8]/20"
            title={wsConnected ? 'Real-time WebSocket room connected' : 'Connecting real-time sync'}
          >
            <div className="flex items-center gap-1.5 text-xs text-[#795D6B] dark:text-[#D9B7C4] whitespace-nowrap">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-[#21865B]' : 'bg-[#D99A35]'
                }`}
              />
              <span className="hidden lg:inline font-medium">
                {wsConnected ? 'Live' : 'Syncing'}
              </span>
            </div>

            {presenceMembers.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {presenceMembers.slice(0, 4).map((member) => (
                  <Avatar
                    key={member.uid}
                    name={member.displayName}
                    photoURL={member.photoURL}
                    size="sm"
                    ringColor={member.color}
                  />
                ))}
                {presenceMembers.length > 4 && (
                  <span className="w-6 h-6 rounded-full bg-[#FCE8EC] dark:bg-[#5B1733] text-[10px] font-mono font-semibold flex items-center justify-center text-[#7A2346] dark:text-[#FFF5F6] ring-1 ring-[#EAD7DE] dark:ring-[#E9A8B8]/25">
                    +{presenceMembers.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <NotificationCenter
          notifications={notifications}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllRead}
          onDelete={onDeleteNotification}
          onSelectTask={onSelectTaskFromNotification}
          onOpenPreferences={onOpenNotificationPreferences}
        />

        {project && (
          <>
            <button
              type="button"
              onClick={onOpenTeamModal}
              className="btn-blush hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team</span>
            </button>

            <button
              type="button"
              onClick={onOpenNewTaskModal}
              className="btn-burgundy inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">New Task</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}

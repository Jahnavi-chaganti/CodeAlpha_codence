import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Columns3,
  Download,
  FolderKanban,
  GanttChartSquare,
  KeyRound,
  Layers,
  List,
  LogOut,
  Plus,
  Rocket,
  Users,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ProjectMembership, WorkspaceView } from '../types/pm';
import { Avatar } from './Avatar';

interface SidebarProps {
  user: User;
  memberships: ProjectMembership[];
  activeProjectId: string | null;
  activeView: WorkspaceView;
  overdueCount: number;
  myTasksCount: number;
  onSelectView: (view: WorkspaceView) => void;
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onOpenJoinProject: () => void;
  onSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: {
  id: WorkspaceView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'board', label: 'Kanban Board', icon: Columns3 },
  { id: 'list', label: 'Task List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  { id: 'my_tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { id: 'sprints', label: 'Sprints & Milestones', icon: Rocket },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'team', label: 'Team & Invites', icon: Users },
  { id: 'activity', label: 'Activity Feed', icon: Activity },
  { id: 'export', label: 'Export & Reports', icon: Download },
];

export function Sidebar({
  user,
  memberships,
  activeProjectId,
  activeView,
  overdueCount,
  myTasksCount,
  onSelectView,
  onSelectProject,
  onOpenNewProject,
  onOpenJoinProject,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';

  const content = (
    <aside className="no-print flex flex-col h-full w-[268px] sidebar-burgundy text-[#FFF5F6] select-none shadow-[10px_0_32px_-16px_rgba(42,13,25,0.55)]">
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#E9A8B8]/15 shrink-0">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-[12px] bg-gradient-to-br from-[#E9A8B8] via-[#C86B88] to-[#8F3157] flex items-center justify-center text-[#FFF5F6] shadow-md ring-1 ring-white/25">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-base font-bold tracking-tight text-white block leading-none">
              Cadence
            </span>
            <span className="text-[10px] text-[#F1BBC8]/80 tracking-wider uppercase font-medium">
              Workspace
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-[12px] text-[#F1BBC8] hover:text-white hover:bg-[#E9A8B8]/15 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {activeProjectId && (
          <div className="space-y-1.5">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#E9A8B8]/75">
              Views
            </p>
            <nav className="space-y-0.5" aria-label="Workspace views">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                const badge =
                  item.id === 'overdue' && overdueCount > 0
                    ? overdueCount
                    : item.id === 'my_tasks' && myTasksCount > 0
                      ? myTasksCount
                      : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectView(item.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[12px] text-xs font-medium transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#C86B88] to-[#8F3157] text-white shadow-[0_8px_18px_-8px_rgba(200,107,136,0.65)] ring-1 ring-[#F1BBC8]/30'
                        : 'text-[#FFF5F6]/85 hover:bg-[#E9A8B8]/12 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-[#E9A8B8]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badge !== null && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isActive
                            ? 'text-white'
                            : item.id === 'overdue'
                              ? 'text-[#F18B9E] font-semibold'
                              : 'text-[#F1BBC8]'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        <div className="pt-4 border-t border-[#E9A8B8]/15 space-y-1.5">
          <div className="px-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#E9A8B8]/75">
              Projects
            </span>
            <button
              type="button"
              onClick={onOpenNewProject}
              title="Create project or use template"
              aria-label="Create project"
              className="p-1 rounded-[10px] text-[#E9A8B8] hover:text-white hover:bg-[#E9A8B8]/15 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {memberships.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#F1BBC8]/75">
              No projects yet. Create from a template or join via invite.
            </div>
          ) : (
            <nav className="space-y-0.5" aria-label="Project list">
              {memberships.map((m) => {
                const isActive = m.projectId === activeProjectId;
                return (
                  <button
                    key={m.projectId}
                    type="button"
                    onClick={() => {
                      onSelectProject(m.projectId);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[12px] text-xs transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[#8F3157]/75 text-white font-semibold ring-1 ring-[#E9A8B8]/25'
                        : 'text-[#FFF5F6]/85 hover:bg-[#E9A8B8]/12 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FolderKanban
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#F1BBC8]' : 'text-[#E9A8B8]'
                        }`}
                      />
                      <span className="truncate">{m.projectName}</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#F1BBC8]/80 shrink-0">
                      {m.projectKey}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <div className="pt-4 border-t border-[#E9A8B8]/15 space-y-1">
          <button
            type="button"
            onClick={() => {
              onOpenNewProject();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-xs font-medium text-[#FFF5F6]/90 hover:bg-[#E9A8B8]/12 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#E9A8B8] shrink-0" />
            <span>New project / template</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenJoinProject();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-xs font-medium text-[#FFF5F6]/90 hover:bg-[#E9A8B8]/12 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#E9A8B8] shrink-0" />
            <span>Join via invite code</span>
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-[#E9A8B8]/15 flex items-center justify-between gap-2 shrink-0 bg-[#2A0D19]/75">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={displayName} photoURL={user.photoURL ?? ''} size="md" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{displayName}</p>
            <p className="text-[11px] text-[#F1BBC8]/75 truncate">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="p-2 rounded-[12px] text-[#E9A8B8] hover:text-white hover:bg-[#E9A8B8]/15 transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block shrink-0 h-full">{content}</div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#2A0D19]/65 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
}

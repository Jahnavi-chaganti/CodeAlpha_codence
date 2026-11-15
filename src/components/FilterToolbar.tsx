import { useState } from 'react';
import {
  Activity,
  CalendarDays,
  Columns3,
  GanttChartSquare,
  List,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import {
  BOARD_COLUMNS,
  DEFAULT_FILTER_CRITERIA,
  type FilterCriteria,
  type ProjectMember,
  type SavedFilter,
  type Sprint,
  type TaskCard,
  type TaskPriority,
  type TaskStatus,
  type WorkspaceView,
} from '../types/pm';
import { SavedFilters } from './SavedFilters';

interface FilterToolbarProps {
  view: WorkspaceView;
  onChangeView: (view: WorkspaceView) => void;
  criteria: FilterCriteria;
  onChangeCriteria: (next: FilterCriteria) => void;
  members: ProjectMember[];
  sprints: Sprint[];
  tasks: TaskCard[];
  uid: string;
  projectId: string;
  savedFilters: SavedFilter[];
  onOpenTeamModal: () => void;
}

export function FilterToolbar({
  view,
  onChangeView,
  criteria,
  onChangeCriteria,
  members,
  sprints,
  tasks,
  uid,
  projectId,
  savedFilters,
  onOpenTeamModal,
}: FilterToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const uniqueTags = Array.from(
    new Set(tasks.flatMap((t) => t.tags ?? []))
  ).sort();

  const hasActiveFilters =
    criteria.search.trim().length > 0 ||
    criteria.status !== 'all' ||
    criteria.priority !== 'all' ||
    criteria.assigneeUid !== 'all' ||
    criteria.reporterUid !== 'all' ||
    criteria.tag !== 'all' ||
    criteria.sprintId !== 'all' ||
    criteria.overdueOnly ||
    criteria.completion !== 'all' ||
    Boolean(criteria.dueDateFrom) ||
    Boolean(criteria.dueDateTo);

  const totalCount = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="no-print px-3 sm:px-6 py-2.5 bg-white/60 dark:bg-[#3D1023]/55 backdrop-blur-[20px] border-b border-[rgba(143,49,87,0.14)] dark:border-[#E9A8B8]/15 space-y-2.5 shrink-0 z-20">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div
            className="inline-flex items-center p-0.5 rounded-[12px] bg-[#FCE8EC]/85 dark:bg-[#2A0D19]/75 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 overflow-x-auto max-w-full"
            role="tablist"
            aria-label="Primary task views"
          >
            {(
              [
                { id: 'board', label: 'Board', icon: Columns3 },
                { id: 'list', label: 'List', icon: List },
                { id: 'calendar', label: 'Calendar', icon: CalendarDays },
                { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
                { id: 'activity', label: 'Activity', icon: Activity },
              ] as {
                id: WorkspaceView;
                label: string;
                icon: React.ComponentType<{ className?: string }>;
              }[]
            ).map((tab) => {
              const Icon = tab.icon;
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onChangeView(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-[#8F3157] to-[#7A2346] text-white shadow-xs'
                      : 'text-[#513443] dark:text-[#D9B7C4] hover:text-[#7A2346] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="md:hidden relative flex-1 min-w-[150px]">
            <Search className="w-3.5 h-3.5 text-[#8F3157] dark:text-[#E9A8B8] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={criteria.search}
              onChange={(e) => onChangeCriteria({ ...criteria, search: e.target.value })}
              placeholder="Filter tasks..."
              className="input-blush w-full pl-8 pr-3 py-1.5 text-xs"
            />
          </div>

          <select
            value={criteria.priority}
            onChange={(e) =>
              onChangeCriteria({
                ...criteria,
                priority: e.target.value as TaskPriority | 'all',
              })
            }
            aria-label="Filter by priority"
            className="input-blush px-2.5 py-1.5 text-xs cursor-pointer"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={criteria.assigneeUid}
            onChange={(e) =>
              onChangeCriteria({ ...criteria, assigneeUid: e.target.value })
            }
            aria-label="Filter by assignee"
            className="input-blush px-2.5 py-1.5 text-xs cursor-pointer max-w-[150px]"
          >
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.displayName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            aria-expanded={advancedOpen}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[12px] border transition-colors cursor-pointer whitespace-nowrap ${
              advancedOpen
                ? 'border-[#C86B88] bg-[#FCE8EC] dark:bg-[#8F3157]/45 text-[#7A2346] dark:text-[#FFF5F6]'
                : 'btn-blush'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>More</span>
          </button>

          <SavedFilters
            uid={uid}
            projectId={projectId}
            savedFilters={savedFilters}
            currentCriteria={criteria}
            onApplyCriteria={onChangeCriteria}
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => onChangeCriteria(DEFAULT_FILTER_CRITERIA)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#7A2346] dark:text-[#F1BBC8] hover:text-[#D94C65] cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-[#795D6B] dark:text-[#D9B7C4] shrink-0">
          <div className="hidden xl:flex items-center gap-2 font-mono tabular-nums">
            <span>{totalCount} total</span>
            <span aria-hidden="true">·</span>
            <span>{inProgressCount} active</span>
            <span aria-hidden="true">·</span>
            <span>{doneCount} done</span>
          </div>

          <button
            type="button"
            onClick={onOpenTeamModal}
            className="btn-blush sm:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team</span>
          </button>
        </div>
      </div>

      {advancedOpen && (
        <div className="pt-2.5 border-t border-[#EAD7DE]/70 dark:border-[#E9A8B8]/15 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-[#795D6B] dark:text-[#D9B7C4] mb-1">
              Status
            </label>
            <select
              value={criteria.status}
              onChange={(e) =>
                onChangeCriteria({
                  ...criteria,
                  status: e.target.value as TaskStatus | 'all',
                })
              }
              className="input-blush w-full px-2.5 py-1.5 text-xs"
            >
              <option value="all">All statuses</option>
              {BOARD_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#795D6B] dark:text-[#D9B7C4] mb-1">
              Tag
            </label>
            <select
              value={criteria.tag}
              onChange={(e) => onChangeCriteria({ ...criteria, tag: e.target.value })}
              className="input-blush w-full px-2.5 py-1.5 text-xs"
            >
              <option value="all">All tags</option>
              {uniqueTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#795D6B] dark:text-[#D9B7C4] mb-1">
              Sprint
            </label>
            <select
              value={criteria.sprintId}
              onChange={(e) =>
                onChangeCriteria({ ...criteria, sprintId: e.target.value })
              }
              className="input-blush w-full px-2.5 py-1.5 text-xs"
            >
              <option value="all">All sprints</option>
              <option value="backlog_none">No sprint</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#795D6B] dark:text-[#D9B7C4] mb-1">
              Due From
            </label>
            <input
              type="date"
              value={criteria.dueDateFrom}
              onChange={(e) =>
                onChangeCriteria({ ...criteria, dueDateFrom: e.target.value })
              }
              className="input-blush w-full px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#795D6B] dark:text-[#D9B7C4] mb-1">
              Due To
            </label>
            <input
              type="date"
              value={criteria.dueDateTo}
              onChange={(e) =>
                onChangeCriteria({ ...criteria, dueDateTo: e.target.value })
              }
              className="input-blush w-full px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="flex items-center gap-3 pb-1">
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3D1023] dark:text-[#FFF5F6] cursor-pointer">
              <input
                type="checkbox"
                checked={criteria.overdueOnly}
                onChange={(e) =>
                  onChangeCriteria({ ...criteria, overdueOnly: e.target.checked })
                }
                className="rounded border-[#EAD7DE] dark:border-[#E9A8B8]/30 accent-[#7A2346]"
              />
              <span>Overdue only</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

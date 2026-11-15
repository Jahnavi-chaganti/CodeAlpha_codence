import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  CheckSquare,
  Clock,
  MessageSquare,
  Repeat,
  ShieldAlert,
} from 'lucide-react';
import type { RemoteDragState, TaskCard } from '../types/pm';
import {
  formatMinutes,
  getIncompleteBlockers,
  isDueSoonTask,
  isOverdueTask,
} from '../lib/validationService';
import { Avatar } from './Avatar';
import { PriorityBadge } from './PriorityBadge';

interface TaskCardItemProps {
  task: TaskCard;
  allTasks?: TaskCard[];
  onSelect: (task: TaskCard) => void;
  remoteDrag?: RemoteDragState;
  isOverlay?: boolean;
}

export function TaskCardItem({
  task,
  allTasks = [],
  onSelect,
  remoteDrag,
  isOverlay = false,
}: TaskCardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
    disabled: isOverlay,
  });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        transition,
      };

  const overdue = isOverdueTask(task);
  const dueSoon = !overdue && isDueSoonTask(task, 2);
  const subtasks = task.subtasks ?? [];
  const subtasksDone = subtasks.filter((s) => s.completed).length;
  const incompleteBlockers =
    allTasks.length > 0 ? getIncompleteBlockers(task, allTasks) : [];
  const isBlocked = incompleteBlockers.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
          onSelect(task);
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(task);
        }
      }}
      className={`group rounded-[16px] border bg-white/85 dark:bg-[#2A0D19]/75 backdrop-blur-md p-3.5 text-left transition-all duration-150 select-none cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C86B88] ${
        isDragging
          ? 'opacity-35 border-dashed border-[#C86B88]'
          : isOverlay
            ? 'border-[#C86B88] shadow-2xl ring-2 ring-[#C86B88]/30 rotate-[0.5deg]'
            : remoteDrag
              ? 'border-[#C86B88] shadow-[0_8px_20px_-8px_rgba(200,107,136,0.45)]'
              : overdue
                ? 'border-[#D94C65]/45 hover:border-[#D94C65]/80 shadow-[0_6px_18px_-10px_rgba(217,76,101,0.22)]'
                : 'border-[#EAD7DE] dark:border-[#E9A8B8]/18 hover:border-[#C86B88]/60 hover:-translate-y-0.5 shadow-[0_6px_18px_-12px_rgba(61,16,35,0.14)]'
      }`}
    >
      {remoteDrag && (
        <div
          className="mb-2 text-[11px] font-semibold flex items-center gap-1.5"
          style={{ color: remoteDrag.color }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: remoteDrag.color }}
          />
          <span className="truncate">{remoteDrag.actorName} is moving this card</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[11px] font-semibold text-[#8F3157] dark:text-[#F1BBC8] tabular-nums">
            {task.taskKey}
          </span>
          {task.recurrence?.active && (
            <Repeat
              className="w-3 h-3 text-[#7A2346] dark:text-[#E9A8B8] shrink-0"
              aria-label="Recurring task"
            />
          )}
          {isBlocked && (
            <span
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#D99A35] dark:text-[#F0BF67]"
              title={`Blocked by ${incompleteBlockers.map((b) => b.taskKey).join(', ')}`}
            >
              <ShieldAlert className="w-3 h-3" />
              <span>Blocked</span>
            </span>
          )}
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      <h3 className="text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6] leading-snug line-clamp-2 group-hover:text-[#7A2346] dark:group-hover:text-[#F1BBC8] transition-colors">
        {task.title}
      </h3>

      {task.tags.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#795D6B] dark:text-[#D9B7C4] truncate">
          {task.tags.map((tag, idx) => (
            <span key={tag} className="inline-flex items-center gap-1.5">
              {idx > 0 && <span aria-hidden="true">·</span>}
              <span>#{tag}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-[#EAD7DE]/70 dark:border-[#E9A8B8]/12 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-[11px] text-[#795D6B] dark:text-[#D9B7C4] font-mono tabular-nums min-w-0">
          {subtasks.length > 0 && (
            <span
              className={`inline-flex items-center gap-1 ${
                subtasksDone === subtasks.length ? 'text-[#21865B] dark:text-[#5AD29D]' : ''
              }`}
              title={`${subtasksDone} of ${subtasks.length} subtasks complete`}
            >
              <CheckSquare className="w-3 h-3" />
              <span>
                {subtasksDone}/{subtasks.length}
              </span>
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1" title={`${task.commentCount} comments`}>
              <MessageSquare className="w-3 h-3" />
              <span>{task.commentCount}</span>
            </span>
          )}
          {(task.actualMinutes ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1" title="Logged time">
              <Clock className="w-3 h-3" />
              <span>{formatMinutes(task.actualMinutes)}</span>
            </span>
          )}
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 ${
                overdue
                  ? 'text-[#D94C65] dark:text-[#F68398] font-semibold'
                  : dueSoon
                    ? 'text-[#D99A35] dark:text-[#F0BF67] font-semibold'
                    : ''
              }`}
              title={overdue ? `Overdue (due ${task.dueDate})` : `Due ${task.dueDate}`}
            >
              <Calendar className="w-3 h-3" />
              <span>{task.dueDate.slice(5)}</span>
            </span>
          )}
        </div>

        {task.assigneeUid ? (
          <Avatar
            name={task.assigneeName || 'Assignee'}
            photoURL={task.assigneePhoto}
            size="xs"
          />
        ) : (
          <span className="text-[11px] text-[#A58C98] dark:text-[#B891A1] shrink-0">
            Unassigned
          </span>
        )}
      </div>
    </div>
  );
}

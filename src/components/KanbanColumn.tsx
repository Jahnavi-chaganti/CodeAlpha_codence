import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { RemoteDragState, TaskCard, TaskStatus } from '../types/pm';
import { TaskCardItem } from './TaskCardItem';

interface KanbanColumnProps {
  id: TaskStatus;
  label: string;
  description: string;
  tasks: TaskCard[];
  allTasks: TaskCard[];
  remoteDrags: Record<string, RemoteDragState>;
  onSelectTask: (task: TaskCard) => void;
  onQuickCreate: (status: TaskStatus) => void;
}

export function KanbanColumn({
  id,
  label,
  description,
  tasks,
  allTasks,
  remoteDrags,
  onSelectTask,
  onQuickCreate,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      status: id,
    },
  });

  return (
    <section
      aria-label={label}
      className={`flex flex-col w-[292px] sm:w-[316px] shrink-0 rounded-[20px] border backdrop-blur-[20px] transition-all duration-150 max-h-full ${
        isOver
          ? 'bg-[#FCE8EC]/85 dark:bg-[#5B1733]/75 border-[#C86B88] shadow-[0_14px_32px_-12px_rgba(122,35,70,0.28)]'
          : 'bg-[#FBEFF1]/72 dark:bg-[#3D1023]/60 border-[rgba(143,49,87,0.14)] dark:border-[#E9A8B8]/16 shadow-[0_10px_28px_-14px_rgba(61,16,35,0.12)]'
      }`}
    >
      <div className="px-4 py-3.5 flex items-center justify-between gap-2 border-b border-[rgba(143,49,87,0.12)] dark:border-[#E9A8B8]/14 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xs font-bold text-[#7A2346] dark:text-[#FFF5F6] truncate uppercase tracking-wide">
              {label}
            </h2>
            <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-[8px] bg-[#FCE8EC] dark:bg-[#8F3157]/45 text-[#7A2346] dark:text-[#F1BBC8] tabular-nums">
              {tasks.length}
            </span>
          </div>
          <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4] truncate mt-0.5">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onQuickCreate(id)}
          title={`Add task to ${label}`}
          aria-label={`Add task to ${label}`}
          className="p-1.5 rounded-[10px] text-[#8F3157] hover:text-[#7A2346] hover:bg-white/80 dark:text-[#E9A8B8] dark:hover:text-white dark:hover:bg-[#8F3157]/40 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[140px]"
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="h-28 rounded-[16px] border border-dashed border-[#D989A2]/60 dark:border-[#E9A8B8]/25 bg-white/40 dark:bg-[#2A0D19]/30 flex flex-col items-center justify-center text-center px-4">
              <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
                Drop a task here or add a new card
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCardItem
                key={task.id}
                task={task}
                allTasks={allTasks}
                onSelect={onSelectTask}
                remoteDrag={remoteDrags[task.id]}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}

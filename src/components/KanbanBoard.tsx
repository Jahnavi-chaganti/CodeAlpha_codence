import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  BOARD_COLUMNS,
  type RemoteDragState,
  type TaskCard,
  type TaskStatus,
} from '../types/pm';
import { KanbanColumn } from './KanbanColumn';
import { TaskCardItem } from './TaskCardItem';

interface KanbanBoardProps {
  tasks: TaskCard[];
  allTasks: TaskCard[];
  remoteDrags: Record<string, RemoteDragState>;
  onSelectTask: (task: TaskCard) => void;
  onQuickCreate: (status: TaskStatus) => void;
  onMoveTask: (task: TaskCard, newStatus: TaskStatus, newPosition: number) => Promise<boolean | void>;
  onDragStartSignal: (taskId: string, taskKey: string) => void;
  onDragEndSignal: (taskId: string) => void;
}

function computeNewPosition(columnTasks: TaskCard[], targetIndex: number): number {
  if (columnTasks.length === 0) return 1000;
  if (targetIndex <= 0) {
    return columnTasks[0].position / 2;
  }
  if (targetIndex >= columnTasks.length) {
    return columnTasks[columnTasks.length - 1].position + 1000;
  }
  const prev = columnTasks[targetIndex - 1].position;
  const next = columnTasks[targetIndex].position;
  return (prev + next) / 2;
}

export function KanbanBoard({
  tasks,
  allTasks,
  remoteDrags,
  onSelectTask,
  onQuickCreate,
  onMoveTask,
  onDragStartSignal,
  onDragEndSignal,
}: KanbanBoardProps) {
  const [localTasks, setLocalTasks] = useState<TaskCard[]>(tasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTaskId) {
      setLocalTasks(tasks);
    }
  }, [tasks, activeTaskId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tasksByColumn = useMemo(() => {
    const grouped: Record<TaskStatus, TaskCard[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      done: [],
    };
    for (const t of localTasks) {
      grouped[t.status]?.push(t);
    }
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => a.position - b.position);
    }
    return grouped;
  }, [localTasks]);

  const activeTask = useMemo(
    () => localTasks.find((t) => t.id === activeTaskId) ?? null,
    [localTasks, activeTaskId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveTaskId(id);
    const task = localTasks.find((t) => t.id === id);
    if (task) {
      onDragStartSignal(task.id, task.taskKey);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeItem = localTasks.find((t) => t.id === activeId);
    if (!activeItem) return;

    const isOverColumn = BOARD_COLUMNS.some((c) => c.id === overId);
    const overTask = isOverColumn ? null : localTasks.find((t) => t.id === overId);
    const targetStatus: TaskStatus | null = isOverColumn
      ? (overId as TaskStatus)
      : overTask
        ? overTask.status
        : null;

    if (!targetStatus || activeItem.status === targetStatus) return;

    setLocalTasks((prev) => {
      const targetColTasks = prev
        .filter((t) => t.status === targetStatus && t.id !== activeId)
        .sort((a, b) => a.position - b.position);

      let insertIndex = targetColTasks.length;
      if (overTask) {
        const idx = targetColTasks.findIndex((t) => t.id === overTask.id);
        if (idx >= 0) insertIndex = idx;
      }

      const newPos = computeNewPosition(targetColTasks, insertIndex);
      return prev.map((t) =>
        t.id === activeId ? { ...t, status: targetStatus, position: newPos } : t
      );
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = String(active.id);
    onDragEndSignal(activeId);

    if (!over) {
      setActiveTaskId(null);
      setLocalTasks(tasks);
      return;
    }

    const overId = String(over.id);
    const currentItem = localTasks.find((t) => t.id === activeId);
    const originalItem = tasks.find((t) => t.id === activeId);

    if (!currentItem || !originalItem) {
      setActiveTaskId(null);
      return;
    }

    const isOverColumn = BOARD_COLUMNS.some((c) => c.id === overId);
    const overTask = isOverColumn ? null : localTasks.find((t) => t.id === overId);
    const targetStatus: TaskStatus = isOverColumn
      ? (overId as TaskStatus)
      : overTask
        ? overTask.status
        : currentItem.status;

    const colTasks = localTasks
      .filter((t) => t.status === targetStatus)
      .sort((a, b) => a.position - b.position);

    const oldIndex = colTasks.findIndex((t) => t.id === activeId);
    let finalPosition = currentItem.position;

    if (overTask && overTask.status === targetStatus && oldIndex !== -1) {
      const newIndex = colTasks.findIndex((t) => t.id === overTask.id);
      if (newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(colTasks, oldIndex, newIndex);
        const withoutActive = reordered.filter((t) => t.id !== activeId);
        const placedIdx = reordered.findIndex((t) => t.id === activeId);
        finalPosition = computeNewPosition(withoutActive, placedIdx);

        setLocalTasks((prev) =>
          prev.map((t) =>
            t.id === activeId ? { ...t, status: targetStatus, position: finalPosition } : t
          )
        );
      }
    }

    setActiveTaskId(null);

    if (
      originalItem.status !== targetStatus ||
      Math.abs(originalItem.position - finalPosition) > 0.0001
    ) {
      try {
        const ok = await onMoveTask(originalItem, targetStatus, finalPosition);
        if (ok === false) {
          setLocalTasks(tasks);
        }
      } catch {
        setLocalTasks(tasks);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        if (activeTaskId) onDragEndSignal(activeTaskId);
        setActiveTaskId(null);
        setLocalTasks(tasks);
      }}
    >
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-3 sm:px-6 py-4 sm:py-5">
        <div className="flex items-start gap-4 h-full min-w-max">
          {BOARD_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              description={col.description}
              tasks={tasksByColumn[col.id]}
              allTasks={allTasks}
              remoteDrags={remoteDrags}
              onSelectTask={onSelectTask}
              onQuickCreate={onQuickCreate}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-[292px]">
            <TaskCardItem task={activeTask} allTasks={allTasks} onSelect={() => {}} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

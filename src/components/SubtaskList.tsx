import { useState, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { LIMITS, type SubtaskItem } from '../types/pm';

interface SubtaskListProps {
  subtasks: SubtaskItem[];
  onChange: (next: SubtaskItem[]) => void;
  disabled?: boolean;
}

export function SubtaskList({ subtasks, onChange, disabled = false }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const completedCount = subtasks.filter((s) => s.completed).length;
  const pct = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim().slice(0, 160);
    if (!title || subtasks.length >= LIMITS.SUBTASKS_MAX) return;
    const item: SubtaskItem = {
      id: `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    onChange([...subtasks, item]);
    setNewTitle('');
  };

  const handleToggle = (id: string) => {
    onChange(subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)));
  };

  const handleDelete = (id: string) => {
    onChange(subtasks.filter((s) => s.id !== id));
  };

  const startEdit = (item: SubtaskItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
  };

  const saveEdit = (id: string) => {
    const clean = editTitle.trim().slice(0, 160);
    if (!clean) {
      handleDelete(id);
    } else {
      onChange(subtasks.map((s) => (s.id === id ? { ...s, title: clean } : s)));
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
          Subtasks &amp; Checklist
        </span>
        <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
          {completedCount}/{subtasks.length} ({pct}%)
        </span>
      </div>

      {subtasks.length > 0 && (
        <div className="h-2 w-full rounded-full bg-[#FCE8EC] dark:bg-[#2A0D19]/75 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7A2346] to-[#C86B88] rounded-full transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {subtasks.length > 0 && (
        <ul className="space-y-1.5">
          {subtasks.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2.5 p-2.5 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-[#FBEFF1]/75 dark:bg-[#2A0D19]/50"
            >
              <input
                type="checkbox"
                checked={item.completed}
                disabled={disabled}
                onChange={() => handleToggle(item.id)}
                aria-label={`Mark "${item.title}" as ${item.completed ? 'incomplete' : 'complete'}`}
                className="rounded border-[#C86B88] accent-[#7A2346] cursor-pointer"
              />

              {editingId === item.id ? (
                <div className="flex-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editTitle}
                    maxLength={160}
                    autoFocus
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveEdit(item.id);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    className="input-blush flex-1 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(item.id)}
                    aria-label="Save subtask"
                    className="p-1 text-[#21865B] hover:bg-[#21865B]/12 dark:text-[#5FD09E] rounded-[8px] cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel edit"
                    className="p-1 text-[#A58C98] hover:text-[#3D1023] dark:hover:text-[#FFF5F6] rounded-[8px] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className={`flex-1 text-xs ${
                      item.completed
                        ? 'line-through text-[#A58C98] dark:text-[#B891A1]'
                        : 'text-[#3D1023] dark:text-[#FFF5F6]'
                    }`}
                  >
                    {item.title}
                  </span>
                  {!disabled && (
                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label={`Edit "${item.title}"`}
                        className="p-1 text-[#A58C98] hover:text-[#7A2346] dark:hover:text-[#F1BBC8] cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        aria-label={`Delete "${item.title}"`}
                        className="p-1 text-[#A58C98] hover:text-[#D94C65] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && subtasks.length < LIMITS.SUBTASKS_MAX && (
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            maxLength={160}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a subtask..."
            className="input-blush flex-1 px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="btn-blush inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>
      )}
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Flag, Plus, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Milestone, ProjectRole, TaskCard } from '../types/pm';
import {
  createMilestone,
  deleteMilestone,
  updateMilestone,
} from '../lib/sprintService';
import { localTodayIso } from '../lib/validationService';

interface MilestoneManagerProps {
  projectId: string;
  milestones: Milestone[];
  tasks: TaskCard[];
  user: User;
  role: ProjectRole;
}

export function MilestoneManager({
  projectId,
  milestones,
  tasks,
  user,
  role,
}: MilestoneManagerProps) {
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState(() => localTodayIso());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = role === 'owner' || role === 'admin';

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createMilestone({ projectId, name, description, dueDate, user });
      setName('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create milestone.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
            <Flag className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
          </div>
          <h3 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
            Project Milestones
          </h3>
        </div>
        <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
          {milestones.length}
        </span>
      </div>

      {error && (
        <div className="p-2.5 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]">
          {error}
        </div>
      )}

      {canManage && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Milestone name (e.g. v1.2 Release)"
            required
            className="input-blush sm:col-span-2 px-3 py-1.5 text-xs"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="input-blush px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-burgundy inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-60 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Milestone</span>
          </button>
        </form>
      )}

      {milestones.length === 0 ? (
        <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] py-2">
          No milestones defined yet. Link tasks to milestones from the task detail drawer.
        </p>
      ) : (
        <div className="divide-y divide-[#EAD7DE]/80 dark:divide-[#E9A8B8]/15">
          {milestones.map((ms) => {
            const linked = tasks.filter((t) => t.milestoneId === ms.id);
            const done = linked.filter((t) => t.status === 'done').length;
            const pct = linked.length > 0 ? Math.round((done / linked.length) * 100) : ms.completed ? 100 : 0;

            return (
              <div key={ms.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          ms.completed
                            ? 'line-through text-[#A58C98] dark:text-[#B891A1]'
                            : 'text-[#3D1023] dark:text-[#FFF5F6]'
                        }`}
                      >
                        {ms.name}
                      </span>
                      <span className="font-mono text-[11px] text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                        Due {ms.dueDate}
                      </span>
                    </div>
                    {ms.description && (
                      <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">
                        {ms.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                      {done}/{linked.length} tasks ({pct}%)
                    </span>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            updateMilestone({
                              projectId,
                              milestone: ms,
                              updates: { completed: !ms.completed },
                            })
                          }
                          title={ms.completed ? 'Reopen milestone' : 'Mark completed'}
                          className={`p-1.5 rounded-[10px] transition-colors cursor-pointer ${
                            ms.completed
                              ? 'text-[#21865B] bg-[#21865B]/12 dark:text-[#5FD09E]'
                              : 'text-[#A58C98] hover:text-[#21865B] dark:hover:text-[#5FD09E]'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMilestone({ projectId, milestoneId: ms.id })}
                          aria-label={`Delete milestone ${ms.name}`}
                          className="p-1.5 rounded-[10px] text-[#A58C98] hover:text-[#D94C65] hover:bg-[#D94C65]/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#FCE8EC] dark:bg-[#2A0D19]/75 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ms.completed
                        ? 'bg-[#21865B]'
                        : 'bg-gradient-to-r from-[#7A2346] to-[#C86B88]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

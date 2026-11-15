import { useMemo, useState, type FormEvent } from 'react';
import { Check, Play, Plus, Rocket, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Milestone, ProjectRole, Sprint, TaskCard } from '../types/pm';
import {
  assignTaskToSprint,
  createSprint,
  deleteSprint,
  updateSprint,
} from '../lib/sprintService';
import { computeSprintBurndown } from '../lib/analyticsService';
import { addDaysIso, localTodayIso } from '../lib/validationService';
import { BurndownChart } from './BurndownChart';
import { MilestoneManager } from './MilestoneManager';
import { PriorityBadge } from './PriorityBadge';

interface SprintBoardProps {
  projectId: string;
  sprints: Sprint[];
  milestones: Milestone[];
  tasks: TaskCard[];
  user: User;
  role: ProjectRole;
  onSelectTask: (task: TaskCard) => void;
}

export function SprintBoard({
  projectId,
  sprints,
  milestones,
  tasks,
  user,
  role,
  onSelectTask,
}: SprintBoardProps) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(() => localTodayIso());
  const [endDate, setEndDate] = useState(() => addDaysIso(localTodayIso(), 14));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retroDrafts, setRetroDrafts] = useState<Record<string, string>>({});

  const canManage = role === 'owner' || role === 'admin';

  const backlogTasks = useMemo(
    () => tasks.filter((t) => !t.sprintId),
    [tasks]
  );

  const handleCreateSprint = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createSprint({
        projectId,
        name,
        goal,
        startDate,
        endDate,
        status: sprints.some((s) => s.status === 'active') ? 'planned' : 'active',
        existingSprints: sprints,
        user,
      });
      setName('');
      setGoal('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create sprint.');
    } finally {
      setCreating(false);
    }
  };

  const handleSprintStatus = async (sprint: Sprint, nextStatus: 'planned' | 'active' | 'completed') => {
    setError(null);
    try {
      await updateSprint({
        projectId,
        sprintId: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: nextStatus,
        retrospectiveNotes: retroDrafts[sprint.id] ?? sprint.retrospectiveNotes ?? '',
        existingSprints: sprints,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update sprint.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#3D1023] dark:text-[#FFF5F6] tracking-tight">
              Sprints &amp; Milestones
            </h2>
            <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">
              Plan time-boxed sprints, assign backlog tasks, track burndown, and record retrospectives.
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]"
          >
            {error}
          </div>
        )}

        {canManage && (
          <form
            onSubmit={handleCreateSprint}
            className="glass-card p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
              <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                <Rocket className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
              </div>
              <span>Create New Sprint</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sprint name (e.g. Sprint 12)"
                required
                className="input-blush px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={goal}
                maxLength={500}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Sprint goal (optional)"
                className="input-blush px-3 py-2 text-xs"
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="input-blush px-3 py-2 text-xs"
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="input-blush flex-1 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-burgundy inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create</span>
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-5">
            {sprints.length === 0 ? (
              <div className="glass-card p-8 border-dashed border-[#C86B88]/35 text-center text-xs text-[#795D6B] dark:text-[#D9B7C4]">
                No sprints created yet. Admins and project owners can launch a sprint above.
              </div>
            ) : (
              sprints.map((sprint) => {
                const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
                const doneCount = sprintTasks.filter((t) => t.status === 'done').length;
                const pct =
                  sprintTasks.length > 0
                    ? Math.round((doneCount / sprintTasks.length) * 100)
                    : 0;
                const burndown = computeSprintBurndown(sprint, sprintTasks);
                const retroVal = retroDrafts[sprint.id] ?? sprint.retrospectiveNotes ?? '';

                return (
                  <section
                    key={sprint.id}
                    className="glass-card p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-display text-sm font-bold text-[#3D1023] dark:text-[#FFF5F6]">
                            {sprint.name}
                          </h3>
                          <span
                            className={`text-[11px] font-semibold uppercase tracking-wide ${
                              sprint.status === 'active'
                                ? 'text-[#7A2346] dark:text-[#E9A8B8]'
                                : sprint.status === 'completed'
                                  ? 'text-[#21865B] dark:text-[#5FD09E]'
                                  : 'text-[#795D6B] dark:text-[#D9B7C4]'
                            }`}
                          >
                            {sprint.status}
                          </span>
                        </div>
                        <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5 tabular-nums">
                          {sprint.startDate} → {sprint.endDate} · {doneCount}/{sprintTasks.length} tasks done ({pct}%)
                        </p>
                        {sprint.goal && (
                          <p className="text-xs text-[#513443] dark:text-[#F8DDE3] mt-1">
                            Goal: {sprint.goal}
                          </p>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-2">
                          {sprint.status === 'planned' && (
                            <button
                              type="button"
                              onClick={() => handleSprintStatus(sprint, 'active')}
                              className="btn-burgundy inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              <span>Start Sprint</span>
                            </button>
                          )}
                          {sprint.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleSprintStatus(sprint, 'completed')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-[12px] bg-[#21865B] hover:bg-[#1B6F4B] text-white transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Complete Sprint</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              deleteSprint({
                                projectId,
                                sprintId: sprint.id,
                                sprintTasks,
                              })
                            }
                            aria-label={`Delete ${sprint.name}`}
                            className="p-1.5 rounded-[10px] text-[#A58C98] hover:text-[#D94C65] hover:bg-[#D94C65]/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="h-2 w-full rounded-full bg-[#FCE8EC] dark:bg-[#2A0D19]/75 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          sprint.status === 'completed'
                            ? 'bg-[#21865B]'
                            : 'bg-gradient-to-r from-[#7A2346] to-[#C86B88]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {sprint.status === 'active' && (
                      <BurndownChart sprintName={sprint.name} points={burndown} />
                    )}

                    <div className="space-y-1.5">
                      {sprintTasks.length === 0 ? (
                        <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">
                          No tasks assigned to this sprint yet.
                        </p>
                      ) : (
                        sprintTasks.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/16 bg-[#FBEFF1]/70 dark:bg-[#2A0D19]/50 hover:border-[#C86B88]/45 transition-colors text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectTask(t)}
                              className="flex items-center gap-2 min-w-0 text-left hover:underline cursor-pointer"
                            >
                              <span className="font-mono text-[11px] text-[#7A2346] dark:text-[#F1BBC8] shrink-0">
                                {t.taskKey}
                              </span>
                              <span
                                className={`truncate font-medium ${
                                  t.status === 'done'
                                    ? 'line-through text-[#A58C98] dark:text-[#B891A1]'
                                    : 'text-[#3D1023] dark:text-[#FFF5F6]'
                                }`}
                              >
                                {t.title}
                              </span>
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <PriorityBadge priority={t.priority} />
                              <button
                                type="button"
                                onClick={() =>
                                  assignTaskToSprint({
                                    projectId,
                                    taskId: t.id,
                                    sprintId: '',
                                  })
                                }
                                className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4] hover:text-[#D94C65] transition-colors cursor-pointer"
                              >
                                Unassign
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {canManage && (
                      <div className="pt-3 border-t border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 space-y-1.5">
                        <label className="block text-[11px] font-medium text-[#795D6B] dark:text-[#D9B7C4]">
                          Sprint Retrospective Notes
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={retroVal}
                            maxLength={2000}
                            onChange={(e) =>
                              setRetroDrafts((prev) => ({
                                ...prev,
                                [sprint.id]: e.target.value,
                              }))
                            }
                            placeholder="What went well, blockers, action items..."
                            className="input-blush flex-1 px-3 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSprintStatus(sprint, sprint.status)}
                            className="btn-blush px-3 py-1.5 text-xs font-medium cursor-pointer shrink-0"
                          >
                            Save Notes
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>

          <aside className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                Unassigned Backlog
              </h3>
              <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                {backlogTasks.length}
              </span>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {backlogTasks.length === 0 ? (
                <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] py-4 text-center">
                  All tasks are assigned to a sprint.
                </p>
              ) : (
                backlogTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/16 bg-white/75 dark:bg-[#2A0D19]/50 space-y-1.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTask(t)}
                      className="block w-full text-left font-medium text-[#3D1023] dark:text-[#FFF5F6] truncate hover:underline cursor-pointer"
                    >
                      <span className="font-mono text-[11px] text-[#7A2346] dark:text-[#F1BBC8] mr-1.5">
                        {t.taskKey}
                      </span>
                      {t.title}
                    </button>
                    {sprints.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          assignTaskToSprint({
                            projectId,
                            taskId: t.id,
                            sprintId: e.target.value,
                          });
                        }}
                        aria-label={`Assign ${t.taskKey} to sprint`}
                        className="input-blush w-full px-2 py-1 text-[11px]"
                      >
                        <option value="">Assign to sprint...</option>
                        {sprints
                          .filter((s) => s.status !== 'completed')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>

        <MilestoneManager
          projectId={projectId}
          milestones={milestones}
          tasks={tasks}
          user={user}
          role={role}
        />
      </div>
    </div>
  );
}

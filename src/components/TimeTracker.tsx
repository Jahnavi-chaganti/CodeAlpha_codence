import { useEffect, useState, type FormEvent } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Clock, Pause, Play, Plus, Square, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import {
  deleteTimeEntry,
  getElapsedSeconds,
  loadActiveTimer,
  logTimeEntry,
  saveActiveTimer,
  type ActiveTimerState,
} from '../lib/timeTrackingService';
import { formatMinutes } from '../lib/validationService';
import type { ProjectRole, TaskCard, TimeEntry } from '../types/pm';

interface TimeTrackerProps {
  projectId: string;
  task: TaskCard;
  currentUser: User;
  currentUserRole: ProjectRole;
}

function formatClockSeconds(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function TimeTracker({
  projectId,
  task,
  currentUser,
  currentUserRole,
}: TimeTrackerProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimerState | null>(() => loadActiveTimer());
  const [elapsedSec, setElapsedSec] = useState(0);

  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualNote, setManualNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'projects', projectId, 'tasks', task.id, 'timeEntries'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => d.data() as TimeEntry));
      },
      (err) => {
        console.warn('Time entries listener warning:', err);
      }
    );
    return () => unsub();
  }, [projectId, task.id]);

  useEffect(() => {
    if (!activeTimer) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(getElapsedSeconds(activeTimer));
    if (activeTimer.isPaused) return;
    const id = setInterval(() => {
      setElapsedSec(getElapsedSeconds(activeTimer));
    }, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  const isRunningHere = activeTimer?.taskId === task.id;
  const isRunningElsewhere = Boolean(activeTimer && activeTimer.taskId !== task.id);

  const totalLoggedMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0) || task.actualMinutes || 0;
  const est = task.estimatedMinutes ?? 0;
  const estPct = est > 0 ? Math.min(100, Math.round((totalLoggedMinutes / est) * 100)) : 0;

  const startTimerHere = () => {
    setError(null);
    const next: ActiveTimerState = {
      projectId,
      taskId: task.id,
      taskKey: task.taskKey,
      startedAtMs: Date.now(),
      pausedAccumulatedMs: 0,
      isPaused: false,
    };
    saveActiveTimer(next);
    setActiveTimer(next);
  };

  const togglePause = () => {
    if (!activeTimer || !isRunningHere) return;
    if (activeTimer.isPaused) {
      const resumed: ActiveTimerState = {
        ...activeTimer,
        startedAtMs: Date.now(),
        isPaused: false,
      };
      saveActiveTimer(resumed);
      setActiveTimer(resumed);
    } else {
      const acc = activeTimer.pausedAccumulatedMs + Math.max(0, Date.now() - activeTimer.startedAtMs);
      const paused: ActiveTimerState = {
        ...activeTimer,
        pausedAccumulatedMs: acc,
        isPaused: true,
      };
      saveActiveTimer(paused);
      setActiveTimer(paused);
    }
  };

  const stopAndSave = async () => {
    if (!activeTimer || !isRunningHere) return;
    const sec = getElapsedSeconds(activeTimer);
    const mins = Math.max(1, Math.round(sec / 60));
    setSubmitting(true);
    setError(null);
    try {
      const endIso = new Date().toISOString();
      const startIso = new Date(Date.now() - sec * 1000).toISOString();
      await logTimeEntry({
        projectId,
        taskId: task.id,
        durationMinutes: mins,
        startTimeIso: startIso,
        endTimeIso: endIso,
        note: 'Tracked timer session',
        isManual: false,
        user: currentUser,
      });
      saveActiveTimer(null);
      setActiveTimer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save timer entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualLog = async (e: FormEvent) => {
    e.preventDefault();
    const mins = Number(manualMinutes);
    if (!Number.isFinite(mins) || mins < 1) {
      setError('Enter at least 1 minute.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - mins * 60_000);
      await logTimeEntry({
        projectId,
        taskId: task.id,
        durationMinutes: mins,
        startTimeIso: start.toISOString(),
        endTimeIso: end.toISOString(),
        note: manualNote.trim() || 'Manual time entry',
        isManual: true,
        user: currentUser,
      });
      setManualNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log time.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
          <Clock className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
          <span>Time Tracking</span>
        </div>
        <div className="font-mono text-xs text-[#513443] dark:text-[#F8DDE3] tabular-nums">
          Logged: {formatMinutes(totalLoggedMinutes)}
          {est > 0 && ` / Est: ${formatMinutes(est)}`}
        </div>
      </div>

      {est > 0 && (
        <div className="h-2 w-full rounded-full bg-[#FCE8EC] dark:bg-[#2A0D19]/75 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              totalLoggedMinutes > est ? 'bg-[#D99A35]' : 'bg-[#21865B]'
            }`}
            style={{ width: `${estPct}%` }}
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-2.5 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]"
        >
          {error}
        </div>
      )}

      <div className="p-4 rounded-[16px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-[#FCE8EC]/60 dark:bg-[#2A0D19]/55 space-y-3">
        {isRunningElsewhere && activeTimer && (
          <p className="text-[11px] text-[#C17A43] dark:text-[#F1BBC8]">
            Timer currently active on <span className="font-mono font-semibold">{activeTimer.taskKey}</span>. Starting here will replace the active timer.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-lg font-bold text-[#3D1023] dark:text-[#FFF5F6] tabular-nums">
            {isRunningHere ? formatClockSeconds(elapsedSec) : '00:00:00'}
          </div>

          <div className="flex items-center gap-2">
            {!isRunningHere ? (
              <button
                type="button"
                onClick={startTimerHere}
                className="btn-burgundy inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Timer</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={togglePause}
                  className="btn-blush inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium cursor-pointer"
                >
                  {activeTimer?.isPaused ? (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={stopAndSave}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-[12px] bg-[#21865B] hover:bg-[#1B6F4B] text-white cursor-pointer disabled:opacity-60"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop &amp; Log</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleManualLog} className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={14400}
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            aria-label="Duration in minutes"
            className="input-blush w-20 px-2.5 py-1.5 font-mono text-xs"
          />
          <span className="text-xs text-[#795D6B] dark:text-[#D9B7C4]">min</span>
        </div>
        <input
          type="text"
          value={manualNote}
          maxLength={300}
          onChange={(e) => setManualNote(e.target.value)}
          placeholder="Work note (optional)"
          className="input-blush flex-1 min-w-[140px] px-3 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={submitting}
          className="btn-blush inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Time</span>
        </button>
      </form>

      {entries.length > 0 && (
        <ul className="divide-y divide-[#EAD7DE]/80 dark:divide-[#E9A8B8]/15 border border-[#EAD7DE] dark:border-[#E9A8B8]/18 rounded-[14px] overflow-hidden">
          {entries.map((entry) => {
            const canDelete =
              entry.userUid === currentUser.uid ||
              currentUserRole === 'owner' ||
              currentUserRole === 'admin';
            return (
              <li
                key={entry.id}
                className="px-3 py-2 flex items-center justify-between gap-3 text-xs bg-white/75 dark:bg-[#2A0D19]/45"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#3D1023] dark:text-[#FFF5F6] truncate">
                    {entry.note || (entry.isManual ? 'Manual entry' : 'Timer session')}
                  </p>
                  <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4]">
                    {entry.userName} · {entry.startTime.slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-semibold text-[#7A2346] dark:text-[#F1BBC8] tabular-nums">
                    {formatMinutes(entry.durationMinutes)}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        deleteTimeEntry({
                          projectId,
                          taskId: task.id,
                          entryId: entry.id,
                          durationMinutes: entry.durationMinutes,
                        })
                      }
                      aria-label="Delete time entry"
                      className="p-1 text-[#A58C98] hover:text-[#D94C65] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

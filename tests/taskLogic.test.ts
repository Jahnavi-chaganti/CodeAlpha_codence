import { describe, expect, it } from 'vitest';
import type { ProjectMember, TaskCard } from '../src/types/pm';
import {
  computeNextRecurrenceDate,
  extractMentionedMembers,
  formatMinutes,
  generateCryptoInviteCode,
  getIncompleteBlockers,
  hasCircularDependency,
  isDueSoonTask,
  isOverdueTask,
  shouldGenerateRecurrence,
} from '../src/lib/validationService';

function makeTask(overrides: Partial<TaskCard>): TaskCard {
  return {
    id: overrides.id ?? 't1',
    projectId: 'proj_1',
    taskKey: overrides.taskKey ?? 'ENG-1',
    title: overrides.title ?? 'Sample task',
    description: '',
    status: overrides.status ?? 'todo',
    priority: overrides.priority ?? 'medium',
    position: 1000,
    assigneeUid: '',
    assigneeName: '',
    assigneePhoto: '',
    tags: [],
    dueDate: '',
    commentCount: 0,
    createdBy: 'u1',
    createdByName: 'Alice',
    ...overrides,
  };
}

describe('Dependency cycle & blocker validation', () => {
  it('detects direct and transitive circular dependencies', () => {
    const a = makeTask({ id: 'a', taskKey: 'ENG-1', blockedBy: ['b'] });
    const b = makeTask({ id: 'b', taskKey: 'ENG-2', blockedBy: ['c'] });
    const c = makeTask({ id: 'c', taskKey: 'ENG-3', blockedBy: [] });
    const all = [a, b, c];

    // Self-cycle
    expect(hasCircularDependency('a', 'a', all)).toBe(true);
    // Transitive cycle: c -> blockedBy a -> b -> c
    expect(hasCircularDependency('c', 'a', all)).toBe(true);
    // Safe dependency: a -> blockedBy c (already transitive, no cycle back to a)
    expect(hasCircularDependency('a', 'c', all)).toBe(false);
  });

  it('returns only incomplete blockers', () => {
    const blockerDone = makeTask({ id: 'b1', taskKey: 'ENG-1', status: 'done' });
    const blockerOpen = makeTask({ id: 'b2', taskKey: 'ENG-2', status: 'in_progress' });
    const target = makeTask({ id: 't1', blockedBy: ['b1', 'b2', 'missing'] });

    const incomplete = getIncompleteBlockers(target, [blockerDone, blockerOpen, target]);
    expect(incomplete.map((t) => t.id)).toEqual(['b2']);
  });
});

describe('Recurring task schedules & deadline helpers', () => {
  it('computes daily, weekly, monthly, and custom intervals', () => {
    expect(computeNextRecurrenceDate('2026-05-01', 'daily', 3)).toBe('2026-05-04');
    expect(computeNextRecurrenceDate('2026-05-01', 'weekly', 2)).toBe('2026-05-15');
    expect(computeNextRecurrenceDate('2026-05-01', 'monthly', 1)).toBe('2026-06-01');
    expect(computeNextRecurrenceDate('2026-05-01', 'custom', 10)).toBe('2026-05-11');
  });

  it('evaluates whether recurrence should spawn', () => {
    expect(
      shouldGenerateRecurrence(
        {
          frequency: 'weekly',
          interval: 1,
          startDate: '2026-05-01',
          endDate: '2026-05-30',
          nextRunDate: '2026-05-10',
          active: true,
        },
        '2026-05-10'
      )
    ).toBe(true);

    expect(
      shouldGenerateRecurrence(
        {
          frequency: 'weekly',
          interval: 1,
          startDate: '2026-05-01',
          endDate: '2026-05-08',
          nextRunDate: '2026-05-10',
          active: true,
        },
        '2026-05-10'
      )
    ).toBe(false);
  });

  it('classifies overdue and due-soon tasks accurately', () => {
    const overdue = makeTask({ dueDate: '2026-05-09', status: 'in_progress' });
    const doneLate = makeTask({ dueDate: '2026-05-01', status: 'done' });
    const dueTomorrow = makeTask({ dueDate: '2026-05-11', status: 'todo' });

    expect(isOverdueTask(overdue, '2026-05-10')).toBe(true);
    expect(isOverdueTask(doneLate, '2026-05-10')).toBe(false);
    expect(isDueSoonTask(dueTomorrow, 2, '2026-05-10')).toBe(true);
    expect(isDueSoonTask(overdue, 2, '2026-05-10')).toBe(false);
  });
});

describe('Mentions, invite codes, and duration formatting', () => {
  it('extracts mentioned project members without duplicates', () => {
    const members: ProjectMember[] = [
      { uid: 'u1', displayName: 'Alice Chen', photoURL: '', role: 'owner', inviteCode: '' },
      { uid: 'u2', displayName: 'Bob Smith', photoURL: '', role: 'member', inviteCode: '' },
    ];
    const mentioned = extractMentionedMembers(
      'Hey @Alice Chen and @bob, can you review this? cc @Alice Chen',
      members
    );
    expect(mentioned.map((m) => m.uid)).toEqual(['u1', 'u2']);
  });

  it('generates mixed-case 12-char cryptographic invite codes and formats minutes', () => {
    const code = generateCryptoInviteCode(12);
    expect(code).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(135)).toBe('2h 15m');
  });
});

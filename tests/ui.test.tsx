// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PriorityBadge } from '../src/components/PriorityBadge';
import { StatCard } from '../src/components/StatCard';
import { SubtaskList } from '../src/components/SubtaskList';
import { AuthScreen } from '../src/components/AuthScreen';
import { ExportManager } from '../src/components/ExportManager';
import type { Project, ProjectMember, TaskCard } from '../src/types/pm';

describe('Cadence UI Components', () => {
  it('renders PriorityBadge and StatCard with tabular metrics', () => {
    render(
      <div>
        <PriorityBadge priority="urgent" />
        <StatCard label="Completion Rate" value="84%" sublabel="21 of 25 tasks done" tone="success" />
      </div>
    );
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('84%')).toBeInTheDocument();
    expect(screen.getByText('21 of 25 tasks done')).toBeInTheDocument();
  });

  it('adds and toggles subtasks interactively in SubtaskList', () => {
    const onChange = vi.fn();
    render(
      <SubtaskList
        subtasks={[{ id: 's1', title: 'Write unit tests', completed: false }]}
        onChange={onChange}
      />
    );

    expect(screen.getByText('0/1 (0%)')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith([
      { id: 's1', title: 'Write unit tests', completed: true },
    ]);

    const input = screen.getByPlaceholderText('Add a subtask...');
    fireEvent.change(input, { target: { value: 'Deploy rules' } });
    fireEvent.submit(input.closest('form')!);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0]).toHaveLength(2);
    expect(onChange.mock.calls[1][0][1].title).toBe('Deploy rules');
  });

  it('switches AuthScreen between Sign In, Create Account, and Password Reset modes', () => {
    render(<AuthScreen />);

    expect(screen.getByText('Plan Smarter. Collaborate Better. Deliver Faster.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Create Account' }));
    expect(screen.getByPlaceholderText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Sign In' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('button', { name: 'Send Password Reset Email' })).toBeInTheDocument();
  });

  it('renders ExportManager report selector and live Markdown preview', () => {
    const project: Project = {
      id: 'p1',
      name: 'Apollo Launch',
      key: 'APL',
      description: 'Q4 release',
      ownerId: 'u1',
      taskCounter: 1,
    };
    const members: ProjectMember[] = [
      { uid: 'u1', displayName: 'Alice', photoURL: '', role: 'owner', inviteCode: '' },
    ];
    const tasks: TaskCard[] = [
      {
        id: 't1',
        projectId: 'p1',
        taskKey: 'APL-1',
        title: 'Launch checklist',
        description: '',
        status: 'done',
        priority: 'high',
        position: 1000,
        assigneeUid: 'u1',
        assigneeName: 'Alice',
        assigneePhoto: '',
        tags: ['release'],
        dueDate: '2026-05-15',
        commentCount: 0,
        createdBy: 'u1',
        createdByName: 'Alice',
      },
    ];

    render(<ExportManager project={project} members={members} tasks={tasks} sprints={[]} />);
    expect(screen.getByText('Export Tasks CSV')).toBeInTheDocument();
    expect(screen.getByText(/Cadence PROGRESS Report — Apollo Launch/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'workload' }));
    expect(screen.getByText(/Cadence WORKLOAD Report — Apollo Launch/i)).toBeInTheDocument();
  });
});

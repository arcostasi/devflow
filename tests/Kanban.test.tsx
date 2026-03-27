import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Kanban } from '../components/Kanban';
import { ConfirmProvider } from '../contexts/ConfirmContext';
import { Task, Sprint, User, Repository } from '../types';

// Mock api module
vi.mock('../services/api', () => ({
  api: {
    updateTask: vi.fn().mockResolvedValue(undefined),
    getTaskComments: vi.fn().mockResolvedValue([]),
    createTaskComment: vi.fn().mockResolvedValue({ id: 'c1', text: 'test', author: { id: 'u1', name: 'Dev', avatar: '' }, timestamp: new Date().toISOString() }),
    deleteTaskComment: vi.fn().mockResolvedValue(undefined),
    createActivity: vi.fn().mockResolvedValue(undefined),
    getActivities: vi.fn().mockResolvedValue([]),
  },
}));

// Mock auto-animate (returns a no-op ref)
vi.mock('@formkit/auto-animate/react', () => ({
  useAutoAnimate: () => [{ current: null }],
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1', title: 'Implement login', description: 'Add authentication', status: 'todo',
  priority: 'medium', tags: ['auth'], sprintId: 'sprint-1', createdAt: new Date().toISOString(),
  ...overrides,
});

const activeSprint: Sprint = {
  id: 'sprint-1', name: 'Sprint 1', goal: 'MVP', startDate: '2025-01-01',
  endDate: '2025-01-14', status: 'active',
};

const teamMembers: User[] = [
  { id: 'u1', name: 'Alice', avatar: '' },
  { id: 'u2', name: 'Bob', avatar: '' },
];

const repositories: Repository[] = [
  { id: 'repo-1', name: 'devflow', description: '', localPath: '/code', status: 'active', createdAt: '' },
];

const renderKanban = (tasks: Task[] = [makeTask()], extraProps: Record<string, unknown> = {}) => {
  const addToast = vi.fn();
  const setTasks = vi.fn();
  const openNewTaskModal = vi.fn();

  const result = render(
    <ConfirmProvider>
      <Kanban
        initialTasks={tasks}
        setTasks={setTasks}
        addToast={addToast}
        openNewTaskModal={openNewTaskModal}
        activeSprint={activeSprint}
        teamMembers={teamMembers}
        repositories={repositories}
        {...extraProps}
      />
    </ConfirmProvider>
  );

  return { ...result, addToast, setTasks, openNewTaskModal };
};

describe('Kanban', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all five columns', () => {
    renderKanban([makeTask({ status: 'todo' })]);
    expect(screen.getByText('A Fazer')).toBeInTheDocument();
    expect(screen.getByText('Em Progresso')).toBeInTheDocument();
    expect(screen.getByText('Revisão / QA')).toBeInTheDocument();
    expect(screen.getByText('Pronto para Release')).toBeInTheDocument();
    expect(screen.getByText('Concluído')).toBeInTheDocument();
  });

  it('renders task cards in the correct column', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Todo task', status: 'todo' }),
      makeTask({ id: 't2', title: 'Doing task', status: 'doing' }),
      makeTask({ id: 't3', title: 'Done task', status: 'done' }),
    ];
    renderKanban(tasks);

    expect(screen.getByText('Todo task')).toBeInTheDocument();
    expect(screen.getByText('Doing task')).toBeInTheDocument();
    expect(screen.getByText('Done task')).toBeInTheDocument();
  });

  it('shows WIP limit warning when column exceeds limit', () => {
    // doing column has wipLimit=3, put 4 tasks there
    const tasks = Array.from({ length: 4 }, (_, i) =>
      makeTask({ id: `t${i}`, title: `Task ${i}`, status: 'doing' })
    );
    const { container } = renderKanban(tasks);
    // WIP limit exceeded shows AlertTriangle icon with title
    const wipWarning = container.querySelector('[title="WIP Limit Exceeded"]');
    expect(wipWarning).not.toBeNull();
  });

  it('does not show WIP warning when under limit', () => {
    const tasks = [makeTask({ id: 't1', title: 'Single task', status: 'doing' })];
    const { container } = renderKanban(tasks);
    const wipWarning = container.querySelector('[title="WIP Limit Exceeded"]');
    expect(wipWarning).toBeNull();
  });

  it('shows loading state when isLoading', () => {
    renderKanban([], { isLoading: true });
    expect(screen.getByText('Montando o quadro da sprint')).toBeInTheDocument();
  });

  it('shows empty state when no tasks match filters', () => {
    renderKanban([]);
    expect(screen.getByText('Nenhum item visível no board')).toBeInTheDocument();
  });

  it('triggers openNewTaskModal when add button is clicked', async () => {
    const user = userEvent.setup();
    const tasks = [makeTask()];
    const { openNewTaskModal } = renderKanban(tasks);

    const addButtons = screen.getAllByText('Adicionar');
    await user.click(addButtons[0]); // First column's add button (todo)
    expect(openNewTaskModal).toHaveBeenCalledWith('todo');
  });

  it('opens task detail drawer when a task card is clicked', async () => {
    const user = userEvent.setup();
    const tasks = [makeTask({ title: 'Clickable task' })];
    renderKanban(tasks);

    await user.click(screen.getByText('Clickable task'));
    // The drawer should show the task title and details tabs
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
  });

  it('filters tasks by team member', async () => {
    const user = userEvent.setup();
    const tasks = [
      makeTask({ id: 't1', title: 'Alice task', status: 'todo', assignee: teamMembers[0] }),
      makeTask({ id: 't2', title: 'Bob task', status: 'doing', assignee: teamMembers[1] }),
    ];
    renderKanban(tasks);

    // Click Alice's avatar to filter
    await user.click(screen.getByLabelText('Filtrar por Alice'));
    expect(screen.getByText('Alice task')).toBeInTheDocument();
    expect(screen.queryByText('Bob task')).toBeNull();
  });

  it('shows column count badges', () => {
    const tasks = [
      makeTask({ id: 't1', status: 'todo' }),
      makeTask({ id: 't2', status: 'todo' }),
      makeTask({ id: 't3', status: 'doing' }),
    ];
    renderKanban(tasks);
    // todo column should show "2 "
    expect(screen.getByText(/^2\s*$/)).toBeInTheDocument();
    // doing column should show "1 / 3"
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Dashboard from '../components/Dashboard';
import { Task, Repository, ActivityLog, ViewState } from '../types';

const makeTasks = (overrides: Partial<Task>[] = []): Task[] => {
  const base: Task = {
    id: 'task-1', title: 'Test task', description: '', status: 'todo',
    priority: 'medium', tags: [], sprintId: 'sprint-1', createdAt: new Date().toISOString(),
  };
  if (overrides.length === 0) return [base];
  return overrides.map((o, i) => ({ ...base, id: `task-${i + 1}`, ...o }));
};

const makeRepo = (overrides: Partial<Repository> = {}): Repository => ({
  id: 'repo-1', name: 'devflow', description: 'Main repo', localPath: '/code/devflow',
  status: 'active', createdAt: new Date().toISOString(), ...overrides,
});

const defaultProps = () => ({
  tasks: makeTasks([
    { status: 'todo' },
    { status: 'doing' },
    { status: 'review' },
    { status: 'ready' },
    { status: 'done' },
  ]),
  repositories: [makeRepo()],
  activities: [] as ActivityLog[],
  onNavigate: vi.fn(),
  onCreateTask: vi.fn(),
  onCreateRepo: vi.fn(),
  onOpenRepo: vi.fn(),
  onOpenRepoInGit: vi.fn(),
  onOpenEnvironment: vi.fn(),
  onOpenTask: vi.fn(),
});

describe('Dashboard', () => {
  it('renders executive summary with stable status', () => {
    render(<Dashboard {...defaultProps()} />);
    expect(screen.getByText('Panorama Executivo')).toBeInTheDocument();
    expect(screen.getByText('Estavel')).toBeInTheDocument();
    expect(screen.getByText('Entrega estável e pronta para operar.')).toBeInTheDocument();
  });

  it('shows unstable status when repos have failures', () => {
    const props = defaultProps();
    props.repositories = [makeRepo({ status: 'error' })];
    props.tasks = [];
    render(<Dashboard {...props} stats={{ totalCommits: 0, weeklyCommits: 0, contributions: {}, failedRepos: 1, failedRepoDetails: [{ id: 'repo-1', name: 'devflow', reason: 'git error' }] }} />);
    expect(screen.getByText('1 Falha')).toBeInTheDocument();
    expect(screen.getByText('Existem bloqueios de infraestrutura e fluxo.')).toBeInTheDocument();
  });

  it('computes open issues count from non-done tasks', () => {
    const props = defaultProps();
    render(<Dashboard {...props} />);
    // 4 non-done tasks (todo, doing, review, ready)
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Issues abertas')).toBeInTheDocument();
  });

  it('computes review count from tasks in review status', () => {
    const props = defaultProps();
    render(<Dashboard {...props} />);
    const reviewCard = screen.getByText('Em revisão').closest('button')!;
    expect(within(reviewCard).getByText('1')).toBeInTheDocument();
  });

  it('renders action buttons and fires callbacks', async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<Dashboard {...props} />);

    await user.click(screen.getByText('Nova tarefa'));
    expect(props.onCreateTask).toHaveBeenCalledOnce();

    await user.click(screen.getByText('Novo repositório'));
    expect(props.onCreateRepo).toHaveBeenCalledOnce();
  });

  it('navigates to kanban when clicking issues abertas card', async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<Dashboard {...props} />);

    await user.click(screen.getByText('Issues abertas'));
    expect(props.onNavigate).toHaveBeenCalledWith(ViewState.KANBAN);
  });

  it('shows loading skeletons when isLoading', () => {
    const props = defaultProps();
    const { container } = render(<Dashboard {...props} isLoading />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays repos portfolio section', () => {
    const props = defaultProps();
    render(<Dashboard {...props} />);
    expect(screen.getByText('devflow')).toBeInTheDocument();
  });

  it('renders contribution graph section', () => {
    const props = defaultProps();
    render(<Dashboard {...props} stats={{ totalCommits: 42, weeklyCommits: 7, contributions: {}, failedRepos: 0 }} />);
    expect(screen.getByText('Histórico de Contribuições')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

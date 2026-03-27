import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import RepoDetail from '../components/RepoDetail';
import { ConfirmProvider } from '../contexts/ConfirmContext';
import { Repository, Task } from '../types';

const mockApi = vi.hoisted(() => ({
  getRepoFiles: vi.fn(),
  getRepoCommits: vi.fn(),
  getRepoFileContent: vi.fn(),
  saveRepoSettings: vi.fn(),
}));

vi.mock('../services/api', () => ({
  api: mockApi,
}));

const makeRepo = (overrides: Partial<Repository> = {}): Repository => ({
  id: 'repo-1',
  name: 'devflow',
  description: 'Main repository',
  status: 'active',
  lastUpdated: new Date().toISOString(),
  branch: 'main',
  issues: 2,
  localPath: 'D:/Code/devflow',
  stars: 3,
  ...overrides,
});

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Fix auth',
  description: 'Fix auth flow',
  status: 'todo',
  priority: 'high',
  tags: ['auth'],
  repositoryId: 'repo-1',
  ...overrides,
});

const renderRepoDetail = (repoOverrides: Partial<Repository> = {}, taskOverrides: Partial<Task>[] = []) => {
  const onBack = vi.fn();
  const onNavigateToTask = vi.fn();
  const onDeleteRepo = vi.fn();
  const onOpenGit = vi.fn();
  const addToast = vi.fn();

  const repo = makeRepo(repoOverrides);
  const tasks = taskOverrides.length > 0 ? taskOverrides.map((t, i) => makeTask({ id: `task-${i + 1}`, ...t })) : [makeTask()];

  render(
    <ConfirmProvider>
      <RepoDetail
        repo={repo}
        tasks={tasks}
        onBack={onBack}
        onNavigateToTask={onNavigateToTask}
        addToast={addToast}
        onDeleteRepo={onDeleteRepo}
        onOpenGit={onOpenGit}
      />
    </ConfirmProvider>
  );

  return { onBack, onNavigateToTask, onDeleteRepo, onOpenGit, addToast };
};

describe('RepoDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockApi.getRepoFiles.mockResolvedValue({
      files: [
        { name: 'README.md', relativePath: 'README.md', type: 'file', modifiedAt: new Date().toISOString() },
        { name: 'src', relativePath: 'src', type: 'directory', modifiedAt: new Date().toISOString() },
      ],
      localPath: 'D:/Code/devflow',
      currentPath: '',
    });
    mockApi.getRepoCommits.mockResolvedValue({
      commits: [
        {
          hash: 'abc1234',
          fullHash: 'abc1234567890',
          author: 'Alice',
          email: 'alice@test.dev',
          date: new Date().toISOString(),
          message: 'Initial commit',
          relativeDate: 'há 1h',
        },
      ],
    });
    mockApi.getRepoFileContent.mockResolvedValue({ content: '# DevFlow\n\nReadme content', fileName: 'README.md' });
    mockApi.saveRepoSettings.mockResolvedValue({ success: true });
  });

  it('renders repository details and loads code tab content', async () => {
    renderRepoDetail();

    expect(screen.getByText('devflow')).toBeInTheDocument();
    await screen.findByText('README.md');
    expect(screen.getByText('Arquivos da raiz do repositorio')).toBeInTheDocument();
    expect(mockApi.getRepoFiles).toHaveBeenCalledWith('repo-1');
  });

  it('calls onBack when clicking back button', async () => {
    const user = userEvent.setup();
    const { onBack } = renderRepoDetail();

    await user.click(screen.getByRole('button', { name: /Voltar para repositorios/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('navigates to task when clicking task in issues tab', async () => {
    const user = userEvent.setup();
    const { onNavigateToTask } = renderRepoDetail({}, [{ id: 'task-99', title: 'Investigate bug', status: 'review' }]);

    await screen.findByText('README.md');
    await user.click(screen.getByRole('button', { name: /^Issues(?:\s+\d+)?$/i }));
    await user.click(screen.getByText('Investigate bug'));

    await waitFor(() => {
      expect(onNavigateToTask).toHaveBeenCalledTimes(1);
    });
    expect(onNavigateToTask.mock.calls[0][0]).toMatchObject({ id: 'task-99', title: 'Investigate bug' });
  });

  it('calls onOpenGit from branch action card', async () => {
    const user = userEvent.setup();
    const { onOpenGit } = renderRepoDetail();

    await user.click(screen.getByRole('button', { name: /Branch atual/i }));
    expect(onOpenGit).toHaveBeenCalledWith('repo-1');
  });

  it('shows missing path banner when repository path is not found', async () => {
    mockApi.getRepoFiles.mockRejectedValueOnce(new Error('Diretório do repositório não encontrado'));

    renderRepoDetail();

    await waitFor(() => {
      expect(screen.getByText('Diretorio local nao encontrado')).toBeInTheDocument();
    });
    expect(screen.getByText('Remover do sistema')).toBeInTheDocument();
  });
});

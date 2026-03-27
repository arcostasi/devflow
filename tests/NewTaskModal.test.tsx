import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NewTaskModal from '../components/NewTaskModal';
import { Repository, User } from '../types';

vi.mock('../components/AIFieldAssist', () => ({
  default: () => null,
}));

describe('NewTaskModal', () => {
  const repos: Repository[] = [
    {
      id: 'repo-1',
      name: 'devflow',
      description: 'Main repo',
      status: 'active',
      lastUpdated: new Date().toISOString(),
      branch: 'main',
      issues: 0,
    },
  ];

  const users: User[] = [
    { id: 'u-1', name: 'Alice', avatar: '' },
    { id: 'u-2', name: 'Bob', avatar: '' },
  ];

  it('submits with defaults and closes modal', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onClose = vi.fn();

    render(
      <NewTaskModal
        isOpen
        onClose={onClose}
        onCreate={onCreate}
        repos={repos}
        users={users}
      />
    );

    await user.type(screen.getByPlaceholderText('Informe um título breve e descritivo'), 'Implementar autenticação');
    await user.click(screen.getByRole('button', { name: 'Criar Tarefa' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Implementar autenticação',
        description: '',
        priority: 'medium',
        status: 'todo',
        tags: ['Geral'],
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits selected assignee, repo and parsed tags', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <NewTaskModal
        isOpen
        onClose={vi.fn()}
        onCreate={onCreate}
        repos={repos}
        users={users}
      />
    );

    await user.type(screen.getByPlaceholderText('Informe um título breve e descritivo'), 'Tarefa com contexto');
    await user.type(screen.getByPlaceholderText('Descreva o problema, objetivo, critérios de entrega ou dependências.'), 'Descrição detalhada');
    await user.selectOptions(screen.getByRole('combobox'), 'repo-1');
    await user.click(screen.getAllByTitle('Alice')[0]);
    await user.type(screen.getByPlaceholderText('Frontend, Bugfix, V1...'), 'frontend, bugfix,  sprint');
    await user.click(screen.getByRole('button', { name: 'Criar Tarefa' }));

    const payload = onCreate.mock.calls[0][0];
    expect(payload.repositoryId).toBe('repo-1');
    expect(payload.assignee).toMatchObject({ id: 'u-1', name: 'Alice' });
    expect(payload.tags).toEqual(['frontend', 'bugfix', 'sprint']);
  });

  it('does not submit when title is empty', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <NewTaskModal
        isOpen
        onClose={vi.fn()}
        onCreate={onCreate}
        repos={repos}
        users={users}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Criar Tarefa' });
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(onCreate).not.toHaveBeenCalled();
  });
});

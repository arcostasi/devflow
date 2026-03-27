import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import NewRepoModal from '../components/NewRepoModal';

vi.mock('../components/AIFieldAssist', () => ({
  default: () => null,
}));

describe('NewRepoModal', () => {
  it('creates a new repository in create mode', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onClose = vi.fn();

    render(<NewRepoModal isOpen onClose={onClose} onCreate={onCreate} />);

    await user.type(screen.getByPlaceholderText('Ex: novo-projeto-api'), 'core-api');
    await user.type(screen.getByPlaceholderText('Contexto do produto, objetivo do serviço ou área responsável.'), 'API principal');
    await user.clear(screen.getByPlaceholderText('main'));
    await user.type(screen.getByPlaceholderText('main'), 'develop');

    await user.click(screen.getByRole('button', { name: 'Criar Repositório' }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'core-api',
        description: 'API principal',
        branch: 'develop',
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('requires local path in link mode', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(<NewRepoModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    await user.click(screen.getByRole('button', { name: 'Vincular Existente' }));
    await user.type(screen.getByPlaceholderText('Ex: meu-projeto'), 'legacy-repo');

    const submitButton = screen.getByRole('button', { name: 'Vincular Repositório' });
    expect(submitButton).toBeDisabled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('links existing repository with local path', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(<NewRepoModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    await user.click(screen.getByRole('button', { name: 'Vincular Existente' }));
    await user.type(screen.getByPlaceholderText('Ex: meu-projeto'), 'legacy-repo');
    await user.type(screen.getByPlaceholderText(String.raw`Ex: C:\projetos\meu-repo ou /home/user/projetos/repo`), 'D:/Code/legacy-repo');
    await user.click(screen.getByRole('button', { name: 'Vincular Repositório' }));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'legacy-repo',
        localPath: 'D:/Code/legacy-repo',
        linkExisting: true,
      })
    );
  });
});

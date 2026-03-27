import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useEffect } from 'react';
import Settings from '../components/Settings';

let mockIsAdmin = true;

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u-1', name: 'Alice Admin', email: 'alice@devflow.test', role: 'admin' },
    isAdmin: mockIsAdmin,
  }),
}));

vi.mock('../components/settings/ProfileTab', () => ({
  default: () => <div>ProfileTab Content</div>,
}));

vi.mock('../components/settings/NotificationsTab', () => ({
  default: () => <div>NotificationsTab Content</div>,
}));

vi.mock('../components/settings/IntegrationsTab', () => ({
  default: function IntegrationsTabMock({ onIntegrationsCountChange }: { onIntegrationsCountChange?: (count: number) => void }) {
    useEffect(() => {
      onIntegrationsCountChange?.(2);
    }, [onIntegrationsCountChange]);
    return <div>IntegrationsTab Content</div>;
  },
}));

vi.mock('../components/settings/AITab', () => ({
  default: function AITabMock({ onAiLanguageChange }: { onAiLanguageChange?: (language: string) => void }) {
    useEffect(() => {
      onAiLanguageChange?.('en-US');
    }, [onAiLanguageChange]);
    return <div>AITab Content</div>;
  },
}));

vi.mock('../components/settings/SecurityTab', () => ({
  default: () => <div>SecurityTab Content</div>,
}));

vi.mock('../components/settings/AdminUsersTab', () => ({
  default: function AdminUsersTabMock({ onPendingCountChange }: { onPendingCountChange?: (count: number) => void }) {
    useEffect(() => {
      onPendingCountChange?.(4);
    }, [onPendingCountChange]);
    return <div>AdminUsersTab Content</div>;
  },
}));

vi.mock('../components/settings/AdminSystemTab', () => ({
  default: () => <div>AdminSystemTab Content</div>,
}));

describe('Settings', () => {
  beforeEach(() => {
    mockIsAdmin = true;
  });

  it('renders profile tab by default and shows admin tabs when user is admin', () => {
    render(<Settings />);

    expect(screen.getByText('Configurações')).toBeInTheDocument();
    expect(screen.getByText('ProfileTab Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sistema' })).toBeInTheDocument();
  });

  it('switches to notifications tab on click', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('NotificationsTab Content')).toBeInTheDocument();
  });

  it('updates integrations summary when child reports count', async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(screen.getByRole('button', { name: 'Integrações' }));
    expect(screen.getByText('IntegrationsTab Content')).toBeInTheDocument();

    const card = screen.getByText('Conexões ativas entre GitLab, ClickUp e automações MCP.').closest('div');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('2')).toBeInTheDocument();
  });

  it('hides admin tabs when user is not admin', () => {
    mockIsAdmin = false;
    render(<Settings />);

    expect(screen.queryByRole('button', { name: 'Usuários' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sistema' })).toBeNull();
  });
});

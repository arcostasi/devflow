import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import ToastContainer from '../components/Toast';

describe('ToastContainer', () => {
  it('renders without toasts', () => {
    const { container } = render(<ToastContainer toasts={[]} removeToast={() => {}} />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('renders a success toast', () => {
    const toasts = [{ id: '1', title: 'Salvo!', type: 'success' as const }];
    render(<ToastContainer toasts={toasts} removeToast={() => {}} />);
    expect(screen.getByText('Salvo!')).toBeInTheDocument();
  });

  it('renders a toast with description', () => {
    const toasts = [{ id: '2', title: 'Erro', type: 'error' as const, description: 'Detalhes aqui' }];
    render(<ToastContainer toasts={toasts} removeToast={() => {}} />);
    expect(screen.getByText('Detalhes aqui')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const toasts = [{ id: '3', title: 'Falha', type: 'error' as const, onRetry: () => {} }];
    render(<ToastContainer toasts={toasts} removeToast={() => {}} />);
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });
});

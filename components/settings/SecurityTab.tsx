import React, { useState, useCallback } from 'react';
import { Key, Shield } from 'lucide-react';
import { getErrorMessage } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { api } from '../../services/api';

interface SecurityTabProps {
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
}

const SecurityTab: React.FC<SecurityTabProps> = ({ addToast }) => {
  const { updatePassword } = useAuth();
  const { confirm } = useConfirm();

  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  const handleSaveSecurity = useCallback(async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      addToast?.('Senhas Diferentes', 'error', 'A nova senha e a confirmação não coincidem.');
      return;
    }

    const res = await updatePassword(passwordForm.current, passwordForm.new);
    if (res.success) {
      addToast?.('Senha Atualizada', 'success', 'Sua senha foi alterada com sucesso.');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } else {
      addToast?.('Falha ao Alterar Senha', 'error', res.error || 'Verifique a senha atual e tente novamente.');
    }
  }, [passwordForm, updatePassword, addToast]);

  const handleDeleteAccount = useCallback(async () => {
    if (!await confirm({ title: 'Excluir Conta', message: 'Tem certeza? Esta ação é irreversível e removerá sua conta permanentemente.', confirmText: 'Excluir Conta', variant: 'danger' })) return;
    try {
      await api.deleteAccount();
      localStorage.removeItem('devflow_token');
      globalThis.location.reload();
    } catch (e: unknown) {
      addToast?.('Falha ao Excluir Conta', 'error', getErrorMessage(e));
    }
  }, [confirm, addToast]);

  return (
    <div className="panel-stack pb-6">
      {/* 2FA Section */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 dark:border-white/10 dark:from-[#1a1b1f] dark:to-[#101114]">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <Shield className="w-24 h-24 text-fiori-blue dark:text-blue-400 transform rotate-12" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-4">
            <div className="p-3 bg-white dark:bg-white/[0.04] rounded-lg shadow-sm w-fit h-fit">
              <Shield className="w-6 h-6 text-fiori-blue dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-slate-800 dark:text-white">Autenticação de Dois Fatores (2FA)</h4>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full border border-green-200 dark:border-green-800">
                  Recomendado
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
                Adicione uma camada extra de segurança à sua conta exigindo um código de verificação ao entrar.
              </p>
            </div>
          </div>
          <button className="app-button-secondary flex-shrink-0">
            Configurar 2FA
          </button>
        </div>
      </div>

      <div className="surface-muted rounded-2xl p-6 space-y-6">
        <h4 className="text-lg font-semibold text-fiori-textPrimary dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Alterar Senha</h4>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha Atual</label>
          <div className="relative">
            <Key className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="password"
              value={passwordForm.current}
              onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
              autoComplete="current-password"
              className="app-input w-full rounded-xl px-4 py-3 pl-10"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nova Senha</label>
            <input
              type="password"
              value={passwordForm.new}
              onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
              autoComplete="new-password"
              className="app-input w-full rounded-xl px-4 py-3"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar Nova Senha</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              autoComplete="new-password"
              className="app-input w-full rounded-xl px-4 py-3"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSaveSecurity}
            disabled={!passwordForm.current || !passwordForm.new}
            className="app-button-primary px-6 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            Atualizar Senha
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-8 mt-8 border-t border-slate-200 dark:border-slate-800">
        <h4 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Zona de Perigo</h4>

        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <h5 className="font-semibold text-slate-900 dark:text-white">Excluir sua conta</h5>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
              Uma vez excluída, sua conta não poderá ser recuperada. Todos os seus dados, tarefas e configurações pessoais serão removidos permanentemente.
            </p>
          </div>
          <button onClick={handleDeleteAccount} className="app-button-danger flex-shrink-0">
            Excluir Conta
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;

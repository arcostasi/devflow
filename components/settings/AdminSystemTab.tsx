import React, { useState, useEffect, useCallback } from 'react';
import { Folder, Save, Loader2 } from 'lucide-react';
import { SystemSettings, getErrorMessage } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

interface AdminSystemTabProps {
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
}

const AdminSystemTab: React.FC<AdminSystemTabProps> = ({ addToast }) => {
  const { isAdmin } = useAuth();

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ gitDirectory: '', allowSelfRegister: 'true', requireApproval: 'true' });
  const [isLoading, setIsLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await api.getAdminSettings();
      setSystemSettings(settings);
    } catch (err) {
      console.error('Failed to load system settings:', err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadSettings();
  }, [isAdmin, loadSettings]);

  const handleSaveSettings = useCallback(async () => {
    try {
      await api.saveAdminSettings(systemSettings);
      addToast?.('Configurações Salvas', 'success', 'As configurações do sistema foram atualizadas.');
    } catch (e: unknown) {
      addToast?.('Falha ao Salvar', 'error', getErrorMessage(e));
    }
  }, [systemSettings, addToast]);

  return (
    <div className="panel-stack pb-6">
      <h3 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">Configurações do Sistema</h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] space-y-6 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
          {/* Git Directory */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-fiori-textPrimary dark:text-white">
              <Folder className="w-4 h-4" />
              Diretório Git Local
            </label>
            <input
              type="text"
              value={systemSettings.gitDirectory || ''}
              onChange={e => setSystemSettings({ ...systemSettings, gitDirectory: e.target.value })}
              placeholder="C:\Projects\meu-repositorio"
              className="app-input w-full rounded-xl px-4 py-3"
            />
            <p className="text-xs text-slate-500">Caminho absoluto do repositório Git para integração com Controle de Fonte.</p>
          </div>

          {/* Self Registration */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/75 bg-white/72 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <div>
              <h4 className="font-medium text-fiori-textPrimary dark:text-white">Permitir Auto-Cadastro</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Novos usuários podem criar contas sem convite.</p>
            </div>
            <button
              onClick={() => setSystemSettings({ ...systemSettings, allowSelfRegister: systemSettings.allowSelfRegister === 'true' ? 'false' : 'true' })}
              className={`app-toggle ${systemSettings.allowSelfRegister === 'true' ? 'app-toggle-active' : ''}`}
            >
              <span className="sr-only">Permitir Auto-Cadastro</span>
            </button>
          </div>

          {/* Require Approval */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/75 bg-white/72 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <div>
              <h4 className="font-medium text-fiori-textPrimary dark:text-white">Exigir Aprovação do Admin</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Novos cadastros ficam pendentes até aprovação manual.</p>
            </div>
            <button
              onClick={() => setSystemSettings({ ...systemSettings, requireApproval: systemSettings.requireApproval === 'true' ? 'false' : 'true' })}
              className={`app-toggle ${systemSettings.requireApproval === 'true' ? 'app-toggle-active' : ''}`}
            >
              <span className="sr-only">Exigir Aprovação do Admin</span>
            </button>
          </div>

          <button onClick={handleSaveSettings} className="app-button-primary mt-4 w-fit">
            <Save className="w-4 h-4" />
            Salvar Configurações
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminSystemTab;

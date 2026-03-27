import React, { useState, useCallback } from 'react';
import { User, Bell, Globe, Shield, Users, Settings2, Bot } from 'lucide-react';
import { ThemeMode, DensityMode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import ProfileTab from './settings/ProfileTab';
import NotificationsTab from './settings/NotificationsTab';
import IntegrationsTab from './settings/IntegrationsTab';
import AITab from './settings/AITab';
import SecurityTab from './settings/SecurityTab';
import AdminUsersTab from './settings/AdminUsersTab';
import AdminSystemTab from './settings/AdminSystemTab';

interface SettingsProps {
  themeMode?: ThemeMode;
  setThemeMode?: (mode: ThemeMode) => void;
  densityMode?: DensityMode;
  setDensityMode?: (mode: DensityMode) => void;
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ themeMode = 'system', setThemeMode, densityMode = 'comfortable', setDensityMode, addToast }) => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  // Lightweight counts for summary cards — reported by child components
  const [connectedIntegrationsCount, setConnectedIntegrationsCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [aiLanguage, setAiLanguage] = useState('pt-BR');

  const handleIntegrationsCountChange = useCallback((count: number) => setConnectedIntegrationsCount(count), []);
  const handlePendingCountChange = useCallback((count: number) => setPendingUsersCount(count), []);
  const handleAiLanguageChange = useCallback((lang: string) => setAiLanguage(lang), []);

  const settingsInsetCard =
    'rounded-2xl border border-slate-200/75 bg-slate-50/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

  const tabs = [
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'integrations', label: 'Integrações', icon: Globe },
    { id: 'ai', label: 'IA Local', icon: Bot },
    { id: 'security', label: 'Segurança', icon: Shield },
    ...(isAdmin ? [
      { id: 'admin-users', label: 'Usuários', icon: Users },
      { id: 'admin-system', label: 'Sistema', icon: Settings2 },
    ] : [])
  ];

  return (
    <div className="page-container-narrow page-shell min-h-full flex flex-col">

      {/* Header */}
      <div className="page-header-block mb-8">
        <div className="page-heading">
          <h2 className="page-title">Configurações</h2>
          <p className="page-subtitle">
            Gerencie suas preferências e informações pessoais.
          </p>
        </div>
      </div>

      <div className="page-panel-grid mb-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <div className={settingsInsetCard}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Conta</p>
          <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{user?.name || 'Usuário'}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Centralize preferências pessoais, segurança e densidade operacional.</p>
        </div>
        <div className={settingsInsetCard}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Integrações</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">{connectedIntegrationsCount}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Conexões ativas entre GitLab, ClickUp e automações MCP.</p>
        </div>
        <div className={settingsInsetCard}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Governança</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">{isAdmin ? pendingUsersCount : 0}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{isAdmin ? 'Usuários aguardando aprovação administrativa.' : 'Permissões administrativas indisponíveis para este perfil.'}</p>
        </div>
      </div>

      <div className="surface-card panel-body-block rounded-2xl">
        <nav className="page-tabs mb-6 overflow-x-auto -mx-2 px-2 scrollbar-thin" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center whitespace-nowrap rounded-xl border px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                  isActive
                    ? 'border-slate-200/80 bg-white/85 text-slate-900 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:shadow-none'
                    : 'border-transparent text-slate-500 hover:border-slate-200/70 hover:bg-slate-50/80 hover:text-slate-800 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:hover:text-slate-200'
                }`}
              >
                <tab.icon className={`
                  -ml-0.5 mr-2.5 h-5 w-5
                  ${isActive ? 'text-primary-500' : 'text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'}
                `} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-[500px] w-full self-start pt-2">
          {activeTab === 'profile' && (
            <ProfileTab
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              densityMode={densityMode}
              setDensityMode={setDensityMode}
              addToast={addToast}
              aiLanguage={aiLanguage}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsTab addToast={addToast} />
          )}

          {activeTab === 'integrations' && (
            <IntegrationsTab addToast={addToast} onIntegrationsCountChange={handleIntegrationsCountChange} />
          )}

          {activeTab === 'ai' && (
            <AITab addToast={addToast} onAiLanguageChange={handleAiLanguageChange} />
          )}

          {activeTab === 'security' && (
            <SecurityTab addToast={addToast} />
          )}

          {activeTab === 'admin-users' && (
            <AdminUsersTab addToast={addToast} onPendingCountChange={handlePendingCountChange} />
          )}

          {activeTab === 'admin-system' && (
            <AdminSystemTab addToast={addToast} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

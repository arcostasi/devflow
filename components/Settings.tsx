
import React, { useState, useEffect } from 'react';
import { User, Bell, Palette, Globe, Save, Key, Shield, Mail, Check, LogOut, CheckCircle2, Users, Folder, Settings2, Loader2, Trash2, UserPlus, UserCheck, RefreshCw } from 'lucide-react';
import Avatar from './Avatar';
import { ThemeMode, DensityMode } from '../types';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { api } from '../services/api';
import jiraLogo from '../assets/jira-logo.svg';

interface SettingsProps {
  themeMode?: ThemeMode;
  setThemeMode?: (mode: ThemeMode) => void;
  densityMode?: DensityMode;
  setDensityMode?: (mode: DensityMode) => void;
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: string;
  createdAt: string;
  groupNames?: string;
}

interface AdminGroup {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface SystemSettings {
  gitDirectory: string;
  allowSelfRegister: string;
  requireApproval: string;
}

const DEFAULT_BIO = 'Apaixonado por código limpo e arquitetura de software escalável.';

const Settings: React.FC<SettingsProps> = ({ themeMode = 'system', setThemeMode, densityMode = 'comfortable', setDensityMode, addToast }) => {
  const { user, isAdmin, updateProfile, updatePassword } = useAuth();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    bio: user?.preferences?.bio || DEFAULT_BIO
  });

  // Security Form
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  const [notifications, setNotifications] = useState({
    email_digest: true,
    pr_review: true,
    ci_failed: true,
    marketing: false,
    ...user?.preferences?.notifications
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name,
        bio: user.preferences?.bio || DEFAULT_BIO
      });
      if (user.preferences?.notifications) {
        setNotifications(prev => ({ ...prev, ...user.preferences.notifications }));
      }
    }
  }, [user]);

  // Admin states
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminGroups, setAdminGroups] = useState<AdminGroup[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ gitDirectory: '', allowSelfRegister: 'true', requireApproval: 'true' });
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);

  // Estados de Integração
  const [gitlabConfig, setGitlabConfig] = useState({ connected: false, token: '', username: '', gitlabUrl: '' });
  const [jiraConfig, setJiraConfig] = useState({ connected: false, email: '', domain: '', displayName: '' });

  // Load Integrations
  useEffect(() => {
    api.getIntegrations()
      .then(data => {
        const gitlab = data.find((i: any) => i.provider === 'gitlab');
        if (gitlab) {
          setGitlabConfig({
            connected: true,
            token: '********',
            username: gitlab.meta.username,
            gitlabUrl: gitlab.meta.gitlabUrl || 'https://gitlab.com'
          });
        } else {
          setGitlabConfig({ connected: false, token: '', username: '', gitlabUrl: '' });
        }

        const jira = data.find((i: any) => i.provider === 'jira');
        if (jira) {
          setJiraConfig({
            connected: true,
            email: jira.meta.email,
            domain: jira.meta.domain,
            displayName: jira.meta.displayName
          });
        } else {
          setJiraConfig({ connected: false, email: '', domain: '', displayName: '' });
        }
      })
      .catch(err => console.error('Failed to load integrations', err));
  }, []);

  // Controle de Modais
  const [activeModal, setActiveModal] = useState<'gitlab' | 'jira' | 'newUser' | null>(null);

  // Forms temporários para os modais
  const [gitlabForm, setGitlabForm] = useState({ token: '', username: '', gitlabUrl: '' });
  const [jiraForm, setJiraForm] = useState({ email: '', apiToken: '', domain: '' });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'user' });

  // Load admin data when tab changes
  useEffect(() => {
    if (isAdmin && (activeTab === 'admin-users' || activeTab === 'admin-groups' || activeTab === 'admin-system')) {
      loadAdminData();
    }
  }, [activeTab, isAdmin]);

  const loadAdminData = async () => {
    setIsLoadingAdmin(true);
    try {
      const [users, groups, settings] = await Promise.all([
        api.getAdminUsers(),
        api.getAdminGroups(),
        api.getAdminSettings()
      ]);
      setAdminUsers(users);
      setAdminGroups(groups);
      setSystemSettings(settings);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
    setIsLoadingAdmin(false);
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await api.updateAdminUser(userId, { status: 'active' });
      addToast?.('Usuário Aprovado', 'success', 'O acesso ao sistema foi liberado.');
      loadAdminData();
    } catch (e: any) {
      addToast?.('Falha na Aprovação', 'error', e.message || 'Não foi possível aprovar o usuário.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!await confirm({ title: 'Remover Usuário', message: 'Remover este usuário?', confirmText: 'Remover', variant: 'danger' })) return;
    try {
      await api.deleteAdminUser(userId);
      addToast?.('Usuário Removido', 'info', 'A conta foi removida do sistema.');
      loadAdminData();
    } catch (e: any) {
      addToast?.('Falha ao Remover', 'error', e.message || 'Não foi possível remover o usuário.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAdminUser(newUserForm);
      addToast?.('Usuário Criado', 'success', `${newUserForm.name} foi adicionado ao sistema.`);
      setActiveModal(null);
      setNewUserForm({ name: '', email: '', password: '', role: 'user' });
      loadAdminData();
    } catch (e: any) {
      addToast?.('Falha ao Criar Usuário', 'error', e.message || 'Verifique os dados e tente novamente.');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.saveAdminSettings(systemSettings);
      addToast?.('Configurações Salvas', 'success', 'As configurações do sistema foram atualizadas.');
    } catch (e: any) {
      addToast?.('Falha ao Salvar', 'error', e.message || 'Não foi possível salvar as configurações.');
    }
  };

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Auto-save notifications
      if (user) {
        updateProfile({
          preferences: {
            ...(user.preferences || {}),
            notifications: next
          }
        });
      }
      return next;
    });
  };

  const handleSaveProfile = async () => {
    const res = await updateProfile({
      name: profileForm.name,
      preferences: {
        ...(user?.preferences || {}),
        bio: profileForm.bio
      }
    });

    if (res.success) {
      addToast?.('Perfil Atualizado', 'success', 'Suas informações foram salvas com sucesso.');
    } else {
      addToast?.('Falha ao Atualizar Perfil', 'error', res.error || 'Não foi possível salvar as alterações.');
    }
  };

  const handleSaveSecurity = async () => {
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
  };

  const handleThemeChange = (mode: ThemeMode) => {
    if (setThemeMode) {
      setThemeMode(mode);
    }
  };

  // Handlers para GitLab
  const handleSyncGitlab = async () => {
    try {
      addToast?.('Sincronizando GitLab...', 'info', 'Buscando repositórios e dados remotos.');
      const data = await api.syncGitlab();
      addToast?.('GitLab Sincronizado', 'success', data.message || 'Dados atualizados com sucesso.');
    } catch (e: any) {
      addToast?.('Falha na Sincronização', 'error', e.message || 'Não foi possível sincronizar com o GitLab.');
    }
  };

  const handleConnectGitlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gitlabForm.token || !gitlabForm.username) {
      addToast?.('Campos Obrigatórios', 'error', 'Informe o Personal Access Token e o nome de usuário do GitLab.');
      return;
    }
    try {
      const data = await api.connectGitlab(gitlabForm);
      setGitlabConfig({ connected: true, ...gitlabForm });
      setActiveModal(null);
      addToast?.('GitLab Conectado', 'success', `Conta @${data.user} vinculada com sucesso.`);
      setGitlabForm({ token: '', username: '', gitlabUrl: '' });
    } catch (e: any) {
      addToast?.('Falha na Conexão GitLab', 'error', e.message || 'Verifique o token e o nome de usuário.');
    }
  };

  const handleDisconnectGitlab = async () => {
    if (!await confirm({ title: 'Desconectar GitLab', message: 'Tem certeza que deseja desconectar o GitLab?', confirmText: 'Desconectar', variant: 'warning' })) return;
    try {
      await api.disconnectGitlab();
      setGitlabConfig({ connected: false, token: '', username: '', gitlabUrl: '' });
      addToast?.('GitLab Desconectado', 'info', 'A integração com o GitLab foi removida.');
    } catch (e: any) {
      addToast?.('Falha ao Desconectar', 'error', e.message || 'Não foi possível desconectar o GitLab.');
    }
  };

  // Handlers para Jira
  const handleSyncJira = async () => {
    try {
      addToast?.('Sincronizando Jira...', 'info', 'Importando issues e projetos.');
      const data = await api.syncJira();
      addToast?.('Jira Sincronizado', 'success', data.message || 'Dados importados com sucesso.');
    } catch (e: any) {
      addToast?.('Falha na Sincronização', 'error', e.message || 'Não foi possível sincronizar com o Jira.');
    }
  };

  const handleConnectJira = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraForm.email || !jiraForm.apiToken || !jiraForm.domain) {
      addToast?.('Campos Obrigatórios', 'error', 'Informe o e-mail, API Token e domínio do Jira para conectar.');
      return;
    }
    try {
      const result = await api.connectJira(jiraForm);
      setJiraConfig({ connected: true, email: jiraForm.email, domain: jiraForm.domain, displayName: result.displayName || jiraForm.email });
      setActiveModal(null);
      addToast?.('Jira Conectado', 'success', `Conectado como ${result.displayName || jiraForm.email}`);
      setJiraForm({ email: '', apiToken: '', domain: '' });
    } catch (e: any) {
      addToast?.('Falha na Conexão Jira', 'error', e.message || 'Verifique as credenciais e o domínio informado.');
    }
  };

  const handleDisconnectJira = async () => {
    if (!await confirm({ title: 'Desconectar Jira', message: 'Desconectar integração com Jira?', confirmText: 'Desconectar', variant: 'warning' })) return;
    try {
      await api.disconnectJira();
      setJiraConfig({ connected: false, email: '', domain: '', displayName: '' });
      addToast?.('Jira Desconectado', 'info', 'A integração com o Jira foi removida.');
    } catch (e: any) {
      addToast?.('Falha ao Desconectar', 'error', e.message || 'Não foi possível desconectar o Jira.');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'integrations', label: 'Integrações', icon: Globe },
    { id: 'security', label: 'Segurança', icon: Shield },
    ...(isAdmin ? [
      { id: 'admin-users', label: 'Usuários', icon: Users },
      { id: 'admin-groups', label: 'Grupos', icon: Shield },
      { id: 'admin-system', label: 'Sistema', icon: Settings2 },
    ] : [])
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-fiori-textPrimary dark:text-white">Configurações</h2>
          <p className="text-sm text-fiori-textSecondary dark:text-slate-400 mt-1">
            Gerencie suas preferências e informações pessoais.
          </p>
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 mb-8">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-[3px] font-medium text-sm transition-all whitespace-nowrap
                  ${isActive
                    ? 'border-fiori-blue text-fiori-blue'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200'}
                `}
              >
                <tab.icon className={`
                  -ml-0.5 mr-2.5 h-5 w-5
                  ${isActive ? 'text-fiori-blue' : 'text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300'}
                `} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="bg-fiori-cardLight dark:bg-fiori-cardDark rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 p-8 min-h-[500px]">

        {activeTab === 'profile' && (
          <div className="space-y-8 pb-6">
            <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="relative group cursor-pointer">
                <Avatar name={user?.name || 'User'} size="xl" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                  <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Alterar</span>
                </div>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-fiori-textPrimary dark:text-white">{user?.name}</h4>
                <p className="text-fiori-textSecondary dark:text-slate-400 text-sm mt-0.5 capitalize">{user?.role} • <span className="text-fiori-link dark:text-fiori-linkDark cursor-pointer hover:underline">@{user?.name?.toLowerCase().replace(/\s+/g, '')}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Nome Completo</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-fiori-blue focus:border-transparent focus:outline-none dark:text-slate-200 shadow-sm transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Email Corporativo</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input type="email" defaultValue={user?.email} disabled className="w-full pl-10 px-4 py-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-sm transition-all" />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Bio</label>
                <textarea
                  rows={4}
                  value={profileForm.bio}
                  onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-fiori-blue focus:border-transparent focus:outline-none dark:text-slate-200 resize-none shadow-sm transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <button onClick={handleSaveProfile} className="bg-fiori-blue hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors">
                  Salvar Perfil
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            {[
              { key: 'email_digest', label: 'Resumo por Email', desc: 'Receba um resumo diário das atividades do projeto.' },
              { key: 'pr_review', label: 'Revisões de Pull Request', desc: 'Notifique-me quando alguém solicitar minha revisão.' },
              { key: 'ci_failed', label: 'Falhas de Build (CI/CD)', desc: 'Alerta imediato quando pipelines quebrarem.' },
              { key: 'marketing', label: 'Novidades do Produto', desc: 'Receba atualizações sobre novas funcionalidades do DevFlow.' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all">
                <div className="pr-4">
                  <h4 className="text-base font-semibold text-fiori-textPrimary dark:text-white">{item.label}</h4>
                  <p className="text-sm text-fiori-textSecondary dark:text-slate-400 mt-1">{item.desc}</p>
                </div>
                <button
                  onClick={() => toggleNotif(item.key as keyof typeof notifications)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fiori-blue ${notifications[item.key as keyof typeof notifications] ? 'bg-fiori-blue' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${notifications[item.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-10">
            <div>
              <h4 className="text-base font-semibold text-fiori-textPrimary dark:text-white mb-6">Tema da Interface</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* SYSTEM THEME CARD */}
                <div
                  onClick={() => handleThemeChange('system')}
                  className={`group border-2 rounded-xl p-2 bg-slate-50 dark:bg-slate-800/70 cursor-pointer h-40 flex flex-col transition-all
                        ${themeMode === 'system' ? 'border-fiori-blue' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  <div className="flex-1 bg-white rounded-lg border border-slate-200 mb-2 relative overflow-hidden group-hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-full h-6 bg-slate-100 border-b border-slate-100"></div>
                    <div className="absolute top-0 left-0 w-8 h-full bg-slate-100 border-r border-slate-100"></div>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className={`text-sm font-semibold ${themeMode === 'system' ? 'text-fiori-blue' : 'text-slate-500'}`}>Sistema</span>
                    {themeMode === 'system' && <Check className="w-4 h-4 text-fiori-blue" />}
                  </div>
                </div>

                {/* LIGHT THEME CARD */}
                <div
                  onClick={() => handleThemeChange('light')}
                  className={`group border-2 rounded-xl p-2 bg-white cursor-pointer h-40 flex flex-col transition-all
                        ${themeMode === 'light' ? 'border-fiori-blue' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                >
                  <div className="flex-1 bg-white rounded-lg border border-slate-200 mb-2 relative overflow-hidden group-hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-full h-6 bg-gray-100 border-b border-gray-200"></div>
                    <div className="absolute top-0 left-0 w-8 h-full bg-gray-50 border-r border-gray-200"></div>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className={`text-sm font-semibold ${themeMode === 'light' ? 'text-fiori-blue' : 'text-slate-500'}`}>Claro</span>
                    {themeMode === 'light' && <Check className="w-4 h-4 text-fiori-blue" />}
                  </div>
                </div>

                {/* DARK THEME CARD */}
                <div
                  onClick={() => handleThemeChange('dark')}
                  className={`group border-2 rounded-xl p-2 bg-slate-900 cursor-pointer h-40 flex flex-col transition-all
                        ${themeMode === 'dark' ? 'border-fiori-blue' : 'border-slate-200 dark:border-slate-700 hover:border-slate-600'}`}
                >
                  <div className="flex-1 bg-slate-900 rounded-lg border border-slate-800 mb-2 relative overflow-hidden group-hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-full h-6 bg-slate-800 border-b border-primary-400/20"></div>
                    <div className="absolute top-0 left-0 w-8 h-full bg-slate-800 border-r border-primary-400/20"></div>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className={`text-sm font-semibold ${themeMode === 'dark' ? 'text-fiori-blue' : 'text-slate-500'}`}>Escuro</span>
                    {themeMode === 'dark' && <Check className="w-4 h-4 text-fiori-blue" />}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-semibold text-fiori-textPrimary dark:text-white mb-6">Densidade de Informação</h4>
              <div className="flex gap-8">
                <label
                  onClick={() => setDensityMode?.('comfortable')}
                  className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className={`w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center group-hover:border-fiori-blue ${densityMode === 'comfortable' ? 'border-fiori-blue' : ''}`}>
                    {densityMode === 'comfortable' && <div className="w-2.5 h-2.5 rounded-full bg-fiori-blue"></div>}
                  </div>
                  <span className={`text-sm font-medium transition-colors ${densityMode === 'comfortable' ? 'text-fiori-blue' : 'text-slate-700 dark:text-slate-300'}`}>Confortável (Padrão)</span>
                </label>
                <label
                  onClick={() => setDensityMode?.('compact')}
                  className="flex items-center gap-3 cursor-pointer group p-3 rounded-lg border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className={`w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center group-hover:border-fiori-blue ${densityMode === 'compact' ? 'border-fiori-blue' : ''}`}>
                    {densityMode === 'compact' && <div className="w-2.5 h-2.5 rounded-full bg-fiori-blue"></div>}
                  </div>
                  <span className={`text-sm font-medium transition-colors ${densityMode === 'compact' ? 'text-fiori-blue' : 'text-slate-700 dark:text-slate-300'}`}>Compacto</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6">
            {/* GITLAB */}
            <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/30 flex items-center justify-between shadow-sm hover:shadow-md dark:hover:shadow-none dark:hover:bg-slate-900/50 transition-all">
              <div className="flex items-center gap-5">
                <div className={`p-4 rounded-full ${gitlabConfig.connected ? 'bg-orange-600 text-white' : 'bg-orange-50 dark:bg-slate-800'}`}>
                  <svg className={`w-8 h-8 ${!gitlabConfig.connected ? 'text-orange-600' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">GitLab</h4>
                    {gitlabConfig.connected && (
                      <span className="text-xs flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Conectado como {gitlabConfig.username}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-fiori-textSecondary dark:text-slate-400">Sincronização de issues e merge requests com GitLab</p>
                  {gitlabConfig.connected && gitlabConfig.gitlabUrl && (
                    <p className="text-xs text-slate-400 mt-1">{gitlabConfig.gitlabUrl}</p>
                  )}
                </div>
              </div>
              {gitlabConfig.connected ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncGitlab}
                    className="text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Sincronizar
                  </button>
                  <button
                    onClick={handleDisconnectGitlab}
                    className="text-sm font-medium border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveModal('gitlab')}
                  className="text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-5 py-2.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Configurar
                </button>
              )}
            </div>

            {/* JIRA */}
            <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/30 flex items-center justify-between shadow-sm hover:shadow-md dark:hover:shadow-none dark:hover:bg-slate-900/50 transition-all">
              <div className="flex items-center gap-5">
                <img src={jiraLogo} alt="Jira" className="w-12 h-12 rounded-xl" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">Jira</h4>
                    {jiraConfig.connected && (
                      <span className="text-xs flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Conectado como {jiraConfig.displayName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-fiori-textSecondary dark:text-slate-400">
                    {jiraConfig.connected ? jiraConfig.domain : 'Importação de issues, sincronização de status com Jira Cloud (plano free).'}
                  </p>
                </div>
              </div>
              {jiraConfig.connected ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncJira}
                    className="text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Sincronizar
                  </button>
                  <button
                    onClick={handleDisconnectJira}
                    className="text-sm font-medium border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveModal('jira')}
                  className="text-sm font-medium bg-fiori-blue text-white px-5 py-2.5 rounded-md hover:bg-blue-700 shadow-sm transition-colors"
                >
                  Conectar
                </button>
              )}
            </div>

            {/* Personal Access Token Info (Static) */}
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 opacity-60 hover:opacity-100 transition-opacity">
              <label className="text-sm font-semibold text-fiori-textPrimary dark:text-white mb-2 block">DevFlow API Token</label>
              <p className="text-sm text-slate-500 mb-4">Token para scripts de automação CI/CD internos.</p>
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input type="password" value="ghp_************************************" disabled className="w-full pl-10 px-4 py-3 bg-slate-50 dark:bg-[#1a1f26] border border-slate-200 dark:border-slate-700 rounded-md text-slate-500 font-mono text-sm" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-8">
            {/* 2FA Section - Premium Card */}
            <div className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-slate-700 rounded-xl">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Shield className="w-24 h-24 text-fiori-blue dark:text-blue-400 transform rotate-12" />
              </div>

              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm w-fit h-fit">
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
                <button className="flex-shrink-0 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-fiori-blue dark:hover:border-blue-500 text-slate-700 dark:text-slate-200 font-medium text-sm rounded-lg transition-all shadow-sm">
                  Configurar 2FA
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-lg font-semibold text-fiori-textPrimary dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Alterar Senha</h4>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha Atual</label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="w-full pl-10 px-4 py-3 bg-white dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-fiori-blue focus:border-transparent focus:outline-none dark:text-slate-200 shadow-sm transition-all"
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
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-fiori-blue focus:border-transparent focus:outline-none dark:text-slate-200 shadow-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-fiori-blue focus:border-transparent focus:outline-none dark:text-slate-200 shadow-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveSecurity}
                  disabled={!passwordForm.current || !passwordForm.new}
                  className="bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <button
                  onClick={async () => {
                    if (!await confirm({ title: 'Excluir Conta', message: 'Tem certeza? Esta ação é irreversível e removerá sua conta permanentemente.', confirmText: 'Excluir Conta', variant: 'danger' })) return;
                    try {
                      await api.deleteAccount();
                      localStorage.removeItem('devflow_token');
                      window.location.reload();
                    } catch (e: any) {
                      addToast?.('Falha ao Excluir Conta', 'error', e.message || 'Não foi possível excluir sua conta. Tente novamente.');
                    }
                  }}
                  className="flex-shrink-0 px-4 py-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 font-medium text-sm rounded-lg transition-colors shadow-sm">
                  Excluir Conta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN: Users Tab */}
        {activeTab === 'admin-users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">Gerenciar Usuários</h3>
              <button
                onClick={() => setActiveModal('newUser')}
                className="flex items-center gap-2 bg-fiori-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Novo Usuário
              </button>
            </div>

            {isLoadingAdmin ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Usuário</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Grupos</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-transparent">
                    {adminUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : user.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-red-100 text-red-700'}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user.groupNames || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {user.status === 'pending' && (
                              <button onClick={() => handleApproveUser(user.id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded" title="Aprovar">
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}
                            {user.id !== 'admin' && (
                              <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Remover">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ADMIN: Groups Tab */}
        {activeTab === 'admin-groups' && (
          <div className="space-y-6 pb-6">
            <h3 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">Grupos e Permissões</h3>

            {isLoadingAdmin ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-4">
                {adminGroups.map(group => (
                  <div key={group.id} className="p-5 bg-white dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-700 dark:text-white">{group.name}</h4>
                      <span className="text-xs text-slate-400">{group.id}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{group.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.permissions.map((perm, idx) => (
                        <span key={idx} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADMIN: System Settings Tab */}
        {activeTab === 'admin-system' && (
          <div className="space-y-8">
            <h3 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">Configurações do Sistema</h3>

            {isLoadingAdmin ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
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
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800/70 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-fiori-blue focus:border-transparent focus:outline-none dark:text-slate-200"
                  />
                  <p className="text-xs text-slate-500">Caminho absoluto do repositório Git para integração com Controle de Fonte.</p>
                </div>

                {/* Self Registration */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-fiori-textPrimary dark:text-white">Permitir Auto-Cadastro</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Novos usuários podem criar contas sem convite.</p>
                  </div>
                  <button
                    onClick={() => setSystemSettings({ ...systemSettings, allowSelfRegister: systemSettings.allowSelfRegister === 'true' ? 'false' : 'true' })}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${systemSettings.allowSelfRegister === 'true' ? 'bg-fiori-blue' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${systemSettings.allowSelfRegister === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Require Approval */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-fiori-textPrimary dark:text-white">Exigir Aprovação do Admin</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Novos cadastros ficam pendentes até aprovação manual.</p>
                  </div>
                  <button
                    onClick={() => setSystemSettings({ ...systemSettings, requireApproval: systemSettings.requireApproval === 'true' ? 'false' : 'true' })}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${systemSettings.requireApproval === 'true' ? 'bg-fiori-blue' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${systemSettings.requireApproval === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <button
                  onClick={handleSaveSettings}
                  className="flex items-center gap-2 bg-fiori-blue hover:bg-blue-700 text-white px-5 py-2.5 rounded-md text-sm font-medium transition-colors mt-4"
                >
                  <Save className="w-4 h-4" />
                  Salvar Configurações
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New User Modal */}
      <Modal isOpen={activeModal === 'newUser'} onClose={() => setActiveModal(null)} title="Novo Usuário" size="md">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
            <input
              type="text"
              value={newUserForm.name}
              onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              value={newUserForm.email}
              onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
            <input
              type="password"
              value={newUserForm.password}
              onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
            <select
              value={newUserForm.role}
              onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm bg-fiori-blue text-white rounded-md hover:bg-blue-700">Criar Usuário</button>
          </div>
        </form>
      </Modal>

      {/* GitLab Configuration Modal */}
      <Modal isOpen={activeModal === 'gitlab'} onClose={() => setActiveModal(null)} title="Configurar GitLab" size="md">
        <form onSubmit={handleConnectGitlab} className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Crie um Personal Access Token (PAT) no GitLab com escopo <code>api</code> ou <code>read_api</code> para permitir a integração.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">URL do GitLab <span className="text-slate-400">(opcional)</span></label>
            <input
              type="text"
              value={gitlabForm.gitlabUrl}
              onChange={(e) => setGitlabForm({ ...gitlabForm, gitlabUrl: e.target.value })}
              placeholder="https://gitlab.com (padrão)"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
            />
            <p className="text-xs text-slate-400">Deixe em branco para usar gitlab.com ou insira a URL do seu GitLab self-hosted.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">GitLab Username</label>
            <input
              type="text"
              value={gitlabForm.username}
              onChange={(e) => setGitlabForm({ ...gitlabForm, username: e.target.value })}
              placeholder="ex: johndoe"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Personal Access Token</label>
            <input
              type="password"
              value={gitlabForm.token}
              onChange={(e) => setGitlabForm({ ...gitlabForm, token: e.target.value })}
              placeholder="glpat-..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white font-mono"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700">Conectar GitLab</button>
          </div>
        </form>
      </Modal>

      {/* Jira Configuration Modal */}
      <Modal isOpen={activeModal === 'jira'} onClose={() => setActiveModal(null)} title="Configurar Jira" size="md">
        <form onSubmit={handleConnectJira} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3">
            <img src={jiraLogo} alt="Jira" className="w-6 h-6 rounded flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p className="font-medium">Como obter o API Token do Jira:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                <li>Acesse <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="font-mono underline hover:text-blue-900 dark:hover:text-blue-100 transition-colors">id.atlassian.com/manage-profile/security/api-tokens</a></li>
                <li>Clique em <strong>Create API token</strong></li>
                <li>Copie o token gerado e cole abaixo</li>
              </ol>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail da conta Atlassian</label>
            <input
              type="email"
              value={jiraForm.email}
              onChange={(e) => setJiraForm({ ...jiraForm, email: e.target.value })}
              placeholder="seu@email.com"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">API Token</label>
            <input
              type="password"
              value={jiraForm.apiToken}
              onChange={(e) => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
              placeholder="ATATT3xFfGF0..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Domínio Jira</label>
            <input
              type="text"
              value={jiraForm.domain}
              onChange={(e) => setJiraForm({ ...jiraForm, domain: e.target.value })}
              placeholder="minha-org.atlassian.net"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-mono"
            />
            <p className="text-xs text-slate-500">Encontrado na URL do seu Jira: <span className="font-mono">https://sua-org.atlassian.net</span></p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm bg-[#0052CC] hover:bg-blue-800 text-white rounded-md font-medium">Conectar Jira</button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default Settings;

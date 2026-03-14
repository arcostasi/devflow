
import React, { useState, useEffect } from 'react';
import { User, Bell, Palette, Globe, Save, Key, Shield, Mail, Check, LogOut, CheckCircle2, Users, Folder, Settings2, Loader2, Trash2, UserPlus, UserCheck, RefreshCw, Zap } from 'lucide-react';
import Avatar from './Avatar';
import { ThemeMode, DensityMode } from '../types';
import Modal from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { api } from '../services/api';

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
const clickUpSyncDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const formatClickUpSyncTime = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return clickUpSyncDateFormatter.format(parsed);
};

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
  const [clickupConfig, setClickupConfig] = useState({
    connected: false,
    workspaceId: '',
    listId: '',
    mcpConnected: false,
    mcpWorkspaceId: '',
    lastSyncUsedWorkspaceFallback: false,
    lastSyncAt: '',
  });

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

        const clickup = data.find((i: any) => i.provider === 'clickup');
        const clickupMcp = data.find((i: any) => i.provider === 'clickup_mcp');
        if (clickup) {
          setClickupConfig({
            connected: true,
            workspaceId: clickup.meta.workspaceId || '',
            listId: clickup.meta.listId || '',
            mcpConnected: Boolean(clickupMcp),
            mcpWorkspaceId: clickup.meta.mcpWorkspaceId || clickup.meta.workspaceId || '',
            lastSyncUsedWorkspaceFallback: Boolean(clickup.meta.lastSyncUsedWorkspaceFallback),
            lastSyncAt: clickup.meta.lastSyncAt || '',
          });
        } else {
          setClickupConfig({
            connected: false,
            workspaceId: '',
            listId: '',
            mcpConnected: false,
            mcpWorkspaceId: '',
            lastSyncUsedWorkspaceFallback: false,
            lastSyncAt: '',
          });
        }
      })
      .catch(err => console.error('Failed to load integrations', err));
  }, []);

  // Controle de Modais
  const [activeModal, setActiveModal] = useState<'gitlab' | 'clickup' | 'newUser' | null>(null);

  // Forms temporários para os modais
  const [gitlabForm, setGitlabForm] = useState({ token: '', username: '', gitlabUrl: '' });
  const [clickupForm, setClickupForm] = useState({ apiToken: '', workspaceId: '', listId: '', mcpAccessToken: '', mcpWorkspaceId: '' });
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [clickupTools, setClickupTools] = useState<any[]>([]);
  const [clickupToolsSource, setClickupToolsSource] = useState<'runtime' | 'catalog' | 'catalog-fallback'>('catalog');
  const [isLoadingClickupTools, setIsLoadingClickupTools] = useState(false);
  const [toolToExecute, setToolToExecute] = useState('get_workspace_hierarchy');
  const [toolArgsJson, setToolArgsJson] = useState('{\n  "workspace_id": ""\n}');
  const [toolDryRun, setToolDryRun] = useState(true);
  const [toolExecutionResult, setToolExecutionResult] = useState('');
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [mcpAuditItems, setMcpAuditItems] = useState<any[]>([]);
  const [isLoadingMcpAudit, setIsLoadingMcpAudit] = useState(false);

  // Load admin data when tab changes
  useEffect(() => {
    if (isAdmin && (activeTab === 'admin-users' || activeTab === 'admin-system')) {
      loadAdminData();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab !== 'integrations' || !clickupConfig.connected) return;
    loadClickUpTools();
    loadClickUpMcpAudit();
  }, [activeTab, clickupConfig.connected]);

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

  const handleSyncClickUp = async () => {
    try {
      addToast?.('Sincronizando ClickUp...', 'info', 'Importando tarefas via API v3.');
      const data = await api.syncClickUp();
      setClickupConfig(prev => ({
        ...prev,
        lastSyncUsedWorkspaceFallback: Boolean(data.usedWorkspaceFallback),
        lastSyncAt: data.syncedAt || new Date().toISOString(),
      }));
      addToast?.('ClickUp Sincronizado', 'success', data.message || 'Dados importados com sucesso.');
    } catch (e: any) {
      addToast?.('Falha na Sincronização', 'error', e.message || 'Não foi possível sincronizar com o ClickUp.');
    }
  };

  const handleRefreshClickUpMcpStatus = async () => {
    try {
      const status = await api.getClickUpStatus();
      setClickupConfig(prev => ({
        ...prev,
        connected: status.connected,
        mcpConnected: status.mcpConnected && status.mcpHealthy,
        workspaceId: status.workspaceId || prev.workspaceId,
        listId: status.listId || prev.listId,
        mcpWorkspaceId: status.mcpWorkspaceId || prev.mcpWorkspaceId,
        lastSyncUsedWorkspaceFallback: Boolean(status.lastSyncUsedWorkspaceFallback),
        lastSyncAt: status.lastSyncAt || prev.lastSyncAt,
      }));
      if (status.mcpConnected && status.mcpHealthy) {
        addToast?.('Status Atualizado', 'success', 'ClickUp MCP validado com sucesso.');
      } else {
        addToast?.('Status Atualizado', 'warning', status.mcpError || 'MCP não está conectado. Configure o token MCP ou use OAuth PKCE.');
      }
    } catch (e: any) {
      addToast?.('Falha ao Atualizar Status', 'error', e.message || 'Não foi possível validar a conexão MCP do ClickUp.');
    }
  };

  const handleConnectClickUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickupForm.apiToken || !clickupForm.workspaceId) {
      addToast?.('Campos Obrigatórios', 'error', 'Informe o API Token e o Workspace ID do ClickUp.');
      return;
    }
    try {
      const result = await api.connectClickUp(clickupForm);
      const attemptedMcp = Boolean(clickupForm.mcpAccessToken?.trim());
      setClickupConfig({
        connected: true,
        workspaceId: clickupForm.workspaceId,
        listId: clickupForm.listId,
        mcpConnected: Boolean(result.mcpConnected),
        mcpWorkspaceId: clickupForm.mcpWorkspaceId || clickupForm.workspaceId,
        lastSyncUsedWorkspaceFallback: false,
        lastSyncAt: '',
      });
      setActiveModal(null);
      if (attemptedMcp && !result.mcpConnected) {
        addToast?.('ClickUp API Conectada', 'warning', result.mcpError || 'API conectou, mas o MCP não validou. Revise o token MCP ou use OAuth PKCE.');
      } else if (attemptedMcp && result.mcpConnected) {
        addToast?.('ClickUp Conectado', 'success', 'Integração com API v3 e MCP configurada.');
      } else {
        addToast?.('ClickUp API Conectada', 'success', 'API v3 conectada com sucesso. Configure o MCP via token ou OAuth PKCE.');
      }
      setClickupForm({ apiToken: '', workspaceId: '', listId: '', mcpAccessToken: '', mcpWorkspaceId: '' });
    } catch (e: any) {
      addToast?.('Falha na Conexão ClickUp', 'error', e.message || 'Verifique os dados informados e tente novamente.');
    }
  };

  const handleDisconnectClickUp = async () => {
    if (!await confirm({ title: 'Desconectar ClickUp', message: 'Desconectar integração com ClickUp API v3 e MCP?', confirmText: 'Desconectar', variant: 'warning' })) return;
    try {
      await api.disconnectClickUp();
      setClickupConfig({
        connected: false,
        workspaceId: '',
        listId: '',
        mcpConnected: false,
        mcpWorkspaceId: '',
        lastSyncUsedWorkspaceFallback: false,
        lastSyncAt: '',
      });
      addToast?.('ClickUp Desconectado', 'info', 'A integração com o ClickUp foi removida.');
    } catch (e: any) {
      addToast?.('Falha ao Desconectar', 'error', e.message || 'Não foi possível desconectar o ClickUp.');
    }
  };

  const loadClickUpTools = async () => {
    setIsLoadingClickupTools(true);
    try {
      const result = await api.getClickUpTools();
      setClickupTools(Array.isArray(result.tools) ? result.tools : []);
      setClickupToolsSource(result.source || 'catalog');
    } catch (e: any) {
      addToast?.('Falha ao Carregar Tools MCP', 'error', e.message || 'Não foi possível obter o catálogo MCP do ClickUp.');
    } finally {
      setIsLoadingClickupTools(false);
    }
  };

  const loadClickUpMcpAudit = async () => {
    setIsLoadingMcpAudit(true);
    try {
      const result = await api.getClickUpMcpAudit(30);
      setMcpAuditItems(Array.isArray(result.items) ? result.items : []);
    } catch (e: any) {
      addToast?.('Falha ao Carregar Auditoria', 'error', e.message || 'Não foi possível carregar a trilha de auditoria MCP.');
    } finally {
      setIsLoadingMcpAudit(false);
    }
  };

  const handleConnectClickUpMcpOAuth = async () => {
    try {
      const result = await api.startClickUpMcpOAuth(clickupConfig.workspaceId || clickupForm.workspaceId || undefined);
      const popup = globalThis.open(result.authorizeUrl, 'clickup-mcp-oauth', 'width=640,height=760');
      if (!popup) {
        addToast?.('Popup Bloqueado', 'error', 'Habilite popups para concluir o OAuth do ClickUp MCP.');
        return;
      }
      addToast?.('OAuth Iniciado', 'info', 'Finalize a autorização na janela do ClickUp.');

      const interval = globalThis.setInterval(async () => {
        if (!popup || popup.closed) {
          globalThis.clearInterval(interval);
          await handleRefreshClickUpMcpStatus();
          await loadClickUpTools();
          await loadClickUpMcpAudit();
        }
      }, 1500);
    } catch (e: any) {
      addToast?.('Falha no OAuth', 'error', e.message || 'Não foi possível iniciar o OAuth do ClickUp MCP.');
    }
  };

  const handleExecuteMcpTool = async () => {
    if (!toolToExecute) {
      addToast?.('Tool Obrigatória', 'error', 'Selecione uma tool para executar.');
      return;
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = toolArgsJson.trim() ? JSON.parse(toolArgsJson) : {};
    } catch {
      addToast?.('JSON Inválido', 'error', 'Os argumentos da tool precisam estar em JSON válido.');
      return;
    }

    setIsExecutingTool(true);
    try {
      const result = await api.executeClickUpMcpTool({
        toolName: toolToExecute,
        arguments: parsedArgs,
        dryRun: toolDryRun,
      });
      setToolExecutionResult(JSON.stringify(result, null, 2));
      addToast?.('Tool MCP Executada', 'success', toolDryRun ? 'Dry-run executado com sucesso.' : 'Execução concluída no ClickUp MCP.');
      await loadClickUpMcpAudit();
    } catch (e: any) {
      setToolExecutionResult(JSON.stringify({ error: e.message || 'Falha na execução' }, null, 2));
      addToast?.('Falha ao Executar Tool', 'error', e.message || 'Não foi possível executar a tool MCP.');
      await loadClickUpMcpAudit();
    } finally {
      setIsExecutingTool(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'integrations', label: 'Integrações', icon: Globe },
    { id: 'security', label: 'Segurança', icon: Shield },
    ...(isAdmin ? [
      { id: 'admin-users', label: 'Usuários', icon: Users },
      { id: 'admin-system', label: 'Sistema', icon: Settings2 },
    ] : [])
  ];
  const connectedIntegrationsCount = Number(gitlabConfig.connected) + Number(clickupConfig.connected);
  const pendingUsersCount = adminUsers.filter((adminUser) => adminUser.status === 'pending').length;
  const settingsInsetCard =
    'rounded-2xl border border-slate-200/75 bg-slate-50/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

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

      <div className="page-panel-grid mb-6 md:grid-cols-3">
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
        <nav className="page-tabs mb-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center whitespace-nowrap rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
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
          <div className="panel-stack pb-6">
            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/70 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="relative group cursor-pointer">
                  <Avatar name={user?.name || 'User'} size="xl" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
                    <span className="rounded bg-black/50 px-2 py-1 text-xs font-medium text-white">Alterar</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Identidade</p>
                  <h4 className="mt-2 text-xl font-semibold text-fiori-textPrimary dark:text-white">{user?.name}</h4>
                  <p className="mt-0.5 text-sm capitalize text-fiori-textSecondary dark:text-slate-400">{user?.role} • <span className="cursor-pointer text-fiori-link hover:underline dark:text-fiori-linkDark">@{user?.name?.toLowerCase().replace(/\s+/g, '')}</span></p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Nome Completo</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="app-input w-full rounded-xl px-4 py-3"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Email Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input type="email" defaultValue={user?.email} disabled className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 pl-10 text-slate-500 shadow-sm transition-all dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400" />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-fiori-textPrimary dark:text-slate-300">Bio</label>
                  <textarea
                    rows={4}
                    value={profileForm.bio}
                    onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                    className="app-input w-full rounded-xl px-4 py-3 resize-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <button onClick={handleSaveProfile} className="app-button-primary px-6">
                    Salvar Perfil
                  </button>
                </div>
              </div>
            </div>

            <div className="surface-card panel-body-block rounded-2xl">
              <div className="mb-8 flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <p className="app-section-label">Aparência</p>
                  <h4 className="mt-2 text-lg font-semibold text-fiori-textPrimary dark:text-white">Tema e densidade operacional</h4>
                  <p className="mt-1 app-copy-compact">Ajuste o estilo visual e a quantidade de informação exibida sem sair do contexto do seu perfil.</p>
                </div>
              </div>

              <div>
                <h5 className="mb-6 text-base font-semibold text-fiori-textPrimary dark:text-white">Tema da Interface</h5>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div
                    onClick={() => handleThemeChange('system')}
                    className={`group h-40 cursor-pointer rounded-2xl border p-3 transition-all ${themeMode === 'system' ? 'border-fiori-blue bg-sky-50 shadow-sm shadow-sky-100/80 dark:bg-sky-500/10 dark:shadow-none' : 'bg-slate-50/78 hover:border-slate-300 dark:bg-white/[0.03] dark:hover:border-slate-600'}`}
                  >
                    <div className="relative mb-2 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white group-hover:shadow-md transition-shadow">
                      <div className="absolute top-0 left-0 h-6 w-full border-b border-slate-100 bg-slate-100"></div>
                      <div className="absolute top-0 left-0 h-full w-8 border-r border-slate-100 bg-slate-100"></div>
                    </div>
                    <div className="flex items-center justify-between px-2">
                      <span className={`text-sm font-semibold ${themeMode === 'system' ? 'text-fiori-blue' : 'text-slate-500'}`}>Sistema</span>
                      {themeMode === 'system' && <Check className="h-4 w-4 text-fiori-blue" />}
                    </div>
                  </div>

                  <div
                    onClick={() => handleThemeChange('light')}
                    className={`group h-40 cursor-pointer rounded-2xl border p-3 transition-all ${themeMode === 'light' ? 'border-fiori-blue bg-sky-50 shadow-sm shadow-sky-100/80 dark:bg-sky-500/10 dark:shadow-none' : 'bg-slate-50/78 hover:border-slate-300 dark:bg-white/[0.03]'}`}
                  >
                    <div className="relative mb-2 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white group-hover:shadow-md transition-shadow">
                      <div className="absolute top-0 left-0 h-6 w-full border-b border-gray-200 bg-gray-100"></div>
                      <div className="absolute top-0 left-0 h-full w-8 border-r border-gray-200 bg-gray-50"></div>
                    </div>
                    <div className="flex items-center justify-between px-2">
                      <span className={`text-sm font-semibold ${themeMode === 'light' ? 'text-fiori-blue' : 'text-slate-500'}`}>Claro</span>
                      {themeMode === 'light' && <Check className="h-4 w-4 text-fiori-blue" />}
                    </div>
                  </div>

                  <div
                    onClick={() => handleThemeChange('dark')}
                    className={`group h-40 cursor-pointer rounded-2xl border p-3 transition-all ${themeMode === 'dark' ? 'border-fiori-blue bg-sky-50 shadow-sm shadow-sky-100/80 dark:bg-sky-500/10 dark:shadow-none' : 'bg-slate-50/78 hover:border-slate-300 dark:bg-white/[0.03] dark:hover:border-slate-600'}`}
                  >
                    <div className="relative mb-2 flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 group-hover:shadow-md transition-shadow">
                      <div className="absolute top-0 left-0 h-6 w-full border-b border-primary-400/20 bg-slate-800"></div>
                      <div className="absolute top-0 left-0 h-full w-8 border-r border-primary-400/20 bg-slate-800"></div>
                    </div>
                    <div className="flex items-center justify-between px-2">
                      <span className={`text-sm font-semibold ${themeMode === 'dark' ? 'text-fiori-blue' : 'text-slate-500'}`}>Escuro</span>
                      {themeMode === 'dark' && <Check className="h-4 w-4 text-fiori-blue" />}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-slate-100 pt-8 dark:border-slate-800">
                <h5 className="mb-6 text-base font-semibold text-fiori-textPrimary dark:text-white">Densidade de Informação</h5>
                <div className="grid gap-4 md:grid-cols-2">
                  <label
                    onClick={() => setDensityMode?.('comfortable')}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition-colors dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none"
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 ${densityMode === 'comfortable' ? 'border-fiori-blue' : ''}`}>
                      {densityMode === 'comfortable' && <div className="h-2.5 w-2.5 rounded-full bg-fiori-blue"></div>}
                    </div>
                    <div>
                      <span className={`text-sm font-medium transition-colors ${densityMode === 'comfortable' ? 'text-fiori-blue' : 'text-slate-700 dark:text-slate-300'}`}>Confortável</span>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mais respiro entre painéis, ideal para leitura e revisão.</p>
                    </div>
                  </label>
                  <label
                    onClick={() => setDensityMode?.('compact')}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition-colors dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none"
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 ${densityMode === 'compact' ? 'border-fiori-blue' : ''}`}>
                      {densityMode === 'compact' && <div className="h-2.5 w-2.5 rounded-full bg-fiori-blue"></div>}
                    </div>
                    <div>
                      <span className={`text-sm font-medium transition-colors ${densityMode === 'compact' ? 'text-fiori-blue' : 'text-slate-700 dark:text-slate-300'}`}>Compacto</span>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mais informação por área útil, melhor para operação diária.</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="panel-stack pb-6">
            <div className="surface-card panel-body-block rounded-2xl">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="app-section-label">Notificações</p>
                  <h4 className="mt-2 text-lg font-semibold text-fiori-textPrimary dark:text-white">Preferências de alerta</h4>
                  <p className="mt-1 app-copy-compact">Defina como receber sinais de revisão, falha de pipeline e resumos do workspace.</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { key: 'email_digest', label: 'Resumo por Email', desc: 'Receba um resumo diário das atividades do projeto.' },
                  { key: 'pr_review', label: 'Revisões de Pull Request', desc: 'Notifique-me quando alguém solicitar minha revisão.' },
                  { key: 'ci_failed', label: 'Falhas de Build (CI/CD)', desc: 'Alerta imediato quando pipelines quebrarem.' },
                  { key: 'marketing', label: 'Novidades do Produto', desc: 'Receba atualizações sobre novas funcionalidades do DevFlow.' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition-all dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                    <div className="pr-4">
                      <h4 className="text-base font-semibold text-fiori-textPrimary dark:text-white">{item.label}</h4>
                      <p className="mt-1 text-sm text-fiori-textSecondary dark:text-slate-400">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => toggleNotif(item.key as keyof typeof notifications)}
                      className={`app-toggle ${notifications[item.key as keyof typeof notifications] ? 'app-toggle-active' : ''}`}
                    >
                      <span className="sr-only">{item.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="panel-stack pb-6">
            {/* GITLAB */}
              <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/75 bg-slate-50/72 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] xl:flex-row xl:items-center xl:justify-between dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
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
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button
                    onClick={handleSyncGitlab}
                    className="app-button-secondary"
                  >
                    <RefreshCw className="w-4 h-4" /> Sincronizar
                  </button>
                  <button
                    onClick={handleDisconnectGitlab}
                    className="app-button-danger"
                  >
                    <LogOut className="w-4 h-4" /> Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveModal('gitlab')}
                  className="app-button-secondary"
                >
                  Configurar
                </button>
              )}
            </div>

            {/* CLICKUP */}
              <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/75 bg-slate-50/72 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] xl:flex-row xl:items-center xl:justify-between dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${clickupConfig.connected ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300'}`}>
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">ClickUp (API v3 + MCP)</h4>
                    {clickupConfig.connected && (
                      <span className="text-xs flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Workspace {clickupConfig.workspaceId}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-fiori-textSecondary dark:text-slate-400">
                    {clickupConfig.connected
                      ? `Escopo: ${clickupConfig.listId || 'workspace completo'} • MCP: ${clickupConfig.mcpConnected ? 'ativo' : 'inativo'}`
                      : 'Integração completa com ClickUp API v3 para sync de tarefas e ClickUp MCP para execução de tools.'}
                  </p>
                  {clickupConfig.connected && clickupConfig.lastSyncAt && (
                    <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${clickupConfig.lastSyncUsedWorkspaceFallback ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/[0.1] dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300'}`}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      {clickupConfig.lastSyncUsedWorkspaceFallback
                        ? `Última sync via fallback do workspace em ${formatClickUpSyncTime(clickupConfig.lastSyncAt)}`
                        : `Última sync direta do escopo em ${formatClickUpSyncTime(clickupConfig.lastSyncAt)}`}
                    </div>
                  )}
                </div>
              </div>
              {clickupConfig.connected ? (
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button
                    onClick={handleSyncClickUp}
                    className="app-button-secondary"
                  >
                    <RefreshCw className="w-4 h-4" /> Sincronizar
                  </button>
                  <button
                    onClick={handleRefreshClickUpMcpStatus}
                    className="app-button-secondary text-indigo-600 dark:text-indigo-300"
                  >
                    <Globe className="w-4 h-4" /> Validar MCP
                  </button>
                  <button
                    onClick={handleDisconnectClickUp}
                    className="app-button-danger"
                  >
                    <LogOut className="w-4 h-4" /> Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveModal('clickup')}
                  className="app-button-primary"
                >
                  Conectar
                </button>
              )}
            </div>

            {clickupConfig.connected && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Catálogo de Tools MCP</h5>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Fonte: {clickupToolsSource}</span>
                      <button onClick={loadClickUpTools} className="app-button-secondary min-h-0 px-3 py-1.5 text-xs">Atualizar</button>
                    </div>
                  </div>
                  {isLoadingClickupTools ? (
                    <p className="text-sm text-slate-500">Carregando tools MCP...</p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
                      {clickupTools.length === 0 ? (
                        <div className="app-empty-state rounded-none border-0">
                          <strong className="text-sm">Nenhuma tool disponível</strong>
                          <p className="text-sm">Valide o MCP para carregar o catálogo operacional.</p>
                        </div>
                      ) : (
                        clickupTools.map((tool: any, idx: number) => (
                          <div key={`${tool.name || tool.id || 'tool'}-${idx}`} className="px-3 py-2 text-xs border-b border-slate-100 dark:border-slate-800 last:border-b-0 flex items-center justify-between gap-3">
                            <span className="font-mono text-slate-700 dark:text-slate-300">{tool.name || tool.id || 'unnamed_tool'}</span>
                            <span className="text-slate-400">{tool.mode || tool.category || 'runtime'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Console Assistido MCP</h5>
                    <div className="flex items-center gap-2">
                      <button onClick={handleConnectClickUpMcpOAuth} className="app-button-secondary min-h-0 px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-300">Conectar OAuth PKCE</button>
                      <button onClick={handleRefreshClickUpMcpStatus} className="app-button-secondary min-h-0 px-3 py-1.5 text-xs">Status</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Tool</label>
                      <select value={toolToExecute} onChange={(e) => setToolToExecute(e.target.value)} className="app-input w-full rounded-xl px-3 py-2 text-sm">
                        {(clickupTools.length > 0 ? clickupTools : [{ name: 'get_workspace_hierarchy' }]).map((tool: any, idx: number) => (
                          <option key={`${tool.name || 'fallback'}-${idx}`} value={tool.name || ''}>{tool.name || 'unnamed_tool'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <input type="checkbox" checked={toolDryRun} onChange={(e) => setToolDryRun(e.target.checked)} />
                        Dry-run
                      </label>
                    </div>
                  </div>

                  <label className="text-xs text-slate-500 mb-1 block">Arguments (JSON)</label>
                  <textarea value={toolArgsJson} onChange={(e) => setToolArgsJson(e.target.value)} rows={7} className="app-input mb-3 w-full rounded-xl px-3 py-2 text-xs font-mono" />

                  <div className="flex items-center justify-between gap-3">
                    <button onClick={handleExecuteMcpTool} disabled={isExecutingTool} className="app-button-primary disabled:opacity-50 disabled:shadow-none">
                      {isExecutingTool ? 'Executando...' : 'Executar Tool'}
                    </button>
                    <span className="text-xs text-slate-500">Workspace MCP: {clickupConfig.mcpWorkspaceId || clickupConfig.workspaceId || 'n/d'}</span>
                  </div>

                  {toolExecutionResult && (
                    <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/70">{toolExecutionResult}</pre>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Auditoria MCP</h5>
                    <button onClick={loadClickUpMcpAudit} className="app-button-secondary min-h-0 px-3 py-1.5 text-xs">Atualizar</button>
                  </div>
                  {isLoadingMcpAudit ? (
                    <p className="text-sm text-slate-500">Carregando trilha de auditoria...</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {mcpAuditItems.length === 0 ? (
                        <div className="app-empty-state">
                          <strong className="text-sm">Sem eventos de auditoria MCP</strong>
                          <p className="text-sm">As execuções realizadas por esta conexão aparecerão aqui.</p>
                        </div>
                      ) : (
                        mcpAuditItems.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-mono text-slate-700 dark:text-slate-200">{item.toolName || item.actionType}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>{item.status}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.createdAt} • workspace {item.workspaceId || 'n/d'}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.responseSummary || '-'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!clickupConfig.connected && (
              <div className="app-empty-state mt-4">
                <strong className="text-sm">Ferramentas MCP indisponíveis</strong>
                <p className="text-sm">Conecte o ClickUp para habilitar catálogo MCP, console assistido e trilha de auditoria.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="panel-stack pb-6">
            {/* 2FA Section - Premium Card */}
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
                <button
                  onClick={async () => {
                    if (!await confirm({ title: 'Excluir Conta', message: 'Tem certeza? Esta ação é irreversível e removerá sua conta permanentemente.', confirmText: 'Excluir Conta', variant: 'danger' })) return;
                    try {
                      await api.deleteAccount();
                      localStorage.removeItem('devflow_token');
                      globalThis.location.reload();
                    } catch (e: any) {
                      addToast?.('Falha ao Excluir Conta', 'error', e.message || 'Não foi possível excluir sua conta. Tente novamente.');
                    }
                  }}
                  className="app-button-danger flex-shrink-0">
                  Excluir Conta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN: Users Tab */}
        {activeTab === 'admin-users' && (
          <div className="panel-stack pb-6">
            <div className="surface-card panel-body-block rounded-2xl">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="app-section-label">Grupos</p>
                  <h4 className="mt-2 text-lg font-semibold text-fiori-textPrimary dark:text-white">Grupos e permissões</h4>
                  <p className="mt-1 app-copy-compact">Mantenha a leitura de governança perto da gestão de usuários para reduzir troca de contexto administrativo.</p>
                </div>
              </div>

              {isLoadingAdmin ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : adminGroups.length === 0 ? (
                <div className="app-empty-state">
                  <strong className="text-sm">Nenhum grupo cadastrado</strong>
                  <p className="text-sm">Os grupos de permissão aparecerão aqui quando forem configurados pela administração.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {adminGroups.map(group => (
                    <div key={group.id} className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-700 dark:text-white">{group.name}</h4>
                        <span className="text-xs text-slate-400">{group.id}</span>
                      </div>
                      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{group.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.permissions.map((perm, idx) => (
                          <span key={idx} className="rounded px-2 py-1 text-xs text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">Gerenciar Usuários</h3>
              <button
                onClick={() => setActiveModal('newUser')}
                className="app-button-primary"
              >
                <UserPlus className="w-4 h-4" />
                Novo Usuário
              </button>
            </div>

            {isLoadingAdmin ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : adminUsers.length === 0 ? (
              <div className="app-empty-state">
                <strong className="text-sm">Nenhum usuário encontrado</strong>
                <p className="text-sm">Adicione colaboradores para iniciar o controle de acesso do workspace.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/88 shadow-sm shadow-slate-200/60 dark:border-slate-800 dark:bg-transparent dark:shadow-none">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50/85 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Usuário</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Grupos</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white/80 dark:bg-transparent">
                    {adminUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
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
                              <button onClick={() => handleApproveUser(user.id)} className="rounded-lg p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" title="Aprovar">
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}
                            {user.id !== 'admin' && (
                              <button onClick={() => handleDeleteUser(user.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Remover">
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

        {/* ADMIN: System Settings Tab */}
        {activeTab === 'admin-system' && (
          <div className="panel-stack pb-6">
            <h3 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">Configurações do Sistema</h3>

            {isLoadingAdmin ? (
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

                <button
                  onClick={handleSaveSettings}
                  className="app-button-primary mt-4 w-fit"
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
          <div className="surface-muted rounded-2xl p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Provisionamento de acesso</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Crie uma conta interna com papel e credenciais iniciais para entrada imediata no workspace.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome</label>
            <input
              type="text"
              value={newUserForm.name}
              onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
              autoComplete="name"
              className="app-input w-full rounded-xl px-3 py-2.5"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              value={newUserForm.email}
              onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
              autoComplete="email"
              className="app-input w-full rounded-xl px-3 py-2.5"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
            <input
              type="password"
              value={newUserForm.password}
              onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
              autoComplete="new-password"
              className="app-input w-full rounded-xl px-3 py-2.5"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
            <select
              value={newUserForm.role}
              onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
              className="app-input w-full rounded-xl px-3 py-2.5"
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActiveModal(null)} className="app-button-secondary">Cancelar</button>
            <button type="submit" className="app-button-primary">Criar Usuário</button>
          </div>
        </form>
      </Modal>

      {/* GitLab Configuration Modal */}
      <Modal isOpen={activeModal === 'gitlab'} onClose={() => setActiveModal(null)} title="Configurar GitLab" size="md">
        <form onSubmit={handleConnectGitlab} className="space-y-4">
          <div className="rounded-2xl border border-orange-200/70 bg-orange-50/80 p-4 text-sm text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">
            Crie um Personal Access Token (PAT) no GitLab com escopo <code>api</code> ou <code>read_api</code> para permitir a integração.
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">URL do GitLab <span className="text-slate-400">(opcional)</span></label>
            <input
              type="text"
              value={gitlabForm.gitlabUrl}
              onChange={(e) => setGitlabForm({ ...gitlabForm, gitlabUrl: e.target.value })}
              placeholder="https://gitlab.com (padrão)"
              className="app-input w-full rounded-xl px-3 py-2.5"
            />
            <p className="text-xs text-slate-400">Deixe em branco para usar gitlab.com ou insira a URL do seu GitLab self-hosted.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">GitLab Username</label>
            <input
              type="text"
              value={gitlabForm.username}
              onChange={(e) => setGitlabForm({ ...gitlabForm, username: e.target.value })}
              autoComplete="username"
              placeholder="ex: johndoe"
              className="app-input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Personal Access Token</label>
            <input
              type="password"
              value={gitlabForm.token}
              onChange={(e) => setGitlabForm({ ...gitlabForm, token: e.target.value })}
              autoComplete="off"
              placeholder="glpat-..."
              className="app-input w-full rounded-xl px-3 py-2.5 font-mono"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActiveModal(null)} className="app-button-secondary">Cancelar</button>
            <button type="submit" className="app-button-primary">Conectar GitLab</button>
          </div>
        </form>
      </Modal>

      {/* ClickUp Configuration Modal */}
      <Modal isOpen={activeModal === 'clickup'} onClose={() => setActiveModal(null)} title="Configurar ClickUp API v3 + MCP" size="md">
        <form onSubmit={handleConnectClickUp} className="space-y-4">
          <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/80 p-4 text-sm text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200 space-y-2">
            <p className="font-medium">Configuração recomendada:</p>
            <ul className="list-disc list-inside text-xs space-y-1 text-indigo-700 dark:text-indigo-300">
              <li>API Token do ClickUp para sincronização via API v3.</li>
              <li>Workspace ID obrigatório para escopo mínimo.</li>
              <li>O campo opcional aceita List ID e também funciona com Space ID via fallback do workspace.</li>
              <li>MCP Access Token opcional para executar tools do ClickUp MCP.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">ClickUp API Token (V3)</label>
            <input
              type="password"
              value={clickupForm.apiToken}
              onChange={(e) => setClickupForm({ ...clickupForm, apiToken: e.target.value })}
              autoComplete="off"
              placeholder="pk_..."
              className="app-input w-full rounded-xl px-3 py-2.5 font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Workspace ID</label>
            <input
              type="text"
              value={clickupForm.workspaceId}
              onChange={(e) => setClickupForm({ ...clickupForm, workspaceId: e.target.value })}
              placeholder="9012345678"
              className="app-input w-full rounded-xl px-3 py-2.5 font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">List ID ou Space ID <span className="text-slate-400">(opcional)</span></label>
            <input
              type="text"
              value={clickupForm.listId}
              onChange={(e) => setClickupForm({ ...clickupForm, listId: e.target.value })}
              placeholder="123456789"
              className="app-input w-full rounded-xl px-3 py-2.5 font-mono"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se informado, a sincronização tenta primeiro a lista específica e cai automaticamente para o workspace filtrando pelo escopo compatível.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">ClickUp MCP (opcional)</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">MCP Access Token</label>
                <input
                  type="password"
                  value={clickupForm.mcpAccessToken}
                  onChange={(e) => setClickupForm({ ...clickupForm, mcpAccessToken: e.target.value })}
                  autoComplete="off"
                  placeholder="Bearer ..."
                  className="app-input w-full rounded-xl px-3 py-2.5 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">MCP Workspace ID <span className="text-slate-400">(opcional)</span></label>
                <input
                  type="text"
                  value={clickupForm.mcpWorkspaceId}
                  onChange={(e) => setClickupForm({ ...clickupForm, mcpWorkspaceId: e.target.value })}
                  placeholder="9012345678"
                  className="app-input w-full rounded-xl px-3 py-2.5 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActiveModal(null)} className="app-button-secondary">Cancelar</button>
            <button type="submit" className="app-button-primary">Conectar ClickUp</button>
          </div>
        </form>
      </Modal>

      </div>
    </div>
  );
};

export default Settings;

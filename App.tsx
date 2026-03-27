
import React, { Suspense, lazy, useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import NewTaskModal from './components/NewTaskModal';
import NewRepoModal from './components/NewRepoModal';
import ManageSprintsModal from './components/ManageSprintsModal';
import LoginPage from './components/LoginPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfirmProvider, useConfirm } from './contexts/ConfirmContext';
import {
  ViewState,
  ThemeMode,
  DensityMode,
  ToastMessage,
  Task,
  TaskStatus,
  Repository,
  ActivityLog,
  Sprint,
  Environment,
  RepoDetailTab,
  GitIntegrationTab,
  WorkspaceNavigationTarget,
  DashboardStats,
  AdminUser,
  getErrorMessage,
} from './types';
import { initialActivities } from './services/data';
import { api } from './services/api';
import { hasUnsavedChanges } from './hooks/useUnsavedChanges';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Kanban = lazy(() => import('./components/Kanban').then((module) => ({ default: module.Kanban })));
const Backlog = lazy(() => import('./components/Backlog'));
const GitIntegration = lazy(() => import('./components/GitIntegration'));
const RepositoryList = lazy(() => import('./components/RepositoryList'));
const Settings = lazy(() => import('./components/Settings'));
const RepoDetail = lazy(() => import('./components/RepoDetail'));
const Environments = lazy(() => import('./components/Environments'));

const ScreenLoader: React.FC = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/82 px-4 py-3 text-sm text-slate-600 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none">
      <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
      Carregando tela...
    </div>
  </div>
);

// Global Error Boundary — catches unhandled React render errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-8 shadow-lg dark:border-red-900/40 dark:bg-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Algo deu errado</h2>
            </div>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
              Ocorreu um erro inesperado na aplicação. Tente recarregar a página ou voltar ao estado anterior.
            </p>
            {this.state.error && (
              <pre className="mb-4 max-h-24 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Tentar novamente
              </button>
              <button
                onClick={() => globalThis.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const { confirm } = useConfirm();

  const guardedSetView = async (view: ViewState) => {
    if (view !== currentView && hasUnsavedChanges()) {
      const ok = await confirm('Você tem alterações não salvas. Deseja sair desta página?', 'Alterações não salvas');
      if (!ok) return;
    }
    setCurrentView(view);
  };
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [densityMode, setDensityMode] = useState<DensityMode>('comfortable');
  const [isEffectiveDark, setIsEffectiveDark] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [isManageSprintsModalOpen, setIsManageSprintsModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskInitialStatus, setNewTaskInitialStatus] = useState<TaskStatus>('todo');
  const [isNewRepoModalOpen, setIsNewRepoModalOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<WorkspaceNavigationTarget | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivities);

  // States fetched from API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isWorkspaceDataLoading, setIsWorkspaceDataLoading] = useState(true);
  const activeUsers = useMemo(
    () => users.filter((currentUser) => currentUser.status !== 'pending' && currentUser.status !== 'inactive'),
    [users]
  );

  // Initial Data Fetch
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsWorkspaceDataLoading(true);
    try {
      const [fetchedTasks, fetchedRepos, fetchedSprints, fetchedUsers, fetchedActivitiesResult, fetchedStats, fetchedEnvironments] = await Promise.all([
        api.getTasks(),
        api.getRepos(),
        api.getSprints(),
        api.getUsers(),
        api.getActivities({ limit: 50 }),
        api.getDashboardStats(),
        api.getEnvironments(),
      ]);
      setTasks(fetchedTasks);
      setRepos(fetchedRepos);
      setUsers(fetchedUsers);
      setActivities(fetchedActivitiesResult.items);
      setDashboardStats(fetchedStats);
      setSprints(fetchedSprints);
      setEnvironments(fetchedEnvironments);
      // Logic to find active sprint (status='active') or default to first
      const active = fetchedSprints.find((s: Sprint) => s.status === 'active') || fetchedSprints[0];
      if (active) setActiveSprint(active);
    } catch (error) {
      console.error("Failed to load data", error);
      addToast("Falha ao Carregar Dados", "error", "Não foi possível conectar ao servidor. Verifique se o serviço está ativo.", () => loadData());
    } finally {
      setIsWorkspaceDataLoading(false);
    }
  };

  const addToast = (title: string, type: 'success' | 'error' | 'info' = 'info', description?: string, onRetry?: () => void) => {
    // Deduplicate: skip if an identical toast (same title + type) already exists
    setToasts(prev => {
      if (prev.some(t => t.title === title && t.type === type)) return prev;
      const id = Math.random().toString(36).substring(7);
      return [...prev, { id, title, type, description, onRetry }];
    });
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLogActivity = (action: string, target: string, targetType: ActivityLog['targetType'], options?: { taskId?: string; meta?: string }) => {
    const id = `a-${Date.now()}`;
    const newLog: ActivityLog = {
      id,
      user: { id: user!.id, name: user!.name, avatar: user?.avatar || '' },
      action,
      target,
      targetType,
      taskId: options?.taskId,
      timestamp: 'agora',
      meta: options?.meta
    };
    setActivities(prev => [newLog, ...prev]);
    // Persist to DB (fire-and-forget)
    if (user?.id) {
      api.createActivity({ id, userId: user.id, action, target, targetType, taskId: options?.taskId, meta: options?.meta }).catch(() => {});
    }
  };

  // Theme Logic
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);

      setIsEffectiveDark(isDark);
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };

    applyTheme();
    const listener = (_e: MediaQueryListEvent) => {
      if (themeMode === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [themeMode]);

  // Density Logic
  useEffect(() => {
    document.documentElement.classList.toggle('density-compact', densityMode === 'compact');
  }, [densityMode]);

  const toggleTheme = () => {
    setThemeMode(prev => (prev === 'dark' || (prev === 'system' && isEffectiveDark)) ? 'light' : 'dark');
  };

  const handleCreateRepo = async (repoData: Omit<Repository, 'id' | 'issues' | 'lastUpdated' | 'status'> & { localPath?: string; linkExisting?: boolean }) => {
    const id = `r${Date.now()}`;
    try {
      const newRepo: Repository = {
        id,
        name: repoData.name,
        description: repoData.description,
        branch: repoData.branch || 'main',
        status: 'active',
        lastUpdated: 'agora',
        issues: 0
      };
      await api.createRepo({ ...newRepo, localPath: repoData.localPath, linkExisting: repoData.linkExisting });
      setRepos(prev => [...prev, newRepo]);
      addToast('Repositório Adicionado', 'success', repoData.linkExisting ? `"${repoData.name}" vinculado ao DevFlow.` : `"${repoData.name}" criado e pronto para uso.`);
    } catch (e: unknown) {
      addToast('Falha ao Criar Repositório', 'error', getErrorMessage(e) || 'Verifique o caminho informado e tente novamente.');
    }
  };

  const handleDeleteRepo = async (id: string) => {
    try {
      await api.deleteRepo(id);
      setRepos(prev => prev.filter(r => r.id !== id));
      addToast('Repositório Removido', 'info', 'O registro foi removido do sistema.');
    } catch (error) {
      console.error('Failed to remove repository', error);
      addToast('Falha ao Remover', 'error', 'Não foi possível remover o repositório.');
    }
  };


  // Função para abrir o modal de nova tarefa
  const openNewTaskModal = (initialStatus: TaskStatus = 'todo') => {
    setNewTaskInitialStatus(initialStatus);
    setIsNewTaskModalOpen(true);
  };

  // Função para criar a tarefa vinda do modal
  const handleCreateTask = async (taskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...taskData,
      id: `t-${Date.now()}`
    };
    // Optimistic update
    setTasks(prev => [newTask, ...prev]);
    try {
      await api.createTask(newTask);
      handleLogActivity('criou tarefa', newTask.title, 'issue', { taskId: newTask.id });
      addToast('Tarefa Criada', 'success', `"${newTask.title}" adicionada ao quadro.`);
    } catch (error) {
      console.error('Failed to create task', error);
      // Rollback on failure
      setTasks(prev => prev.filter(t => t.id !== newTask.id));
      addToast('Falha ao Criar Tarefa', 'error', 'Não foi possível salvar a tarefa. Tente novamente.');
    }
  };

  const handleOpenTask = (task: Task, source: WorkspaceNavigationTarget['source'] = 'dashboard') => {
    setNavigationTarget({ source, taskId: task.id });
    setSelectedTaskId(task.id);
    guardedSetView(ViewState.KANBAN);
  };

  const handleOpenRepo = (
    id: string,
    options: {
      tab?: RepoDetailTab;
      source?: WorkspaceNavigationTarget['source'];
    } = {}
  ) => {
    setNavigationTarget({
      source: options.source || 'dashboard',
      repoId: id,
      repoDetailTab: options.tab || 'code',
    });
    setSelectedRepoId(id);
    guardedSetView(ViewState.REPO_DETAIL);
  };

  const handleOpenRepoGit = (
    id: string,
    options: {
      tab?: GitIntegrationTab;
      source?: WorkspaceNavigationTarget['source'];
    } = {}
  ) => {
    setNavigationTarget({
      source: options.source || 'dashboard',
      repoId: id,
      gitTab: options.tab || 'changes',
    });
    guardedSetView(ViewState.GIT);
  };

  const handleOpenEnvironment = (
    environmentId: string,
    options: {
      repoId?: string | null;
      source?: WorkspaceNavigationTarget['source'];
    } = {}
  ) => {
    setNavigationTarget({
      source: options.source || 'activity',
      environmentId,
      repoId: options.repoId || null,
    });
    guardedSetView(ViewState.ENVIRONMENTS);
  };

  const handleActivateSprint = async (sprintId: string) => {
    const sprint = sprints.find((item) => item.id === sprintId);
    if (!sprint) return;

    try {
      await api.updateSprint(sprintId, { status: 'active' });
      addToast('Sprint ativada', 'success', `"${sprint.name}" agora está em execução.`);
      await loadData();
      guardedSetView(ViewState.KANBAN);
    } catch (error: unknown) {
      addToast('Falha ao ativar sprint', 'error', getErrorMessage(error) || 'Não foi possível ativar a sprint selecionada.');
    }
  };

  const renderView = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return (
          <Dashboard
            activities={activities}
            tasks={tasks}
            repositories={repos}
            onNavigate={guardedSetView}
            onCreateTask={() => openNewTaskModal('todo')}
            onCreateRepo={() => setIsNewRepoModalOpen(true)}
            onOpenRepo={(id) => handleOpenRepo(id, { source: 'dashboard' })}
            onOpenRepoInGit={(id, tab) => handleOpenRepoGit(id, { tab, source: 'dashboard' })}
            onOpenTask={(task) => handleOpenTask(task, 'dashboard')}
            onOpenEnvironment={(environmentId, repoId) => handleOpenEnvironment(environmentId, { repoId, source: 'activity' })}
            stats={dashboardStats}
            isLoading={isWorkspaceDataLoading}
          />
        );
      case ViewState.KANBAN:
        return (
          <Kanban
            initialTasks={tasks}
            setTasks={setTasks}
            addToast={addToast}
            openNewTaskModal={openNewTaskModal}
            activeSprint={activeSprint}
            teamMembers={activeUsers}
            repositories={repos}
            selectedTaskId={selectedTaskId}
            onSelectedTaskIdHandled={() => setSelectedTaskId(null)}
            isLoading={isWorkspaceDataLoading}
          />
        );
      case ViewState.BACKLOG:
        return (
          <Backlog
            tasks={tasks}
            setTasks={setTasks}
            addToast={addToast}
            openNewTaskModal={() => openNewTaskModal('backlog')}
            openManageSprintsModal={() => setIsManageSprintsModalOpen(true)}
            activeSprint={activeSprint}
            onRefreshData={loadData}
            isLoading={isWorkspaceDataLoading}
          />
        );
      case ViewState.GIT:
        return (
          <GitIntegration
            repos={repos}
            addToast={addToast}
            logActivity={handleLogActivity}
            onRefreshData={loadData}
            preferredRepoId={currentView === ViewState.GIT ? navigationTarget?.repoId ?? null : null}
            preferredTab={currentView === ViewState.GIT ? navigationTarget?.gitTab : undefined}
          />
        );
      case ViewState.REPOS:
        return (
          <RepositoryList
            repos={repos}
            onOpenNewRepo={() => setIsNewRepoModalOpen(true)}
            onDelete={handleDeleteRepo}
            onRepoClick={(id) => handleOpenRepo(id, { source: 'repo_list' })}
            onRepoGitClick={(id) => handleOpenRepoGit(id, { source: 'repo_list' })}
            onRepoIssuesClick={(id) => handleOpenRepo(id, { tab: 'issues', source: 'repo_list' })}
            isLoading={isWorkspaceDataLoading}
          />
        );
      case ViewState.REPO_DETAIL: {
        const selectedRepo = repos.find(r => r.id === selectedRepoId);
        if (!selectedRepo) {
          return (
            <RepositoryList
              repos={repos}
              onDelete={handleDeleteRepo}
              onOpenNewRepo={() => setIsNewRepoModalOpen(true)}
              onRepoClick={(id) => handleOpenRepo(id, { source: 'repo_list' })}
              onRepoGitClick={(id) => handleOpenRepoGit(id, { source: 'repo_list' })}
              onRepoIssuesClick={(id) => handleOpenRepo(id, { tab: 'issues', source: 'repo_list' })}
              isLoading={isWorkspaceDataLoading}
            />
          );
        }
        return (
          <RepoDetail
            repo={selectedRepo}
            tasks={tasks}
            onBack={() => guardedSetView(ViewState.REPOS)}
            onNavigateToTask={(task) => handleOpenTask(task, 'repo_detail')}
            addToast={addToast}
            onDeleteRepo={handleDeleteRepo}
            initialTab={navigationTarget?.repoId === selectedRepo.id ? navigationTarget?.repoDetailTab : undefined}
            onOpenGit={(repoId) => handleOpenRepoGit(repoId, { source: 'repo_detail' })}
          />
        );
      }
      case ViewState.ENVIRONMENTS:
        return (
          <Environments
            repositories={repos}
            addToast={addToast}
            onNavigateToGit={() => guardedSetView(ViewState.GIT)}
            preferredRepoId={currentView === ViewState.ENVIRONMENTS ? navigationTarget?.repoId ?? null : null}
            preferredEnvironmentId={currentView === ViewState.ENVIRONMENTS ? navigationTarget?.environmentId ?? null : null}
          />
        );
      case ViewState.SETTINGS:
        return <Settings themeMode={themeMode} setThemeMode={setThemeMode} densityMode={densityMode} setDensityMode={setDensityMode} addToast={addToast} />;
      default:
        return (
          <Dashboard
            activities={activities}
            tasks={tasks}
            repositories={repos}
            onNavigate={guardedSetView}
            onCreateTask={() => openNewTaskModal('todo')}
            onCreateRepo={() => setIsNewRepoModalOpen(true)}
            onOpenRepo={(id) => handleOpenRepo(id, { source: 'dashboard' })}
            onOpenRepoInGit={(id, tab) => handleOpenRepoGit(id, { tab, source: 'dashboard' })}
            onOpenTask={(task) => handleOpenTask(task, 'dashboard')}
            onOpenEnvironment={(environmentId, repoId) => handleOpenEnvironment(environmentId, { repoId, source: 'activity' })}
            isLoading={isWorkspaceDataLoading}
          />
        );
    }
  };

  const getPageTitle = () => {
    switch (currentView) {
      case ViewState.DASHBOARD: return 'Visão Geral do Projeto';
      case ViewState.KANBAN: return 'Sprints do Projeto';
      case ViewState.BACKLOG: return 'Backlog do Projeto';
      case ViewState.GIT: return 'Controle de Fonte';
      case ViewState.REPOS: return 'Repositórios da Organização';
      case ViewState.REPO_DETAIL: return 'Detalhes do Repositório';
      case ViewState.ENVIRONMENTS: return 'Ambientes de Deploy';
      case ViewState.SETTINGS: return 'Configurações';
      default: return '';
    }
  };

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => globalThis.location.reload()} />;
  }

  return (
    <div className="app-shell-bg flex h-screen overflow-hidden p-2 gap-2 font-sans antialiased">
      <CommandPalette
        isOpen={isCmdOpen}
        setIsOpen={setIsCmdOpen}
        setView={guardedSetView}
        toggleTheme={toggleTheme}
        openNewTaskModal={() => openNewTaskModal('todo')}
        openNewRepoModal={() => setIsNewRepoModalOpen(true)}
        tasks={tasks}
        repos={repos}
        sprints={sprints}
        environments={environments}
        onSelectTask={(task) => handleOpenTask(task, 'command_palette')}
        onOpenRepo={(repoId) => handleOpenRepo(repoId, { source: 'command_palette' })}
        onActivateSprint={handleActivateSprint}
        onOpenEnvironment={(environmentId, repoId) => handleOpenEnvironment(environmentId, { repoId, source: 'command_palette' })}
      />

      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onCreate={handleCreateTask}
        initialStatus={newTaskInitialStatus}
        repos={repos}
        users={activeUsers}
      />

      <ManageSprintsModal
        isOpen={isManageSprintsModalOpen}
        onClose={() => setIsManageSprintsModalOpen(false)}
        sprints={sprints}
        onRefresh={loadData}
        addToast={addToast}
      />

      <NewRepoModal
        isOpen={isNewRepoModalOpen}
        onClose={() => setIsNewRepoModalOpen(false)}
        onCreate={handleCreateRepo}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <Sidebar currentView={currentView} setView={guardedSetView} />

      <div className="app-workspace-shell flex-1 flex flex-col min-w-0 rounded-[1.6rem] overflow-hidden">
        <Header
          isDark={isEffectiveDark}
          toggleTheme={toggleTheme}
          title={getPageTitle()}
          onOpenCommandPalette={() => setIsCmdOpen(true)}
          onOpenNewTask={() => openNewTaskModal('todo')}
        />

        <main className="app-workspace-body flex-1 overflow-y-auto">
          <Suspense fallback={<ScreenLoader />}>
            {renderView()}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmProvider>
          <AppContent />
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;


import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import { Kanban } from './components/Kanban';
import Backlog from './components/Backlog';
import GitIntegration from './components/GitIntegration';
import RepositoryList from './components/RepositoryList';
import Settings from './components/Settings';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import NewTaskModal from './components/NewTaskModal';
import NewRepoModal from './components/NewRepoModal';
import RepoDetail from './components/RepoDetail';
import ManageSprintsModal from './components/ManageSprintsModal';
import LoginPage from './components/LoginPage';
import Environments from './components/Environments';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { ViewState, ThemeMode, DensityMode, ToastMessage, Task, TaskStatus, Repository, ActivityLog, Sprint } from './types';
import { initialActivities } from './services/data';
import { api } from './services/api';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [densityMode, setDensityMode] = useState<DensityMode>('comfortable');
  const [isEffectiveDark, setIsEffectiveDark] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [isManageSprintsModalOpen, setIsManageSprintsModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskInitialStatus, setNewTaskInitialStatus] = useState<TaskStatus>('todo');
  const [isNewRepoModalOpen, setIsNewRepoModalOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivities);

  // States fetched from API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeSprint, setActiveSprint] = useState<Sprint | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // Initial Data Fetch
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [fetchedTasks, fetchedRepos, fetchedSprints, fetchedUsers, fetchedActivities, fetchedStats] = await Promise.all([
        api.getTasks(),
        api.getRepos(),
        api.getSprints(),
        api.getUsers(),
        api.getActivities(),
        api.getDashboardStats()
      ]);
      setTasks(fetchedTasks);
      setRepos(fetchedRepos);
      setUsers(fetchedUsers);
      setActivities(fetchedActivities);
      setDashboardStats(fetchedStats);
      setSprints(fetchedSprints);
      // Logic to find active sprint (status='active') or default to first
      const active = fetchedSprints.find((s: Sprint) => s.status === 'active') || fetchedSprints[0];
      if (active) setActiveSprint(active);
    } catch (error) {
      console.error("Failed to load data", error);
      addToast("Falha ao Carregar Dados", "error", "Não foi possível conectar ao servidor. Verifique se o serviço está ativo.");
    }
  };

  const addToast = (title: string, type: 'success' | 'error' | 'info' = 'info', description?: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, title, type, description }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLogActivity = (action: string, target: string, targetType: ActivityLog['targetType'], meta?: string) => {
    const id = `a-${Date.now()}`;
    const newLog: ActivityLog = {
      id,
      user: { ...user, avatar: user?.avatar || '' } as any,
      action,
      target,
      targetType,
      timestamp: 'agora',
      meta
    };
    setActivities(prev => [newLog, ...prev]);
    // Persist to DB (fire-and-forget)
    if (user?.id) {
      api.createActivity({ id, userId: user.id, action, target, targetType, meta }).catch(() => {});
    }
  };

  // Theme Logic
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      let isDark = false;
      if (themeMode === 'dark') isDark = true;
      else if (themeMode === 'light') isDark = false;
      else if (themeMode === 'system') isDark = mediaQuery.matches;

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
    } catch (e: any) {
      addToast('Falha ao Criar Repositório', 'error', e.message || 'Verifique o caminho informado e tente novamente.');
    }
  };

  const handleDeleteRepo = async (id: string) => {
    try {
      await api.deleteRepo(id);
      setRepos(prev => prev.filter(r => r.id !== id));
      addToast('Repositório Removido', 'info', 'O registro foi removido do sistema.');
    } catch (_e) {
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
      handleLogActivity('criou tarefa', newTask.title, 'issue');
      addToast('Tarefa Criada', 'success', `"${newTask.title}" adicionada ao quadro.`);
    } catch (_e) {
      // Rollback on failure
      setTasks(prev => prev.filter(t => t.id !== newTask.id));
      addToast('Falha ao Criar Tarefa', 'error', 'Não foi possível salvar a tarefa. Tente novamente.');
    }
  };

  const handleOpenTask = (_task: Task) => {
    setCurrentView(ViewState.KANBAN);
    // Aqui poderíamos setar um estado global 'selectedTaskId' se quiséssemos abrir o drawer automaticamente
    // Por enquanto apenas navegamos
  };

  const handleOpenRepo = (id: string) => {
    setSelectedRepoId(id);
    setCurrentView(ViewState.REPO_DETAIL);
  };

  const renderView = () => {
    switch (currentView) {
      case ViewState.DASHBOARD:
        return (
          <Dashboard
            activities={activities}
            tasks={tasks}
            repositories={repos}
            onNavigate={setCurrentView}
            onCreateTask={() => openNewTaskModal('todo')}
            onCreateRepo={() => setIsNewRepoModalOpen(true)}
            onOpenRepo={handleOpenRepo}
            stats={dashboardStats}
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
            teamMembers={users}
            repositories={repos}
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
          />
        );
      case ViewState.GIT:
        return (
          <GitIntegration
            repos={repos}
            addToast={addToast}
            logActivity={handleLogActivity}
            onRefreshData={loadData}
          />
        );
      case ViewState.REPOS:
        return (
          <RepositoryList
            repos={repos}
            onOpenNewRepo={() => setIsNewRepoModalOpen(true)}
            onDelete={handleDeleteRepo}
            onRepoClick={handleOpenRepo}
          />
        );
      case ViewState.REPO_DETAIL: {
        const selectedRepo = repos.find(r => r.id === selectedRepoId);
        if (!selectedRepo) return <RepositoryList repos={repos} onDelete={handleDeleteRepo} onOpenNewRepo={() => setIsNewRepoModalOpen(true)} onRepoClick={handleOpenRepo} />;
        return (
          <RepoDetail
            repo={selectedRepo}
            tasks={tasks}
            onBack={() => setCurrentView(ViewState.REPOS)}
            onNavigateToTask={handleOpenTask}
            addToast={addToast}
            onDeleteRepo={handleDeleteRepo}
          />
        );
      }
      case ViewState.ENVIRONMENTS:
        return (
          <Environments
            repositories={repos}
            addToast={addToast}
            onNavigateToGit={() => setCurrentView(ViewState.GIT)}
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
            onNavigate={setCurrentView}
            onCreateTask={() => openNewTaskModal('todo')}
            onCreateRepo={() => setIsNewRepoModalOpen(true)}
            onOpenRepo={handleOpenRepo}
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 overflow-hidden">
      <CommandPalette
        isOpen={isCmdOpen}
        setIsOpen={setIsCmdOpen}
        setView={setCurrentView}
        toggleTheme={toggleTheme}
        openNewTaskModal={() => openNewTaskModal('todo')}
        tasks={tasks}
        repos={repos}
        onSelectTask={handleSelectTask => handleOpenTask(handleSelectTask)}
      />

      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onCreate={handleCreateTask}
        initialStatus={newTaskInitialStatus}
        repos={repos}
        users={users}
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

      <Sidebar currentView={currentView} setView={setCurrentView} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          isDark={isEffectiveDark}
          toggleTheme={toggleTheme}
          title={getPageTitle()}
          onOpenCommandPalette={() => setIsCmdOpen(true)}
          onOpenNewTask={() => openNewTaskModal('todo')}
        />

        {/* Área de conteúdo com curvas internas */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-slate-800 rounded-tl-2xl shadow-sm border-l border-t border-slate-200 dark:border-slate-700/30">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <AppContent />
      </ConfirmProvider>
    </AuthProvider>
  );
};

export default App;

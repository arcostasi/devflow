
import React, { useState, useEffect, useMemo } from 'react';
import { Search, LayoutDashboard, Kanban, GitBranch, Database, Settings, Sun, Plus, ArrowRight, FolderGit2, CheckCircle2, ListTodo, Rocket, Boxes } from 'lucide-react';
import { ViewState, Task, Repository, Sprint, Environment } from '../types';

interface PaletteItem {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  group: string;
  meta?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setView: (view: ViewState) => void;
  toggleTheme: () => void;
  openNewTaskModal: () => void;
  openNewRepoModal: () => void;
  tasks: Task[];
  repos: Repository[];
  sprints: Sprint[];
  environments: Environment[];
  onSelectTask: (task: Task) => void;
  onOpenRepo: (repoId: string) => void;
  onActivateSprint: (sprintId: string) => void;
  onOpenEnvironment: (environmentId: string, repoId?: string | null) => void;
}

const formatEnvironmentMeta = (repoNameOrId: string, type: string, currentVersion?: string) => {
  const versionPart = currentVersion ? ` · ${currentVersion}` : '';
  return `${repoNameOrId} · ${type}${versionPart}`;
};

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  setIsOpen,
  setView,
  toggleTheme,
  openNewTaskModal,
  openNewRepoModal,
  tasks,
  repos,
  sprints,
  environments,
  onSelectTask,
  onOpenRepo,
  onActivateSprint,
  onOpenEnvironment
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const repoById = useMemo(() => new Map(repos.map((repo) => [repo.id, repo])), [repos]);

  const staticCommands = useMemo<PaletteItem[]>(() => [
    { id: 'nav-dash', label: 'Ir para Visão Geral', icon: LayoutDashboard, action: () => setView(ViewState.DASHBOARD), group: 'Navegação' },
    { id: 'nav-kanban', label: 'Ir para Sprint Atual (Scrumban)', icon: Kanban, action: () => setView(ViewState.KANBAN), group: 'Navegação' },
    { id: 'nav-backlog', label: 'Ir para Backlog do Projeto', icon: ListTodo, action: () => setView(ViewState.BACKLOG), group: 'Navegação' },
    { id: 'nav-repos', label: 'Ir para Repositórios', icon: Database, action: () => setView(ViewState.REPOS), group: 'Navegação' },
    { id: 'nav-git', label: 'Ir para Controle de Fonte', icon: GitBranch, action: () => setView(ViewState.GIT), group: 'Navegação' },
    { id: 'nav-env', label: 'Ir para Ambientes', icon: Rocket, action: () => setView(ViewState.ENVIRONMENTS), group: 'Navegação' },
    { id: 'nav-settings', label: 'Ir para Configurações', icon: Settings, action: () => setView(ViewState.SETTINGS), group: 'Navegação' },
    { id: 'act-new-task', label: 'Criar Nova Tarefa', icon: Plus, action: () => { setView(ViewState.KANBAN); openNewTaskModal(); }, group: 'Ações' },
    { id: 'act-new-repo', label: 'Criar Novo Repositório', icon: FolderGit2, action: () => { setView(ViewState.REPOS); openNewRepoModal(); }, group: 'Ações' },
    { id: 'act-open-backlog', label: 'Planejar no Backlog', icon: Boxes, action: () => setView(ViewState.BACKLOG), group: 'Ações' },
    { id: 'act-theme', label: 'Alternar Tema Claro/Escuro', icon: Sun, action: () => toggleTheme(), group: 'Ações' },
  ], [setView, openNewTaskModal, openNewRepoModal, toggleTheme]);

  const suggestedTasks = useMemo<PaletteItem[]>(() =>
    tasks
      .filter((task) => task.status !== 'done')
      .slice(0, 4)
      .map((task) => ({
        id: `suggested-task-${task.id}`,
        label: task.title,
        icon: CheckCircle2,
        action: () => { onSelectTask(task); setIsOpen(false); },
        group: 'Tarefas',
        meta: `${task.id} · ${task.status}`,
      })),
  [tasks, onSelectTask, setIsOpen]);

  const suggestedRepos = useMemo<PaletteItem[]>(() =>
    repos
      .filter((repo) => repo.status !== 'archived')
      .slice(0, 3)
      .map((repo) => ({
        id: `suggested-repo-${repo.id}`,
        label: repo.name,
        icon: FolderGit2,
        action: () => { onOpenRepo(repo.id); setIsOpen(false); },
        group: 'Repositórios',
        meta: repo.branch,
      })),
  [repos, onOpenRepo, setIsOpen]);

  const suggestedSprints = useMemo<PaletteItem[]>(() => {
    const sprintStatusOrder = { active: 0, future: 1, completed: 2 };
    return [...sprints]
      .sort((left, right) => sprintStatusOrder[left.status] - sprintStatusOrder[right.status])
      .slice(0, 3)
      .map((sprint) => ({
        id: `suggested-sprint-${sprint.id}`,
        label: sprint.status === 'active' ? `Abrir sprint ${sprint.name}` : `Ativar sprint ${sprint.name}`,
        icon: Boxes,
        action: () => {
          if (sprint.status === 'active') {
            setView(ViewState.KANBAN);
          } else {
            onActivateSprint(sprint.id);
          }
          setIsOpen(false);
        },
        group: 'Sprints',
        meta: `${sprint.status} · ${sprint.startDate} → ${sprint.endDate}`,
      }));
  }, [sprints, onActivateSprint, setView, setIsOpen]);

  const suggestedEnvironments = useMemo<PaletteItem[]>(() =>
    environments
      .slice()
      .sort((left, right) => {
        if (left.status === right.status) return left.name.localeCompare(right.name);
        if (left.status === 'down') return -1;
        if (right.status === 'down') return 1;
        if (left.status === 'degraded') return -1;
        if (right.status === 'degraded') return 1;
        return 0;
      })
      .slice(0, 4)
      .map((environment) => {
        const repo = repoById.get(environment.repoId);
        return {
          id: `suggested-env-${environment.id}`,
          label: environment.name,
          icon: Rocket,
          action: () => { onOpenEnvironment(environment.id, environment.repoId); setIsOpen(false); },
          group: 'Ambientes',
          meta: formatEnvironmentMeta(repo?.name || environment.repoId, environment.type, environment.currentVersion),
        };
      }),
  [environments, onOpenEnvironment, repoById, setIsOpen]);

  const filteredItems = useMemo<PaletteItem[]>(() => {
    if (!query) return [...staticCommands, ...suggestedTasks, ...suggestedRepos, ...suggestedSprints, ...suggestedEnvironments];

    const lowerQuery = query.toLowerCase();

    // Commands
    const matchedCommands = staticCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(lowerQuery)
    );

    // Tasks
    const matchedTasks: PaletteItem[] = tasks.filter(t =>
      t.title.toLowerCase().includes(lowerQuery) || t.id.toLowerCase().includes(lowerQuery)
    ).slice(0, 5).map(t => ({
      id: `task-${t.id}`,
      label: t.title,
      icon: CheckCircle2,
      action: () => { onSelectTask(t); setIsOpen(false); },
      group: 'Tarefas',
      meta: t.id
    }));

    // Repos
    const matchedRepos: PaletteItem[] = repos.filter(r =>
      r.name.toLowerCase().includes(lowerQuery)
    ).slice(0, 3).map(r => ({
      id: `repo-${r.id}`,
      label: r.name,
      icon: FolderGit2,
      action: () => { onOpenRepo(r.id); setIsOpen(false); },
      group: 'Repositórios',
      meta: r.branch
    }));

    const matchedSprints: PaletteItem[] = sprints.filter((sprint) =>
      sprint.name.toLowerCase().includes(lowerQuery) || sprint.goal.toLowerCase().includes(lowerQuery)
    ).slice(0, 3).map((sprint) => ({
      id: `sprint-${sprint.id}`,
      label: sprint.status === 'active' ? `Abrir sprint ${sprint.name}` : `Ativar sprint ${sprint.name}`,
      icon: Boxes,
      action: () => {
        if (sprint.status === 'active') {
          setView(ViewState.KANBAN);
        } else {
          onActivateSprint(sprint.id);
        }
        setIsOpen(false);
      },
      group: 'Sprints',
      meta: `${sprint.status} · ${sprint.startDate} → ${sprint.endDate}`,
    }));

    const matchedEnvironments: PaletteItem[] = environments.filter((environment) => {
      const repo = repoById.get(environment.repoId);
      const haystack = [environment.name, environment.type, environment.status, repo?.name || environment.repoId].join(' ').toLowerCase();
      return haystack.includes(lowerQuery);
    }).slice(0, 4).map((environment) => {
      const repo = repoById.get(environment.repoId);
      return {
        id: `environment-${environment.id}`,
        label: environment.name,
        icon: Rocket,
        action: () => { onOpenEnvironment(environment.id, environment.repoId); setIsOpen(false); },
        group: 'Ambientes',
        meta: formatEnvironmentMeta(repo?.name || environment.repoId, environment.type, environment.currentVersion),
      };
    });

    return [...matchedCommands, ...matchedTasks, ...matchedRepos, ...matchedSprints, ...matchedEnvironments];
  }, [query, staticCommands, suggestedTasks, suggestedRepos, suggestedSprints, suggestedEnvironments, tasks, repos, sprints, environments, onSelectTask, onOpenRepo, onActivateSprint, onOpenEnvironment, setView, setIsOpen, repoById]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      // Alt+N — open new task modal from anywhere
      if (e.altKey && e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        openNewTaskModal();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen, openNewTaskModal]);

  // Navegação com setas + Tab + Alt+N atalhos
  useEffect(() => {
    if (!isOpen) return;
    const handleNav = (e: KeyboardEvent) => {
      if (filteredItems.length === 0) return;
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          setIsOpen(false);
          setQuery('');
        }
      }
    };

    // Alt+1..9 quick navigation
    const handleAltShortcut = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const digit = Number.parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9) {
        e.preventDefault();
        const index = digit - 1;
        if (filteredItems[index]) {
          filteredItems[index].action();
          setIsOpen(false);
          setQuery('');
        }
      }
    };

    globalThis.addEventListener('keydown', handleNav);
    globalThis.addEventListener('keydown', handleAltShortcut);
    return () => {
      globalThis.removeEventListener('keydown', handleNav);
      globalThis.removeEventListener('keydown', handleAltShortcut);
    };
  }, [isOpen, filteredItems, selectedIndex, setIsOpen]);

  // Reset selected index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <button
        type="button"
        aria-label="Fechar paleta de comandos"
        className="absolute inset-0 bg-black/35 dark:bg-black/72 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      <div className="app-elevated-panel relative w-full max-w-xl overflow-hidden rounded-[1.35rem] animate-in fade-in zoom-in-95 duration-200">
        <div className="surface-header flex items-center gap-3 px-4 py-3">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            type="text"
            placeholder="O que você precisa? (Digite para buscar...)"
            className="flex-1 bg-transparent border-none outline-none text-sm h-6 text-slate-800 placeholder-slate-400 dark:text-[var(--text-primary)] dark:placeholder:text-[var(--text-muted)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="Buscar comandos"
          />
          <div className="app-kbd">ESC</div>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2" id="command-palette-listbox" aria-label="Resultados">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-[var(--text-muted)]">
              Nenhum resultado encontrado para "{query}"
            </div>
          ) : (
            <>
              {filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  id={`cmd-option-${index}`}
                  type="button"
                  aria-current={index === selectedIndex}
                  onClick={() => { item.action(); setIsOpen(false); }}
                  className={`mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/25
                                ${index === selectedIndex
                      ? 'border-primary-500/35 bg-primary-500/10 text-primary-700 dark:text-primary-200'
                      : 'border-transparent text-slate-700 hover:bg-slate-50 dark:text-[var(--text-secondary)] dark:hover:bg-white/[0.04]'
                    }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <item.icon className={`w-4 h-4 ${index === selectedIndex ? 'text-primary-500' : 'text-slate-400 dark:text-[var(--text-muted)]'}`} />
                    <div className="flex flex-col truncate">
                      <span className={index === selectedIndex ? 'font-medium text-primary-700 dark:text-primary-200' : ''}>{item.label}</span>
                      {item.meta && (
                        <span className="text-[10px] font-mono text-slate-400 dark:text-[var(--text-muted)]">{item.meta}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {index < 9 && (
                      <span className="app-kbd text-[9px] leading-none">Alt+{index + 1}</span>
                    )}
                    {item.group && (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] uppercase text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)]">{item.group}</span>
                    )}
                    {index === selectedIndex && <ArrowRight className="w-4 h-4 text-primary-500 opacity-70" />}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {filteredItems.length === 0
            ? 'Nenhum resultado encontrado.'
            : `${filteredItems.length} resultado(s) encontrado(s).`}
        </div>

        <div className="surface-header flex justify-between px-4 py-2 text-[10px] text-slate-400 dark:text-[var(--text-muted)]">
          <span>↑↓ ou Tab para navegar · Alt+1-9 atalho · Enter para executar</span>
          <span>DevFlow Intelligence</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

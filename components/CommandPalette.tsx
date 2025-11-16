
import React, { useState, useEffect, useMemo } from 'react';
import { Search, LayoutDashboard, Kanban, GitBranch, Database, Settings, Sun, Plus, ArrowRight, FolderGit2, CheckCircle2, ListTodo } from 'lucide-react';
import { ViewState, Task, Repository } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setView: (view: ViewState) => void;
  toggleTheme: () => void;
  openNewTaskModal: () => void;
  tasks: Task[];
  repos: Repository[];
  onSelectTask: (task: Task) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  setIsOpen,
  setView,
  toggleTheme,
  openNewTaskModal,
  tasks,
  repos,
  onSelectTask
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const staticCommands = useMemo(() => [
    { id: 'nav-dash', label: 'Ir para Visão Geral', icon: LayoutDashboard, action: () => setView(ViewState.DASHBOARD), group: 'Navegação' },
    { id: 'nav-kanban', label: 'Ir para Sprint Atual (Scrumban)', icon: Kanban, action: () => setView(ViewState.KANBAN), group: 'Navegação' },
    { id: 'nav-backlog', label: 'Ir para Backlog do Projeto', icon: ListTodo, action: () => setView(ViewState.BACKLOG), group: 'Navegação' },
    { id: 'nav-repos', label: 'Ir para Repositórios', icon: Database, action: () => setView(ViewState.REPOS), group: 'Navegação' },
    { id: 'nav-git', label: 'Ir para Controle de Fonte', icon: GitBranch, action: () => setView(ViewState.GIT), group: 'Navegação' },
    { id: 'nav-settings', label: 'Ir para Configurações', icon: Settings, action: () => setView(ViewState.SETTINGS), group: 'Navegação' },
    { id: 'act-new-task', label: 'Criar Nova Tarefa', icon: Plus, action: () => { setView(ViewState.KANBAN); openNewTaskModal(); }, group: 'Ações' },
    { id: 'act-theme', label: 'Alternar Tema Claro/Escuro', icon: Sun, action: () => toggleTheme(), group: 'Ações' },
  ], [setView, openNewTaskModal, toggleTheme]);

  const filteredItems = useMemo(() => {
    if (!query) return staticCommands;

    const lowerQuery = query.toLowerCase();

    // Commands
    const matchedCommands = staticCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(lowerQuery)
    );

    // Tasks
    const matchedTasks = tasks.filter(t =>
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
    const matchedRepos = repos.filter(r =>
      r.name.toLowerCase().includes(lowerQuery)
    ).slice(0, 3).map(r => ({
      id: `repo-${r.id}`,
      label: r.name,
      icon: FolderGit2,
      action: () => { setView(ViewState.REPOS); setIsOpen(false); },
      group: 'Repositórios'
    }));

    return [...matchedCommands, ...matchedTasks, ...matchedRepos];
  }, [query, staticCommands, tasks, repos, onSelectTask, setView, setIsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsOpen]);

  // Navegação com setas
  useEffect(() => {
    if (!isOpen) return;
    const handleNav = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
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
    window.addEventListener('keydown', handleNav);
    return () => window.removeEventListener('keydown', handleNav);
  }, [isOpen, filteredItems, selectedIndex, setIsOpen]);

  // Reset selected index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            type="text"
            placeholder="O que você precisa? (Digite para buscar...)"
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm h-6"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="text-[10px] font-mono text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 rounded">ESC</div>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              Nenhum resultado encontrado para "{query}"
            </div>
          ) : (
            <>
              {filteredItems.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => { item.action(); setIsOpen(false); }}
                  className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors text-sm border-l-2
                                ${index === selectedIndex
                      ? 'bg-fiori-blue/10 dark:bg-fiori-blue/20 border-fiori-blue'
                      : 'border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <item.icon className={`w-4 h-4 ${index === selectedIndex ? 'text-fiori-blue' : 'text-slate-400'}`} />
                    <div className="flex flex-col truncate">
                      <span className={index === selectedIndex ? 'text-fiori-blue font-medium' : ''}>{item.label}</span>
                      {/* Show extra info for tasks/repos */}
                      {'meta' in item && (
                        <span className="text-[10px] text-slate-400 font-mono">{(item as any).meta}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.group && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 rounded uppercase">{item.group}</span>
                    )}
                    {index === selectedIndex && <ArrowRight className="w-4 h-4 text-fiori-blue opacity-50" />}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex justify-between">
          <span>Use as setas para navegar</span>
          <span>DevFlow Intelligence</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

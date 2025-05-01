
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Kanban, GitBranch, Settings, Database, FolderGit2, ListTodo, PanelLeftClose, PanelLeft, Cloud } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  // Estado de colapso - persiste no localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'Visão Geral', icon: LayoutDashboard },
    // Planejamento
    { id: ViewState.BACKLOG, label: 'Backlog', icon: ListTodo },
    { id: ViewState.KANBAN, label: 'Sprint Ativa', icon: Kanban },
    // Desenvolvimento
    { id: ViewState.REPOS, label: 'Repositórios', icon: Database },
    { id: ViewState.GIT, label: 'Controle de Fonte', icon: GitBranch },
    // Entrega
    { id: ViewState.ENVIRONMENTS, label: 'Ambientes', icon: Cloud },
    // Sistema
    { id: ViewState.SETTINGS, label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} flex flex-col h-screen bg-slate-100 dark:bg-slate-900 transition-all duration-300 z-20`}>
      {/* Logo */}
      <button
        onClick={() => setView(ViewState.DASHBOARD)}
        className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'px-6'} w-full cursor-pointer`}
        title="Visão Geral"
      >
        <FolderGit2 className="w-8 h-8 text-fiori-blue dark:text-fiori-blueDark flex-shrink-0" />
        {!isCollapsed && (
          <span className="ml-3 font-bold text-lg tracking-tight text-fiori-textPrimary dark:text-white">DevFlow</span>
        )}
      </button>

      {/* Menu Items */}
      <nav className="flex-1 py-6 space-y-1">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'px-6'} py-3 transition-colors duration-200 group relative
                ${isActive
                  ? 'bg-primary-50 dark:bg-slate-800/70 border-r-[3px] border-primary-500 dark:border-primary-400'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-fiori-blue dark:text-fiori-blueDark' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
              {!isCollapsed && (
                <span className={`ml-4 text-sm font-medium truncate ${isActive ? 'text-fiori-blue dark:text-fiori-blueDark font-semibold' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'}`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Status da Equipe (só visível quando expandido) */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-lg p-3 text-xs text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-600/30">
            <p className="font-semibold mb-1 text-slate-700 dark:text-slate-300">Status da Equipe</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
              Online (1)
            </div>
          </div>
        </div>
      )}

      {/* Botão Recolher/Expandir Menu */}
      <div className="border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'px-6'} py-4 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group`}
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {isCollapsed ? (
            <PanelLeft className="w-5 h-5 group-hover:text-fiori-blue transition-colors" />
          ) : (
            <>
              <PanelLeftClose className="w-5 h-5 group-hover:text-fiori-blue transition-colors" />
              <span className="ml-4 text-sm font-medium group-hover:text-slate-700 dark:group-hover:text-slate-200">Recolher menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

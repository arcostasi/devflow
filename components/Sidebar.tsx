
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Kanban, GitBranch, Settings, Database, ListTodo, PanelLeftClose, PanelLeft, Cloud } from 'lucide-react';
import { ViewState } from '../types';
import DevFlowLogo from './DevFlowLogo';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  // Estado de colapso - persiste no localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (globalThis.window !== undefined) {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const menuSections = [
    {
      label: 'Visão',
      items: [
        { id: ViewState.DASHBOARD, label: 'Visão Geral', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Planejamento',
      items: [
        { id: ViewState.BACKLOG, label: 'Backlog', icon: ListTodo },
        { id: ViewState.KANBAN, label: 'Sprint Ativa', icon: Kanban },
      ],
    },
    {
      label: 'Execução',
      items: [
        { id: ViewState.REPOS, label: 'Repositórios', icon: Database },
        { id: ViewState.GIT, label: 'Controle de Fonte', icon: GitBranch },
        { id: ViewState.ENVIRONMENTS, label: 'Ambientes', icon: Cloud },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { id: ViewState.SETTINGS, label: 'Configurações', icon: Settings },
      ],
    },
  ];

  return (
    <aside className={`${isCollapsed ? 'w-[5.25rem]' : 'w-[17rem]'} app-sidebar-shell flex flex-col h-full rounded-[1.6rem] transition-all duration-300 z-20 overflow-hidden`}>
      {/* Logo */}
      <button
        onClick={() => setView(ViewState.DASHBOARD)}
        className={`h-[4.75rem] flex items-center ${isCollapsed ? 'justify-center px-3' : 'px-6'} w-full cursor-pointer border-b border-slate-200/60 dark:border-[var(--border-soft)]`}
        title="Visão Geral"
      >
        <div className="app-brand-badge app-brand-badge-sm">
          <DevFlowLogo className="w-7 h-7 flex-shrink-0" />
        </div>
        {!isCollapsed && (
          <div className="ml-3 text-left">
            <span className="block font-bold text-lg tracking-tight text-slate-700 dark:text-[var(--text-primary)]">DevFlow</span>
            <span className="mt-0.5 inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.38)] dark:shadow-[0_0_8px_rgba(34,211,238,0.7)]" aria-hidden="true" />
              Workspace
            </span>
          </div>
        )}
      </button>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {menuSections.map((section) => (
          <div key={section.label} className="space-y-1.5">
            {!isCollapsed && (
              <p className="app-sidebar-section-label">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`app-nav-item w-full ${isCollapsed ? 'justify-center px-3' : 'px-4'} ${isActive ? 'app-nav-item-active' : ''} group`}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-slate-700 dark:text-[var(--text-primary)]' : 'text-slate-500 dark:text-[var(--text-muted)] group-hover:text-slate-700 dark:group-hover:text-[var(--text-primary)]'}`} />
                  {!isCollapsed && (
                    <span className={`ml-3 text-sm truncate ${isActive ? 'font-semibold text-slate-800 dark:text-[var(--text-primary)]' : 'text-slate-600 dark:text-[var(--text-secondary)] group-hover:text-slate-800 dark:group-hover:text-[var(--text-primary)]'}`}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Status da Equipe (só visível quando expandido) */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-200/60 dark:border-[var(--border-soft)]">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-xs text-slate-500 shadow-sm shadow-slate-200/40 dark:border-[var(--border-soft)] dark:bg-white/[0.03] dark:text-[var(--text-muted)] dark:shadow-none">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-[var(--text-muted)]">Status da Equipe</p>
            <div className="flex items-center gap-2 text-slate-700 dark:text-[var(--text-secondary)]">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.32)] dark:shadow-[0_0_5px_rgba(34,197,94,0.5)]" aria-hidden="true" />
              <span>Online (1)</span>
            </div>
          </div>
        </div>
      )}

      {/* Botão Recolher/Expandir Menu */}
      <div className="border-t border-slate-200/60 dark:border-[var(--border-soft)]">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`app-nav-item w-full rounded-none border-0 ${isCollapsed ? 'justify-center px-3' : 'px-4'} py-3 text-slate-500 dark:text-[var(--text-muted)] group`}
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {isCollapsed ? (
            <PanelLeft className="w-5 h-5 group-hover:text-slate-700 dark:group-hover:text-[var(--text-primary)] transition-colors" />
          ) : (
            <>
              <PanelLeftClose className="w-5 h-5 group-hover:text-slate-700 dark:group-hover:text-[var(--text-primary)] transition-colors" />
              <span className="ml-4 text-sm font-medium group-hover:text-slate-700 dark:group-hover:text-[var(--text-primary)]">Recolher menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

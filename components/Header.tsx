import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, Sun, Moon, Plus, Check, MessageSquare, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import DevFlowLogo from './DevFlowLogo';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  title: string;
  onOpenCommandPalette: () => void;
  onOpenNewTask: () => void;
}

const getNotificationTypeClass = (type: string): string => {
  if (type === 'ci') return 'bg-red-100 text-red-500 dark:bg-red-900/30';
  if (type === 'mention') return 'bg-blue-100 text-blue-500 dark:bg-blue-900/30';
  return 'bg-purple-100 text-purple-500 dark:bg-purple-900/30';
};

const getNotificationIcon = (type: string): React.ReactNode => {
  if (type === 'ci') return <AlertTriangle className="w-4 h-4" />;
  if (type === 'mention') return <MessageSquare className="w-4 h-4" />;
  return <Check className="w-4 h-4" />;
};

const Header: React.FC<HeaderProps> = ({ isDark, toggleTheme, title, onOpenCommandPalette, onOpenNewTask }) => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Empty notifications - will be populated from API in the future
  const notifications: { id: number; type: string; text: string; time: string; read: boolean }[] = [];

  return (
    <header className="app-header-bar z-30 relative select-none">
      <div className="app-header-brand">
        <div className="app-brand-badge app-brand-badge-sm hidden sm:inline-flex">
          <DevFlowLogo className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="hidden lg:block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">DevFlow Workspace</p>
          <h1 className="truncate text-xl font-semibold text-slate-700 dark:text-[var(--text-primary)]">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search Bar / Command Palette Trigger */}
        <button
          type="button"
          className="app-command-trigger hidden lg:flex w-80 cursor-pointer group"
          onClick={onOpenCommandPalette}
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-500 dark:text-[var(--text-muted)] dark:group-hover:text-[var(--text-primary)]" />
          <span className="text-sm w-full text-left text-slate-500 dark:text-[var(--text-muted)] group-hover:text-slate-700 dark:group-hover:text-[var(--text-primary)]">Buscar tarefas, repositórios ou ações...</span>
          <div className="flex gap-1">
            <kbd className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-2 font-mono text-[10px] font-medium text-slate-500 shadow-sm shadow-slate-200/40 dark:border-[var(--border-soft)] dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </button>

        <div className="app-control-cluster">
          <button
            onClick={onOpenNewTask}
            className="app-icon-button"
            title="Nova Tarefa"
          >
            <Plus className="w-5 h-5" />
          </button>

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`app-icon-button relative ${showNotifications ? 'border-slate-200/80 bg-slate-50/90 text-slate-700 shadow-sm shadow-slate-200/50 dark:border-[var(--border-soft)] dark:bg-white/[0.05] dark:text-[var(--text-primary)] dark:shadow-none' : ''}`}
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#141821]"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="app-flyout absolute right-0 mt-2 w-80 rounded-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-slate-200/50 bg-slate-50/70 p-3 dark:border-[var(--border-soft)] dark:bg-white/[0.03]">
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-[var(--text-primary)]">Notificações</h3>
                  <button className="text-xs text-primary-600 dark:text-primary-300 hover:underline">Marcar lidas</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm dark:text-[var(--text-muted)]">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhuma notificação
                    </div>
                  ) : notifications.map(notif => (
                    <div key={notif.id} className={`p-3 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer flex gap-3 ${notif.read ? '' : 'bg-blue-50/30 dark:bg-blue-900/10'}`}>
                      <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getNotificationTypeClass(notif.type)}`}>
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${notif.read ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-800 dark:text-slate-100'}`}>
                          {notif.text}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 dark:text-[var(--text-muted)]">{notif.time} atrás</p>
                      </div>
                      {!notif.read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-2"></div>}
                    </div>
                  ))}
                </div>
                <div className="p-2 text-center border-t border-slate-200 bg-slate-50 dark:border-[var(--border-soft)] dark:bg-white/[0.03]">
                  <button className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-[var(--text-muted)] dark:hover:text-[var(--text-primary)]">Ver todas</button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="app-icon-button"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* User Profile */}
        <div className="app-user-chip ml-1">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-700 dark:text-[var(--text-primary)]">{user?.name}</p>
            <p className="text-xs text-slate-500 dark:text-[var(--text-muted)] capitalize">{user?.role}</p>
          </div>
          <Avatar name={user?.name || 'User'} size="md" />

          <button
            onClick={logout}
            className="app-icon-button text-slate-400 hover:bg-red-50 hover:border-red-100 hover:text-red-500 dark:text-[var(--text-muted)] dark:hover:border-red-500/20 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

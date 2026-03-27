import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Search, Sun, Moon, Plus, MessageSquare, AlertTriangle, LogOut, GitCommit, Rocket, Boxes, FolderGit2, GitPullRequest } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Notification } from '../types';
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
  if (type === 'deploy') return 'bg-emerald-100 text-emerald-500 dark:bg-emerald-900/30';
  if (type === 'commit') return 'bg-blue-100 text-blue-500 dark:bg-blue-900/30';
  if (type === 'pr') return 'bg-purple-100 text-purple-500 dark:bg-purple-900/30';
  if (type === 'task') return 'bg-orange-100 text-orange-500 dark:bg-orange-900/30';
  if (type === 'sprint') return 'bg-violet-100 text-violet-500 dark:bg-violet-900/30';
  return 'bg-slate-100 text-slate-500 dark:bg-slate-800/30';
};

const getNotificationIcon = (type: string): React.ReactNode => {
  if (type === 'deploy') return <Rocket className="w-4 h-4" />;
  if (type === 'commit') return <GitCommit className="w-4 h-4" />;
  if (type === 'pr') return <GitPullRequest className="w-4 h-4" />;
  if (type === 'task') return <AlertTriangle className="w-4 h-4" />;
  if (type === 'sprint') return <Boxes className="w-4 h-4" />;
  if (type === 'repo') return <FolderGit2 className="w-4 h-4" />;
  return <MessageSquare className="w-4 h-4" />;
};

const formatTimeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const Header: React.FC<HeaderProps> = ({ isDark, toggleTheme, title, onOpenCommandPalette, onOpenNewTask }) => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
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

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const data = await api.getNotifications({ limit: 20 });
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  // Initial fetch + poll every 30s
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (showNotifications) fetchNotifications();
  }, [showNotifications, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      try {
        await api.markNotificationRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { /* ignore */ }
    }
  };

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
              aria-expanded={showNotifications}
              aria-haspopup="true"
              className={`app-icon-button relative ${showNotifications ? 'border-slate-200/80 bg-slate-50/90 text-slate-700 shadow-sm shadow-slate-200/50 dark:border-[var(--border-soft)] dark:bg-white/[0.05] dark:text-[var(--text-primary)] dark:shadow-none' : ''}`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#141821]"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="app-flyout absolute right-0 mt-2 w-80 rounded-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-slate-200/50 bg-slate-50/70 p-3 dark:border-[var(--border-soft)] dark:bg-white/[0.03]">
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-[var(--text-primary)]">
                    Notificações
                    {unreadCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>}
                  </h3>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-primary-600 dark:text-primary-300 hover:underline">Marcar lidas</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {loadingNotifications && notifications.length === 0 ? (
                    <div className="space-y-1 p-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={`notif-skel-${i}`} className="flex gap-3 p-3">
                          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                            <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm dark:text-[var(--text-muted)]">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhuma notificação
                    </div>
                  ) : notifications.map(notif => (
                    <button
                      type="button"
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left p-3 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer flex gap-3 ${notif.read ? '' : 'bg-blue-50/30 dark:bg-blue-900/10'}`}
                    >
                      <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getNotificationTypeClass(notif.type)}`}>
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${notif.read ? 'text-slate-600 dark:text-slate-400' : 'font-medium text-slate-800 dark:text-slate-100'}`}>
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{notif.body}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1 dark:text-[var(--text-muted)]">{formatTimeAgo(notif.createdAt)}</p>
                      </div>
                      {!notif.read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />}
                    </button>
                  ))}
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

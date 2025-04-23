import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, Sun, Moon, Plus, Check, MessageSquare, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  title: string;
  onOpenCommandPalette: () => void;
  onOpenNewTask: () => void;
}

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
    <header className="h-16 bg-slate-100 dark:bg-slate-900 flex items-center justify-between px-6 transition-colors duration-300 z-30 relative select-none">
      <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Search Bar / Command Palette Trigger */}
        <div
          className="hidden md:flex items-center bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 w-64 focus-within:ring-2 ring-fiori-blue transition-all cursor-pointer group hover:bg-slate-200 dark:hover:bg-slate-700"
          onClick={onOpenCommandPalette}
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
          <span className="text-sm ml-2 w-full text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">Buscar...</span>
          <div className="flex gap-1">
            <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-slate-500 dark:text-slate-400">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewTask}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Nova Tarefa"
          >
            <Plus className="w-5 h-5" />
          </button>

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 relative transition-colors ${showNotifications ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
            >
              <Bell className="w-5 h-5" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-fiori-cardDark rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 border-b border-slate-200 dark:border-slate-600/30 flex justify-between items-center bg-slate-50 dark:bg-slate-800/70">
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Notificações</h3>
                  <button className="text-xs text-fiori-blue hover:underline">Marcar lidas</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhuma notificação
                    </div>
                  ) : notifications.map(notif => (
                    <div key={notif.id} className={`p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex gap-3 ${!notif.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                      <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${notif.type === 'ci' ? 'bg-red-100 text-red-500 dark:bg-red-900/30' :
                        notif.type === 'mention' ? 'bg-blue-100 text-blue-500 dark:bg-blue-900/30' :
                          'bg-purple-100 text-purple-500 dark:bg-purple-900/30'
                        }`}>
                        {notif.type === 'ci' ? <AlertTriangle className="w-4 h-4" /> :
                          notif.type === 'mention' ? <MessageSquare className="w-4 h-4" /> :
                            <Check className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${!notif.read ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                          {notif.text}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{notif.time} atrás</p>
                      </div>
                      {!notif.read && <div className="w-2 h-2 rounded-full bg-fiori-blue mt-2"></div>}
                    </div>
                  ))}
                </div>
                <div className="p-2 text-center border-t border-slate-200 dark:border-slate-600/30 bg-slate-50 dark:bg-slate-800/70">
                  <button className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Ver todas</button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* User Profile */}
        <div className="ml-2 flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{user?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</p>
          </div>
          <Avatar name={user?.name || 'User'} size="md" />

          <button
            onClick={logout}
            className="p-2 rounded-full hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 text-slate-400 transition-colors"
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

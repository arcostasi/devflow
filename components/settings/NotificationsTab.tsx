import React, { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface NotificationsTabProps {
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
}

const defaultNotifications = {
  email_digest: true,
  pr_review: true,
  ci_failed: true,
  marketing: false,
};

type NotificationSettings = typeof defaultNotifications;

const readNotifications = (value: unknown): Partial<NotificationSettings> => {
  if (!value || typeof value !== 'object') return {};
  return value as Partial<NotificationSettings>;
};

const NotificationsTab: React.FC<NotificationsTabProps> = () => {
  const { user, updateProfile } = useAuth();

  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    const stored = readNotifications(user?.preferences?.notifications);
    return { ...defaultNotifications, ...stored };
  });

  useEffect(() => {
    if (user?.preferences?.notifications) {
      const stored = readNotifications(user.preferences?.notifications);
      setNotifications((prev) => ({ ...prev, ...stored }));
    }
  }, [user]);

  const toggleNotif = useCallback((key: keyof typeof notifications) => {
    setNotifications(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (user) {
        updateProfile({
          preferences: {
            ...user?.preferences,
            notifications: next
          }
        });
      }
      return next;
    });
  }, [user, updateProfile]);

  return (
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
  );
};

export default NotificationsTab;

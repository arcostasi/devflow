import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export const useConfirm = (): ConfirmContextType => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    message: '',
    title: 'Confirmar',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'danger',
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions({
      title: opts.title ?? 'Confirmar',
      message: opts.message,
      confirmText: opts.confirmText ?? 'Confirmar',
      cancelText: opts.cancelText ?? 'Cancelar',
      variant: opts.variant ?? 'danger',
    });
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setIsOpen(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  const variantConfig = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white',
    },
    info: {
      icon: Info,
      iconBg: 'bg-sky-100 dark:bg-sky-900/30',
      iconColor: 'text-sky-600 dark:text-sky-400',
      confirmBtn: 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500 text-white',
    },
  };

  const v = variantConfig[options.variant || 'danger'];
  const IconComponent = v.icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => handleClose(false)}
          />

          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{options.title}</h3>
              <button
                onClick={() => handleClose(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <div className="flex gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${v.iconBg} flex items-center justify-center`}>
                  <IconComponent className={`w-5 h-5 ${v.iconColor}`} />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line pt-2">
                  {options.message}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
              >
                {options.cancelText}
              </button>
              <button
                autoFocus
                onClick={() => handleClose(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${v.confirmBtn}`}
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

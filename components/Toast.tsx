
import React, { useEffect, useState } from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animação de entrada
    requestAnimationFrame(() => setIsVisible(true));
    
    // Auto remover após 4 segundos
    const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onRemove, 300); // Espera a animação de saída
    }, 4000);

    return () => clearTimeout(timer);
  }, [onRemove]);

  const getIcon = () => {
    switch(toast.type) {
        case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
        case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
        default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
     switch(toast.type) {
        case 'success': return 'border-emerald-500';
        case 'error': return 'border-red-500';
        default: return 'border-blue-500';
    }
  };

  const getToneClasses = () => {
    switch(toast.type) {
      case 'success':
        return 'bg-emerald-50/95 text-emerald-900 dark:bg-emerald-500/[0.08] dark:text-emerald-100';
      case 'error':
        return 'bg-red-50/95 text-red-950 dark:bg-red-500/[0.08] dark:text-red-100';
      default:
        return 'bg-sky-50/95 text-sky-950 dark:bg-sky-500/[0.08] dark:text-sky-100';
    }
  };

  return (
    <div 
        role="status"
        aria-live="polite"
        className={`
            surface-card border-l-4 ${getBorderColor()} ${getToneClasses()} w-80 rounded-2xl p-4 pointer-events-auto flex items-start gap-3 transition-all duration-300 transform
            ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        `}
    >
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1">
            <h4 className="text-sm font-semibold">{toast.title}</h4>
            {toast.description && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{toast.description}</p>}
        </div>
        <button
            onClick={() => { setIsVisible(false); setTimeout(onRemove, 300); }}
            className="rounded-full p-1 text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/25 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
            aria-label="Fechar notificação"
        >
            <X className="w-4 h-4" />
        </button>
    </div>
  );
};

export default ToastContainer;


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

  return (
    <div 
        className={`
            bg-white dark:bg-slate-800/70 border-l-4 ${getBorderColor()} rounded-r-md shadow-lg p-4 w-80 pointer-events-auto flex items-start gap-3 transition-all duration-300 transform
            ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        `}
    >
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white">{toast.title}</h4>
            {toast.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{toast.description}</p>}
        </div>
        <button onClick={() => { setIsVisible(false); setTimeout(onRemove, 300); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
        </button>
    </div>
  );
};

export default ToastContainer;

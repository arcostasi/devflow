import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-950/45 dark:bg-black/78 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      <div 
        ref={modalRef}
        className={`relative w-full ${sizeClasses[size]} surface-card rounded-[1.35rem] flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-5 duration-200`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="surface-header flex items-center justify-between px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h3>
          <button 
            onClick={onClose}
            className="app-icon-button h-10 w-10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar bg-transparent">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;

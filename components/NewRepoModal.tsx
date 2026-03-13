
import React, { useState } from 'react';
import Modal from './Modal';
import { Repository } from '../types';
import { FolderGit2, GitBranch, FileText, FolderOpen, Plus, Link } from 'lucide-react';

interface NewRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (repo: Omit<Repository, 'id' | 'issues' | 'lastUpdated' | 'status'> & { localPath?: string; linkExisting?: boolean }) => void;
}

const NewRepoModal: React.FC<NewRepoModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [branch, setBranch] = useState('main');
  const [localPath, setLocalPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === 'link' && !localPath.trim()) return;

    onCreate({
      name,
      description,
      branch: branch || 'main',
      ...(mode === 'link' ? { localPath: localPath.trim(), linkExisting: true } : {})
    });

    setName('');
    setDescription('');
    setBranch('main');
    setLocalPath('');
    setMode('create');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Repositório" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="surface-muted rounded-2xl p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            Provisionamento de workspace
          </p>
          <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            Escolha entre iniciar um novo repositório ou conectar um workspace local já existente.
          </h4>
        </div>

        <div className="app-segmented">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`app-segmented-option ${mode === 'create' ? 'app-segmented-option-active text-sky-700 dark:text-sky-300' : ''}`}
          >
            <Plus className="w-4 h-4" /> Criar Novo
          </button>
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`app-segmented-option ${mode === 'link' ? 'app-segmented-option-active text-sky-700 dark:text-sky-300' : ''}`}
          >
            <Link className="w-4 h-4" /> Vincular Existente
          </button>
        </div>

        {mode === 'link' && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-50/80 p-4 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            Vincule um repositório Git já existente no disco. Nenhum <code className="font-mono">git init</code> será executado.
          </div>
        )}

        <div className="surface-muted rounded-2xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome do Repositório <span className="text-red-500">*</span></label>
            <div className="relative">
              <FolderGit2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={mode === 'link' ? 'Ex: meu-projeto' : 'Ex: novo-projeto-api'}
                className="app-input w-full rounded-xl py-2.5 pl-9 pr-3"
                autoFocus
              />
            </div>
          </div>

          {mode === 'link' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Caminho Local <span className="text-red-500">*</span></label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={localPath}
                  onChange={e => setLocalPath(e.target.value)}
                  placeholder="Ex: C:\projetos\meu-repo ou /home/user/projetos/repo"
                  className="app-input w-full rounded-xl py-2.5 pl-9 pr-3 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Informe o caminho absoluto do diretório Git existente.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Descrição</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Contexto do produto, objetivo do serviço ou área responsável."
                className="app-input w-full rounded-xl py-2.5 pl-9 pr-3 resize-none text-sm"
              />
            </div>
          </div>

          {mode === 'create' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Branch Padrão</label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  placeholder="main"
                  className="app-input w-full rounded-xl py-2.5 pl-9 pr-3 font-mono text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="app-button-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim() || (mode === 'link' && !localPath.trim())}
            className="app-button-primary px-6 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {mode === 'link' ? 'Vincular Repositório' : 'Criar Repositório'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NewRepoModal;

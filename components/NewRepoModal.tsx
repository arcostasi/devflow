
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

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${mode === 'create' ? 'bg-fiori-blue text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Plus className="w-4 h-4" /> Criar Novo
          </button>
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors border-l border-slate-200 dark:border-slate-700 ${mode === 'link' ? 'bg-fiori-blue text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <Link className="w-4 h-4" /> Vincular Existente
          </button>
        </div>

        {mode === 'link' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            Vincule um repositório Git já existente no disco. Nenhum <code className="font-mono">git init</code> será executado.
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome do Repositório <span className="text-red-500">*</span></label>
          <div className="relative">
            <FolderGit2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={mode === 'link' ? 'Ex: meu-projeto' : 'Ex: novo-projeto-api'}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
              autoFocus
            />
          </div>
        </div>

        {mode === 'link' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Caminho Local <span className="text-red-500">*</span></label>
            <div className="relative">
              <FolderOpen className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={localPath}
                onChange={e => setLocalPath(e.target.value)}
                placeholder="Ex: C:\projetos\meu-repo ou /home/user/projetos/repo"
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white font-mono text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">Caminho absoluto para o diretório do repositório Git.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Descrição</label>
          <div className="relative">
            <FileText className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Do que se trata este projeto?"
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white resize-none text-sm"
            />
          </div>
        </div>

        {mode === 'create' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Branch Padrão</label>
            <div className="relative">
              <GitBranch className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={branch}
                onChange={e => setBranch(e.target.value)}
                placeholder="main"
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white font-mono text-sm"
              />
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!name.trim() || (mode === 'link' && !localPath.trim())}
            className="px-6 py-2 text-sm font-medium text-white bg-fiori-blue hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mode === 'link' ? 'Vincular Repositório' : 'Criar Repositório'}
          </button>
        </div>

      </form>
    </Modal>
  );
};

export default NewRepoModal;

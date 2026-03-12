import React, { useState } from 'react';
import Modal from './Modal';
import { Task, Priority, TaskStatus, User, Repository } from '../types';
import Avatar from './Avatar';
import { Tag, FolderGit2 } from 'lucide-react';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (task: Omit<Task, 'id'>) => void;
  initialStatus?: TaskStatus;
  repos: Repository[];
  users?: User[];
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onCreate, initialStatus = 'todo', repos, users = [] }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [repoId, setRepoId] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');

  // Reset form when opening/closing would be handled by a useEffect in a real app or resetting on submit

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const assignee = users.find(u => u.id === assigneeId);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

    onCreate({
      title,
      description,
      priority,
      status,
      assignee,
      repositoryId: repoId || undefined,
      tags: tags.length > 0 ? tags : ['Geral'],
      comments: [],
      subtasks: []
    });

    // Reset fields
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStatus(initialStatus);
    setAssigneeId('');
    setRepoId('');
    setTagsInput('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Criar Nova Tarefa" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="surface-muted rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Planejamento operacional
              </p>
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Registre contexto, responsável e vínculo técnico em uma única etapa.
              </h4>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              Status inicial: {status === 'backlog' ? 'Backlog' : status === 'todo' ? 'A Fazer' : status === 'doing' ? 'Em andamento' : status === 'review' ? 'Em revisão' : status === 'ready' ? 'Pronta' : 'Concluída'}
            </span>
          </div>
        </div>

        <div className="surface-muted rounded-2xl p-5 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Título da Tarefa <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Informe um título breve e descritivo"
              className="app-input w-full rounded-xl px-4 py-3"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Descrição</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Descreva o problema, objetivo, critérios de entrega ou dependências."
              className="app-input w-full rounded-xl px-4 py-3 resize-none font-mono text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="surface-muted rounded-2xl p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Criticidade</p>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Prioridade e contexto técnico</h5>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Prioridade</label>
              <div className="app-segmented">
                {(['low', 'medium', 'high'] as Priority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`app-segmented-option capitalize ${priority === p ? 'app-segmented-option-active' : ''} ${
                      priority === p && p === 'high'
                        ? 'text-red-700 dark:text-red-300'
                        : priority === p && p === 'medium'
                          ? 'text-amber-700 dark:text-amber-300'
                          : priority === p && p === 'low'
                            ? 'text-sky-700 dark:text-sky-300'
                            : ''
                    }`}
                  >
                    {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Repositório Vinculado</label>
              <div className="relative">
                <FolderGit2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={repoId}
                  onChange={e => setRepoId(e.target.value)}
                  className="app-input w-full appearance-none rounded-xl py-2.5 pl-9 pr-3"
                >
                  <option value="">Sem repositório</option>
                  {repos.map(repo => (
                    <option key={repo.id} value={repo.id}>{repo.name}</option>
                  ))}
                </select>
              </div>
              {repos.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhum repositório disponível. A tarefa será criada sem vínculo técnico.
                </p>
              )}
            </div>
          </div>

          <div className="surface-muted rounded-2xl p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Responsabilidade</p>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Distribuição e classificação</h5>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Responsável</label>
              {users.length === 0 ? (
                <div className="app-empty-state">
                  <strong className="text-sm">Nenhum colaborador disponível</strong>
                  <p className="text-sm">Crie a tarefa agora e atribua o responsável depois.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {users.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setAssigneeId(member.id === assigneeId ? '' : member.id)}
                      className={`flex justify-center rounded-2xl border p-2 transition-all ${
                        assigneeId === member.id
                          ? 'border-sky-500/40 bg-sky-500/10 shadow-sm'
                          : 'border-transparent hover:border-slate-200 hover:bg-white/70 dark:hover:border-white/10 dark:hover:bg-white/[0.03]'
                      }`}
                      title={member.name}
                    >
                      <Avatar name={member.name} size="md" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tags (separadas por vírgula)</label>
              <div className="relative">
                <Tag className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  placeholder="Frontend, Bugfix, V1..."
                  className="app-input w-full rounded-xl py-2.5 pl-9 pr-3"
                />
              </div>
            </div>
          </div>
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
            disabled={!title.trim()}
            className="app-button-primary px-6 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            Criar Tarefa
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NewTaskModal;

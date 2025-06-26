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

        {/* Title */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Título da Tarefa <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Informe um título breve e descritivo"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Descrição</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="Detalhes da tarefa (suporta Markdown)..."
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white resize-none font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Priority & Status */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Prioridade</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as Priority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2 px-3 rounded-md text-sm border transition-all capitalize
                              ${priority === p
                        ? (p === 'high' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300' :
                          p === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300' :
                            'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300')
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }
                            `}
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
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white appearance-none"
                >
                  <option value="">Sem repositório</option>
                  {repos.map(repo => (
                    <option key={repo.id} value={repo.id}>{repo.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Assignee & Tags */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Responsável</label>
              <div className="grid grid-cols-4 gap-2">
                {users.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setAssigneeId(member.id === assigneeId ? '' : member.id)}
                    className={`p-1 rounded-full border-2 transition-all flex justify-center ${assigneeId === member.id ? 'border-fiori-blue scale-110' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                    title={member.name}
                  >
                    <Avatar name={member.name} size="md" />
                  </button>
                ))}
              </div>
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
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

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
            disabled={!title.trim()}
            className="px-6 py-2 text-sm font-medium text-white bg-fiori-blue hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Criar Tarefa
          </button>
        </div>

      </form>
    </Modal>
  );
};

export default NewTaskModal;


import React from 'react';
import { Task, TaskStatus, Sprint } from '../types';
import { Plus, ArrowRight, UserCircle2, Calendar, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { api } from '../services/api';
import { useConfirm } from '../contexts/ConfirmContext';

interface BacklogProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  addToast: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
  openNewTaskModal: () => void;
  openManageSprintsModal: () => void;
  activeSprint: Sprint | null;
  onRefreshData?: () => void;
}

const Backlog: React.FC<BacklogProps> = ({ tasks, setTasks, addToast, openNewTaskModal, openManageSprintsModal, activeSprint, onRefreshData }) => {
  const { confirm } = useConfirm();
  const [parent] = useAutoAnimate();

  const backlogTasks = tasks.filter(t => t.status === 'backlog');
  const sprintTasks = tasks.filter(t => t.status !== 'backlog');

  const moveToSprint = async (task: Task) => {
    if (!activeSprint) return;
    const updatedTask = { ...task, status: 'todo' as TaskStatus, sprintId: activeSprint.id };
    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    try {
      await api.updateTask(task.id, { status: 'todo', sprintId: activeSprint.id });
      addToast('Adicionado ao Sprint', 'success', `"${task.title}" movido para o sprint ativo.`);
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      addToast('Falha ao Mover', 'error', 'Não foi possível mover o item para o sprint.');
    }
  };

  const deleteFromBacklog = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (await confirm({ title: 'Remover do Backlog', message: 'Deseja realmente remover este item do backlog?', confirmText: 'Remover', variant: 'danger' })) {
      setTasks(prev => prev.filter(t => t.id !== id));
      try {
        await api.deleteTask(id);
        addToast('Item Removido', 'info', 'O item foi removido do backlog.');
      } catch {
        addToast('Falha ao Remover', 'error', 'Não foi possível remover o item. Os dados foram restaurados.');
        if (onRefreshData) onRefreshData();
      }
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'high': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
      default: return 'text-slate-600 bg-slate-50 dark:bg-slate-800';
    }
  };

  const totalBacklogPoints = backlogTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  const totalSprintPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);

  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncGitlab();
      addToast('GitLab Sincronizado', 'success', `${res.count ?? 0} itens importados do GitLab.`);
      if (onRefreshData) onRefreshData();
    } catch (e: any) {
      addToast('Falha na Sincronização', 'error', e.message || 'Não foi possível conectar com o GitLab.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-fiori-textPrimary dark:text-white">Backlog do Projeto</h2>
          <p className="text-sm text-slate-500">Gerenciamento Scrum: Priorize o trabalho para as próximas Sprints.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openManageSprintsModal}
            className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Calendar className="w-4 h-4" /> Gerenciar Sprints
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <ArrowRight className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sincronizar GitLab
          </button>
          <button
            onClick={openNewTaskModal}
            className="flex items-center gap-2 bg-fiori-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-hidden">
        {/* Project Backlog Column */}
        <div className="flex flex-col bg-fiori-cardLight dark:bg-fiori-cardDark rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              Backlog do Projeto <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">{backlogTasks.length}</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">{totalBacklogPoints} pts</span>
          </div>
          <div ref={parent} className="flex-1 overflow-y-auto p-2 space-y-2">
            {backlogTasks.map(task => (
              <div key={task.id} className="group flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded hover:border-fiori-blue transition-colors shadow-sm">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase font-bold px-1.5 rounded ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                    <span className="text-xs text-slate-400 font-mono">{task.id}</span>
                    {task.tags.map(t => <span key={t} className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 rounded">#{t}</span>)}
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500" title="Story Points">
                    {task.storyPoints || '-'}
                  </div>
                  <button
                    onClick={(e) => deleteFromBacklog(e, task.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Remover do Backlog"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveToSprint(task)}
                    className="p-1.5 text-slate-400 hover:text-fiori-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title="Mover para Sprint Atual"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            {backlogTasks.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                Backlog vazio. Todo o escopo está planejado.
              </div>
            )}
          </div>
        </div>

        {/* Current Sprint Column */}
        <div className="flex flex-col bg-fiori-cardLight dark:bg-fiori-cardDark rounded-lg border-2 border-fiori-blue/20 dark:border-fiori-blue/10 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-fiori-blue"></div>
          {activeSprint ? (
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-fiori-blue dark:text-blue-400 text-lg">{activeSprint.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" /> {activeSprint.startDate} - {activeSprint.endDate}
                  </p>
                </div>
                <span className="text-sm font-bold font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                  {totalSprintPoints} pts
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 italic border-l-2 border-fiori-blue pl-2">
                Goal: "{activeSprint.goal}"
              </p>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 text-sm">Nenhuma Sprint ativa.</div>
          )}

          <div ref={parent} className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/30 dark:bg-slate-900/20">
            {sprintTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded opacity-75">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] uppercase font-bold px-1.5 rounded ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                    <span className="text-xs text-slate-400 font-mono">{task.id}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{task.title}</p>
                </div>
                <div className="flex items-center gap-3">
                  {task.assignee ? <Avatar name={task.assignee.name} size="sm" /> : <UserCircle2 className="w-6 h-6 text-slate-300" />}
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500">
                    {task.storyPoints || '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Backlog;

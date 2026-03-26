import { Priority, Repository, TaskStatus } from '../types';

type TaskStatusLabelVariant = 'default' | 'kanban' | 'new-task';
type PriorityLabelVariant = 'default' | 'accented';
type RepoStatusLabelVariant = 'detail' | 'list';

type PriorityToneVariant = 'backlog-badge' | 'kanban-badge' | 'repo-text';

export const getTaskPriorityLabel = (priority: Priority, variant: PriorityLabelVariant = 'default'): string => {
  if (priority === 'low') return 'Baixa';
  if (priority === 'medium') return variant === 'accented' ? 'Média' : 'Media';
  return 'Alta';
};

export const getTaskStatusLabel = (status: TaskStatus, variant: TaskStatusLabelVariant = 'default'): string => {
  if (status === 'backlog') return 'Backlog';
  if (status === 'todo') return 'A Fazer';

  if (status === 'doing') {
    return variant === 'kanban' || variant === 'new-task' ? 'Em andamento' : 'Em Progresso';
  }

  if (status === 'review') {
    return variant === 'kanban' || variant === 'new-task' ? 'Em revisão' : 'Revisao';
  }

  if (status === 'ready') {
    if (variant === 'kanban') return 'Pronto para release';
    if (variant === 'new-task') return 'Pronta';
    return 'Pronto';
  }

  if (variant === 'new-task' || variant === 'kanban') return 'Concluído';
  return 'Concluido';
};

export const getTaskPriorityToneClass = (priority: Priority, variant: PriorityToneVariant): string => {
  if (variant === 'backlog-badge') {
    if (priority === 'high') {
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/[0.1] dark:text-red-300';
    }

    if (priority === 'medium') {
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/[0.1] dark:text-amber-300';
    }

    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300';
  }

  if (variant === 'kanban-badge') {
    if (priority === 'high') {
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    }

    if (priority === 'medium') {
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    }

    return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }

  if (priority === 'high') return 'text-red-600 dark:text-red-300';
  if (priority === 'medium') return 'text-amber-600 dark:text-amber-300';
  return 'text-blue-600 dark:text-blue-300';
};

export const getTaskStatusToneClass = (status: TaskStatus): string => {
  if (status === 'doing') {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/[0.1] dark:text-blue-300';
  }

  if (status === 'review') {
    return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/[0.1] dark:text-purple-300';
  }

  if (status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300';
  }

  if (status === 'done') {
    return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/[0.1] dark:text-amber-300';
};

export const getRepoStatusLabel = (status: Repository['status'], variant: RepoStatusLabelVariant = 'detail'): string => {
  if (status === 'active') return variant === 'list' ? 'Ativo' : 'Operando';
  if (status === 'error') return variant === 'list' ? 'Falha build' : 'Falha';
  return 'Arquivado';
};

export const getRepoStatusToneClass = (status: Repository['status']): string => {
  if (status === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300';
  }

  if (status === 'error') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/[0.1] dark:text-red-300';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300';
};

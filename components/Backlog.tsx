import React, { useMemo, useState } from 'react';
import { Task, TaskStatus, Sprint } from '../types';
import { Plus, ArrowRight, UserCircle2, Calendar, Trash2, Target, Layers3, ShieldAlert, Rocket } from 'lucide-react';
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

const getPriorityLabel = (priority: Task['priority']) => {
  switch (priority) {
    case 'high':
      return 'Alta';
    case 'medium':
      return 'Media';
    default:
      return 'Baixa';
  }
};

const getPriorityClassName = (priority: Task['priority']) => {
  switch (priority) {
    case 'high':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/[0.1] dark:text-red-300';
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/[0.1] dark:text-amber-300';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300';
  }
};

const getStatusLabel = (status: TaskStatus) => {
  switch (status) {
    case 'todo':
      return 'A Fazer';
    case 'doing':
      return 'Em Progresso';
    case 'review':
      return 'Revisao';
    case 'ready':
      return 'Pronto';
    case 'done':
      return 'Concluido';
    default:
      return 'Backlog';
  }
};

const getStatusClassName = (status: TaskStatus) => {
  switch (status) {
    case 'doing':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/[0.1] dark:text-blue-300';
    case 'review':
      return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/[0.1] dark:text-purple-300';
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300';
    case 'done':
      return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/[0.1] dark:text-amber-300';
  }
};

const planningInsetCard = 'rounded-2xl border border-slate-200/70 bg-slate-50/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

const Backlog: React.FC<BacklogProps> = ({
  tasks,
  setTasks,
  addToast,
  openNewTaskModal,
  openManageSprintsModal,
  activeSprint,
  onRefreshData,
}) => {
  const { confirm } = useConfirm();
  const [backlogParent] = useAutoAnimate();
  const [sprintParent] = useAutoAnimate();
  const [isSyncing, setIsSyncing] = useState(false);

  const backlogTasks = useMemo(() => tasks.filter((task) => task.status === 'backlog'), [tasks]);
  const sprintTasks = useMemo(() => tasks.filter((task) => task.status !== 'backlog'), [tasks]);

  const totalBacklogPoints = useMemo(
    () => backlogTasks.reduce((acc, task) => acc + (task.storyPoints || 0), 0),
    [backlogTasks]
  );
  const totalSprintPoints = useMemo(
    () => sprintTasks.reduce((acc, task) => acc + (task.storyPoints || 0), 0),
    [sprintTasks]
  );
  const highPriorityBacklogCount = useMemo(
    () => backlogTasks.filter((task) => task.priority === 'high').length,
    [backlogTasks]
  );
  const sprintReadyCount = useMemo(
    () => sprintTasks.filter((task) => task.status === 'ready' || task.status === 'done').length,
    [sprintTasks]
  );

  const moveToSprint = async (task: Task) => {
    if (!activeSprint) return;

    const updatedTask = { ...task, status: 'todo' as TaskStatus, sprintId: activeSprint.id };
    setTasks((prev) => prev.map((item) => (item.id === task.id ? updatedTask : item)));

    try {
      await api.updateTask(task.id, { status: 'todo', sprintId: activeSprint.id });
      addToast('Adicionado ao Sprint', 'success', `"${task.title}" movido para o sprint ativo.`);
    } catch {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
      addToast('Falha ao Mover', 'error', 'Nao foi possivel mover o item para o sprint.');
    }
  };

  const deleteFromBacklog = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();

    if (
      await confirm({
        title: 'Remover do Backlog',
        message: 'Deseja realmente remover este item do backlog?',
        confirmText: 'Remover',
        variant: 'danger',
      })
    ) {
      setTasks((prev) => prev.filter((task) => task.id !== id));
      try {
        await api.deleteTask(id);
        addToast('Item Removido', 'info', 'O item foi removido do backlog.');
      } catch {
        addToast('Falha ao Remover', 'error', 'Nao foi possivel remover o item. Os dados foram restaurados.');
        if (onRefreshData) onRefreshData();
      }
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const response = await api.syncGitlab();
      addToast('GitLab Sincronizado', 'success', `${response.count ?? 0} itens importados do GitLab.`);
      if (onRefreshData) onRefreshData();
    } catch (error: any) {
      addToast('Falha na Sincronizacao', 'error', error.message || 'Nao foi possivel conectar com o GitLab.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="page-container page-shell page-stack min-h-full">
      <section className="page-panel-grid xl:grid-cols-12">
        <div className="surface-card overflow-hidden rounded-[1.6rem] xl:col-span-7">
          <div className="panel-header-block border-b border-slate-200/70 bg-slate-50/45 dark:border-white/10 dark:bg-transparent">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Planejamento do Produto</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 dark:text-[var(--text-primary)]">
                  {activeSprint ? 'Backlog priorizado e sprint em andamento.' : 'Organize o escopo antes de iniciar a proxima sprint.'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                  Use esta visao para controlar entrada de escopo, risco de prioridade e comprometimento do sprint sem perder contexto de entrega.
                </p>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] shadow-sm ${activeSprint ? 'border-blue-200/80 bg-blue-50/80 text-blue-700 shadow-blue-100/60 dark:border-blue-500/20 dark:bg-blue-500/[0.1] dark:text-blue-300 dark:shadow-none' : 'border-slate-200/80 bg-slate-50/80 text-slate-700 shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none'}`}>
                <Target className="h-3.5 w-3.5" />
                {activeSprint ? `Sprint ativa: ${activeSprint.name}` : 'Sem sprint ativa'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-3">
            <div className={`${planningInsetCard} p-4`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Itens no backlog</p>
              <p className="mt-3 text-3xl font-light text-slate-800 dark:text-[var(--text-primary)]">{backlogTasks.length}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">Escopo ainda nao comprometido com a sprint ativa.</p>
            </div>
            <div className={`${planningInsetCard} border-blue-200/60 bg-blue-50/50 p-4 dark:border-white/10 dark:bg-white/[0.03]`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Capacidade em backlog</p>
              <p className="mt-3 text-3xl font-light text-slate-800 dark:text-[var(--text-primary)]">{totalBacklogPoints}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">Story points aguardando refinamento ou planejamento.</p>
            </div>
            <div className={`${planningInsetCard} ${highPriorityBacklogCount > 0 ? 'border-red-200/70 bg-red-50/55' : 'border-emerald-200/70 bg-emerald-50/55'} p-4 dark:border-white/10 dark:bg-white/[0.03]`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Risco imediato</p>
              <p className={`mt-3 text-3xl font-light ${highPriorityBacklogCount > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{highPriorityBacklogCount}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">Itens de alta prioridade ainda fora da sprint.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-200/70 bg-slate-50/35 px-6 py-4 dark:border-white/10 dark:bg-transparent">
            <button
              onClick={openNewTaskModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-900/15 transition-colors hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> Novo item
            </button>
            <button
              onClick={openManageSprintsModal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/75 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm shadow-slate-200/50 transition-colors hover:border-primary-500/30 hover:text-primary-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-secondary)] dark:hover:text-primary-300 dark:shadow-none"
            >
              <Calendar className="h-4 w-4" /> Gerenciar sprints
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/75 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm shadow-slate-200/50 transition-colors hover:border-primary-500/30 hover:text-primary-600 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-secondary)] dark:hover:text-primary-300 dark:shadow-none"
            >
              <ArrowRight className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> {isSyncing ? 'Sincronizando' : 'Sincronizar GitLab'}
            </button>
          </div>
        </div>

        <div className="surface-card panel-body-block rounded-[1.6rem] xl:col-span-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Compromisso Atual</p>
          {activeSprint ? (
            <>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-[var(--text-primary)]">{activeSprint.name}</h3>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">
                    <Calendar className="h-4 w-4" /> {activeSprint.startDate} ate {activeSprint.endDate}
                  </p>
                </div>
                <div className={`${planningInsetCard} px-4 py-3 text-right`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Pontos comprometidos</p>
                  <p className="mt-2 text-2xl font-light text-slate-800 dark:text-[var(--text-primary)]">{totalSprintPoints}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-blue-200/70 bg-blue-50/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-blue-500/20 dark:bg-blue-500/[0.08] dark:shadow-none">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">Sprint goal</p>
                <p className="mt-2 text-sm leading-6 text-blue-800 dark:text-blue-100">{activeSprint.goal || 'Defina um objetivo claro para orientar a priorizacao do sprint.'}</p>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className={`${planningInsetCard} p-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Itens na sprint</p>
                  <p className="mt-2 text-2xl font-light text-slate-800 dark:text-[var(--text-primary)]">{sprintTasks.length}</p>
                </div>
                <div className={`${planningInsetCard} border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-white/10 dark:bg-white/[0.03]`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Prontos ou concluidos</p>
                  <p className="mt-2 text-2xl font-light text-slate-800 dark:text-[var(--text-primary)]">{sprintReadyCount}</p>
                </div>
                <div className={`${planningInsetCard} p-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Acao sugerida</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-[var(--text-secondary)]">
                    {highPriorityBacklogCount > 0 ? 'Revisar itens de risco alto antes do proximo planejamento.' : 'Manter refinamento do backlog e preparar proxima reposicao.'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="surface-empty mt-4 rounded-[1.35rem] p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Nenhuma sprint ativa</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                    Crie ou ative uma sprint para comecar a comprometer itens do backlog e acompanhar capacidade de entrega.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="page-panel-grid min-h-[34rem] xl:grid-cols-2">
        <div className="surface-card flex min-h-0 flex-col overflow-hidden rounded-[1.6rem]">
          <div className="surface-header panel-header-block flex items-start justify-between gap-4 bg-slate-50/45 dark:bg-transparent">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Fila de entrada</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-800 dark:text-white">Backlog do projeto</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-muted)]">Priorize escopo, risco e refinamento antes de comprometer capacidade.</p>
            </div>
            <div className={`${planningInsetCard} px-4 py-3 text-right`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Total</p>
              <p className="mt-1 text-xl font-medium text-slate-800 dark:text-[var(--text-primary)]">{backlogTasks.length}</p>
              <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">{totalBacklogPoints} pts</p>
            </div>
          </div>

          <div ref={backlogParent} className="flex-1 space-y-3 overflow-y-auto p-4">
            {backlogTasks.map((task) => (
              <article
                key={task.id}
                className="surface-card group rounded-[1.35rem] border p-4 transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_24px_40px_-32px_rgba(14,165,233,0.18)] dark:hover:border-primary-500/25 dark:hover:shadow-xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getPriorityClassName(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                      <span className="rounded-full border border-slate-200/80 bg-white/72 px-2.5 py-1 text-[11px] font-mono text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">
                        {task.id}
                      </span>
                      {task.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-slate-200/80 bg-slate-50/72 px-2.5 py-1 text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-muted)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">{task.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                      {task.description || 'Item ainda sem descricao detalhada. Refinar criterios antes de comprometer a sprint.'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={(event) => deleteFromBacklog(event, task.id)}
                      className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/[0.12] dark:hover:text-red-300"
                      title="Remover do backlog"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/75 text-sm font-semibold text-slate-600 shadow-sm shadow-slate-200/35 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:shadow-none">
                      {task.storyPoints || '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10">
                  <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">
                    {activeSprint ? 'Pronto para comprometer no sprint atual.' : 'Ative uma sprint para mover este item para execucao.'}
                  </p>
                  <button
                    onClick={() => moveToSprint(task)}
                    disabled={!activeSprint}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/75 px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm shadow-slate-200/45 transition-colors hover:border-primary-500/30 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-secondary)] dark:hover:text-primary-300 dark:shadow-none"
                    title="Mover para sprint atual"
                  >
                    <ArrowRight className="h-4 w-4" /> Planejar na sprint
                  </button>
                </div>
              </article>
            ))}

            {backlogTasks.length === 0 && (
              <div className="surface-empty rounded-[1.35rem] px-6 py-12 text-center">
                <Layers3 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-500" />
                <h4 className="mt-4 text-base font-semibold text-slate-700 dark:text-slate-200">Backlog vazio</h4>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                  Todo o escopo atual ja foi planejado. Crie novos itens ou sincronize demandas para preparar a proxima entrega.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="surface-card flex min-h-0 flex-col overflow-hidden rounded-[1.6rem]">
          <div className="surface-header panel-header-block flex items-start justify-between gap-4 bg-slate-50/45 dark:bg-transparent">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Execucao comprometida</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-800 dark:text-white">{activeSprint ? activeSprint.name : 'Sprint ativa'}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-muted)]">
                {activeSprint ? 'Itens que ja consomem capacidade e precisam manter fluxo previsivel.' : 'Ative uma sprint para visualizar aqui o escopo comprometido.'}
              </p>
            </div>
            <div className={`${planningInsetCard} px-4 py-3 text-right`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Comprometido</p>
              <p className="mt-1 text-xl font-medium text-slate-800 dark:text-[var(--text-primary)]">{sprintTasks.length}</p>
              <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">{totalSprintPoints} pts</p>
            </div>
          </div>

          <div ref={sprintParent} className="flex-1 space-y-3 overflow-y-auto p-4">
            {sprintTasks.map((task) => (
              <article key={task.id} className="surface-card rounded-[1.35rem] border p-4 transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_24px_40px_-32px_rgba(14,165,233,0.16)] dark:hover:border-primary-500/25 dark:hover:shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getStatusClassName(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getPriorityClassName(task.priority)}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                      <span className="rounded-full border border-slate-200/80 bg-white/72 px-2.5 py-1 text-[11px] font-mono text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">
                        {task.id}
                      </span>
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">{task.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                      {task.description || 'Item comprometido sem descricao detalhada. Vale revisar contexto e criterio de aceite.'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {task.assignee ? <Avatar name={task.assignee.name} size="sm" /> : <UserCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-500" />}
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/75 text-sm font-semibold text-slate-600 shadow-sm shadow-slate-200/35 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:shadow-none">
                      {task.storyPoints || '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[var(--text-muted)]">
                    {task.assignee ? (
                      <span>Responsavel: {task.assignee.name}</span>
                    ) : (
                      <span>Sem responsavel definido</span>
                    )}
                    {task.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-200/80 bg-slate-50/72 px-2.5 py-1 text-[11px] dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300">
                    <Rocket className="h-3.5 w-3.5" /> Em entrega
                  </div>
                </div>
              </article>
            ))}

            {sprintTasks.length === 0 && (
              <div className="surface-empty rounded-[1.35rem] px-6 py-12 text-center">
                <Rocket className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-500" />
                <h4 className="mt-4 text-base font-semibold text-slate-700 dark:text-slate-200">Nenhum item comprometido</h4>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                  Assim que houver uma sprint ativa, os itens planejados aparecerao aqui com foco em capacidade e acompanhamento de entrega.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Backlog;

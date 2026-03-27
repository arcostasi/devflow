
import React, { useMemo, useState } from 'react';
import { ActivityLog, GitIntegrationTab, Task, Repository, ViewState } from '../types';
import { GitPullRequest, GitCommit, GitMerge, AlertCircle, FolderGit2, AlertTriangle, ArrowRight, Plus, ExternalLink, X, ShieldCheck, Boxes, Rocket } from 'lucide-react';
import Avatar from './Avatar';

interface DashboardProps {
  tasks: Task[];
  repositories: Repository[];
  activities: ActivityLog[];
  isLoading?: boolean;
  onNavigate: (view: ViewState) => void;
  onCreateTask: () => void;
  onCreateRepo: () => void;
  onOpenRepo: (id: string) => void;
  onOpenRepoInGit: (id: string, tab?: GitIntegrationTab) => void;
  onOpenEnvironment: (environmentId: string, repoId?: string | null) => void;
  onOpenTask: (task: Task) => void;
  stats?: {
    totalCommits: number;
    weeklyCommits: number;
    contributions: Record<string, number>;
    failedRepos: number;
    failedRepoDetails?: { id: string; name: string; reason: string }[];
  };
}

const dashboardDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDashboardTimestamp = (timestamp: string) => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  return dashboardDateFormatter.format(parsed);
};

const parseActivityMeta = (meta?: string) => {
  if (!meta) return null;

  const trimmedMeta = meta.trim();
  if (!(trimmedMeta.startsWith('{') && trimmedMeta.endsWith('}'))) {
    return null;
  }

  try {
    return JSON.parse(trimmedMeta) as Record<string, string>;
  } catch {
    return null;
  }
};

const getActivityMetaLabel = (log: ActivityLog) => {
  if (!log.meta) return null;

  const trimmedMeta = log.meta.trim();
  if (!trimmedMeta) return null;

  const parsed = parseActivityMeta(trimmedMeta);
  if (parsed) {
    if (parsed.taskId) return 'Tarefa rastreada';
    if (parsed.sprintId) return 'Sprint rastreada';
    if (parsed.environmentId) return 'Ambiente rastreado';
    if (parsed.repoId) return 'Repositório rastreado';
    if (parsed.pipelineId) return 'Pipeline rastreado';
  }

  return trimmedMeta;
};

const ContributionGraph: React.FC<{ data?: Record<string, number> }> = React.memo(({ data = {} }) => {
  const weeks = 52;
  const days = 7;

  // Gerar dados do gráfico baseado nas datas reais
  const graphData = useMemo(() => {
    // Calcular data de início para terminar na semana atual
    const today = new Date();
    const currentWeekSunday = new Date(today);
    currentWeekSunday.setDate(today.getDate() - today.getDay());
    currentWeekSunday.setHours(0, 0, 0, 0);

    const startDate = new Date(currentWeekSunday);
    startDate.setDate(currentWeekSunday.getDate() - ((weeks - 1) * 7));

    const currentDate = new Date(startDate);
    const result = [];

    for (let w = 0; w < weeks; w++) {
      const weekData = [];
      for (let d = 0; d < days; d++) {
        // Usar data local para evitar problemas de fuso horário com toISOString
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayDate = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayDate}`;
        const count = data[dateStr] || 0;

        let intensity = 0;
        if (count > 0) intensity = 1;
        if (count > 2) intensity = 2;
        if (count > 5) intensity = 3;
        if (count > 10) intensity = 4;

        weekData.push({ date: dateStr, count, intensity });

        // Avançar um dia
        currentDate.setDate(currentDate.getDate() + 1);
      }
      result.push(weekData);
    }
    return result;
  }, [data]);

  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex gap-[3px] min-w-max">
        {graphData.map((weekData, wIndex) => (
          <div key={weekData[0]?.date || `week-${wIndex}`} className="flex flex-col gap-[3px]">
            {weekData.map((day) => {
              let colorClass = 'bg-slate-200 dark:bg-slate-700/80 ring-1 ring-slate-300/30 dark:ring-slate-600/50';
              if (day.intensity === 1) colorClass = 'bg-emerald-200 dark:bg-emerald-900';
              if (day.intensity === 2) colorClass = 'bg-emerald-300 dark:bg-emerald-700';
              if (day.intensity === 3) colorClass = 'bg-emerald-400 dark:bg-emerald-500';
              if (day.intensity === 4) colorClass = 'bg-emerald-600 dark:bg-emerald-400';

              return (
                <div
                  key={day.date}
                  className={`w-[11px] h-[11px] rounded-[1px] transition-colors duration-300 ${colorClass}`}
                  title={`${day.count} contribuições em ${day.date}`}
                ></div>
              );
            })}
          </div>
        ))}
      </div>
      {/* ... leganda ... */}
      <div className="flex justify-end items-center mt-3 text-xs text-slate-500 dark:text-slate-400 gap-2">
        <span>Menos</span>
        <div className="w-[11px] h-[11px] bg-slate-200 dark:bg-slate-700/80 ring-1 ring-slate-300/30 dark:ring-slate-600/50 rounded-[1px]"></div>
        <div className="w-[11px] h-[11px] bg-emerald-200 dark:bg-emerald-900 rounded-[1px]"></div>
        <div className="w-[11px] h-[11px] bg-emerald-400 dark:bg-emerald-500 rounded-[1px]"></div>
        <div className="w-[11px] h-[11px] bg-emerald-600 dark:bg-emerald-400 rounded-[1px]"></div>
        <span>Mais</span>
      </div>
    </div>
  );
});

const getRepoActionLabel = (targetType: ActivityLog['targetType']) => (
  targetType === 'commit' ? 'Abrir commits' : 'Abrir repositório'
);

const actionPillClassName = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/78 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm shadow-slate-200/40 transition-all hover:border-primary-500/25 hover:text-primary-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none dark:hover:text-primary-300';
const workspaceSignalIconWrap = 'flex h-12 w-12 min-w-12 items-center justify-center rounded-2xl border bg-white/78 shadow-sm dark:shadow-none';

const ActivityItem: React.FC<{
  log: ActivityLog;
  task?: Task;
  repo?: Repository;
  onOpenTask: (task: Task) => void;
  onOpenRepo: (id: string) => void;
  onOpenRepoInGit: (id: string, tab?: GitIntegrationTab) => void;
  onOpenEnvironment: (environmentId: string, repoId?: string | null) => void;
  onNavigate: (view: ViewState) => void;
}> = React.memo(({ log, task, repo, onOpenTask, onOpenRepo, onOpenRepoInGit, onOpenEnvironment, onNavigate }) => {
  const getIcon = () => {
    switch (log.targetType) {
      case 'pr': return <GitPullRequest className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'commit': return <GitCommit className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'issue': return <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case 'sprint': return <Boxes className="w-4 h-4 text-violet-600 dark:text-violet-300" />;
      case 'environment': return <Rocket className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />;
      default: return <GitMerge className="w-4 h-4 text-slate-500" />;
    }
  };

  const userName = log.user?.name || 'Usuário Desconhecido';
  const metaLabel = getActivityMetaLabel(log);
  const timestampLabel = formatDashboardTimestamp(log.timestamp);
  const parsedMeta = parseActivityMeta(log.meta);

  const activityAction = (() => {
    if (log.targetType === 'issue') {
      if (task) {
        return {
          label: 'Abrir tarefa',
          handler: () => onOpenTask(task),
        };
      }

      return {
        label: 'Ir para sprint',
        handler: () => onNavigate(ViewState.KANBAN),
      };
    }

    if (log.targetType === 'sprint') {
      return {
        label: 'Abrir sprint',
        handler: () => onNavigate(ViewState.KANBAN),
      };
    }

    if (log.targetType === 'environment') {
      if (parsedMeta?.environmentId) {
        return {
          label: 'Abrir ambiente',
          handler: () => onOpenEnvironment(parsedMeta.environmentId, parsedMeta.repoId || repo?.id || null),
        };
      }

      return {
        label: 'Ver ambientes',
        handler: () => onNavigate(ViewState.ENVIRONMENTS),
      };
    }

    if (log.targetType === 'commit') {
      if (repo) {
        return {
          label: getRepoActionLabel(log.targetType),
          handler: () => onOpenRepoInGit(repo.id, 'changes'),
        };
      }

      return {
        label: 'Ver commits',
        handler: () => onNavigate(ViewState.GIT),
      };
    }

    if (log.targetType === 'repo' || log.targetType === 'pr') {
      if (repo) {
        return {
          label: log.targetType === 'pr' ? 'Abrir revisão' : getRepoActionLabel(log.targetType),
          handler: () => onOpenRepo(repo.id),
        };
      }

      return {
        label: log.targetType === 'pr' ? 'Ver revisões' : 'Ver repositórios',
        handler: () => onNavigate(log.targetType === 'pr' ? ViewState.GIT : ViewState.REPOS),
      };
    }

    return null;
  })();

  const canNavigate = Boolean(activityAction);
  const handlePrimaryAction = () => {
    if (!activityAction) return;
    activityAction.handler();
  };

  return (
    <div className="group flex items-start gap-3 rounded-2xl border border-slate-200/55 bg-slate-50/55 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.56)] transition-all hover:border-slate-200/80 hover:bg-slate-50/85 hover:shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.62)] dark:border-white/5 dark:bg-white/[0.015] dark:shadow-none dark:hover:border-white/10 dark:hover:bg-white/[0.03]">
      <div className="mt-1">
        <Avatar name={userName} size="md" />
      </div>
      <div className="flex-1">
        <div className="text-sm leading-relaxed text-slate-700 dark:text-[var(--text-secondary)]">
          <span className="font-semibold text-slate-800 dark:text-white">{userName}</span>{' '}
          <span className="text-slate-500 dark:text-[var(--text-muted)]">{log.action}</span>{' '}
          {canNavigate ? (
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="cursor-pointer font-medium text-primary-600 transition-colors hover:text-primary-700 hover:underline focus:outline-none focus:underline dark:text-primary-300 dark:hover:text-primary-200"
            >
              {log.target}
            </button>
          ) : (
            <span className="font-medium text-primary-600 dark:text-primary-300">
              {log.target}
            </span>
          )}
        </div>
        {metaLabel && (
          <div className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/72 px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">
            {getIcon()} {metaLabel}
          </div>
        )}
        {activityAction && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className={actionPillClassName}
            >
              {activityAction.label} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{timestampLabel}</div>
      </div>
      <div className="mt-1 opacity-70 group-hover:opacity-100 transition-opacity">{getIcon()}</div>
    </div>
  );
});

interface MetricCardProps {
  title: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
  tone?: 'default' | 'warning' | 'success' | 'info' | 'accent';
  onClick?: () => void;
  className?: string;
}

const metricToneMap: Record<NonNullable<MetricCardProps['tone']>, { card: string; icon: string }> = {
  default: {
    card: 'border-slate-200/70 bg-slate-50/75 text-slate-800 shadow-[0_22px_42px_-34px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:shadow-none',
    icon: 'border-white/70 bg-white/80 text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:shadow-none',
  },
  warning: {
    card: 'border-orange-200/75 bg-orange-50/65 text-orange-700 shadow-[0_22px_42px_-34px_rgba(249,115,22,0.18)] dark:border-orange-500/20 dark:bg-orange-500/[0.08] dark:text-orange-200 dark:shadow-none',
    icon: 'border-orange-100/80 bg-white/72 text-orange-600 shadow-sm dark:border-orange-500/20 dark:bg-orange-500/[0.1] dark:text-orange-200 dark:shadow-none',
  },
  success: {
    card: 'border-emerald-200/75 bg-emerald-50/65 text-emerald-700 shadow-[0_22px_42px_-34px_rgba(16,185,129,0.18)] dark:border-emerald-500/20 dark:bg-emerald-500/[0.08] dark:text-emerald-200 dark:shadow-none',
    icon: 'border-emerald-100/80 bg-white/72 text-emerald-600 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-200 dark:shadow-none',
  },
  info: {
    card: 'border-blue-200/75 bg-blue-50/65 text-blue-700 shadow-[0_22px_42px_-34px_rgba(59,130,246,0.18)] dark:border-blue-500/20 dark:bg-blue-500/[0.08] dark:text-blue-200 dark:shadow-none',
    icon: 'border-blue-100/80 bg-white/72 text-blue-600 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/[0.1] dark:text-blue-200 dark:shadow-none',
  },
  accent: {
    card: 'border-violet-200/75 bg-violet-50/65 text-violet-700 shadow-[0_22px_42px_-34px_rgba(139,92,246,0.18)] dark:border-purple-500/20 dark:bg-purple-500/[0.08] dark:text-purple-200 dark:shadow-none',
    icon: 'border-violet-100/80 bg-white/72 text-violet-600 shadow-sm dark:border-purple-500/20 dark:bg-purple-500/[0.1] dark:text-purple-200 dark:shadow-none',
  },
};

const executiveInsetCard = 'rounded-2xl border border-slate-200/70 bg-slate-50/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

const MetricCard: React.FC<MetricCardProps> = ({ title, value, helper, icon, tone = 'default', onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`surface-card group flex h-full flex-col justify-between rounded-[1.35rem] border p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_26px_46px_-34px_rgba(14,165,233,0.2)] dark:hover:border-primary-500/30 dark:hover:shadow-xl ${metricToneMap[tone].card} ${className}`}
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">{title}</p>
        <p className="mt-3 text-3xl font-light tracking-tight text-slate-900 dark:text-[var(--text-primary)]">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform group-hover:scale-105 ${metricToneMap[tone].icon}`}>
        {icon}
      </div>
    </div>
    <p className="mt-6 text-sm text-slate-500 dark:text-[var(--text-muted)]">{helper}</p>
  </button>
);

const getSystemStatusLabel = (isSystemStable: boolean, failedRepoCount: number): string => {
  if (isSystemStable) return 'Estavel';
  return `${failedRepoCount} Falha${failedRepoCount > 1 ? 's' : ''}`;
};

const getRepoStatusDotClass = (isBroken: boolean, status: Repository['status']): string => {
  if (isBroken) return 'bg-red-500 shadow-red-500/30 animate-pulse';
  if (status === 'active') return 'bg-emerald-500 shadow-emerald-500/30';
  return 'bg-slate-400';
};

const Dashboard: React.FC<DashboardProps> = ({ tasks, repositories, activities, isLoading = false, onNavigate, onCreateTask, onCreateRepo, onOpenRepo, onOpenRepoInGit, onOpenEnvironment, onOpenTask, stats }) => {
  const openIssuesCount = useMemo(() => tasks.filter(t => t.status !== 'done').length, [tasks]);
  const reviewsCount = useMemo(() => tasks.filter(t => t.status === 'review').length, [tasks]);
  const readyForReleaseCount = useMemo(() => tasks.filter(t => t.status === 'ready').length, [tasks]);
  const activeReposCount = useMemo(() => repositories.filter(r => r.status === 'active').length, [repositories]);

  // Usar failedRepos do stats se disponível
  const failedRepoCount = stats ? stats.failedRepos : repositories.filter(r => r.status === 'error').length;
  const failedRepoDetails = stats?.failedRepoDetails || [];
  const isSystemStable = failedRepoCount === 0;

  // Usar weeklyCommits do stats se disponível
  const weeklyCommits = stats ? stats.weeklyCommits : activities.filter(a => a.targetType === 'commit').length;

  const displayedRepos = useMemo(() => repositories.slice(0, 5), [repositories]);
  const taskById = useMemo(
    () => new Map(tasks.map(task => [task.id, task])),
    [tasks]
  );
  const repoById = useMemo(
    () => new Map(repositories.map(repo => [repo.id, repo])),
    [repositories]
  );
  const taskByTitle = useMemo(
    () => new Map(tasks.map(task => [task.title.trim().toLocaleLowerCase('pt-BR'), task])),
    [tasks]
  );
  const repoByName = useMemo(
    () => new Map(repositories.map(repo => [repo.name.trim().toLocaleLowerCase('pt-BR'), repo])),
    [repositories]
  );
  const firstReadyTask = useMemo(() => tasks.find((task) => task.status === 'ready'), [tasks]);

  const [showFailedPanel, setShowFailedPanel] = useState(false);
  const [visibleActivityCount, setVisibleActivityCount] = useState(5);

  const getRelatedRepoFromLog = (log: ActivityLog) => {
    const parsed = parseActivityMeta(log.meta);
    if (parsed?.repoId) {
      return repoById.get(parsed.repoId);
    }

    if (!log.meta) {
      return repoByName.get(log.target.trim().toLocaleLowerCase('pt-BR'));
    }

    return repoByName.get(log.target.trim().toLocaleLowerCase('pt-BR'));
  };

  return (
    <div className="page-container page-shell page-stack">
      <section className="page-panel-grid xl:grid-cols-[minmax(0,2fr)_22rem]">
        <div className="surface-card overflow-hidden rounded-[1.6rem]">
          <div className="panel-header-block border-b border-slate-200/70 bg-slate-50/45 dark:border-white/10 dark:bg-transparent">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Panorama Executivo</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-800 dark:text-[var(--text-primary)]">
                  {isSystemStable ? 'Entrega estável e pronta para operar.' : 'Existem bloqueios de infraestrutura e fluxo.'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                  {isSystemStable
                    ? 'Use o quadro e os repositórios para acelerar o fluxo de entrega sem perder visibilidade.'
                    : 'Reveja os repositórios com falha antes de puxar novas entregas para a sprint ativa.'}
                </p>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] shadow-sm ${isSystemStable ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700 shadow-emerald-100/60 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300 dark:shadow-none' : 'border-red-200/80 bg-red-50/80 text-red-700 shadow-red-100/60 dark:border-red-500/20 dark:bg-red-500/[0.1] dark:text-red-300 dark:shadow-none'}`}>
                {isSystemStable ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {getSystemStatusLabel(isSystemStable, failedRepoCount)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-3">
            <button type="button" onClick={() => onNavigate(ViewState.REPOS)} className={`${executiveInsetCard} p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_22px_34px_-30px_rgba(14,165,233,0.16)]`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Repositórios ativos</p>
              <p className="mt-3 text-3xl font-light text-slate-800 dark:text-[var(--text-primary)]">{activeReposCount}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">Base operacional em monitoramento contínuo.</p>
            </button>
            <button
              type="button"
              onClick={() => firstReadyTask ? onOpenTask(firstReadyTask) : onNavigate(ViewState.KANBAN)}
              className={`${executiveInsetCard} border-blue-200/60 bg-blue-50/50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_22px_34px_-30px_rgba(14,165,233,0.16)] dark:border-white/10 dark:bg-white/[0.03]`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Prontas para release</p>
              <p className="mt-3 text-3xl font-light text-slate-800 dark:text-[var(--text-primary)]">{readyForReleaseCount}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">Itens já preparados para promover entrega.</p>
            </button>
            <button
              type="button"
              onClick={() => failedRepoCount > 0 ? setShowFailedPanel(true) : onNavigate(ViewState.REPOS)}
              className={`${executiveInsetCard} ${failedRepoCount > 0 ? 'border-red-200/70 bg-red-50/55' : 'border-emerald-200/70 bg-emerald-50/55'} p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_22px_34px_-30px_rgba(14,165,233,0.16)] dark:border-white/10 dark:bg-white/[0.03]`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Risco atual</p>
              <p className={`mt-3 text-3xl font-light ${failedRepoCount > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{failedRepoCount}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">Repositórios exigindo ação imediata.</p>
            </button>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200/70 bg-slate-50/35 px-6 py-4 dark:border-white/10 dark:bg-transparent">
            <button
              onClick={onCreateTask}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-900/15 transition-colors hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> Nova tarefa
            </button>
            <button
              onClick={onCreateRepo}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/75 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm shadow-slate-200/50 transition-colors hover:border-primary-500/30 hover:text-primary-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-secondary)] dark:hover:text-primary-300 dark:shadow-none"
            >
              <FolderGit2 className="h-4 w-4" /> Novo repositório
            </button>
            {!isSystemStable && (
              <button
                onClick={() => setShowFailedPanel(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/[0.08] dark:text-red-300 dark:hover:bg-red-500/[0.12]"
              >
                <ExternalLink className="h-4 w-4" /> Ver riscos do sistema
              </button>
            )}
          </div>
        </div>

        <div className="panel-stack-tight">
          <MetricCard
            title="Issues abertas"
            value={openIssuesCount}
            helper="Trabalho ainda em aberto no fluxo atual."
            tone="warning"
            onClick={() => onNavigate(ViewState.KANBAN)}
            icon={<AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-300" />}
          />
          <MetricCard
            title="Em revisão"
            value={reviewsCount}
            helper="Itens aguardando QA, revisão ou merge."
            tone="accent"
            onClick={() => onNavigate(ViewState.KANBAN)}
            icon={<GitPullRequest className="h-6 w-6 text-purple-600 dark:text-purple-300" />}
          />
          <MetricCard
            title="Commits da semana"
            value={weeklyCommits}
            helper="Indicador rápido de cadência técnica."
            tone="info"
            onClick={() => onNavigate(ViewState.GIT)}
            icon={<GitCommit className="h-6 w-6 text-blue-600 dark:text-blue-300" />}
          />
        </div>
      </section>

      <div className="page-panel-grid xl:grid-cols-[minmax(0,2fr)_22rem]">
        <div className="surface-card panel-body-block rounded-[1.6rem]">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Fluxo de Entrega</p>
              <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-white">
                <ActivityLogIcon className="w-5 h-5 text-primary-500" />
                Histórico de Contribuições
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-[var(--text-muted)]">Visão compacta da atividade técnica das últimas 52 semanas.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`${executiveInsetCard} px-4 py-3`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Commits</p>
                <p className="mt-2 text-xl font-medium text-slate-800 dark:text-[var(--text-primary)]">{stats?.totalCommits ?? weeklyCommits}</p>
              </div>
              <div className={`${executiveInsetCard} px-4 py-3`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Repos online</p>
                <p className="mt-2 text-xl font-medium text-slate-800 dark:text-[var(--text-primary)]">{activeReposCount}</p>
              </div>
            </div>
          </div>
          <ContributionGraph data={stats?.contributions} />
        </div>

        <div className="surface-card panel-body-block rounded-[1.6rem]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Sinais do Workspace</p>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-emerald-200/65 bg-emerald-50/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <div className="flex items-center gap-3">
                <div className={`${workspaceSignalIconWrap} border-emerald-100/80 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08] dark:text-emerald-300`}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-[var(--text-primary)]">Saúde do sistema</p>
                  <p className="text-sm text-slate-500 dark:text-[var(--text-muted)]">{isSystemStable ? 'Sem impedimentos críticos na infraestrutura.' : 'Existem falhas que impactam o fluxo.'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-blue-200/65 bg-blue-50/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <div className="flex items-center gap-3">
                <div className={`${workspaceSignalIconWrap} border-blue-100/80 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/[0.08] dark:text-blue-300`}>
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-[var(--text-primary)]">Cobertura operacional</p>
                  <p className="text-sm text-slate-500 dark:text-[var(--text-muted)]">{repositories.length} repositórios mapeados no workspace.</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-violet-200/65 bg-violet-50/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <div className="flex items-center gap-3">
                <div className={`${workspaceSignalIconWrap} border-violet-100/80 text-violet-600 dark:border-purple-500/20 dark:bg-purple-500/[0.08] dark:text-purple-300`}>
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-[var(--text-primary)]">Prontas para release</p>
                  <p className="text-sm text-slate-500 dark:text-[var(--text-muted)]">{readyForReleaseCount} itens já podem seguir para entrega.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Failed Repos Detail Panel */}
      {showFailedPanel && failedRepoDetails.length > 0 && (
        <div className="animate-in slide-in-from-top-2 rounded-[1.35rem] border border-red-200 bg-red-50/90 p-5 dark:border-red-800/40 dark:bg-red-900/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-red-700 dark:text-red-300">Repositórios com Problemas</h3>
            </div>
            <button onClick={() => setShowFailedPanel(false)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
          <div className="space-y-2">
            {failedRepoDetails.map(repo => (
              <button
                type="button"
                key={repo.id}
                onClick={() => { onOpenRepo(repo.id); setShowFailedPanel(false); }}
                className="group/item flex w-full items-center justify-between rounded-2xl border border-red-100 bg-white p-3 text-left transition-all hover:border-red-300 dark:border-red-900/30 dark:bg-white/[0.03] dark:hover:border-red-700"
              >
                <div className="flex items-center gap-3">
                  <FolderGit2 className="w-4 h-4 text-red-400" />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover/item:text-red-600 dark:group-hover/item:text-red-300 transition-colors">{repo.name}</span>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{repo.reason}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover/item:text-red-400 transition-colors" />
              </button>
            ))}
          </div>
          <button
            onClick={() => { onNavigate(ViewState.REPOS); setShowFailedPanel(false); }}
            className="mt-3 text-xs font-medium text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
          >
            Ver todos os repositórios <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="page-panel-grid xl:grid-cols-[minmax(0,2fr)_22rem]">
        {/* Activity Feed */}
        <div className="surface-card overflow-hidden rounded-[1.6rem]">
          <div className="surface-header panel-header-compact flex items-center justify-between bg-slate-50/45 dark:bg-transparent">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Fluxo recente</p>
              <h3 className="mt-1 font-semibold text-slate-800 dark:text-white">Timeline Operacional</h3>
            </div>
            <button
              onClick={() => onNavigate(ViewState.GIT)}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-300"
            >
              Ver tudo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3 p-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={`activity-skeleton-${index}`} className="rounded-2xl border border-slate-200/55 bg-slate-50/55 px-4 py-4 dark:border-white/5 dark:bg-white/[0.015]">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                      <div className="h-3 w-2/5 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                      <div className="h-3 w-1/4 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                    </div>
                  </div>
                </div>
              ))
            ) : activities.slice(0, visibleActivityCount).map(log => (
              <ActivityItem
                key={log.id}
                log={log}
                task={log.targetType === 'issue'
                  ? (log.taskId ? taskById.get(log.taskId) : taskByTitle.get(log.target.trim().toLocaleLowerCase('pt-BR')))
                  : undefined}
                repo={log.targetType === 'issue' ? undefined : getRelatedRepoFromLog(log)}
                onOpenTask={onOpenTask}
                onOpenRepo={onOpenRepo}
                onOpenRepoInGit={onOpenRepoInGit}
                onOpenEnvironment={onOpenEnvironment}
                onNavigate={onNavigate}
              />
            ))}
            {!isLoading && activities.length === 0 && (
              <div className="surface-empty rounded-2xl bg-slate-50/55 py-12 text-center text-sm text-slate-400 dark:bg-transparent dark:text-[var(--text-muted)]">Nenhuma atividade recente.</div>
            )}
            {!isLoading && activities.length > visibleActivityCount && (
              <button
                type="button"
                onClick={() => setVisibleActivityCount(prev => prev + 10)}
                className="w-full mt-2 rounded-xl border border-slate-200/70 bg-slate-50/72 py-2.5 text-sm font-medium text-primary-600 shadow-sm shadow-slate-200/45 transition-all hover:border-primary-500/30 hover:bg-blue-50/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-primary-300 dark:hover:bg-white/[0.04] dark:shadow-none"
              >
                Carregar mais atividades
              </button>
            )}
          </div>
        </div>

        {/* Side Panel: Quick Repos */}
        <div className="surface-card flex h-fit flex-col overflow-hidden rounded-[1.6rem]">
          <div className="surface-header panel-header-compact flex items-center justify-between bg-slate-50/45 dark:bg-transparent">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Portfólio técnico</p>
              <h3 className="mt-1 font-semibold text-slate-800 dark:text-white">Meus Repositórios</h3>
            </div>
            <button
              onClick={() => onNavigate(ViewState.REPOS)}
              className="text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="p-4 flex-1">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`repo-skeleton-${index}`} className="rounded-2xl border border-slate-200/70 bg-slate-50/58 p-3 dark:border-white/10 dark:bg-white/[0.015]">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/[0.08]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                        <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                      <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.08]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayedRepos.length === 0 ? (
              <div className="surface-empty rounded-2xl bg-slate-50/55 py-8 text-center text-xs italic text-slate-400 dark:bg-transparent">
                Nenhum repositório encontrado.
              </div>
            ) : (
              <>
                {displayedRepos.map(repo => {
                  const isBroken = repo.pathMissing || failedRepoDetails.some(f => f.id === repo.id);
                  return (
                    <article
                      key={repo.id}
                      className={`mb-3 flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-all group ${isBroken ? 'border-red-200/60 bg-red-50/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.56)] hover:border-red-200/90 hover:bg-red-50/80 hover:shadow-[0_18px_34px_-30px_rgba(239,68,68,0.2),inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-red-900/30 dark:bg-white/[0.03] dark:shadow-none dark:hover:border-red-700 dark:hover:bg-red-900/10' : 'border-slate-200/70 bg-slate-50/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.56)] hover:border-primary-500/20 hover:bg-slate-50/85 hover:shadow-[0_18px_34px_-30px_rgba(14,165,233,0.18),inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/10 dark:bg-white/[0.015] dark:shadow-none dark:hover:bg-white/[0.04]'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onOpenRepo(repo.id)}
                          className="flex w-full items-center justify-between gap-3 text-left"
                        >
                          <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                            {isBroken
                              ? <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                              : <FolderGit2 className="w-5 h-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-primary-500" />
                            }
                            <div className="overflow-hidden">
                              <span className={`block truncate text-sm font-medium ${isBroken ? 'text-red-600 dark:text-red-300' : 'text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-300'}`}>
                                {repo.name}
                              </span>
                              <span className={`mt-0.5 block truncate text-[10px] ${isBroken ? 'text-red-400 dark:text-red-500' : 'text-slate-500 dark:text-slate-500'}`}>
                                {isBroken ? failedRepoDetails.find(f => f.id === repo.id)?.reason || 'Diretório não encontrado' : repo.description || 'Repositório conectado ao workspace'}
                              </span>
                            </div>
                          </div>
                          <span className={`w-2.5 h-2.5 flex-shrink-0 rounded-full shadow-sm ${getRepoStatusDotClass(isBroken, repo.status)}`}></span>
                        </button>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenRepo(repo.id);
                            }}
                            className={actionPillClassName}
                          >
                            Código
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenRepoInGit(repo.id, 'changes');
                            }}
                            className={actionPillClassName}
                          >
                            Commits
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </>
            )}

            <div className="mt-4 space-y-3 border-t border-slate-200/60 pt-4 dark:border-white/10">
              <button
                onClick={onCreateRepo}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300/90 bg-slate-50/72 py-2.5 text-sm font-medium text-primary-600 shadow-sm shadow-slate-200/45 transition-all hover:border-primary-500/50 hover:bg-blue-50/70 dark:border-white/10 dark:bg-white/[0.02] dark:text-primary-300 dark:hover:bg-white/[0.04] dark:shadow-none"
              >
                <FolderGit2 className="w-4 h-4" /> Novo Repositório
              </button>
              <button
                onClick={onCreateTask}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/72 py-2.5 text-sm font-medium text-slate-600 shadow-sm shadow-slate-200/45 transition-all hover:border-slate-300 hover:bg-slate-100/80 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:shadow-none dark:hover:bg-white/[0.08]"
              >
                <Plus className="w-4 h-4" /> Nova Tarefa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityLogIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 7V21M12 7H16M12 7H8M12 7L7 3M12 7L17 3M21 12H18M3 12H6M10 16H6M14 16H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Dashboard;

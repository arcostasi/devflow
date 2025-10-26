
import React, { useMemo, useState } from 'react';
import { ActivityLog, Task, Repository, ViewState } from '../types';
import { GitPullRequest, GitCommit, GitMerge, AlertCircle, CheckCircle2, FolderGit2, AlertTriangle, ArrowRight, Plus, ExternalLink, X } from 'lucide-react';
import Avatar from './Avatar';

interface DashboardProps {
  tasks: Task[];
  repositories: Repository[];
  activities: ActivityLog[];
  onNavigate: (view: ViewState) => void;
  onCreateTask: () => void;
  onCreateRepo: () => void;
  onOpenRepo: (id: string) => void;
  stats?: {
    totalCommits: number;
    weeklyCommits: number;
    contributions: Record<string, number>;
    failedRepos: number;
    failedRepoDetails?: { id: string; name: string; reason: string }[];
  };
}

const ContributionGraph: React.FC<{ data?: Record<string, number> }> = ({ data = {} }) => {
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
          <div key={wIndex} className="flex flex-col gap-[3px]">
            {weekData.map((day, dIndex) => {
              let colorClass = 'bg-slate-200 dark:bg-slate-700/80 ring-1 ring-slate-300/30 dark:ring-slate-600/50';
              if (day.intensity === 1) colorClass = 'bg-emerald-200 dark:bg-emerald-900';
              if (day.intensity === 2) colorClass = 'bg-emerald-300 dark:bg-emerald-700';
              if (day.intensity === 3) colorClass = 'bg-emerald-400 dark:bg-emerald-500';
              if (day.intensity === 4) colorClass = 'bg-emerald-600 dark:bg-emerald-400';

              return (
                <div
                  key={`${wIndex}-${dIndex}`}
                  className={`w-[11px] h-[11px] rounded-[1px] transition-colors duration-300 ${colorClass}`}
                  title={`${day.count} contribuições em ${day.date}`}
                ></div>
              );
            })}
          </div>
        ))}
      </div>
      {/* ... leganda ... */}
      <div className="flex justify-end items-center mt-3 text-xs text-fiori-textSecondary dark:text-fiori-textSecondaryDark gap-2">
        <span>Menos</span>
        <div className="w-[11px] h-[11px] bg-slate-200 dark:bg-slate-700/80 ring-1 ring-slate-300/30 dark:ring-slate-600/50 rounded-[1px]"></div>
        <div className="w-[11px] h-[11px] bg-emerald-200 dark:bg-emerald-900 rounded-[1px]"></div>
        <div className="w-[11px] h-[11px] bg-emerald-400 dark:bg-emerald-500 rounded-[1px]"></div>
        <div className="w-[11px] h-[11px] bg-emerald-600 dark:bg-emerald-400 rounded-[1px]"></div>
        <span>Mais</span>
      </div>
    </div>
  );
};

const ActivityItem: React.FC<{ log: ActivityLog }> = ({ log }) => {
  const getIcon = () => {
    switch (log.targetType) {
      case 'pr': return <GitPullRequest className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'commit': return <GitCommit className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'issue': return <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      default: return <GitMerge className="w-4 h-4 text-slate-500" />;
    }
  };

  const userName = log.user?.name || 'Usuário Desconhecido';

  return (
    <div className="flex items-start py-4 border-b border-slate-100 dark:border-slate-600/25 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/60 px-4 -mx-4 transition-colors group">
      <div className="mr-3 mt-1">
        <Avatar name={userName} size="md" />
      </div>
      <div className="flex-1">
        <div className="text-sm text-fiori-textPrimary dark:text-fiori-textPrimaryDark leading-relaxed">
          <span className="font-semibold text-fiori-textPrimary dark:text-white">{userName}</span>{' '}
          <span className="text-slate-500 dark:text-slate-400">{log.action}</span>{' '}
          <span className="font-medium text-fiori-link dark:text-fiori-linkDark hover:underline cursor-pointer transition-colors">
            {log.target}
          </span>
        </div>
        {log.meta && (
          <div className="flex items-center mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-800/70 w-fit px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600/30">
            <GitCommit className="w-3 h-3 mr-1.5" /> {log.meta}
          </div>
        )}
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{log.timestamp}</div>
      </div>
      <div className="mt-1 opacity-70 group-hover:opacity-100 transition-opacity">{getIcon()}</div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ tasks, repositories, activities, onNavigate, onCreateTask, onCreateRepo, onOpenRepo, stats }) => {

  const openIssuesCount = useMemo(() => tasks.filter(t => t.status !== 'done').length, [tasks]);
  const reviewsCount = useMemo(() => tasks.filter(t => t.status === 'review').length, [tasks]);

  // Usar failedRepos do stats se disponível
  const failedRepoCount = stats ? stats.failedRepos : repositories.filter(r => r.status === 'error').length;
  const failedRepoDetails = stats?.failedRepoDetails || [];
  const isSystemStable = failedRepoCount === 0;

  // Usar weeklyCommits do stats se disponível
  const weeklyCommits = stats ? stats.weeklyCommits : activities.filter(a => a.targetType === 'commit').length;

  const displayedRepos = useMemo(() => repositories.slice(0, 5), [repositories]);

  const [showFailedPanel, setShowFailedPanel] = useState(false);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Issues Abertas */}
        <div
          onClick={() => onNavigate(ViewState.KANBAN)}
          className="bg-fiori-cardLight dark:bg-slate-900/40 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50 flex items-center justify-between hover:shadow-md dark:hover:bg-slate-900/60 transition-all cursor-pointer group"
          title="Ver issues no Kanban"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Issues Abertas</p>
            <p className="text-3xl font-light text-orange-600 dark:text-orange-300">{openIssuesCount}</p>
          </div>
          <div className="p-3 rounded-full bg-orange-50 dark:bg-orange-900/10 group-hover:scale-110 transition-transform">
            <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-300" />
          </div>
        </div>

        {/* Em Revisão */}
        <div
          onClick={() => onNavigate(ViewState.KANBAN)}
          className="bg-fiori-cardLight dark:bg-slate-900/40 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50 flex items-center justify-between hover:shadow-md dark:hover:bg-slate-900/60 transition-all cursor-pointer group"
          title="Ver PRs em revisão"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Em Revisão (PRs)</p>
            <p className="text-3xl font-light text-purple-600 dark:text-purple-300">{reviewsCount}</p>
          </div>
          <div className="p-3 rounded-full bg-purple-50 dark:bg-purple-900/10 group-hover:scale-110 transition-transform">
            <GitPullRequest className="w-6 h-6 text-purple-600 dark:text-purple-300" />
          </div>
        </div>

        {/* Commits Semana */}
        <div
          onClick={() => onNavigate(ViewState.GIT)}
          className="bg-fiori-cardLight dark:bg-slate-900/40 p-5 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50 flex items-center justify-between hover:shadow-md dark:hover:bg-slate-900/60 transition-all cursor-pointer group"
          title="Ver controle de fonte"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Commits (Semana)</p>
            <p className="text-3xl font-light text-blue-600 dark:text-blue-300">{weeklyCommits}</p>
          </div>
          <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-900/10 group-hover:scale-110 transition-transform">
            <GitCommit className="w-6 h-6 text-blue-600 dark:text-blue-300" />
          </div>
        </div>

        {/* Status do Sistema */}
        <div
          onClick={() => !isSystemStable && setShowFailedPanel(true)}
          className={`bg-fiori-cardLight dark:bg-slate-900/40 p-5 rounded-lg shadow-sm border flex items-center justify-between transition-all group ${
            isSystemStable
              ? 'border-slate-200 dark:border-slate-700/50 hover:shadow-md dark:hover:bg-slate-900/60'
              : 'border-red-200 dark:border-red-900/50 hover:shadow-md hover:border-red-300 dark:hover:border-red-800 cursor-pointer'
          }`}
          title={isSystemStable ? 'Todos os repositórios estão funcionando' : 'Clique para ver detalhes das falhas'}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Status do Sistema</p>
            <div className="flex flex-col">
              <p className={`text-xl font-medium ${isSystemStable ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
                {isSystemStable ? 'Estável' : `${failedRepoCount} Falha${failedRepoCount > 1 ? 's' : ''}`}
              </p>
              {!isSystemStable && (
                <span className="text-xs text-red-400 dark:text-red-400/80 mt-0.5 flex items-center gap-1">
                  Repositórios com problemas <ExternalLink className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
          <div className={`p-3 rounded-full group-hover:scale-110 transition-transform ${isSystemStable ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
            {isSystemStable
              ? <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-300" />
              : <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-300 animate-pulse" />
            }
          </div>
        </div>
      </div>

      {/* Failed Repos Detail Panel */}
      {showFailedPanel && failedRepoDetails.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-lg p-5 animate-in slide-in-from-top-2">
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
              <div
                key={repo.id}
                onClick={() => { onOpenRepo(repo.id); setShowFailedPanel(false); }}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/50 rounded-md border border-red-100 dark:border-red-900/30 hover:border-red-300 dark:hover:border-red-700 cursor-pointer transition-all group/item"
              >
                <div className="flex items-center gap-3">
                  <FolderGit2 className="w-4 h-4 text-red-400" />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover/item:text-red-600 dark:group-hover/item:text-red-300 transition-colors">{repo.name}</span>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{repo.reason}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover/item:text-red-400 transition-colors" />
              </div>
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

      {/* Contribution Graph */}
      <div className="bg-fiori-cardLight dark:bg-slate-900/40 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50">
        <h2 className="text-base font-semibold text-fiori-textPrimary dark:text-white mb-6 flex items-center gap-2">
          <ActivityLogIcon className="w-5 h-5 text-fiori-blue" />
          Histórico de Contribuições
        </h2>
        <ContributionGraph data={stats?.contributions} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-fiori-cardLight dark:bg-slate-900/40 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-600/30 bg-slate-50 dark:bg-slate-800/70 flex justify-between items-center">
            <h3 className="font-semibold text-fiori-textPrimary dark:text-white">Atividade Recente</h3>
            <button
              onClick={() => onNavigate(ViewState.GIT)}
              className="text-xs font-medium text-fiori-link dark:text-fiori-linkDark hover:underline flex items-center gap-1"
            >
              Ver tudo <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4">
            {activities.slice(0, 5).map(log => <ActivityItem key={log.id} log={log} />)}
            {activities.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">Nenhuma atividade recente.</div>
            )}
          </div>
        </div>

        {/* Side Panel: Quick Repos */}
        <div className="bg-fiori-cardLight dark:bg-slate-900/40 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50 flex flex-col h-fit">
          <div className="p-4 border-b border-slate-200 dark:border-slate-600/30 bg-slate-50 dark:bg-slate-800/70 flex justify-between items-center">
            <h3 className="font-semibold text-fiori-textPrimary dark:text-white">Meus Repositórios</h3>
            <button
              onClick={() => onNavigate(ViewState.REPOS)}
              className="text-xs font-medium text-fiori-link dark:text-fiori-linkDark hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="p-4 flex-1">
            {displayedRepos.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                Nenhum repositório encontrado.
              </div>
            ) : (
              <>
                {displayedRepos.map(repo => {
                  const isBroken = (repo as any).pathMissing || failedRepoDetails.some(f => f.id === repo.id);
                  return (
                    <div key={repo.id} onClick={() => onOpenRepo(repo.id)} className={`flex items-center justify-between mb-3 p-2.5 rounded-md cursor-pointer border transition-all group ${isBroken ? 'hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:border-red-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border-transparent hover:border-slate-100 dark:hover:border-primary-400/20'}`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        {isBroken
                          ? <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                          : <FolderGit2 className="w-5 h-5 flex-shrink-0 transition-colors text-slate-400 group-hover:text-fiori-blue" />
                        }
                        <div className="overflow-hidden">
                          <span className={`text-sm font-medium truncate block ${isBroken ? 'text-red-600 dark:text-red-300' : 'text-fiori-textPrimary dark:text-slate-200 group-hover:text-fiori-link dark:group-hover:text-fiori-linkDark'}`}>
                            {repo.name}
                          </span>
                          {isBroken && (
                            <span className="text-[10px] text-red-400 dark:text-red-500">
                              {failedRepoDetails.find(f => f.id === repo.id)?.reason || 'Diretório não encontrado'}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`w-2.5 h-2.5 flex-shrink-0 rounded-full shadow-sm ${isBroken ? 'bg-red-500 shadow-red-500/30 animate-pulse' :
                        repo.status === 'active' ? 'bg-emerald-500 shadow-emerald-500/30' :
                          'bg-slate-400'
                        }`}></span>
                    </div>
                  );
                })}
              </>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <button
                onClick={onCreateRepo}
                className="w-full py-2.5 text-sm font-medium text-fiori-blue dark:text-fiori-linkDark border border-dashed border-slate-300 dark:border-slate-600 rounded-md hover:border-fiori-blue hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2"
              >
                <FolderGit2 className="w-4 h-4" /> Novo Repositório
              </button>
              <button
                onClick={onCreateTask}
                className="w-full py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
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

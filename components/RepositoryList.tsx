import React, { useMemo, useState } from 'react';
import { Repository } from '../types';
import {
  GitBranch,
  AlertCircle,
  CheckCircle2,
  Star,
  GitFork,
  Clock,
  Trash2,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  FolderGit2,
  Boxes,
  ShieldAlert,
  Rocket,
} from 'lucide-react';
import { useConfirm } from '../contexts/ConfirmContext';

interface RepoListProps {
  repos: Repository[];
  onDelete: (id: string) => void;
  onOpenNewRepo: () => void;
  onRepoClick: (id: string) => void;
  onRepoGitClick?: (id: string) => void;
  onRepoIssuesClick?: (id: string) => void;
}

const getStatusLabel = (repo: Repository) => {
  if (repo.status === 'active') return 'Ativo';
  if (repo.status === 'error') return 'Falha build';
  return 'Arquivado';
};

const getStatusClassName = (repo: Repository) => {
  if (repo.status === 'active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300';
  }

  if (repo.status === 'error') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/[0.1] dark:text-red-300';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300';
};

const getRepoIconClassName = (repo: Repository) => {
  if (repo.status === 'error') {
    return 'bg-red-50 text-red-600 dark:bg-red-500/[0.12] dark:text-red-300';
  }

  if (repo.status === 'archived') {
    return 'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300';
  }

  return 'bg-blue-50 text-blue-600 dark:bg-blue-500/[0.12] dark:text-blue-300';
};

const getPipelineStatus = (repo: Repository) => (repo as any).lastPipelineStatus as 'success' | 'failed' | 'running' | undefined;

const repositoryDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatRepositoryTimestamp = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return repositoryDateFormatter.format(parsed);
};

const repoInsetCard =
  'rounded-2xl border border-slate-200/75 bg-slate-50/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

const quickActionClassName = 'inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/78 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm shadow-slate-200/40 transition-all hover:border-primary-500/25 hover:text-primary-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none dark:hover:text-primary-300';

const RepositoryList: React.FC<RepoListProps> = ({ repos, onDelete, onOpenNewRepo, onRepoClick, onRepoGitClick, onRepoIssuesClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('all');
  const { confirm } = useConfirm();

  const handleDeleteClick = async (event: React.MouseEvent, repo: Repository) => {
    event.stopPropagation();

    if (
      await confirm({
        title: 'Excluir Repositorio',
        message: `Tem certeza que deseja excluir o repositorio "${repo.name}"?\nEsta acao nao pode ser desfeita.`,
        confirmText: 'Excluir',
        variant: 'danger',
      })
    ) {
      onDelete(repo.id);
    }
  };

  const filteredRepos = useMemo(() => {
    return repos.filter((repo) => {
      const matchesSearch =
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === 'all' ? true : filterStatus === 'active' ? repo.status !== 'archived' : repo.status === 'archived';

      return matchesSearch && matchesStatus;
    });
  }, [repos, searchTerm, filterStatus]);

  const activeRepos = useMemo(() => repos.filter((repo) => repo.status === 'active').length, [repos]);
  const archivedRepos = useMemo(() => repos.filter((repo) => repo.status === 'archived').length, [repos]);
  const errorRepos = useMemo(() => repos.filter((repo) => repo.status === 'error').length, [repos]);
  const missingPathRepos = useMemo(() => repos.filter((repo) => Boolean((repo as any).pathMissing)).length, [repos]);

  return (
    <div className="page-container-narrow page-shell page-stack min-h-full">
      <section className="page-panel-grid xl:grid-cols-12">
        <div className="surface-card overflow-hidden rounded-[1.6rem] xl:col-span-7">
          <div className="panel-header-block border-b border-slate-200/70 bg-slate-50/45 dark:border-white/10 dark:bg-transparent">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="app-section-label">Portifolio Tecnico</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-[var(--text-primary)]">
                  Repositorios organizados para operacao, risco e manutencao.
                </h2>
                <p className="app-copy mt-2">
                  Esta tela concentra o estado de cada projeto, sinais de pipeline e pontos de atencao para que a equipe identifique rapido onde agir.
                </p>
              </div>
              <div className="app-soft-badge gap-2 uppercase tracking-[0.18em]">
                <FolderGit2 className="h-3.5 w-3.5" />
                {repos.length} repositorios
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-3">
            <div className={repoInsetCard}>
              <p className="app-metric-label">Operando</p>
              <p className="mt-3 text-3xl font-light text-slate-900 dark:text-[var(--text-primary)]">{activeRepos}</p>
              <p className="app-copy-compact mt-2">Repositorios disponiveis para fluxo normal de entrega.</p>
            </div>
            <div className={repoInsetCard}>
              <p className="app-metric-label">Com falha</p>
              <p className={`mt-3 text-3xl font-light ${errorRepos > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{errorRepos}</p>
              <p className="app-copy-compact mt-2">Repositorios com erro ou pipeline exigindo intervencao.</p>
            </div>
            <div className={repoInsetCard}>
              <p className="app-metric-label">Arquivados</p>
              <p className="mt-3 text-3xl font-light text-slate-900 dark:text-[var(--text-primary)]">{archivedRepos}</p>
              <p className="app-copy-compact mt-2">Itens mantidos para historico ou baixa manutencao.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-slate-200/70 px-6 py-4 dark:border-white/10">
            <button
              onClick={onOpenNewRepo}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-900/15 transition-colors hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> Novo repositorio
            </button>
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-2.5 text-sm font-medium text-amber-700 shadow-sm shadow-amber-100/70 dark:border-amber-500/20 dark:bg-amber-500/[0.1] dark:text-amber-300 dark:shadow-none">
              <AlertTriangle className="h-4 w-4" /> {missingPathRepos} diretorios ausentes
            </div>
          </div>
        </div>

        <div className="surface-card panel-body-block rounded-[1.6rem] xl:col-span-5">
          <p className="app-section-label">Leitura Operacional</p>
          <div className="mt-4 space-y-3.5">
            <div className={repoInsetCard}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/[0.12] dark:text-emerald-300">
                  <Rocket className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Saude do portfolio</h3>
                  <p className="app-copy-compact mt-1">
                    {errorRepos > 0
                      ? 'Existem repositorios com falha e eles devem receber atencao antes de novas entregas.'
                      : 'Nao ha falhas criticas visiveis no portfolio atual.'}
                  </p>
                </div>
              </div>
            </div>
            <div className={repoInsetCard}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.12] dark:text-blue-300">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Cobertura de manutencao</h3>
                  <p className="app-copy-compact mt-1">
                    {filteredRepos.length} repositorios visiveis apos filtros. Use busca e status para localizar rapidamente o conjunto que importa.
                  </p>
                </div>
              </div>
            </div>
            <div className={repoInsetCard}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/[0.12] dark:text-amber-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Higiene tecnica</h3>
                  <p className="app-copy-compact mt-1">
                    {missingPathRepos > 0
                      ? 'Ha caminhos locais ausentes. Vale revisar repositorios desconectados para evitar falsa percepcao de cobertura.'
                      : 'Todos os repositorios aparentam estar associados a caminhos locais validos.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card panel-body-block rounded-[1.6rem]">
        <div className="page-toolbar mb-6">
          <div className="page-toolbar-item relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou descricao..."
              className="app-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="relative md:w-64">
            <Filter className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <select
              className="app-input w-full appearance-none rounded-xl py-2.5 pl-10 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-slate-300"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as 'all' | 'active' | 'archived')}
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativos e com falha</option>
              <option value="archived">Arquivados</option>
            </select>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/78 px-4 py-2.5 text-sm text-slate-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-secondary)] dark:shadow-none">
            {filteredRepos.length} resultados
          </div>
        </div>

        <div className="grid gap-4">
          {filteredRepos.length === 0 ? (
            <div className="surface-empty rounded-[1.35rem] px-6 py-16 text-center">
              <GitBranch className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-500" />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200">Nenhum repositorio encontrado</h3>
              <p className="app-copy mx-auto mt-2 max-w-md">
                Ajuste os filtros ou crie um novo repositorio para manter o portfolio tecnico centralizado nesta area.
              </p>
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const pipelineStatus = getPipelineStatus(repo);
              const pipelineLabel =
                pipelineStatus === 'success'
                  ? 'Passou'
                  : pipelineStatus === 'failed'
                    ? 'Falhou'
                    : pipelineStatus === 'running'
                      ? 'Rodando'
                      : repo.status === 'active'
                        ? 'Sem pipeline'
                        : 'Desconhecido';

              return (
                <article
                  key={repo.id}
                  onClick={() => onRepoClick(repo.id)}
                  className="surface-card group relative cursor-pointer rounded-[1.35rem] border border-slate-200/75 bg-white/88 p-5 shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-lg hover:shadow-slate-200/70 dark:border-white/10 dark:bg-transparent dark:shadow-none dark:hover:shadow-xl"
                >
                  <button
                    onClick={(event) => handleDeleteClick(event, repo)}
                    className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-500/[0.12] dark:hover:text-red-300"
                    title="Excluir repositorio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="flex flex-col gap-5 pr-10 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 flex h-12 w-12 items-center justify-center rounded-2xl ${getRepoIconClassName(repo)}`}>
                          {repo.status === 'error' ? <AlertCircle className="h-6 w-6" /> : <GitBranch className="h-6 w-6" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-primary-600 dark:text-[var(--text-primary)] dark:group-hover:text-primary-300">
                              {repo.name}
                            </h3>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getStatusClassName(repo)}`}>
                              {getStatusLabel(repo)}
                            </span>
                            {(repo as any).pathMissing && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/[0.1] dark:text-amber-300">
                                <AlertTriangle className="h-3.5 w-3.5" /> Diretorio ausente
                              </span>
                            )}
                          </div>

                          <p className="app-copy mt-2">
                            {repo.description || 'Repositorio ainda sem descricao. Vale registrar contexto tecnico e responsabilidade do servico.'}
                          </p>

                          <div className="app-meta-row mt-4 gap-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                              <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                              {repo.branch}
                            </div>
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                              <Clock className="h-3.5 w-3.5" />
                              {formatRepositoryTimestamp(repo.lastUpdated)}
                            </div>
                            {repo.issues > 0 && (
                              <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/[0.1] dark:text-orange-300">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {repo.issues} issues
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRepoClick(repo.id);
                              }}
                              className={quickActionClassName}
                            >
                              Abrir
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRepoGitClick?.(repo.id);
                              }}
                              className={quickActionClassName}
                            >
                              Commits
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRepoIssuesClick?.(repo.id);
                              }}
                              className={quickActionClassName}
                            >
                              Issues
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 xl:items-end">
                      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-[var(--text-muted)]">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/78 px-3 py-1.5 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <Star className="h-4 w-4" /> Stars {repo.stars || 0}
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/78 px-3 py-1.5 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <GitFork className="h-4 w-4" /> Forks 0
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200/75 bg-slate-50/78 px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                        <p className="app-metric-label">Pipeline</p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                            {pipelineStatus === 'success' ? (
                              <>
                                <div className="w-1/3 bg-emerald-400 dark:bg-emerald-500"></div>
                                <div className="ml-0.5 w-1/3 bg-emerald-400 dark:bg-emerald-500"></div>
                                <div className="ml-0.5 w-1/3 bg-emerald-400 dark:bg-emerald-500"></div>
                              </>
                            ) : pipelineStatus === 'failed' ? (
                              <>
                                <div className="w-1/3 bg-red-400/50"></div>
                                <div className="ml-0.5 w-1/3 bg-red-400/50"></div>
                                <div className="ml-0.5 w-1/3 bg-red-500"></div>
                              </>
                            ) : pipelineStatus === 'running' ? (
                              <div className="w-2/3 animate-pulse bg-blue-400"></div>
                            ) : (
                              <div className="w-full bg-slate-200 dark:bg-slate-600/70"></div>
                            )}
                          </div>

                          <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${pipelineStatus === 'success' ? 'text-emerald-600 dark:text-emerald-300' : pipelineStatus === 'failed' ? 'text-red-600 dark:text-red-300' : pipelineStatus === 'running' ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-[var(--text-muted)]'}`}>
                            {pipelineStatus === 'success' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : pipelineStatus === 'failed' ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <Clock className={`h-4 w-4 ${pipelineStatus === 'running' ? 'animate-spin' : ''}`} />
                            )}
                            {pipelineLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default RepositoryList;

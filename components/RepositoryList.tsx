
import React, { useState, useMemo } from 'react';
import { Repository } from '../types';
import { GitBranch, AlertCircle, CheckCircle2, Star, GitFork, Clock, Trash2, Plus, Search, Filter, AlertTriangle } from 'lucide-react';
import { useConfirm } from '../contexts/ConfirmContext';

interface RepoListProps {
    repos: Repository[];
    onDelete: (id: string) => void;
    onOpenNewRepo: () => void;
    onRepoClick: (id: string) => void;
}

const RepositoryList: React.FC<RepoListProps> = ({ repos, onDelete, onOpenNewRepo, onRepoClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('all');
    const { confirm } = useConfirm();

    const handleDeleteClick = async (e: React.MouseEvent, repo: Repository) => {
        e.stopPropagation();
        if (await confirm({ title: 'Excluir Repositório', message: `Tem certeza que deseja excluir o repositório "${repo.name}"?\nEsta ação não pode ser desfeita.`, confirmText: 'Excluir', variant: 'danger' })) {
            onDelete(repo.id);
        }
    };

    const filteredRepos = useMemo(() => {
        return repos.filter(repo => {
            const matchesSearch = repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (repo.description || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' ? true :
                filterStatus === 'active' ? repo.status !== 'archived' :
                    repo.status === 'archived';
            return matchesSearch && matchesStatus;
        });
    }, [repos, searchTerm, filterStatus]);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-fiori-textPrimary dark:text-white tracking-tight">Repositórios</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie os projetos e serviços da sua organização.</p>
                </div>
                <button
                    onClick={onOpenNewRepo}
                    className="bg-fiori-blue hover:bg-blue-700 text-white px-5 py-2.5 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Novo Repositório
                </button>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar repositórios..."
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-fiori-blue text-sm dark:text-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <select
                        className="pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-fiori-blue text-sm text-slate-600 dark:text-slate-300 appearance-none"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                    >
                        <option value="all">Todos os Status</option>
                        <option value="active">Ativos</option>
                        <option value="archived">Arquivados</option>
                    </select>
                </div>
            </div>

            <div className="grid gap-5">
                {filteredRepos.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                        <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300">Nenhum repositório encontrado</h3>
                        <p className="text-slate-500 text-sm mt-1">Tente ajustar seus filtros ou crie um novo projeto.</p>
                    </div>
                ) : (
                    filteredRepos.map(repo => (
                        <div
                            key={repo.id}
                            onClick={() => onRepoClick(repo.id)}
                            className="bg-fiori-cardLight dark:bg-slate-900/40 p-6 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm hover:border-fiori-blue dark:hover:border-fiori-linkDark dark:hover:bg-slate-900/60 transition-all group relative cursor-pointer"
                        >

                            {/* Delete Button (Visible on Hover) */}
                            <button
                                onClick={(e) => handleDeleteClick(e, repo)}
                                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all opacity-0 group-hover:opacity-100 z-10"
                                title="Excluir Repositório"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex justify-between items-start pr-10">
                                <div className="flex items-start gap-4">
                                    <div className={`mt-1 p-2.5 rounded-lg ${repo.status === 'error'
                                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                        : 'bg-blue-50 text-fiori-blue dark:bg-blue-900/20 dark:text-blue-400'
                                        }`}>
                                        {repo.status === 'error' ? (
                                            <AlertCircle className="w-6 h-6" />
                                        ) : (
                                            <GitBranch className="w-6 h-6" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-lg font-semibold text-fiori-link dark:text-fiori-linkDark group-hover:underline transition-colors">
                                                {repo.name}
                                            </h3>
                                            {(repo as any).pathMissing && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/50">
                                                    <AlertTriangle className="w-3 h-3" /> Diretório ausente
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-fiori-textSecondary dark:text-slate-400 text-sm mt-1 leading-relaxed">
                                            {repo.description || <span className="italic text-slate-400">Sem descrição</span>}
                                        </p>

                                        <div className="flex items-center gap-5 mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800/70">
                                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                                {repo.branch}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {repo.lastUpdated}
                                            </div>
                                            {repo.issues > 0 && (
                                                <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 px-2 py-0.5 rounded">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    {repo.issues} issues
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3 mt-10 md:mt-0">
                                    <div className="flex items-center gap-4">
                                        <button className="flex items-center gap-1 text-slate-500 hover:text-fiori-blue dark:hover:text-fiori-linkDark text-sm transition-colors">
                                            <Star className="w-4 h-4" /> 0
                                        </button>
                                        <button className="flex items-center gap-1 text-slate-500 hover:text-fiori-blue dark:hover:text-fiori-linkDark text-sm transition-colors">
                                            <GitFork className="w-4 h-4" /> 0
                                        </button>
                                    </div>

                                    <span className={`text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full ${repo.status === 'active'
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                        : repo.status === 'error'
                                            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                            : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                        {repo.status === 'active' ? 'Ativo' : repo.status === 'error' ? 'Falha Build' : 'Arquivado'}
                                    </span>
                                </div>
                            </div>

                            {/* CI/CD Pipeline Status */}
                            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status do Pipeline</span>

                                {/* Visual Bar */}
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-full overflow-hidden flex">
                                    {(repo as any).lastPipelineStatus === 'success' ? (
                                        <>
                                            <div className="w-1/3 bg-emerald-400 dark:bg-emerald-600"></div>
                                            <div className="w-1/3 bg-emerald-400 dark:bg-emerald-600 ml-0.5"></div>
                                            <div className="w-1/3 bg-emerald-400 dark:bg-emerald-600 ml-0.5"></div>
                                        </>
                                    ) : (repo as any).lastPipelineStatus === 'failed' ? (
                                        <>
                                            <div className="w-1/3 bg-red-400/50"></div>
                                            <div className="w-1/3 bg-red-400/50 ml-0.5"></div>
                                            <div className="w-1/3 bg-red-500 ml-0.5"></div>
                                        </>
                                    ) : (repo as any).lastPipelineStatus === 'running' ? (
                                        <div className="w-2/3 bg-blue-400 animate-pulse"></div>
                                    ) : (
                                        <div className="w-full bg-slate-200 dark:bg-slate-700"></div>
                                    )}
                                </div>

                                {/* Text Status */}
                                {(repo as any).lastPipelineStatus === 'success' ? (
                                    <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Passou
                                    </div>
                                ) : (repo as any).lastPipelineStatus === 'failed' ? (
                                    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                                        <AlertCircle className="w-4 h-4" />
                                        Falhou
                                    </div>
                                ) : (repo as any).lastPipelineStatus === 'running' ? (
                                    <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        <Clock className="w-4 h-4 animate-spin" />
                                        Rodando
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                                        <Clock className="w-4 h-4" />
                                        {repo.status === 'active' ? 'Sem Pipeline' : 'Desconhecido'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RepositoryList;

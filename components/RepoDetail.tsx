
import React, { useState, useEffect, useMemo } from 'react';
import { Repository, RepoDetailTab, Task, getErrorMessage } from '../types';
import { ArrowLeft, GitBranch, Clock, AlertCircle, Copy, FileText, Code2, GitPullRequest, Star, Eye, Folder, X, Save, Edit3, GitCommit, Settings, AlertTriangle, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { api } from '../services/api';
import { useConfirm } from '../contexts/ConfirmContext';
import {
    getRepoStatusLabel,
    getRepoStatusToneClass,
    getTaskPriorityToneClass,
    getTaskStatusLabel,
} from '../utils/statusPriority';

interface RepoFile {
    name: string;
    type: 'file' | 'directory';
    modifiedAt: string;
    relativePath?: string;
}

interface Commit {
    hash: string;
    fullHash: string;
    author: string;
    email: string;
    date: string;
    message: string;
    relativeDate: string;
}

interface RepoDetailProps {
    repo: Repository;
    tasks: Task[];
    onBack: () => void;
    onNavigateToTask: (task: Task) => void;
    addToast: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
    onDeleteRepo?: (id: string) => void;
    initialTab?: RepoDetailTab;
    onOpenGit?: (repoId: string) => void;
}

const detailInsetCard =
    'rounded-2xl border border-slate-200/75 bg-slate-50/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

const detailActionCard =
    `${detailInsetCard} text-left transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_22px_34px_-30px_rgba(14,165,233,0.18)]`;

const RepoDetail: React.FC<RepoDetailProps> = ({ repo, tasks, onBack, onNavigateToTask, addToast, onDeleteRepo, initialTab, onOpenGit }) => {
    const { confirm } = useConfirm();
    const [activeTab, setActiveTab] = useState<RepoDetailTab>(initialTab || 'code');
    const [files, setFiles] = useState<RepoFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [localPath, setLocalPath] = useState<string>('');

    // Estados para commits
    const [commits, setCommits] = useState<Commit[]>([]);
    const [loadingCommits, setLoadingCommits] = useState(true);

    // Estados para visualização/edição de arquivo
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [editedContent, setEditedContent] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [loadingFile, setLoadingFile] = useState(false);
    const [savingFile, setSavingFile] = useState(false);

    // Estados para modal de commit
    const [showCommitModal, setShowCommitModal] = useState(false);
    const [commitMessage, setCommitMessage] = useState('');

    // Estado para README
    const [readmeContent, setReadmeContent] = useState<string>('');
    const [loadingReadme, setLoadingReadme] = useState(true);

    // Estado para caminho ausente
    const [pathMissing, setPathMissing] = useState(false);

    // Estado para dropdown do botão Code
    const [showCodeDropdown, setShowCodeDropdown] = useState(false);
    const [gitlabProjectPath, setGitlabProjectPath] = useState<string>(repo.gitlabProjectPath || '');
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        if (initialTab && initialTab !== activeTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab, activeTab]);

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            await api.saveRepoSettings(repo.id, { gitlabProjectPath });
            addToast('Configurações Salvas', 'success', 'As configurações do repositório foram atualizadas.');
        } catch {
            addToast('Falha ao Salvar', 'error', 'Não foi possível salvar as configurações do repositório.');
        } finally {
            setSavingSettings(false);
        }
    };

    // Carregar arquivos
    const loadFiles = async (): Promise<RepoFile[] | null> => {
        try {
            setLoading(true);
            const data = await api.getRepoFiles(repo.id);
            setFiles(data.files);
            setLocalPath(data.localPath || '');
            return data.files;
        } catch (error: unknown) {
            const msg: string = error?.message || '';
            if (msg.includes('não encontrado') || msg.includes('not found') || msg.includes('ENOENT')) {
                setPathMissing(true);
            } else {
                console.error('Erro ao carregar arquivos:', error);
                addToast('Falha ao Carregar Arquivos', 'error', msg || 'Não foi possível listar os arquivos do repositório.');
            }
            return null;
        } finally {
            setLoading(false);
        }
    };

    // Carregar commits
    const loadCommits = async () => {
        try {
            setLoadingCommits(true);
            const data = await api.getRepoCommits(repo.id, 10);
            setCommits(data.commits || []);
        } catch (error) {
            console.error('Erro ao carregar commits:', error);
        } finally {
            setLoadingCommits(false);
        }
    };

    // Carregar README
    const loadReadme = async (repoFiles: RepoFile[] = files) => {
        const readmeFile = repoFiles.find((file) => file.type === 'file' && /^readme(\.[^.]+)?$/i.test(file.name));

        if (!readmeFile) {
            setReadmeContent('');
            setLoadingReadme(false);
            return;
        }

        try {
            setLoadingReadme(true);
            const data = await api.getRepoFileContent(repo.id, readmeFile.relativePath || readmeFile.name);
            setReadmeContent(data.content);
        } catch {
            setReadmeContent('');
        } finally {
            setLoadingReadme(false);
        }
    };

    useEffect(() => {
        setPathMissing(false);
        loadFiles().then(loadedFiles => {
            if (loadedFiles) {
                loadCommits();
                loadReadme(loadedFiles);
            } else {
                setLoadingCommits(false);
                setLoadingReadme(false);
            }
        });
    }, [repo.id]);

    // Formatar data de atualização
    const formatLastUpdated = (dateString: string): string => {
        if (!dateString) return 'Nunca';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'agora';
            if (diffMins < 60) return `há ${diffMins} min`;
            if (diffHours < 24) return `há ${diffHours}h`;
            if (diffDays < 7) return `há ${diffDays} dias`;
            return date.toLocaleDateString('pt-BR');
        } catch {
            return dateString;
        }
    };

    // Filtrar tarefas vinculadas a este repositório
    const repoTasks = useMemo(() => tasks.filter(t => t.repositoryId === repo.id), [tasks, repo.id]);
    const openTaskCount = useMemo(() => repoTasks.filter(t => t.status !== 'done').length, [repoTasks]);
    const reviewTaskCount = useMemo(() => repoTasks.filter(t => t.status === 'review').length, [repoTasks]);
    const fileCount = useMemo(() => files.filter(f => f.type === 'file').length, [files]);
    const directoryCount = useMemo(() => files.filter(f => f.type === 'directory').length, [files]);

    // Abrir arquivo para visualização
    const handleOpenFile = async (fileName: string) => {
        try {
            setLoadingFile(true);
            setSelectedFile(fileName);
            const data = await api.getRepoFileContent(repo.id, fileName);
            setFileContent(data.content);
            setEditedContent(data.content);
            setIsEditing(false);
        } catch (error: unknown) {
            console.error('Erro ao abrir arquivo:', error);
            addToast('Falha ao Abrir Arquivo', 'error', getErrorMessage(error) || 'Não foi possível ler o conteúdo do arquivo.');
            setSelectedFile(null);
        } finally {
            setLoadingFile(false);
        }
    };

    // Abrir modal de commit (chamado ao clicar em Salvar)
    const handleRequestSave = () => {
        setCommitMessage(`Atualização de ${selectedFile}`);
        setShowCommitModal(true);
    };

    // Confirmar commit e salvar arquivo
    const handleConfirmCommit = async () => {
        if (!selectedFile || !commitMessage.trim()) return;
        try {
            setSavingFile(true);
            setShowCommitModal(false);
            const result = await api.saveRepoFile(repo.id, selectedFile, editedContent, commitMessage);
            setFileContent(editedContent);
            setIsEditing(false);

            if (result.committed) {
                addToast('Commit Realizado', 'success', result.message || 'As alterações foram salvas no repositório.');
                // Recarregar commits e arquivos
                loadCommits();
                loadFiles();
            } else {
                addToast('Arquivo Salvo', 'info', result.message || 'O conteúdo foi atualizado localmente.');
            }
            setCommitMessage('');
        } catch (error: unknown) {
            console.error('Erro ao salvar arquivo:', error);
            addToast('Falha ao Salvar', 'error', getErrorMessage(error) || 'Não foi possível salvar as alterações no arquivo.');
        } finally {
            setSavingFile(false);
        }
    };

    // Cancelar modal de commit
    const handleCancelCommit = () => {
        setShowCommitModal(false);
        setCommitMessage('');
    };

    // Fechar modal de arquivo
    const handleCloseFile = () => {
        setSelectedFile(null);
        setFileContent('');
        setEditedContent('');
        setIsEditing(false);
    };

    // Determinar linguagem para syntax highlighting básico
    const getFileLanguage = (fileName: string): string => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const langMap: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'json': 'json',
            'md': 'markdown',
            'html': 'html',
            'css': 'css',
            'scss': 'css',
            'yaml': 'yaml',
            'yml': 'yaml',
            'xml': 'xml',
            'sql': 'sql',
            'sh': 'bash',
            'bash': 'bash',
        };
        return langMap[ext] || 'text';
    };

    const handleCopyPath = () => {
        if (localPath) {
            navigator.clipboard.writeText(localPath);
            addToast('Caminho Copiado', 'success', 'O caminho local foi copiado para a área de transferência.');
        } else {
            addToast('Caminho Indisponível', 'error', 'O caminho local deste repositório não está disponível.');
        }
        setShowCodeDropdown(false);
    };

    const handleOpenInExplorer = () => {
        if (localPath) {
            // Abrir comando para terminal - o usuário pode copiar e executar
            navigator.clipboard.writeText(`explorer "${localPath}"`);
            addToast('Comando Copiado', 'info', 'Cole o comando no terminal para abrir a pasta no Explorer.');
        }
        setShowCodeDropdown(false);
    };

    return (
        <div className="page-shell min-h-full">
            <div className="page-container page-stack">
            {/* Missing path banner */}
            {pathMissing && (
                <div className="surface-card rounded-[1.35rem] border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-500/20 dark:bg-amber-500/[0.08]">
                    <div className="flex flex-wrap items-start gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/[0.14] dark:text-amber-300">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Diretorio local nao encontrado</p>
                            {repo.localPath && (
                                <p className="mt-1 break-all font-mono text-xs text-amber-700/80 dark:text-amber-300/80">{repo.localPath}</p>
                            )}
                            <p className="mt-2 text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
                                O caminho local foi removido ou movido. Sem esse diretorio, leitura de arquivos, commits e operacao local ficam indisponiveis.
                            </p>
                        </div>
                        {onDeleteRepo && (
                            <button
                                onClick={async () => {
                                    if (!await confirm({ title: 'Remover Repositório', message: `Remover "${repo.name}" do DevFlow?\n\nIsso apenas remove o registro do sistema. Os arquivos no disco não serão afetados.`, confirmText: 'Remover', variant: 'warning' })) return;
                                    onDeleteRepo(repo.id);
                                    onBack();
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white/70 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-white dark:border-amber-500/30 dark:bg-black/10 dark:text-amber-200"
                            >
                                <Trash2 className="h-4 w-4" /> Remover do sistema
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <section className="page-panel-grid xl:grid-cols-12">
                <div className="surface-card overflow-visible rounded-[1.6rem] xl:col-span-7">
                    <div className="panel-header-block border-b border-slate-200/70 bg-slate-50/45 dark:border-white/10 dark:bg-transparent">
                <button
                    onClick={onBack}
                    className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-primary-600 dark:text-[var(--text-muted)] dark:hover:text-primary-300"
                >
                    <ArrowLeft className="h-4 w-4" /> Voltar para repositorios
                </button>

                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="app-section-label">Operacao Tecnica</p>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getRepoStatusToneClass(repo.status)}`}>
                                {getRepoStatusLabel(repo.status)}
                            </span>
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-[var(--text-primary)]">{repo.name}</h1>
                        <p className="app-copy mt-2 max-w-2xl">
                            {repo.description || 'Repositorio sem descricao registrada. Defina contexto tecnico e responsabilidade do servico para melhorar a leitura operacional.'}
                        </p>

                        <div className="app-meta-row mt-4 gap-4">
                            <div className="flex items-center gap-1.5">
                                <GitBranch className="h-3.5 w-3.5" />
                                <span className="font-mono">{repo.branch}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Atualizado {commits.length > 0 ? commits[0].relativeDate : formatLastUpdated(repo.lastUpdated)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Star className="h-3.5 w-3.5" />
                                <span>0 stars</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Eye className="h-3.5 w-3.5" />
                                <span>{repo.stars || 0} watching</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowCodeDropdown(!showCodeDropdown)}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-900/15 transition-colors hover:bg-primary-700"
                        >
                            <Code2 className="h-4 w-4" /> Acoes de codigo
                        </button>
                        {showCodeDropdown && (
                            <div className="app-flyout absolute right-0 z-50 mt-3 w-80 rounded-2xl p-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Caminho local</h4>
                                    <div className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 font-mono text-xs text-slate-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">
                                        {localPath || 'Nao disponivel'}
                                    </div>
                                    <div className="mt-3 space-y-2">
                                        <button
                                            onClick={handleCopyPath}
                                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100/85 dark:text-slate-200 dark:hover:bg-white/[0.04]"
                                        >
                                            <Copy className="h-4 w-4" />
                                            Copiar caminho
                                        </button>
                                        <button
                                            onClick={handleOpenInExplorer}
                                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100/85 dark:text-slate-200 dark:hover:bg-white/[0.04]"
                                        >
                                            <Folder className="h-4 w-4" />
                                            Copiar comando Explorer
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
                                    <button
                                        onClick={() => setShowCodeDropdown(false)}
                                        className="text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-3">
                        <button
                            type="button"
                            onClick={() => onOpenGit?.(repo.id)}
                            className={detailActionCard}
                        >
                            <p className="app-metric-label">Branch atual</p>
                            <p className="mt-3 font-mono text-lg font-semibold text-slate-900 dark:text-[var(--text-primary)]">{repo.branch}</p>
                            <p className="app-copy-compact mt-2">Atualizado {commits.length > 0 ? commits[0].relativeDate : formatLastUpdated(repo.lastUpdated)}</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('code')}
                            className={detailActionCard}
                        >
                            <p className="app-metric-label">Arquivos visiveis</p>
                            <p className="mt-3 text-3xl font-light text-slate-900 dark:text-[var(--text-primary)]">{fileCount}</p>
                            <p className="app-copy-compact mt-2">{directoryCount} diretorios carregados na raiz atual.</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('issues')}
                            className={detailActionCard}
                        >
                            <p className="app-metric-label">Risco operacional</p>
                            <p className={`mt-3 text-3xl font-light ${openTaskCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{openTaskCount}</p>
                            <p className="app-copy-compact mt-2">Issues abertas vinculadas ao repositorio.</p>
                        </button>
                    </div>
                </div>
                <div className="surface-card panel-body-block rounded-[1.6rem] xl:col-span-5">
                    <p className="app-section-label">Leitura Rapida</p>
                    <div className="mt-4 space-y-3.5">
                        <button
                            type="button"
                            onClick={() => onOpenGit?.(repo.id)}
                            className={detailActionCard}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/[0.12] dark:text-blue-300">
                                    <GitCommit className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Ultimo movimento</h3>
                                    <p className="app-copy-compact mt-1">
                                        {commits.length > 0 ? commits[0].message : 'Ainda nao existem commits disponiveis para leitura nesta tela.'}
                                    </p>
                                </div>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('issues')}
                            className={detailActionCard}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/[0.12] dark:text-amber-300">
                                    <AlertCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Fluxo de tarefas</h3>
                                    <p className="app-copy-compact mt-1">
                                        {reviewTaskCount > 0 ? `${reviewTaskCount} item(ns) em revisao exigem acompanhamento antes de merge ou release.` : 'Nenhum item em revisao no momento.'}
                                    </p>
                                </div>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('settings')}
                            className={detailActionCard}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                                    <Eye className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Acompanhamento</h3>
                                    <p className="app-copy-compact mt-1">
                                        {repo.stars || 0} watchers e {repoTasks.length} tarefa(s) ligadas ao contexto deste repositorio.
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </section>

            {/* Tabs */}
            <div className="page-tabs">
                <nav className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'code' ? 'border-slate-200/80 bg-white/85 text-primary-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.08] dark:text-primary-300 dark:shadow-none' : 'border-transparent text-slate-500 hover:border-slate-200/70 hover:bg-slate-50/80 hover:text-slate-700 dark:text-[var(--text-muted)] dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:hover:text-white'}`}
                    >
                        <span className="inline-flex items-center gap-2"><Code2 className="h-4 w-4" /> Codigo</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('issues')}
                        className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'issues' ? 'border-slate-200/80 bg-white/85 text-primary-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.08] dark:text-primary-300 dark:shadow-none' : 'border-transparent text-slate-500 hover:border-slate-200/70 hover:bg-slate-50/80 hover:text-slate-700 dark:text-[var(--text-muted)] dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:hover:text-white'}`}
                    >
                        <span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Issues <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-white/[0.05]">{repoTasks.length}</span></span>
                    </button>
                    <button
                        disabled
                        className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 dark:text-slate-600 cursor-not-allowed"
                    >
                        <span className="inline-flex items-center gap-2"><GitPullRequest className="h-4 w-4" /> Pull Requests</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${activeTab === 'settings' ? 'border-slate-200/80 bg-white/85 text-primary-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.08] dark:text-primary-300 dark:shadow-none' : 'border-transparent text-slate-500 hover:border-slate-200/70 hover:bg-slate-50/80 hover:text-slate-700 dark:text-[var(--text-muted)] dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:hover:text-white'}`}
                    >
                        <span className="inline-flex items-center gap-2"><Settings className="h-4 w-4" /> Configuracoes</span>
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="flex-1">
                {activeTab === 'code' && (
                    <div className="page-panel-grid xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.9fr)]">
                        <div className="surface-card overflow-hidden rounded-[1.6rem]">
                            <div className="surface-header panel-header-compact flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="app-metric-label">Workspace local</p>
                                    <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">Arquivos da raiz do repositorio</h3>
                                </div>
                                {loadingCommits ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"></div>
                                        <span>Carregando commits...</span>
                                    </div>
                                ) : commits.length > 0 ? (
                                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                                        <div className="flex items-center gap-2">
                                            <Avatar name={commits[0].author} size="sm" />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-700 dark:text-slate-200">{commits[0].author}</p>
                                                <p className="truncate text-slate-500 dark:text-[var(--text-muted)]">{commits[0].message}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <GitCommit className="h-4 w-4" />
                                        <span>Sem commits ainda</span>
                                    </div>
                                )}
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-white/10">
                                {loading ? (
                                    <div className="px-5 py-10 text-center text-sm text-slate-400">Carregando arquivos...</div>
                                ) : files.length === 0 ? (
                                    <div className="surface-empty m-4 rounded-2xl px-5 py-10 text-center text-sm text-slate-400">
                                        Nenhum arquivo encontrado no repositorio.
                                    </div>
                                ) : (
                                    files.map((file, i) => {
                                        const timeAgo = new Date(file.modifiedAt).toLocaleDateString('pt-BR');
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-slate-50/85 dark:hover:bg-white/[0.03]"
                                                onClick={() => file.type === 'file' && handleOpenFile(file.name)}
                                                title={file.type === 'file' ? 'Clique para visualizar ou editar' : 'Diretorio'}
                                            >
                                                <div className="flex min-w-0 items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                                                    {file.type === 'directory' ? (
                                                        <Folder className="h-4 w-4 flex-shrink-0 text-blue-400" />
                                                    ) : (
                                                        <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                                                    )}
                                                    <span className={`truncate ${file.type === 'file' ? 'hover:text-primary-600 dark:hover:text-primary-300' : ''}`}>{file.name}</span>
                                                </div>
                                                <span className="flex-shrink-0 text-xs text-slate-400">{timeAgo}</span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="panel-stack">
                            <div className="surface-card overflow-hidden rounded-[1.6rem]">
                                <div className="surface-header panel-header-compact flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-400" />
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">README.md</h3>
                                </div>
                                <div className="max-h-[32rem] overflow-auto p-6 text-sm leading-7 text-slate-600 dark:text-slate-300">
                                    {loadingReadme ? (
                                        <p className="text-slate-400">Carregando README...</p>
                                    ) : readmeContent ? (
                                        <pre className="whitespace-pre-wrap font-sans text-sm leading-7">{readmeContent}</pre>
                                    ) : (
                                        <div className="surface-empty rounded-2xl px-5 py-10 text-center text-sm italic text-slate-400">
                                            Nenhum arquivo README.md encontrado neste repositorio.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="surface-card rounded-[1.6rem] p-5">
                                <p className="app-metric-label">Sinais tecnicos</p>
                                <div className="mt-4 space-y-3.5">
                                    <div className={detailInsetCard}>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Ultimo hash</p>
                                        <p className="mt-2 font-mono text-sm text-primary-600 dark:text-primary-300">{commits[0]?.hash || 'Sem hash disponivel'}</p>
                                    </div>
                                    <div className={detailInsetCard}>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Acompanhamento</p>
                                        <p className="app-copy-compact mt-2">
                                            {openTaskCount > 0 ? `${openTaskCount} tarefas abertas ligadas ao repositorio pedem alinhamento entre codigo e fluxo do board.` : 'Nao ha tarefas abertas vinculadas no momento.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'issues' && (
                    <div className="space-y-4">
                        {repoTasks.length === 0 ? (
                            <div className="surface-empty rounded-[1.6rem] px-6 py-14 text-center">
                                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-500" />
                                <h3 className="text-base font-medium text-slate-700 dark:text-slate-200">Nenhuma tarefa vinculada</h3>
                                <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">Crie tarefas no Kanban e associe este repositorio para acompanhar risco e entrega no mesmo contexto.</p>
                            </div>
                        ) : (
                            repoTasks.map(task => (
                                <div
                                    key={task.id}
                                    onClick={() => onNavigateToTask(task)}
                                    className="surface-card group cursor-pointer rounded-[1.35rem] border border-slate-200/75 bg-white/88 p-5 shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-lg hover:shadow-slate-200/70 dark:border-white/10 dark:bg-transparent dark:shadow-none dark:hover:shadow-xl"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="flex gap-3">
                                            <div className={`mt-0.5 ${task.status === 'done' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                <AlertCircle className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-800 transition-colors group-hover:text-primary-600 dark:text-slate-200 dark:group-hover:text-primary-300">
                                                    {task.title}
                                                </h4>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[var(--text-muted)]">
                                                    <span>#{task.id}</span>
                                                    <span>•</span>
                                                    <span>{task.assignee?.name || 'Sem responsavel'}</span>
                                                    <span>•</span>
                                                    <span className={`font-semibold uppercase ${getTaskPriorityToneClass(task.priority, 'repo-text')}`}>{task.priority}</span>
                                                    <span>•</span>
                                                    <span>{getTaskStatusLabel(task.status)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {task.tags.map(tag => (
                                                <span key={tag} className="rounded-full border border-slate-200/80 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
                {activeTab === 'settings' && (
                    <div className="max-w-3xl space-y-6">
                        <div className="surface-card rounded-[1.6rem] border border-slate-200/75 bg-white/90 p-6 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                <GitBranch className="h-4 w-4 text-orange-500" /> Integracao com GitLab
                            </h3>
                            <p className="mt-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">Configure o caminho do projeto no GitLab para leitura consistente de pipelines e integracoes automatizadas.</p>
                            <div className="mt-5 space-y-4">
                                <div>
                                    <label className="app-metric-label mb-2 block tracking-[0.16em]">GitLab Project Path <span className="normal-case tracking-normal text-slate-400">(namespace/projeto)</span></label>
                                    <input
                                        type="text"
                                        value={gitlabProjectPath}
                                        onChange={e => setGitlabProjectPath(e.target.value)}
                                        placeholder="Ex: minha-org/meu-projeto"
                                        className="app-input w-full rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                                    />
                                    <p className="mt-2 text-xs text-slate-400">Encontrado em GitLab → Projeto → Settings → General → namespace do projeto.</p>
                                </div>
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={savingSettings}
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" /> {savingSettings ? 'Salvando...' : 'Salvar configuracoes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            </div>

            {/* Modal de Visualização/Edição de Arquivo */}
            {selectedFile && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="app-flyout flex max-h-[90vh] w-full max-w-5xl flex-col rounded-[1.6rem]">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/45 px-6 py-4 dark:border-white/10 dark:bg-transparent">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-primary-500" />
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-white">{selectedFile}</h3>
                                    <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">
                                        {localPath ? `${localPath}/${selectedFile}` : selectedFile}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                                    >
                                        <Edit3 className="h-4 w-4" /> Editar
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                setEditedContent(fileContent);
                                                setIsEditing(false);
                                            }}
                                            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleRequestSave}
                                            disabled={savingFile}
                                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            <Save className="h-4 w-4" /> {savingFile ? 'Salvando...' : 'Salvar'}
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleCloseFile}
                                    className="rounded-xl p-2 transition-colors hover:bg-slate-100/85 dark:hover:bg-white/[0.04]"
                                >
                                    <X className="h-5 w-5 text-slate-500" />
                                </button>
                            </div>
                        </div>

                        {/* Conteúdo do Arquivo */}
                        <div className="flex-1 overflow-auto p-0">
                            {loadingFile ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
                                </div>
                            ) : isEditing ? (
                                <textarea
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    className="w-full min-h-[400px] resize-none border-0 bg-slate-50/85 p-4 font-mono text-sm text-slate-800 focus:outline-none dark:bg-slate-950 dark:text-slate-200"
                                    spellCheck={false}
                                />
                            ) : (
                                <pre className="min-h-[400px] overflow-x-auto whitespace-pre-wrap bg-slate-50/85 p-4 font-mono text-sm text-slate-800 dark:bg-slate-950 dark:text-slate-200">
                                    <code>{fileContent}</code>
                                </pre>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/45 px-6 py-3 text-xs text-slate-500 dark:border-white/10 dark:bg-transparent dark:text-[var(--text-muted)]">
                            <span>Linguagem: {getFileLanguage(selectedFile)}</span>
                            <span>{isEditing ? editedContent.split('\n').length : fileContent.split('\n').length} linhas</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Commit */}
            {showCommitModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="app-flyout w-full max-w-lg rounded-[1.6rem]">
                        <div className="border-b border-slate-200/80 bg-slate-50/45 px-6 py-4 dark:border-white/10 dark:bg-transparent">
                            <div className="flex items-center gap-3">
                                <GitCommit className="h-5 w-5 text-emerald-500" />
                                <h3 className="font-semibold text-lg text-slate-800 dark:text-white">Confirmar Alterações</h3>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                Salvando alterações em <span className="font-mono text-primary-600 dark:text-primary-300">{selectedFile}</span>
                            </p>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Mensagem do Commit
                            </label>
                            <textarea
                                value={commitMessage}
                                onChange={(e) => setCommitMessage(e.target.value)}
                                placeholder="Descreva as alterações realizadas..."
                                className="app-input w-full resize-none rounded-xl px-3 py-2 text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                                rows={3}
                                autoFocus
                            />
                            <p className="text-xs text-slate-400 mt-2">
                                Dica: Use mensagens descritivas como "Corrige bug no login" ou "Adiciona validação de formulário"
                            </p>
                        </div>
                        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-white/10">
                            <button
                                onClick={handleCancelCommit}
                                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.04]"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmCommit}
                                disabled={!commitMessage.trim() || savingFile}
                                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <GitCommit className="h-4 w-4" />
                                {savingFile ? 'Commitando...' : 'Commit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RepoDetail;


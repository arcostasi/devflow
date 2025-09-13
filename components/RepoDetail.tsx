
import React, { useState, useEffect } from 'react';
import { Repository, Task } from '../types';
import { ArrowLeft, GitBranch, Clock, AlertCircle, Copy, FileText, Code2, GitPullRequest, Star, Eye, Folder, X, Save, Edit3, GitCommit, Settings, AlertTriangle, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { api } from '../services/api';
import { useConfirm } from '../contexts/ConfirmContext';

interface RepoFile {
    name: string;
    type: 'file' | 'directory';
    modifiedAt: string;
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
}

const RepoDetail: React.FC<RepoDetailProps> = ({ repo, tasks, onBack, onNavigateToTask, addToast, onDeleteRepo }) => {
    const { confirm } = useConfirm();
    const [activeTab, setActiveTab] = useState<'code' | 'issues' | 'settings'>('code');
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
    const [gitlabProjectPath, setGitlabProjectPath] = useState<string>((repo as any).gitlabProjectPath || '');
    const [savingSettings, setSavingSettings] = useState(false);

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
    const loadFiles = async (): Promise<boolean> => {
        try {
            setLoading(true);
            const data = await api.getRepoFiles(repo.id);
            setFiles(data.files);
            setLocalPath(data.localPath || '');
            return true;
        } catch (error: any) {
            const msg: string = error?.message || '';
            if (msg.includes('não encontrado') || msg.includes('not found') || msg.includes('ENOENT')) {
                setPathMissing(true);
            } else {
                console.error('Erro ao carregar arquivos:', error);
                addToast('Falha ao Carregar Arquivos', 'error', msg || 'Não foi possível listar os arquivos do repositório.');
            }
            return false;
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
    const loadReadme = async () => {
        try {
            setLoadingReadme(true);
            // Tentar carregar README.md
            const data = await api.getRepoFileContent(repo.id, 'README.md');
            setReadmeContent(data.content);
        } catch (_error) {
            // Se não encontrar README.md, tentar readme.md
            try {
                const data = await api.getRepoFileContent(repo.id, 'readme.md');
                setReadmeContent(data.content);
            } catch {
                setReadmeContent('');
            }
        } finally {
            setLoadingReadme(false);
        }
    };

    useEffect(() => {
        setPathMissing(false);
        loadFiles().then(ok => {
            if (ok) {
                loadCommits();
                loadReadme();
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
    const repoTasks = tasks.filter(t => t.repositoryId === repo.id);

    // Abrir arquivo para visualização
    const handleOpenFile = async (fileName: string) => {
        try {
            setLoadingFile(true);
            setSelectedFile(fileName);
            const data = await api.getRepoFileContent(repo.id, fileName);
            setFileContent(data.content);
            setEditedContent(data.content);
            setIsEditing(false);
        } catch (error: any) {
            console.error('Erro ao abrir arquivo:', error);
            addToast('Falha ao Abrir Arquivo', 'error', error.message || 'Não foi possível ler o conteúdo do arquivo.');
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
        } catch (error: any) {
            console.error('Erro ao salvar arquivo:', error);
            addToast('Falha ao Salvar', 'error', error.message || 'Não foi possível salvar as alterações no arquivo.');
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
        <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
            {/* Missing path banner */}
            {pathMissing && (
                <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Diretório não encontrado</p>
                            {repo.localPath && (
                                <p className="text-xs text-amber-600 dark:text-amber-500 font-mono mt-0.5 break-all">{repo.localPath}</p>
                            )}
                            <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-1">
                                O diretório local foi removido ou movido. Remova este repositório do sistema ou restaure o diretório.
                            </p>
                        </div>
                        {onDeleteRepo && (
                            <button
                                onClick={async () => {
                                    if (!await confirm({ title: 'Remover Repositório', message: `Remover "${repo.name}" do DevFlow?\n\nIsso apenas remove o registro do sistema. Os arquivos no disco não serão afetados.`, confirmText: 'Remover', variant: 'warning' })) return;
                                    onDeleteRepo(repo.id);
                                    onBack();
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800/30 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded border border-amber-200 dark:border-amber-700/50 transition-colors flex-shrink-0"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Remover do Sistema
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-fiori-blue mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar para Repositórios
                </button>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{repo.name}</h1>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${repo.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}>
                                {repo.status === 'active' ? 'Public' : 'Archived'}
                            </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed">
                            {repo.description || 'Sem descrição.'}
                        </p>

                        <div className="flex items-center gap-6 mt-4 text-xs font-medium text-slate-500 dark:text-slate-500">
                            <div className="flex items-center gap-1.5 hover:text-fiori-blue transition-colors cursor-default">
                                <GitBranch className="w-3.5 h-3.5" />
                                <span className="font-mono">{repo.branch}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Atualizado {commits.length > 0 ? commits[0].relativeDate : formatLastUpdated(repo.lastUpdated)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5" />
                                <span>0 stars</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5" />
                                <span>{repo.stars || 0} watching</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowCodeDropdown(!showCodeDropdown)}
                            className="flex items-center gap-2 px-4 py-2 bg-fiori-blue hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm"
                        >
                            <Code2 className="w-4 h-4" /> Code
                        </button>
                        {showCodeDropdown && (
                            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50">
                                <div className="p-4">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Caminho Local</h4>
                                    <div className="bg-slate-100 dark:bg-slate-900 rounded p-2 font-mono text-xs text-slate-600 dark:text-slate-400 break-all mb-3">
                                        {localPath || 'Não disponível'}
                                    </div>
                                    <div className="space-y-2">
                                        <button
                                            onClick={handleCopyPath}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                        >
                                            <Copy className="w-4 h-4" />
                                            Copiar Caminho
                                        </button>
                                        <button
                                            onClick={handleOpenInExplorer}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                        >
                                            <Folder className="w-4 h-4" />
                                            Copiar Comando Explorer
                                        </button>
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2">
                                    <button
                                        onClick={() => setShowCodeDropdown(false)}
                                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-800 mb-6">
                <nav className="-mb-px flex space-x-6">
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`pb-3 px-1 border-b-[3px] font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'code' ? 'border-fiori-blue text-fiori-blue' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Code2 className="w-4 h-4" /> Código
                    </button>
                    <button
                        onClick={() => setActiveTab('issues')}
                        className={`pb-3 px-1 border-b-[3px] font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'issues' ? 'border-fiori-blue text-fiori-blue' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <AlertCircle className="w-4 h-4" /> Issues
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full text-xs">{repoTasks.length}</span>
                    </button>
                    <button
                        disabled
                        className="pb-3 px-1 border-b-[3px] border-transparent font-medium text-sm flex items-center gap-2 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                    >
                        <GitPullRequest className="w-4 h-4" /> Pull Requests
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`pb-3 px-1 border-b-[3px] font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'settings' ? 'border-fiori-blue text-fiori-blue' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Settings className="w-4 h-4" /> Configurações
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="flex-1">
                {activeTab === 'code' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden shadow-sm">
                            <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between backdrop-blur-sm">
                                {loadingCommits ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <div className="animate-pulse w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                                        <span>Carregando commits...</span>
                                    </div>
                                ) : commits.length > 0 ? (
                                    <>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Avatar name={commits[0].author} size="sm" />
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">{commits[0].author}</span>
                                            <span className="text-slate-500 truncate max-w-md">{commits[0].message}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                                            <span className="text-fiori-blue">{commits[0].hash}</span>
                                            <span>{commits[0].relativeDate}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <GitCommit className="w-4 h-4" />
                                        <span>Sem commits ainda</span>
                                    </div>
                                )}
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <div className="px-4 py-8 text-center text-slate-400 text-sm">
                                        Carregando arquivos...
                                    </div>
                                ) : files.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-slate-400 text-sm">
                                        Nenhum arquivo encontrado no repositório.
                                    </div>
                                ) : (
                                    files.map((file, i) => {
                                        const timeAgo = new Date(file.modifiedAt).toLocaleDateString('pt-BR');
                                        return (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group transition-colors border-b border-transparent hover:border-slate-100 dark:hover:border-slate-700/50"
                                                onClick={() => file.type === 'file' && handleOpenFile(file.name)}
                                                title={file.type === 'file' ? 'Clique para visualizar/editar' : 'Diretório'}
                                            >
                                                <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                                    {file.type === 'directory' ? (
                                                        <Folder className="w-4 h-4 text-blue-400 fill-blue-400/20" />
                                                    ) : (
                                                        <FileText className="w-4 h-4 text-slate-400" />
                                                    )}
                                                    <span className={`${file.type === 'file' ? 'group-hover:text-fiori-blue group-hover:underline' : ''}`}>{file.name}</span>
                                                </div>
                                                <span className="text-xs text-slate-400">{timeAgo}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden shadow-sm">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center gap-2 sticky top-0">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">README.md</h3>
                            </div>
                            <div className="p-8 prose dark:prose-invert max-w-none text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                {loadingReadme ? (
                                    <p className="text-slate-400">Carregando README...</p>
                                ) : readmeContent ? (
                                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{readmeContent}</pre>
                                ) : (
                                    <p className="text-slate-400 italic">Nenhum arquivo README.md encontrado neste repositório.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'issues' && (
                    <div className="space-y-4">
                        {repoTasks.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma tarefa vinculada</h3>
                                <p className="text-xs text-slate-400 mt-1">Crie tarefas no quadro Kanban e vincule a este repositório.</p>
                            </div>
                        ) : (
                            repoTasks.map(task => (
                                <div
                                    key={task.id}
                                    onClick={() => onNavigateToTask(task)}
                                    className="bg-fiori-cardLight dark:bg-fiori-cardDark p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-fiori-blue dark:hover:border-fiori-blue transition-all cursor-pointer group shadow-sm"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <div className={`mt-0.5 ${task.status === 'done' ? 'text-emerald-500' : 'text-emerald-600'}`}>
                                                <AlertCircle className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-fiori-blue transition-colors">
                                                    {task.title}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <span>#{task.id} aberto por {task.assignee?.name || 'Desconhecido'}</span>
                                                    <span>•</span>
                                                    <span className={`uppercase font-bold ${task.priority === 'high' ? 'text-red-500' :
                                                        task.priority === 'medium' ? 'text-amber-500' : 'text-blue-500'
                                                        }`}>{task.priority}</span>
                                                    <span>•</span>
                                                    <span className="capitalize">{task.status === 'todo' ? 'A Fazer' : task.status === 'doing' ? 'Em Progresso' : task.status === 'review' ? 'Revisão' : 'Concluído'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            {task.tags.map(tag => (
                                                <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
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
                    <div className="max-w-2xl space-y-6">
                        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-lg p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
                                <GitBranch className="w-4 h-4 text-orange-500" /> GitLab Integration
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">Configure o caminho do projeto no GitLab para sincronizar pipelines corretamente.</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">GitLab Project Path <span className="text-slate-400">(namespace/projeto)</span></label>
                                    <input
                                        type="text"
                                        value={gitlabProjectPath}
                                        onChange={e => setGitlabProjectPath(e.target.value)}
                                        placeholder="Ex: minha-org/meu-projeto"
                                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-fiori-blue focus:outline-none font-mono"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Encontrado em: GitLab → Projeto → Settings → General → Project ID / namespace.</p>
                                </div>
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={savingSettings}
                                    className="flex items-center gap-2 px-4 py-2 bg-fiori-blue hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" /> {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Visualização/Edição de Arquivo */}
            {selectedFile && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-fiori-blue" />
                                <div>
                                    <h3 className="font-semibold text-slate-800 dark:text-white">{selectedFile}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {localPath ? `${localPath}/${selectedFile}` : selectedFile}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-fiori-blue hover:bg-fiori-blue/90 text-white rounded-md text-sm font-medium transition-colors"
                                    >
                                        <Edit3 className="w-4 h-4" /> Editar
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => {
                                                setEditedContent(fileContent);
                                                setIsEditing(false);
                                            }}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md text-sm font-medium transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleRequestSave}
                                            disabled={savingFile}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            <Save className="w-4 h-4" /> {savingFile ? 'Salvando...' : 'Salvar'}
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={handleCloseFile}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                        </div>

                        {/* Conteúdo do Arquivo */}
                        <div className="flex-1 overflow-auto p-0">
                            {loadingFile ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="animate-spin w-8 h-8 border-4 border-fiori-blue border-t-transparent rounded-full"></div>
                                </div>
                            ) : isEditing ? (
                                <textarea
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    className="w-full h-full min-h-[400px] p-4 font-mono text-sm bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border-0 resize-none focus:outline-none"
                                    spellCheck={false}
                                />
                            ) : (
                                <pre className="p-4 font-mono text-sm bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 whitespace-pre-wrap overflow-x-auto min-h-[400px]">
                                    <code>{fileContent}</code>
                                </pre>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
                            <span>Linguagem: {getFileLanguage(selectedFile)}</span>
                            <span>{isEditing ? editedContent.split('\n').length : fileContent.split('\n').length} linhas</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Commit */}
            {showCommitModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <GitCommit className="w-5 h-5 text-emerald-500" />
                                <h3 className="font-semibold text-lg text-slate-800 dark:text-white">Confirmar Alterações</h3>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                Salvando alterações em <span className="font-mono text-fiori-blue">{selectedFile}</span>
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
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-fiori-blue focus:border-transparent resize-none"
                                rows={3}
                                autoFocus
                            />
                            <p className="text-xs text-slate-400 mt-2">
                                Dica: Use mensagens descritivas como "Corrige bug no login" ou "Adiciona validação de formulário"
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={handleCancelCommit}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmCommit}
                                disabled={!commitMessage.trim() || savingFile}
                                className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <GitCommit className="w-4 h-4" />
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


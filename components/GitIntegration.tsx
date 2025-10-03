
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GitChange, FileNode, ActivityLog, Repository, GitCommit } from '../types';
import { api } from '../services/api';
import { GitBranch, RefreshCw, Check, Undo2, Plus, FileCode, FilePlus, FileMinus, ChevronRight, ChevronDown, Sparkles, ArrowDown, ArrowUp, Folder, FolderOpen, BarChart3, Zap, Flame, FolderGit2, Link, Settings2, AlertTriangle, Trash2 } from 'lucide-react';
import { useConfirm } from '../contexts/ConfirmContext';

// Syntax Highlighting imports - usando PrismLight para bundle menor
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Registrar apenas as linguagens mais usadas (Otimizado: C, C++, PHP, HTML, CSS, JS, TS)
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'; // HTML
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';

SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('php', php);

SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('markup', markup); // Fallback
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('md', markdown);

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/g;
const cleanFileName = (name: string): string => name.replace(CONTROL_CHARS_RE, '').trim();

// Markdown imports
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface GitIntegrationProps {
    repos: Repository[];
    addToast: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
    logActivity: (action: string, target: string, targetType: ActivityLog['targetType'], meta?: string) => void;
    onRefreshData?: () => void;
}


// Helper: detectar linguagem pelo nome do arquivo
const getLanguageFromFilename = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'jsx',
        'ts': 'typescript',
        'tsx': 'tsx',
        'py': 'python',
        'json': 'json',
        'md': 'markdown',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'sql': 'sql',
        'sh': 'bash',
        'bash': 'bash',
        'c': 'c',
        'cpp': 'cpp',
        'h': 'c',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
        'rb': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'kt': 'kotlin',
    };
    return langMap[ext] || 'text';
};

// Componente CodeEditor com react-syntax-highlighter
const CodeEditor: React.FC<{ content: string; language: string; filename?: string }> = ({ content, language, filename }) => {
    // Detectar tema do sistema
    const isDark = document.documentElement.classList.contains('dark');
    const detectedLang = filename ? getLanguageFromFilename(filename) : language;

    return (
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
            <SyntaxHighlighter
                language={detectedLang}
                style={isDark ? oneDark : oneLight}
                showLineNumbers={true}
                wrapLines={true}
                customStyle={{
                    margin: 0,
                    padding: '1rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    background: 'transparent',
                    minHeight: '100%',
                }}
                lineNumberStyle={{
                    minWidth: '2.5rem',
                    paddingRight: '1rem',
                    color: '#64748b',
                    userSelect: 'none',
                }}
            >
                {content}
            </SyntaxHighlighter>
        </div>
    );
};

// Componente para renderizar Markdown
const MarkdownViewer: React.FC<{ content: string }> = ({ content }) => {
    const isDark = document.documentElement.classList.contains('dark');

    return (
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 p-6">
            <div className="prose dark:prose-invert max-w-none prose-sm prose-pre:bg-slate-100 dark:prose-pre:bg-slate-900 prose-code:text-pink-600 dark:prose-code:text-pink-400">
                <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        // Syntax highlighting para code blocks dentro do Markdown
                        code({ node: _node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeContent = String(children).replace(/\n$/, '');

                            return !inline && match ? (
                                <SyntaxHighlighter
                                    style={isDark ? oneDark : oneLight}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{
                                        borderRadius: '0.5rem',
                                        fontSize: '0.8rem',
                                    }}
                                >
                                    {codeContent}
                                </SyntaxHighlighter>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            );
                        }
                    }}
                >
                    {content}
                </Markdown>
            </div>
        </div>
    );
};

// --- INSIGHTS COMPONENT ---
interface InsightsPanelProps {
    repoFiles: FileNode[];
    changes: GitChange[];
    repoId: string | null;
    currentBranch: string;
}

const InsightsPanel: React.FC<InsightsPanelProps> = ({ repoFiles, changes, repoId, currentBranch }) => {
    const totalFiles = repoFiles.filter(f => f.type === 'file').length;
    const changedFiles = changes.length;
    const healthScore = totalFiles > 0 ? Math.max(0, 100 - (changedFiles * 10)) : 0;

    const [commits, setCommits] = useState<GitCommit[]>([]);
    const [logTotal, setLogTotal] = useState(0);
    const [logPage, setLogPage] = useState(0);
    const [logLoading, setLogLoading] = useState(false);
    const LOG_LIMIT = 20;

    useEffect(() => {
        if (!repoId) return;
        setLogLoading(true);
        api.getRepoGitLog(repoId, { branch: currentBranch, limit: LOG_LIMIT, skip: logPage * LOG_LIMIT })
            .then(data => {
                setCommits(data.commits);
                setLogTotal(data.total);
            })
            .catch(() => {})
            .finally(() => setLogLoading(false));
    }, [repoId, currentBranch, logPage]);

    const totalPages = Math.ceil(logTotal / LOG_LIMIT);

    const formatDate = (iso: string) => {
        try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch { return iso; }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/50 overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto w-full space-y-8">

                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-fiori-blue" />
                        Code Intelligence
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Análise estática e métricas do repositório.</p>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900/30 p-5 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Arquivos</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{totalFiles}</div>
                        <p className="text-xs text-slate-400 mt-1">Total no repositório</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900/30 p-5 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Commits</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{logTotal}</div>
                        <p className="text-xs text-slate-400 mt-1">Em {currentBranch}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900/30 p-5 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Health Score</span>
                        </div>
                        <div className={`text-3xl font-bold tracking-tight ${healthScore >= 80 ? 'text-emerald-500' : healthScore >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                            {healthScore}%
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{changedFiles} alterações pendentes</p>
                    </div>
                </div>

                {/* Git Log */}
                <div className="bg-white dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <GitBranch className="w-3.5 h-3.5" /> Histórico de Commits — {currentBranch}
                        </h3>
                        <span className="text-xs text-slate-400">{logTotal} commits</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {logLoading ? (
                            <div className="px-6 py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando histórico...
                            </div>
                        ) : commits.length === 0 ? (
                            <div className="px-6 py-8 text-center text-slate-400 text-sm italic">
                                Nenhum commit encontrado.
                            </div>
                        ) : (
                            commits.map((commit) => (
                                <div key={commit.fullHash} className="px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{commit.message}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{commit.author} · {formatDate(commit.date)}</p>
                                        </div>
                                        <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded flex-shrink-0">{commit.hash}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/20">
                            <button
                                onClick={() => setLogPage(p => Math.max(0, p - 1))}
                                disabled={logPage === 0}
                                className="text-xs px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                            >
                                ← Anterior
                            </button>
                            <span className="text-xs text-slate-400">Página {logPage + 1} de {totalPages}</span>
                            <button
                                onClick={() => setLogPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={logPage >= totalPages - 1}
                                className="text-xs px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                            >
                                Próxima →
                            </button>
                        </div>
                    )}
                </div>

                {/* Changed Files List */}
                {changes.length > 0 && (
                    <div className="bg-white dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Alterações Pendentes ({changedFiles})</h3>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {changes.map((change, idx) => (
                                <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <FileCode className="w-4 h-4 text-slate-400" />
                                        <p className="text-sm font-mono text-slate-700 dark:text-slate-200">{change.file}</p>
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${change.status === 'added' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : change.status === 'deleted' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                                        {change.status === 'added' ? 'Novo' : change.status === 'deleted' ? 'Removido' : 'Modificado'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const GitIntegration: React.FC<GitIntegrationProps> = ({ repos, addToast, logActivity, onRefreshData }) => {
    const { confirm } = useConfirm();
    // Estado para repositório selecionado
    const [selectedRepoId, setSelectedRepoId] = useState<string | null>(repos.length > 0 ? repos[0].id : null);
    const selectedRepo = repos.find(r => r.id === selectedRepoId);

    // Todos os hooks devem ser declarados antes de qualquer return condicional
    const [activeTab, setActiveTab] = useState<'changes' | 'source' | 'insights'>('changes');
    const [changes, setChanges] = useState<GitChange[]>([]);
    const [stagedChanges, setStagedChanges] = useState<GitChange[]>([]);
    const [commitMessage, setCommitMessage] = useState('');
    const [isPushing, setIsPushing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [activeFileNode, setActiveFileNode] = useState<FileNode | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [currentBranch, setCurrentBranch] = useState('main');
    const [branches, setBranches] = useState<string[]>([]);
    const [isNewBranchOpen, setIsNewBranchOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [repoPathMissing, setRepoPathMissing] = useState(false);
    const [remoteUrl, setRemoteUrl] = useState('');
    const [isRemoteConfigOpen, setIsRemoteConfigOpen] = useState(false);
    const [remoteUrlInput, setRemoteUrlInput] = useState('');

    // Estado para arquivos reais do repositório
    const [repoFiles, setRepoFiles] = useState<FileNode[]>([]);
    const [currentSubPath, setCurrentSubPath] = useState<string>(''); // current directory relative to repo root

    const [leftPanelWidth, setLeftPanelWidth] = useState(350);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Show empty state if no repositories are registered
    if (!repos || repos.length === 0) {
        return (
            <div className="h-full flex items-center justify-center bg-fiori-bgLight dark:bg-fiori-bgDark p-8">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FolderGit2 className="w-10 h-10 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-700 dark:text-white mb-3">Nenhum Repositório Configurado</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        Para usar a integração Git, primeiro adicione um repositório na aba "Repositórios" ou configure o diretório Git nas configurações do sistema.
                    </p>
                </div>
            </div>
        );
    }


    const startResizing = useCallback(() => setIsResizing(true), []);
    const stopResizing = useCallback(() => setIsResizing(false), []);
    const resize = useCallback((mouseEvent: MouseEvent) => {
        if (isResizing && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = mouseEvent.clientX - containerRect.left;
            if (newWidth > 200 && newWidth < 800) setLeftPanelWidth(newWidth);
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    // Carregar dados do repositório selecionado
    useEffect(() => {
        const loadRepoData = async () => {
            if (!selectedRepoId) return;

            setIsLoading(true);
            try {
                // Carregar status Git
                const gitStatus = await api.getRepoGitStatus(selectedRepoId);
                // Limpar nomes de arquivos que podem vir corrompidos do git status
                const cleanedChanges = gitStatus.changes.map((c: GitChange) => ({
                    ...c,
                    file: cleanFileName(c.file)
                }));
                setChanges(cleanedChanges);
                setCurrentBranch(gitStatus.branch);

                // Carregar branches
                const branchData = await api.getRepoBranches(selectedRepoId);
                setBranches(branchData.branches);

                // Carregar arquivos do repositório
                const filesData = await api.getRepoFiles(selectedRepoId, '');
                const fileNodes: FileNode[] = filesData.files.map((f, i) => ({
                    id: `file-${i}`,
                    name: f.name,
                    relativePath: f.relativePath || f.name,
                    type: f.type === 'directory' ? 'folder' : 'file',
                    language: f.name.endsWith('.tsx') ? 'tsx' : f.name.endsWith('.ts') ? 'ts' : f.name.endsWith('.js') ? 'js' : 'text'
                }));
                setRepoFiles(fileNodes);
                setCurrentSubPath('');

                // Carregar remotes configurados
                try {
                    const remotesData = await api.getRemotes(selectedRepoId);
                    const originUrl = remotesData.remotes?.origin || '';
                    setRemoteUrl(originUrl);
                    setRemoteUrlInput(originUrl);
                } catch { /* remote opcional */ }

            } catch (err: any) {
                const msg: string = err?.message || '';
                if (msg.includes('não encontrado') || msg.includes('not found') || msg.includes('ENOENT')) {
                    setRepoPathMissing(true);
                } else {
                    console.error('Falha ao carregar dados do repositório:', err);
                    addToast('Falha ao Carregar Repositório', 'error', msg || 'Não foi possível obter os dados do repositório.');
                }
            } finally {
                setIsLoading(false);
            }
        };
        loadRepoData();
        // Reset staged changes and path error when switching repos
        setStagedChanges([]);
        setRepoPathMissing(false);
    }, [selectedRepoId]);

    const loadDirectory = async (subPath: string) => {
        if (!selectedRepoId) return;
        try {
            const filesData = await api.getRepoFiles(selectedRepoId, subPath);
            const fileNodes: FileNode[] = filesData.files.map((f, i) => ({
                id: `file-${subPath}-${i}`,
                name: f.name,
                relativePath: f.relativePath || f.name,
                type: f.type === 'directory' ? 'folder' : 'file',
                language: f.name.endsWith('.tsx') ? 'tsx' : f.name.endsWith('.ts') ? 'ts' : f.name.endsWith('.js') ? 'js' : 'text'
            }));
            setRepoFiles(fileNodes);
            setCurrentSubPath(subPath);
            setActiveFileNode(null);
        } catch (err: any) {
            addToast('Falha ao Abrir Diretório', 'error', err.message || 'Não foi possível acessar o diretório solicitado.');
        }
    };

    const handlePull = async () => {
        if (!selectedRepoId) return;
        setIsPulling(true);
        try {
            const result = await api.pullRepo(selectedRepoId, 'origin', currentBranch);
            addToast('Pull Concluído', 'success', result.message || `Branch ${currentBranch} atualizada com as alterações remotas.`);
            // Reload git status after pull
            const gitStatus = await api.getRepoGitStatus(selectedRepoId);
            const cleanedChanges = gitStatus.changes.map((c: GitChange) => ({
                ...c,
                file: cleanFileName(c.file)
            }));
            setChanges(cleanedChanges);
            if (onRefreshData) onRefreshData();
        } catch (e: any) {
            addToast('Falha no Pull', 'error', e.message || `Não foi possível atualizar a branch ${currentBranch}.`);
        } finally {
            setIsPulling(false);
        }
    };

    const handleSaveRemote = async () => {
        if (!selectedRepoId || !remoteUrlInput.trim()) return;
        try {
            await api.setRemoteUrl(selectedRepoId, remoteUrlInput.trim());
            setRemoteUrl(remoteUrlInput.trim());
            setIsRemoteConfigOpen(false);
            addToast('Remote Configurado', 'success', `URL remota definida como ${remoteUrlInput.trim()}`);
        } catch (e: any) {
            addToast('Falha ao Configurar Remote', 'error', e.message || 'Verifique a URL informada e tente novamente.');
        }
    };

    const stageFile = async (id: string) => {
        const file = changes.find(c => c.id === id);
        if (!file || !selectedRepoId) return;
        // Optimistic UI update
        setChanges(prev => prev.filter(c => c.id !== id));
        setStagedChanges(prev => [...prev, file]);
        if (selectedFileId === id) setSelectedFileId(null);
        try {
            await api.stageFiles(selectedRepoId, [file.file]);
        } catch (err: any) {
            // Rollback on failure
            setChanges(prev => [...prev, file]);
            setStagedChanges(prev => prev.filter(c => c.id !== id));
            addToast('Falha no Stage', 'error', err.message || 'Não foi possível adicionar o arquivo ao stage.');
        }
    };

    const unstageFile = async (id: string) => {
        const file = stagedChanges.find(c => c.id === id);
        if (!file || !selectedRepoId) return;
        // Optimistic UI update
        setStagedChanges(prev => prev.filter(c => c.id !== id));
        setChanges(prev => [...prev, file]);
        if (selectedFileId === id) setSelectedFileId(null);
        try {
            await api.unstageFiles(selectedRepoId, [file.file]);
        } catch (err: any) {
            // Rollback on failure
            setStagedChanges(prev => [...prev, file]);
            setChanges(prev => prev.filter(c => c.id !== id));
            addToast('Falha no Unstage', 'error', err.message || 'Não foi possível remover o arquivo do stage.');
        }
    };

    const stageAll = async () => {
        if (!selectedRepoId || changes.length === 0) return;
        const toStage = [...changes];
        setStagedChanges(prev => [...prev, ...toStage]);
        setChanges([]);
        try {
            await api.stageFiles(selectedRepoId, toStage.map(c => c.file));
        } catch (err: any) {
            // Rollback
            setChanges(prev => [...prev, ...toStage]);
            setStagedChanges(prev => prev.filter(c => !toStage.find(t => t.id === c.id)));
            addToast('Falha no Stage', 'error', err.message || 'Não foi possível adicionar os arquivos ao stage.');
        }
    };

    const unstageAll = async () => {
        if (!selectedRepoId || stagedChanges.length === 0) return;
        const toUnstage = [...stagedChanges];
        setChanges(prev => [...prev, ...toUnstage]);
        setStagedChanges([]);
        try {
            await api.unstageFiles(selectedRepoId, toUnstage.map(c => c.file));
        } catch (err: any) {
            // Rollback
            setStagedChanges(prev => [...prev, ...toUnstage]);
            setChanges(prev => prev.filter(c => !toUnstage.find(t => t.id === c.id)));
            addToast('Falha no Unstage', 'error', err.message || 'Não foi possível remover os arquivos do stage.');
        }
    };

    const generateCommitMessage = () => {
        if (stagedChanges.length === 0) return;
        setIsGenerating(true);

        const files = stagedChanges.map(c => c.file);
        const added = stagedChanges.filter(c => c.status === 'added').map(c => c.file);
        const deleted = stagedChanges.filter(c => c.status === 'deleted').map(c => c.file);
        const modified = stagedChanges.filter(c => c.status === 'modified').map(c => c.file);

        const exts = files.map(f => f.split('.').pop()?.toLowerCase() || '');
        const hasTests = files.some(f => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'));
        const hasStyles = exts.some(e => ['css', 'scss', 'sass', 'less'].includes(e));
        const hasConfig = files.some(f => ['package.json', 'tsconfig.json', 'vite.config', '.env', 'webpack', 'eslint', '.gitignore'].some(c => f.includes(c)));
        const hasComponents = files.some(f => f.includes('components/') || f.endsWith('.tsx') || f.endsWith('.jsx'));
        const hasBackend = files.some(f => f.includes('server/') || f.includes('routes/') || f.includes('api.'));
        const hasDb = files.some(f => f.includes('db.') || f.includes('migration') || f.includes('schema'));

        let prefix = 'chore';
        let scope = '';
        let description = '';

        if (hasTests) { prefix = 'test'; }
        else if (hasStyles && !hasComponents) { prefix = 'style'; }
        else if (hasConfig) { prefix = 'chore'; scope = 'config'; }
        else if (hasDb) { prefix = 'feat'; scope = 'db'; }
        else if (hasBackend) { prefix = modified.length > 0 ? 'fix' : 'feat'; scope = 'api'; }
        else if (hasComponents) { prefix = added.length > 0 ? 'feat' : 'fix'; scope = 'ui'; }
        else if (deleted.length === files.length) { prefix = 'refactor'; }
        else if (modified.length > 0 && added.length === 0) { prefix = 'fix'; }
        else { prefix = 'feat'; }

        const fileNames = files.map(f => f.split('/').pop()?.replace(/\.[^.]+$/, '') || f);
        if (files.length === 1) {
            description = `update ${fileNames[0]}`;
        } else if (files.length <= 3) {
            description = `update ${fileNames.join(', ')}`;
        } else {
            description = `update ${files.length} files`;
        }

        const msg = scope ? `${prefix}(${scope}): ${description}` : `${prefix}: ${description}`;
        setCommitMessage(msg);
        setIsGenerating(false);
    };

    const handleCommit = async () => {
        if (!commitMessage.trim() || !selectedRepoId) return;
        if (stagedChanges.length === 0) {
            addToast('Stage Vazio', 'info', 'Adicione arquivos ao stage antes de realizar o commit.');
            return;
        }
        try {
            // Commit only the staged files (already staged via stageFile/stageAll)
            await api.commitRepoChanges(selectedRepoId, commitMessage);
            setStagedChanges([]);
            setCommitMessage('');
            setSelectedFileId(null);
            logActivity('realizou commit', commitMessage.substring(0, 30) + '...', 'commit', 'HEAD');
            addToast('Commit Realizado', 'success', `"${commitMessage.substring(0, 40)}${commitMessage.length > 40 ? '...' : ''}" salvo com sucesso.`);
            // Reload git status
            const gitStatus = await api.getRepoGitStatus(selectedRepoId);
            const cleanedChanges = gitStatus.changes.map((c: GitChange) => ({
                ...c,
                file: cleanFileName(c.file)
            }));
            setChanges(cleanedChanges);
            if (onRefreshData) onRefreshData();
        } catch (e: any) {
            addToast('Falha no Commit', 'error', e.message || 'Não foi possível criar o commit. Verifique os arquivos no stage.');
        }
    };

    const handlePush = async () => {
        if (!selectedRepoId) return;
        setIsPushing(true);
        try {
            const result = await api.pushRepo(selectedRepoId, 'origin', currentBranch);
            logActivity('realizou push', currentBranch, 'repo');
            addToast('Push Concluído', 'success', result.message || `Alterações enviadas para origin/${currentBranch}.`);
        } catch (e: any) {
            addToast('Falha no Push', 'error', e.message || `Não foi possível enviar as alterações para origin/${currentBranch}.`);
        } finally {
            setIsPushing(false);
        }
    };

    const handleCreateBranch = async () => {
        if (!newBranchName.trim() || !selectedRepoId) return;
        const name = newBranchName.startsWith('feature/') || newBranchName.startsWith('hotfix/') || newBranchName.startsWith('fix/')
            ? newBranchName
            : `feature/${newBranchName}`;
        try {
            const result = await api.createBranch(selectedRepoId, name, true);
            const createdName = result.branch;
            setBranches(prev => [...prev, createdName]);
            setCurrentBranch(createdName);
            setNewBranchName('');
            setIsNewBranchOpen(false);
            logActivity('criou branch', createdName, 'repo');
            addToast('Branch Criada', 'success', `Você está agora na branch ${createdName}.`);
        } catch (e: any) {
            addToast('Falha ao Criar Branch', 'error', e.message || 'Não foi possível criar a nova branch.');
        }
    };

    const handleBranchSwitch = async (branch: string) => {
        if (!selectedRepoId || branch === currentBranch) return;
        setIsCheckingOut(true);
        try {
            await api.checkoutBranch(selectedRepoId, branch);
            setCurrentBranch(branch);
            addToast('Branch Alterada', 'info', `Você está agora na branch ${branch}.`);
            // Reload git status for the new branch
            const gitStatus = await api.getRepoGitStatus(selectedRepoId);
            const cleanedChanges = gitStatus.changes.map((c: GitChange) => ({
                ...c,
                file: cleanFileName(c.file)
            }));
            setChanges(cleanedChanges);
            setStagedChanges([]);
        } catch (e: any) {
            addToast('Falha no Checkout', 'error', e.message || `Não foi possível alternar para a branch ${branch}.`);
        } finally {
            setIsCheckingOut(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'added': return <FilePlus className="w-4 h-4 text-green-500" />;
            case 'deleted': return <FileMinus className="w-4 h-4 text-red-500" />;
            default: return <FileCode className="w-4 h-4 text-yellow-500" />;
        }
    };

    const activeFileObj = [...changes, ...stagedChanges].find(c => c.id === selectedFileId);

    // Estado para armazenar linhas do diff
    const [diffLines, setDiffLines] = useState<{ type: 'add' | 'del' | 'normal', content: string }[]>([]);

    useEffect(() => {
        const fetchDiff = async () => {
            if (!activeFileObj || !selectedRepoId) {
                setDiffLines([]);
                return;
            }

            try {
                // Verificar se arquivo está staged
                const isStaged = stagedChanges.some(c => c.id === activeFileObj.id);
                // Buscar diff real do backend
                const res = await api.getRepoFileDiff(selectedRepoId, activeFileObj.file, isStaged);

                // Parsear output do git diff
                const rawDiff = res.diff || '';
                const lines = rawDiff.split('\n');
                const parsedLines: { type: 'add' | 'del' | 'normal', content: string }[] = [];

                let skipHeader = true;

                for (const line of lines) {
                    // Ignorar cabeçalhos do git diff até chegar no conteúdo ou chunks
                    if (skipHeader) {
                        if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
                            continue;
                        }
                        // Se encontrar @@ ou linhas de adição/remoção, paramos de pular header
                        if (line.startsWith('@@') || line.startsWith('+') || line.startsWith('-')) {
                            skipHeader = false;
                        }
                    }

                    if (skipHeader && line.trim() !== '') continue;

                    if (line.startsWith('+') && !line.startsWith('+++')) {
                        parsedLines.push({ type: 'add', content: line.substring(1) });
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                        parsedLines.push({ type: 'del', content: line.substring(1) });
                    } else {
                        parsedLines.push({ type: 'normal', content: line });
                    }
                }

                // Se nenhum diff foi gerado mas arquivo existe e é modificado, pode ser erro de parser ou vazio.
                if (parsedLines.length === 0 && rawDiff.length > 0) {
                    // Fallback: mostrar raw
                    setDiffLines([{ type: 'normal', content: rawDiff }]);
                } else if (parsedLines.length === 0) {
                    setDiffLines([{ type: 'normal', content: 'Sem alterações visíveis ou arquivo binário.' }]);
                } else {
                    setDiffLines(parsedLines);
                }

            } catch (err) {
                console.error('Erro ao carregar diff:', err);
                setDiffLines([{ type: 'normal', content: 'Erro ao carregar visualização de diferenças.' }]);
            }
        };

        fetchDiff();
    }, [selectedRepoId, activeFileObj?.id, activeFileObj?.file]); // Deps cuidadosas para evitar loop

    if (activeTab === 'insights') {
        const tabCls = (t: string) => `py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === t ? 'border-fiori-blue text-fiori-blue' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`;
        return (
            <div className="h-[calc(100vh-4rem)] flex flex-col">
                <div className="flex border-b border-slate-200 dark:border-slate-700 bg-fiori-cardLight dark:bg-fiori-cardDark px-6">
                    <button onClick={() => setActiveTab('changes')} className={tabCls('changes')}>Alterações</button>
                    <button onClick={() => setActiveTab('source')} className={tabCls('source')}>Código Fonte</button>
                    <button onClick={() => setActiveTab('insights')} className={tabCls('insights')}>Insights</button>
                </div>
                <InsightsPanel repoFiles={repoFiles} changes={changes} repoId={selectedRepoId} currentBranch={currentBranch} />
            </div>
        )
    }

    return (
        <div ref={containerRef} className="p-6 h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-4">
            <div
                style={{ width: window.innerWidth >= 768 ? leftPanelWidth : '100%' }}
                className="flex-shrink-0 bg-white dark:bg-slate-900/30 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700/50 flex flex-col h-full overflow-hidden transition-width duration-75 ease-out"
            >
                {/* Seletor de Repositório */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="flex items-center gap-2 mb-3">
                        <FolderGit2 className="w-3.5 h-3.5 text-fiori-blue" />
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">Repositório</span>
                    </div>
                    <select
                        value={selectedRepoId || ''}
                        onChange={(e) => setSelectedRepoId(e.target.value)}
                        className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-fiori-blue transition-colors font-medium"
                    >
                        {repos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    {selectedRepo?.localPath && !repoPathMissing && (
                        <p className="text-[10px] text-slate-400 mt-1 truncate" title={selectedRepo.localPath}>
                            📁 {selectedRepo.localPath}
                        </p>
                    )}
                    {repoPathMissing && selectedRepo?.localPath && (
                        <div className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Diretório não encontrado</p>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-500 truncate mt-0.5" title={selectedRepo.localPath}>{selectedRepo.localPath}</p>
                                    <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 mt-1">O diretório foi removido ou movido. Remova o repositório do sistema ou atualize o caminho.</p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!selectedRepoId) return;
                                    if (!await confirm({ title: 'Remover Repositório', message: `Remover "${selectedRepo?.name}" do DevFlow?\n\nIsso apenas remove o registro do sistema. Os arquivos no disco não serão afetados.`, confirmText: 'Remover', variant: 'warning' })) return;
                                    try {
                                        await api.deleteRepo(selectedRepoId);
                                        addToast('Repositório Removido', 'info', `"${selectedRepo?.name}" foi removido do DevFlow. Os arquivos locais não foram afetados.`);
                                        if (onRefreshData) onRefreshData();
                                    } catch (e: any) {
                                        addToast('Falha ao Remover', 'error', e.message || 'Não foi possível remover o repositório do sistema.');
                                    }
                                }}
                                className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800/30 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-400 text-[10px] font-semibold rounded border border-amber-200 dark:border-amber-700/50 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" /> Remover do Sistema
                            </button>
                        </div>
                    )}
                </div>

                {/* Branch Atual */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="flex items-center gap-2 mb-3">
                        <GitBranch className="w-3.5 h-3.5 text-fiori-blue" />
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">Branch Atual</span>
                    </div>
                    {isNewBranchOpen ? (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <input autoFocus type="text" value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} placeholder="Nome (ex: feature/login)" className="flex-1 text-xs px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-fiori-blue" onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBranch(); if (e.key === 'Escape') setIsNewBranchOpen(false); }} />
                            <button onClick={handleCreateBranch} className="p-1.5 bg-fiori-blue text-white rounded hover:bg-blue-600"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setIsNewBranchOpen(false)} className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:opacity-80"><Undo2 className="w-3 h-3" /></button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <div className="relative flex-1 group">
                                <select value={currentBranch} onChange={(e) => handleBranchSwitch(e.target.value)} disabled={isCheckingOut} className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:border-fiori-blue disabled:opacity-50 transition-colors">
                                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-2 pointer-events-none group-hover:text-fiori-blue transition-colors" />
                            </div>
                            <button onClick={() => setIsNewBranchOpen(true)} className="p-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-fiori-blue transition-colors"><Plus className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>

                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    <button onClick={() => setActiveTab('changes')} className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'changes' ? 'border-fiori-blue text-fiori-blue bg-slate-50/50 dark:bg-slate-900/30' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><RefreshCw className="w-3.5 h-3.5" /> ALTERAÇÕES</button>
                    <button onClick={() => setActiveTab('source')} className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'source' ? 'border-fiori-blue text-fiori-blue bg-slate-50/50 dark:bg-slate-900/30' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><Folder className="w-3.5 h-3.5" /> ARQUIVOS</button>
                    <button onClick={() => setActiveTab('insights')} className="flex-1 py-3 text-xs font-medium border-b-2 border-transparent transition-colors flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"><BarChart3 className="w-3.5 h-3.5" /> INSIGHTS</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 relative">
                    {isCheckingOut && <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center"><RefreshCw className="w-8 h-8 text-fiori-blue animate-spin mb-2" /><span className="text-sm font-medium text-slate-600 dark:text-slate-300">Checkout em andamento...</span></div>}
                    {activeTab === 'changes' ? (
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center px-2 mb-2"><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Staged ({stagedChanges.length})</span>{stagedChanges.length > 0 && <button onClick={unstageAll} className="text-[10px] text-fiori-link hover:underline">Unstage All</button>}</div>
                                {stagedChanges.length === 0 ? <div className="px-3 py-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-lg text-xs text-slate-400">Nenhum arquivo no stage</div> : <ul className="space-y-0.5">{stagedChanges.map(file => <li key={file.id} onClick={() => setSelectedFileId(file.id)} className={`flex items-center justify-between p-2 rounded cursor-pointer border border-transparent transition-all ${selectedFileId === file.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}><div className="flex items-center gap-2 overflow-hidden"><span className="text-slate-400">{selectedFileId === file.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>{getStatusIcon(file.status)}<span className={`text-sm truncate font-mono ${selectedFileId === file.id ? 'text-fiori-blue dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>{file.file}</span></div><button onClick={(e) => { e.stopPropagation(); unstageFile(file.id); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"><ArrowDown className="w-3 h-3" /></button></li>)}</ul>}
                            </div>
                            <div>
                                <div className="flex justify-between items-center px-2 mb-2"><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Changes ({changes.length})</span>{changes.length > 0 && <button onClick={stageAll} className="text-[10px] text-fiori-link hover:underline">Stage All</button>}</div>
                                {changes.length === 0 ? <div className="px-2 py-8 text-center text-xs text-slate-400 italic">Diretório de trabalho limpo</div> : <ul className="space-y-0.5">{changes.map(file => <li key={file.id} onClick={() => setSelectedFileId(file.id)} className={`flex items-center justify-between p-2 rounded cursor-pointer border border-transparent transition-all ${selectedFileId === file.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}><div className="flex items-center gap-2 overflow-hidden"><span className="text-slate-400">{selectedFileId === file.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>{getStatusIcon(file.status)}<span className={`text-sm truncate font-mono ${selectedFileId === file.id ? 'text-fiori-blue dark:text-blue-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>{file.file}</span></div><button onClick={(e) => { e.stopPropagation(); stageFile(file.id); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500"><ArrowUp className="w-3 h-3" /></button></li>)}</ul>}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* Breadcrumb navigation */}
                            <div className="flex items-center gap-1 text-xs text-slate-500 mb-2 flex-wrap">
                                <button
                                    onClick={() => loadDirectory('')}
                                    className="hover:text-fiori-blue transition-colors font-mono"
                                >
                                    /
                                </button>
                                {currentSubPath.split('/').filter(Boolean).map((part, idx, arr) => {
                                    const pathUpTo = arr.slice(0, idx + 1).join('/');
                                    return (
                                        <React.Fragment key={pathUpTo}>
                                            <ChevronRight className="w-3 h-3 text-slate-300" />
                                            <button
                                                onClick={() => loadDirectory(pathUpTo)}
                                                className="hover:text-fiori-blue transition-colors font-mono"
                                            >
                                                {part}
                                            </button>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                            {/* Back button when inside a subdirectory */}
                            {currentSubPath && (
                                <button
                                    onClick={() => {
                                        const parent = currentSubPath.includes('/')
                                            ? currentSubPath.substring(0, currentSubPath.lastIndexOf('/'))
                                            : '';
                                        loadDirectory(parent);
                                    }}
                                    className="flex items-center gap-2 py-1.5 px-2 mb-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                >
                                    <ChevronRight className="w-3 h-3 rotate-180" /> ..
                                </button>
                            )}
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8 text-slate-400">
                                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                                    Carregando arquivos...
                                </div>
                            ) : repoFiles.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    Diretório vazio.
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto">
                                    {repoFiles.map((file) => (
                                        <div
                                            key={file.id}
                                            onClick={() => {
                                                if (file.type === 'folder') {
                                                    loadDirectory(file.relativePath || file.name);
                                                } else {
                                                    setActiveFileNode(file);
                                                }
                                            }}
                                            className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-sm transition-colors ${activeFileNode?.id === file.id ? 'bg-blue-100 dark:bg-blue-900/30 text-fiori-blue' : 'text-slate-600 dark:text-slate-300'}`}
                                        >
                                            {file.type === 'folder' ? (
                                                <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                            ) : (
                                                <FileCode className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            )}
                                            <span className="truncate font-mono text-xs">{file.name}</span>
                                            {file.type === 'folder' && <ChevronRight className="w-3 h-3 ml-auto text-slate-300" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'changes' && (
                    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70">
                        {/* Remote URL config panel */}
                        {isRemoteConfigOpen && (
                            <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1"><Link className="w-3 h-3" /> Remote URL (origin)</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={remoteUrlInput}
                                        onChange={(e) => setRemoteUrlInput(e.target.value)}
                                        placeholder="https://github.com/user/repo.git"
                                        className="flex-1 text-xs px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-fiori-blue font-mono"
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRemote(); if (e.key === 'Escape') setIsRemoteConfigOpen(false); }}
                                    />
                                    <button onClick={handleSaveRemote} className="px-2 py-1.5 bg-fiori-blue text-white text-xs rounded hover:bg-blue-600 font-medium">Salvar</button>
                                    <button onClick={() => setIsRemoteConfigOpen(false)} className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded hover:opacity-80">✕</button>
                                </div>
                            </div>
                        )}
                        <div className="p-4">
                            <div className="relative">
                                <textarea className="w-full h-20 p-3 pr-8 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded resize-none focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-slate-200 font-sans disabled:opacity-50" placeholder="Mensagem do commit..." value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} disabled={isGenerating}></textarea>
                                <button onClick={generateCommitMessage} disabled={stagedChanges.length === 0 || isGenerating} className="absolute right-2 top-2 p-1.5 text-fiori-blue hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors disabled:opacity-30" title="Gerar mensagem sugerida"><Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-pulse' : ''}`} /></button>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleCommit} disabled={stagedChanges.length === 0 || !commitMessage.trim() || isGenerating} className="flex-1 bg-fiori-blue hover:bg-blue-700 text-white text-sm font-medium py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
                                    <Check className="w-4 h-4" /> Commit
                                </button>
                                <button onClick={handlePush} disabled={isPushing || isPulling} title={remoteUrl ? `Push → ${remoteUrl}` : 'Configure o remote antes de fazer push'} className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-3 py-2 rounded flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm">
                                    {isPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />} Push
                                </button>
                                <button onClick={handlePull} disabled={isPulling || isPushing} title={remoteUrl ? `Pull ← ${remoteUrl}` : 'Configure o remote antes de fazer pull'} className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium px-3 py-2 rounded flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm">
                                    {isPulling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />} Pull
                                </button>
                                <button onClick={() => setIsRemoteConfigOpen(v => !v)} title="Configurar remote URL" className={`p-2 rounded border transition-colors ${remoteUrl ? 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'}`}>
                                    <Settings2 className="w-4 h-4" />
                                </button>
                            </div>
                            {remoteUrl && (
                                <p className="text-[10px] text-slate-400 mt-1.5 truncate flex items-center gap-1" title={remoteUrl}>
                                    <Link className="w-3 h-3 flex-shrink-0" /> {remoteUrl}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div className="hidden md:flex w-2 cursor-col-resize hover:bg-fiori-blue/50 items-center justify-center group transition-colors select-none" onMouseDown={startResizing}><div className={`w-0.5 h-8 bg-slate-300 dark:bg-slate-600 rounded-full group-hover:bg-white transition-colors ${isResizing ? 'bg-white' : ''}`}></div></div>
            <div className="hidden md:flex flex-1 flex-col bg-fiori-cardLight dark:bg-fiori-cardDark rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
                {isCheckingOut && <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center"></div>}
                {activeTab === 'changes' ? (
                    activeFileObj ? (
                        <>
                            <div className="h-10 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 bg-slate-50 dark:bg-slate-800/50 justify-between"><span className="text-sm font-mono text-slate-600 dark:text-slate-300 flex items-center gap-2"><FileCode className="w-4 h-4" />{activeFileObj.file}</span><span className="text-xs text-slate-400 flex items-center gap-2">Visualizando Diff</span></div>
                            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 font-mono text-xs md:text-sm">
                                {diffLines.map((line, idx) => (
                                    <div key={idx} className={`flex ${line.type === 'add' ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : line.type === 'del' ? 'bg-rose-50/50 dark:bg-rose-500/5' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/20`}>
                                        <div className="w-10 text-right pr-3 py-0.5 text-slate-300 dark:text-slate-600 select-none border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 font-mono text-[10px] leading-5">{idx + 1}</div>
                                        <div className="w-6 text-center py-0.5 select-none text-slate-300 dark:text-slate-600 font-mono text-[10px] leading-5">{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ''}</div>
                                        <div className={`flex-1 py-0.5 px-2 whitespace-pre break-words font-mono text-[12px] leading-5 ${line.type === 'add' ? 'text-emerald-800 dark:text-emerald-400' : line.type === 'del' ? 'text-rose-800 dark:text-rose-400 line-through decoration-rose-800/30 dark:decoration-rose-400/30 opacity-70' : 'text-slate-600 dark:text-slate-400'}`}>{line.content}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><GitBranch className="w-16 h-16 mb-4 opacity-20" /><p>Selecione um arquivo alterado para ver as diferenças.</p></div>
                ) : (
                    activeFileNode && selectedRepoId ? (
                        <FileViewer node={activeFileNode} repoId={selectedRepoId} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <FolderOpen className="w-16 h-16 mb-4 opacity-20" />
                            <p>Selecione um arquivo na árvore para visualizar o código.</p>
                        </div>
                    )
                )}
            </div >
        </div >
    );
};

// Helper component to fetch and display file content with proper rendering
const FileViewer: React.FC<{ node: FileNode; repoId: string }> = ({ node, repoId }) => {
    const [content, setContent] = useState('Carregando...');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(false);
            try {
                const result = await api.getRepoFileContent(repoId, node.relativePath || node.name);
                setContent(result.content);
            } catch (e) {
                console.error('Erro ao carregar arquivo:', e);
                setError(true);
                setContent('Erro ao carregar arquivo. Verifique se o arquivo existe no repositório.');
            } finally {
                setLoading(false);
            }
        };
        if (node.type === 'file') load();
    }, [node, repoId]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900">
                <RefreshCw className="w-6 h-6 text-fiori-blue animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 text-red-500">
                <p>{content}</p>
            </div>
        );
    }

    // Detectar se é Markdown
    const isMarkdown = node.name.toLowerCase().endsWith('.md') || node.name.toLowerCase().endsWith('.markdown');

    if (isMarkdown) {
        return <MarkdownViewer content={content} />;
    }

    // Para outros arquivos, usar syntax highlighting
    const language = getLanguageFromFilename(node.name);
    return <CodeEditor content={content} language={language} filename={node.name} />;
};

export default GitIntegration;

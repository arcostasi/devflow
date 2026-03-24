
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GitChange, FileNode, ActivityLog, Repository, GitCommit, GitIntegrationTab } from '../types';
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
const cleanFileName = (name: string): string => name.replaceAll(CONTROL_CHARS_RE, '').trim();
type DiffLine = { type: 'add' | 'del' | 'normal'; content: string };

const getNodeText = (children: React.ReactNode): string => {
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (Array.isArray(children)) {
        return children
            .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
            .join('');
    }
    return '';
};

const getRepoTreeLanguage = (filename: string): 'tsx' | 'ts' | 'js' | 'text' => {
    if (filename.endsWith('.tsx')) return 'tsx';
    if (filename.endsWith('.ts')) return 'ts';
    if (filename.endsWith('.js')) return 'js';
    return 'text';
};

const getHealthScoreColorClass = (healthScore: number): string => {
    if (healthScore >= 80) return 'text-emerald-500';
    if (healthScore >= 50) return 'text-amber-500';
    return 'text-rose-500';
};

const getChangeStatusClass = (status: GitChange['status']): string => {
    if (status === 'added') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
    if (status === 'deleted') return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400';
    return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
};

const getChangeStatusLabel = (status: GitChange['status']): string => {
    if (status === 'added') return 'Novo';
    if (status === 'deleted') return 'Removido';
    return 'Modificado';
};

const renderMarkdownCodeNode = (isDark: boolean, inline: boolean, className: string | undefined, children: React.ReactNode, props: Record<string, unknown>) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = getNodeText(children).replace(/\n$/, '');

    if (!inline && match) {
        return (
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
        );
    }

    return (
        <code className={className} {...props}>
            {children}
        </code>
    );
};

// Markdown imports
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface GitIntegrationProps {
    repos: Repository[];
    addToast: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
    logActivity: (action: string, target: string, targetType: ActivityLog['targetType'], meta?: string) => void;
    onRefreshData?: () => void;
    preferredRepoId?: string | null;
    preferredTab?: GitIntegrationTab;
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

const getCommitClassification = (
    files: string[],
    addedCount: number,
    deletedCount: number,
    modifiedCount: number,
): { prefix: string; scope: string } => {
    const exts = files.map((f) => f.split('.').pop()?.toLowerCase() || '');
    const hasTests = files.some((f) => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'));
    const hasStyles = exts.some((e) => ['css', 'scss', 'sass', 'less'].includes(e));
    const hasConfig = files.some((f) => ['package.json', 'tsconfig.json', 'vite.config', '.env', 'webpack', 'eslint', '.gitignore'].some((c) => f.includes(c)));
    const hasComponents = files.some((f) => f.includes('components/') || f.endsWith('.tsx') || f.endsWith('.jsx'));
    const hasBackend = files.some((f) => f.includes('server/') || f.includes('routes/') || f.includes('api.'));
    const hasDb = files.some((f) => f.includes('db.') || f.includes('migration') || f.includes('schema'));

    if (hasTests) return { prefix: 'test', scope: '' };
    if (hasStyles && !hasComponents) return { prefix: 'style', scope: '' };
    if (hasConfig) return { prefix: 'chore', scope: 'config' };
    if (hasDb) return { prefix: 'feat', scope: 'db' };
    if (hasBackend) return { prefix: modifiedCount > 0 ? 'fix' : 'feat', scope: 'api' };
    if (hasComponents) return { prefix: addedCount > 0 ? 'feat' : 'fix', scope: 'ui' };
    if (deletedCount === files.length) return { prefix: 'refactor', scope: '' };
    if (modifiedCount > 0 && addedCount === 0) return { prefix: 'fix', scope: '' };
    return { prefix: 'feat', scope: '' };
};

const getCommitDescription = (files: string[]): string => {
    const fileNames = files.map((f) => f.split('/').pop()?.replace(/\.[^.]+$/, '') || f);
    if (files.length === 1) return `update ${fileNames[0]}`;
    if (files.length <= 3) return `update ${fileNames.join(', ')}`;
    return `update ${files.length} files`;
};

const isDiffHeaderLine = (line: string): boolean => (
    line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')
);

const isDiffChunkOrChangeStart = (line: string): boolean => (
    line.startsWith('@@') || line.startsWith('+') || line.startsWith('-')
);

const toDiffLine = (line: string): DiffLine => {
    if (line.startsWith('+') && !line.startsWith('+++')) return { type: 'add', content: line.substring(1) };
    if (line.startsWith('-') && !line.startsWith('---')) return { type: 'del', content: line.substring(1) };
    return { type: 'normal', content: line };
};

const parseGitDiff = (rawDiff: string): DiffLine[] => {
    const lines = rawDiff.split('\n');
    const parsedLines: DiffLine[] = [];
    let skipHeader = true;

    for (const line of lines) {
        if (skipHeader) {
            if (isDiffHeaderLine(line)) continue;
            if (isDiffChunkOrChangeStart(line)) skipHeader = false;
        }

        if (skipHeader && line.trim() !== '') continue;
        parsedLines.push(toDiffLine(line));
    }

    if (parsedLines.length === 0 && rawDiff.length > 0) return [{ type: 'normal', content: rawDiff }];
    if (parsedLines.length === 0) return [{ type: 'normal', content: 'Sem alterações visíveis ou arquivo binário.' }];
    return parsedLines;
};

const getDiffLineBackgroundClass = (type: DiffLine['type']): string => {
    if (type === 'add') return 'bg-emerald-50/50 dark:bg-emerald-500/5';
    if (type === 'del') return 'bg-rose-50/50 dark:bg-rose-500/5';
    return '';
};

const getDiffLineMarker = (type: DiffLine['type']): string => {
    if (type === 'add') return '+';
    if (type === 'del') return '-';
    return '';
};

const getDiffLineTextClass = (type: DiffLine['type']): string => {
    if (type === 'add') return 'text-emerald-800 dark:text-emerald-400';
    if (type === 'del') return 'text-rose-800 dark:text-rose-400 line-through decoration-rose-800/30 dark:decoration-rose-400/30 opacity-70';
    return 'text-slate-600 dark:text-slate-400';
};

const removeChangesById = (list: GitChange[], ids: Set<string>): GitChange[] => list.filter((item) => !ids.has(item.id));

const gitInsetCard =
    'rounded-2xl border border-slate-200/75 bg-slate-50/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

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
                        code: ({ node: _node, inline, className, children, ...props }: any) =>
                            renderMarkdownCodeNode(isDark, Boolean(inline), className, children, props)
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
        <div className="flex flex-col h-full page-shell overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto w-full space-y-8">

                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary-500" />
                        Code Intelligence
                    </h2>
                    <p className="app-copy-compact mt-1 text-slate-500 dark:text-slate-400">Análise estática e métricas do repositório.</p>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="surface-card rounded-2xl border border-slate-200/75 bg-white/88 p-5 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="app-metric-label tracking-[0.16em]">Arquivos</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{totalFiles}</div>
                        <p className="text-xs text-slate-400 mt-1">Total no repositório</p>
                    </div>
                    <div className="surface-card rounded-2xl border border-slate-200/75 bg-white/88 p-5 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span className="app-metric-label tracking-[0.16em]">Commits</span>
                        </div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{logTotal}</div>
                        <p className="text-xs text-slate-400 mt-1">Em {currentBranch}</p>
                    </div>
                    <div className="surface-card rounded-2xl border border-slate-200/75 bg-white/88 p-5 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-3">
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span className="app-metric-label tracking-[0.16em]">Health Score</span>
                        </div>
                        <div className={`text-3xl font-bold tracking-tight ${getHealthScoreColorClass(healthScore)}`}>
                            {healthScore}%
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{changedFiles} alterações pendentes</p>
                    </div>
                </div>

                {/* Git Log */}
                <div className="surface-card overflow-hidden rounded-2xl border border-slate-200/75 bg-white/88 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <div className="surface-header px-6 py-4 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <GitBranch className="w-3.5 h-3.5" /> Histórico de Commits — {currentBranch}
                        </h3>
                        <span className="text-xs text-slate-400">{logTotal} commits</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {logLoading && (
                            <div className="px-6 py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" /> Carregando histórico...
                            </div>
                        )}
                        {!logLoading && commits.length === 0 && (
                            <div className="px-6 py-8 text-center text-slate-400 text-sm italic">
                                Nenhum commit encontrado.
                            </div>
                        )}
                        {!logLoading && commits.length > 0 && (
                            commits.map((commit) => (
                                <div key={commit.fullHash} className="px-6 py-3 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/20">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{commit.message}</p>
                                    <p className="mt-0.5 text-xs text-slate-400">{commit.author} · {formatDate(commit.date)}</p>
                                        </div>
                                        <span className="font-mono text-[10px] rounded border border-slate-200/70 bg-slate-50/80 px-2 py-0.5 text-slate-500 shadow-sm shadow-slate-200/50 flex-shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:shadow-none">{commit.hash}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="surface-header px-6 py-3 flex items-center justify-between">
                            <button
                                onClick={() => setLogPage(p => Math.max(0, p - 1))}
                                disabled={logPage === 0}
                            className="text-xs px-3 py-1.5 rounded border border-slate-200/80 bg-white/80 text-slate-600 shadow-sm shadow-slate-200/50 transition-colors hover:bg-slate-50/80 disabled:opacity-40 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:shadow-none dark:hover:bg-slate-800"
                            >
                                ← Anterior
                            </button>
                            <span className="text-xs text-slate-400">Página {logPage + 1} de {totalPages}</span>
                            <button
                                onClick={() => setLogPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={logPage >= totalPages - 1}
                            className="text-xs px-3 py-1.5 rounded border border-slate-200/80 bg-white/80 text-slate-600 shadow-sm shadow-slate-200/50 transition-colors hover:bg-slate-50/80 disabled:opacity-40 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:shadow-none dark:hover:bg-slate-800"
                            >
                                Próxima →
                            </button>
                        </div>
                    )}
                </div>

                {/* Changed Files List */}
                {changes.length > 0 && (
                    <div className="surface-card overflow-hidden rounded-2xl border border-slate-200/75 bg-white/88 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                        <div className="surface-header px-6 py-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Alterações Pendentes ({changedFiles})</h3>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {changes.map((change) => (
                                <div key={`${change.file}-${change.status}`} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <FileCode className="w-4 h-4 text-slate-400" />
                                        <p className="text-sm font-mono text-slate-700 dark:text-slate-200">{change.file}</p>
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getChangeStatusClass(change.status)}`}>
                                        {getChangeStatusLabel(change.status)}
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

const GitIntegration: React.FC<GitIntegrationProps> = ({ repos, addToast, logActivity, onRefreshData, preferredRepoId, preferredTab }) => {
    const hasRepositories = (repos || []).length > 0;
    const { confirm } = useConfirm();
    // Estado para repositório selecionado
    const [selectedRepoId, setSelectedRepoId] = useState<string | null>(preferredRepoId || (repos.length > 0 ? repos[0].id : null));
    const selectedRepo = repos.find(r => r.id === selectedRepoId);

    // Todos os hooks devem ser declarados antes de qualquer return condicional
    const [activeTab, setActiveTab] = useState<GitIntegrationTab>(preferredTab || 'changes');
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
        if (preferredRepoId && repos.some((repo) => repo.id === preferredRepoId) && preferredRepoId !== selectedRepoId) {
            setSelectedRepoId(preferredRepoId);
            return;
        }

        if (!preferredRepoId && selectedRepoId && repos.some((repo) => repo.id === selectedRepoId)) {
            return;
        }

        if (!selectedRepoId && repos.length > 0) {
            setSelectedRepoId(repos[0].id);
            return;
        }

        if (selectedRepoId && !repos.some((repo) => repo.id === selectedRepoId)) {
            setSelectedRepoId(repos.length > 0 ? repos[0].id : null);
        }
    }, [preferredRepoId, repos, selectedRepoId]);

    useEffect(() => {
        if (preferredTab && preferredTab !== activeTab) {
            setActiveTab(preferredTab);
        }
    }, [preferredTab, activeTab]);

    useEffect(() => {
        if (isResizing) {
            globalThis.addEventListener('mousemove', resize);
            globalThis.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            globalThis.removeEventListener('mousemove', resize);
            globalThis.removeEventListener('mouseup', stopResizing);
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
                    language: getRepoTreeLanguage(f.name)
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
                language: getRepoTreeLanguage(f.name)
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
        const toStageIds = new Set(toStage.map((item) => item.id));
        setStagedChanges(prev => [...prev, ...toStage]);
        setChanges([]);
        try {
            await api.stageFiles(selectedRepoId, toStage.map(c => c.file));
        } catch (err: any) {
            // Rollback
            setChanges(prev => [...prev, ...toStage]);
            setStagedChanges(prev => removeChangesById(prev, toStageIds));
            addToast('Falha no Stage', 'error', err.message || 'Não foi possível adicionar os arquivos ao stage.');
        }
    };

    const unstageAll = async () => {
        if (!selectedRepoId || stagedChanges.length === 0) return;
        const toUnstage = [...stagedChanges];
        const toUnstageIds = new Set(toUnstage.map((item) => item.id));
        setChanges(prev => [...prev, ...toUnstage]);
        setStagedChanges([]);
        try {
            await api.unstageFiles(selectedRepoId, toUnstage.map(c => c.file));
        } catch (err: any) {
            // Rollback
            setStagedChanges(prev => [...prev, ...toUnstage]);
            setChanges(prev => removeChangesById(prev, toUnstageIds));
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

        api.fillAIField({
            fieldType: 'commit_message',
            context: {
                repositoryName: selectedRepo?.name || '',
                currentBranch,
                stagedFiles: stagedChanges.map(change => ({
                    file: change.file,
                    status: change.status,
                })),
                changeSummary: {
                    added: added.length,
                    deleted: deleted.length,
                    modified: modified.length,
                },
            },
        })
            .then((result) => {
                setCommitMessage(result.value || '');
            })
            .catch(() => {
                const { prefix, scope } = getCommitClassification(files, added.length, deleted.length, modified.length);
                const description = getCommitDescription(files);
                const msg = scope ? `${prefix}(${scope}): ${description}` : `${prefix}: ${description}`;
                setCommitMessage(msg);
                addToast('IA indisponível', 'info', 'Foi usado o gerador local de fallback para a mensagem de commit.');
            })
            .finally(() => setIsGenerating(false));
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
    const modifiedCount = changes.filter(c => c.status === 'modified').length;
    const addedCount = changes.filter(c => c.status === 'added').length;
    const deletedCount = changes.filter(c => c.status === 'deleted').length;

    // Estado para armazenar linhas do diff
    const [diffLines, setDiffLines] = useState<DiffLine[]>([]);

    useEffect(() => {
        const fetchDiff = async () => {
            if (!activeFileObj || !selectedRepoId) {
                setDiffLines([]);
                return;
            }

            try {
                const isStaged = stagedChanges.some(c => c.id === activeFileObj.id);
                const res = await api.getRepoFileDiff(selectedRepoId, activeFileObj.file, isStaged);
                const rawDiff = res.diff || '';
                setDiffLines(parseGitDiff(rawDiff));

            } catch (err) {
                console.error('Erro ao carregar diff:', err);
                setDiffLines([{ type: 'normal', content: 'Erro ao carregar visualização de diferenças.' }]);
            }
        };

        fetchDiff();
    }, [selectedRepoId, activeFileObj?.id, activeFileObj?.file]); // Deps cuidadosas para evitar loop

    if (!hasRepositories) {
        return (
            <div className="h-full page-shell flex items-center justify-center p-8">
                <div className="surface-card max-w-md rounded-[1.6rem] border border-slate-200/75 bg-white/90 p-8 text-center shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50/85 shadow-sm shadow-slate-200/50 dark:bg-white/[0.05] dark:shadow-none">
                        <FolderGit2 className="h-10 w-10 text-slate-400" />
                    </div>
                    <h2 className="mb-3 text-xl font-semibold text-slate-700 dark:text-white">Nenhum Repositorio Configurado</h2>
                    <p className="text-slate-500 dark:text-[var(--text-muted)]">
                        Para usar a integração Git, primeiro adicione um repositório na aba "Repositórios" ou configure o diretório Git nas configurações do sistema.
                    </p>
                </div>
            </div>
        );
    }

    if (activeTab === 'insights') {
        const tabCls = (t: string) => `rounded-xl border px-4 py-3 text-sm font-medium transition-all ${activeTab === t ? 'border-slate-200/80 bg-white/85 text-primary-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.08] dark:text-primary-300 dark:shadow-none' : 'border-transparent text-slate-500 hover:border-slate-200/70 hover:bg-slate-50/80 hover:text-slate-700 dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:hover:text-slate-300'}`;
        return (
            <div className="h-[calc(100vh-4rem)] flex flex-col page-shell">
                <div className="glass-panel-primary flex gap-2 border-b border-slate-200/50 px-6 py-3 dark:border-white/10">
                    <button onClick={() => setActiveTab('changes')} className={tabCls('changes')}>Alterações</button>
                    <button onClick={() => setActiveTab('source')} className={tabCls('source')}>Código Fonte</button>
                    <button onClick={() => setActiveTab('insights')} className={tabCls('insights')}>Insights</button>
                </div>
                <InsightsPanel repoFiles={repoFiles} changes={changes} repoId={selectedRepoId} currentBranch={currentBranch} />
            </div>
        )
    }

    return (
        <div className="page-shell min-h-full">
            <div className="page-container page-stack">
                <section className="page-panel-grid xl:grid-cols-12">
                    <div className="surface-card overflow-hidden rounded-[1.6rem] xl:col-span-7">
                        <div className="panel-header-block border-b border-slate-200/70 bg-slate-50/45 dark:border-white/10 dark:bg-transparent">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="max-w-2xl">
                                    <p className="app-section-label">Controle de Fonte</p>
                                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-[var(--text-primary)]">
                                        {selectedRepo ? `Fluxo Git de ${selectedRepo.name}` : 'Operacao Git'}
                                    </h1>
                                    <p className="app-copy mt-2">
                                        Visualize alteracoes locais, stage, branch ativa e remote do repositorio com leitura rapida de risco e acao.
                                    </p>
                                </div>
                                <div className="app-soft-badge">
                                    {selectedRepo ? selectedRepo.name : 'Sem repositorio'}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-3">
                            <div className={gitInsetCard}>
                                <p className="app-metric-label">Branch ativa</p>
                                <p className="mt-3 font-mono text-lg font-semibold text-slate-900 dark:text-[var(--text-primary)]">{currentBranch}</p>
                                <p className="app-copy-compact mt-2">{branches.length} branch(es) disponiveis</p>
                            </div>
                            <div className={gitInsetCard}>
                                <p className="app-metric-label">Mudancas pendentes</p>
                                <p className="mt-3 text-3xl font-light text-slate-900 dark:text-[var(--text-primary)]">{changes.length}</p>
                                <p className="app-copy-compact mt-2">{addedCount} novas, {modifiedCount} modificadas, {deletedCount} removidas.</p>
                            </div>
                            <div className={gitInsetCard}>
                                <p className="app-metric-label">Stage e remote</p>
                                <p className="mt-3 text-3xl font-light text-slate-900 dark:text-[var(--text-primary)]">{stagedChanges.length}</p>
                                <p className="app-copy-compact mt-2">{remoteUrl ? 'Remote configurado e pronto para push/pull.' : 'Remote ainda nao configurado.'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="surface-card panel-body-block rounded-[1.6rem] xl:col-span-5">
                        <p className="app-section-label">Leitura Operacional</p>
                        <div className="mt-4 panel-stack-tight">
                            <div className={gitInsetCard}>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Acao critica</h3>
                                <p className="app-copy-compact mt-1">
                                    {stagedChanges.length > 0 ? 'Existem arquivos no stage. Revise diff e finalize commit com mensagem clara antes de push.' : 'Sem arquivos no stage. Adicione alteracoes relevantes antes de comprometer a branch.'}
                                </p>
                            </div>
                            <div className={gitInsetCard}>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Risco atual</h3>
                                <p className="app-copy-compact mt-1">
                                    {repoPathMissing ? 'O caminho local do repositorio esta ausente. Operacoes Git locais estao comprometidas ate a correcao.' : 'O caminho local esta acessivel. O principal risco agora esta no volume e natureza das mudancas pendentes.'}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

        <div ref={containerRef} className="page-panel-grid h-[calc(100vh-4rem)] md:flex md:grid-cols-none md:flex-row">
            <div
                style={{ width: window.innerWidth >= 768 ? leftPanelWidth : '100%' }}
                className="surface-card flex h-full flex-shrink-0 flex-col overflow-hidden rounded-[1.6rem] border border-slate-200/75 bg-white/90 shadow-sm shadow-slate-200/60 transition-width duration-75 ease-out dark:border-white/10 dark:bg-transparent dark:shadow-none"
            >
                {/* Seletor de Repositório */}
                <div className="panel-body-compact border-b border-slate-100 bg-slate-50/55 dark:border-white/10 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                        <FolderGit2 className="w-3.5 h-3.5 text-primary-500" />
                        <span className="app-metric-label">Repositório</span>
                    </div>
                    <select
                        value={selectedRepoId || ''}
                        onChange={(e) => setSelectedRepoId(e.target.value)}
                        className="app-input w-full appearance-none rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-slate-200"
                    >
                        {repos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    {selectedRepo?.localPath && !repoPathMissing && (
                        <p className="mt-1 truncate text-[10px] text-slate-400" title={selectedRepo.localPath}>
                            📁 {selectedRepo.localPath}
                        </p>
                    )}
                    {repoPathMissing && selectedRepo?.localPath && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/80 p-2 shadow-sm shadow-amber-100/60 dark:border-amber-700/50 dark:bg-amber-900/20 dark:shadow-none">
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
                                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-100/80 px-2 py-1.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-800/30 dark:text-amber-400 dark:hover:bg-amber-800/50"
                            >
                                <Trash2 className="w-3 h-3" /> Remover do Sistema
                            </button>
                        </div>
                    )}
                </div>

                {/* Branch Atual */}
                <div className="panel-body-compact border-b border-slate-100 bg-slate-50/55 dark:border-white/10 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-3">
                        <GitBranch className="w-3.5 h-3.5 text-primary-500" />
                        <span className="app-metric-label">Branch Atual</span>
                    </div>
                    {isNewBranchOpen ? (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <input
                                autoFocus
                                type="text"
                                value={newBranchName}
                                onChange={(e) => setNewBranchName(e.target.value)}
                                placeholder="Nome (ex: feature/login)"
                                className="app-input flex-1 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500/30"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleCreateBranch();
                                    }
                                    if (e.key === 'Escape') {
                                        setIsNewBranchOpen(false);
                                    }
                                }}
                            />
                            <button onClick={handleCreateBranch} className="rounded-xl bg-primary-600 p-2 text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 dark:focus-visible:ring-sky-500/20"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setIsNewBranchOpen(false)} className="app-soft-icon-button rounded-xl p-2"><Undo2 className="w-3 h-3" /></button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <div className="relative flex-1 group">
                                <select value={currentBranch} onChange={(e) => handleBranchSwitch(e.target.value)} disabled={isCheckingOut} className="app-input w-full appearance-none rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50 transition-colors dark:text-slate-200">
                                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2 top-2 pointer-events-none group-hover:text-primary-500 transition-colors" />
                            </div>
                            <button onClick={() => setIsNewBranchOpen(true)} className="app-soft-icon-button rounded-xl p-2 hover:text-primary-500"><Plus className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>

                <div className="page-tabs mx-4 mt-3 mb-0">
                    <button onClick={() => setActiveTab('changes')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all ${activeTab === 'changes' ? 'border-slate-200/80 bg-white/85 text-primary-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.08] dark:text-primary-300 dark:shadow-none' : 'border-transparent text-slate-500 hover:border-slate-200/70 hover:bg-slate-50/80 hover:text-slate-700 dark:text-[var(--text-muted)] dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:hover:text-slate-300'}`}><RefreshCw className="w-3.5 h-3.5" /> ALTERACOES</button>
                    <button onClick={() => setActiveTab('source')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all ${activeTab === 'source' ? 'border-slate-200/80 bg-white/85 text-primary-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.08] dark:text-primary-300 dark:shadow-none' : 'border-transparent text-slate-500 hover:border-slate-200/70 hover:bg-slate-50/80 hover:text-slate-700 dark:text-[var(--text-muted)] dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:hover:text-slate-300'}`}><Folder className="w-3.5 h-3.5" /> ARQUIVOS</button>
                    <button onClick={() => setActiveTab('insights')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all ${activeTab === 'insights' ? 'border-slate-200/80 bg-white/85 text-primary-600 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-white/[0.08] dark:text-primary-300 dark:shadow-none' : 'border-transparent text-slate-500 hover:border-slate-200/70 hover:bg-slate-50/80 hover:text-slate-700 dark:text-[var(--text-muted)] dark:hover:border-white/10 dark:hover:bg-white/[0.04] dark:hover:text-slate-300'}`}><BarChart3 className="w-3.5 h-3.5" /> INSIGHTS</button>
                </div>

                <div className="panel-list-body relative flex-1 overflow-y-auto">
                    {isCheckingOut && <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center"><RefreshCw className="w-8 h-8 text-primary-500 animate-spin mb-2" /><span className="text-sm font-medium text-slate-600 dark:text-slate-300">Checkout em andamento...</span></div>}
                    {activeTab === 'changes' ? (
                        <div className="panel-stack-tight">
                            <div>
                                <div className="flex justify-between items-center px-2 mb-2"><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Staged ({stagedChanges.length})</span>{stagedChanges.length > 0 && <button onClick={unstageAll} className="text-[10px] text-primary-600 dark:text-primary-300 hover:underline">Unstage All</button>}</div>
                                {stagedChanges.length === 0 ? <div className="rounded-xl border-2 border-dashed border-slate-200/75 bg-slate-50/70 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-transparent">Nenhum arquivo no stage</div> : <ul className="panel-stack-tight">{stagedChanges.map(file => <li key={file.id} className={`panel-list-row flex items-center justify-between rounded-xl border transition-all ${selectedFileId === file.id ? 'border-blue-100 bg-blue-50/85 dark:border-blue-500/20 dark:bg-blue-500/10' : 'border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}><button type="button" onClick={() => setSelectedFileId(file.id)} className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg px-0.5 py-0.5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 dark:focus-visible:ring-sky-500/20"><span className="text-slate-400">{selectedFileId === file.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>{getStatusIcon(file.status)}<span className={`text-sm truncate font-mono ${selectedFileId === file.id ? 'font-medium text-primary-600 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}>{file.file}</span></button><button onClick={() => unstageFile(file.id)} className="app-soft-icon-button rounded p-1 text-slate-500"><ArrowDown className="w-3 h-3" /></button></li>)}</ul>}
                            </div>
                            <div>
                                <div className="flex justify-between items-center px-2 mb-2"><span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Changes ({changes.length})</span>{changes.length > 0 && <button onClick={stageAll} className="text-[10px] text-primary-600 dark:text-primary-300 hover:underline">Stage All</button>}</div>
                                {changes.length === 0 ? <div className="px-2 py-8 text-center text-xs italic text-slate-400">Diretório de trabalho limpo</div> : <ul className="panel-stack-tight">{changes.map(file => <li key={file.id} className={`panel-list-row flex items-center justify-between rounded-xl border transition-all ${selectedFileId === file.id ? 'border-blue-100 bg-blue-50/85 dark:border-blue-500/20 dark:bg-blue-500/10' : 'border-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}><button type="button" onClick={() => setSelectedFileId(file.id)} className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg px-0.5 py-0.5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 dark:focus-visible:ring-sky-500/20"><span className="text-slate-400">{selectedFileId === file.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>{getStatusIcon(file.status)}<span className={`text-sm truncate font-mono ${selectedFileId === file.id ? 'font-medium text-primary-600 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}>{file.file}</span></button><button onClick={() => stageFile(file.id)} className="app-soft-icon-button rounded p-1 text-slate-500"><ArrowUp className="w-3 h-3" /></button></li>)}</ul>}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col">
                            {/* Breadcrumb navigation */}
                            <div className="flex items-center gap-1 text-xs text-slate-500 mb-2 flex-wrap">
                                <button
                                    onClick={() => loadDirectory('')}
                                    className="hover:text-primary-600 dark:hover:text-primary-300 transition-colors font-mono"
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
                                                className="hover:text-primary-600 dark:hover:text-primary-300 transition-colors font-mono"
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
                                    className="mb-1 flex items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 dark:hover:bg-slate-800 dark:focus-visible:ring-sky-500/20"
                                >
                                    <ChevronRight className="w-3 h-3 rotate-180" /> ..
                                </button>
                            )}
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8 text-slate-400">
                                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                                    Carregando arquivos...
                                </div>
                            ) : (
                                <>
                                    {repoFiles.length === 0 && (
                                        <div className="text-center py-8 text-slate-400 text-sm">
                                            Diretório vazio.
                                        </div>
                                    )}
                                    {repoFiles.length > 0 && (
                                        <div className="flex-1 overflow-y-auto panel-stack-tight">
                                            {repoFiles.map((file) => (
                                                <button
                                                    key={file.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (file.type === 'folder') {
                                                            loadDirectory(file.relativePath || file.name);
                                                        } else {
                                                            setActiveFileNode(file);
                                                        }
                                                    }}
                                                    className={`panel-list-row flex w-full items-center gap-2 rounded text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 dark:focus-visible:ring-sky-500/20 ${activeFileNode?.id === file.id ? 'bg-blue-100/80 text-primary-600 dark:bg-blue-900/30 dark:text-primary-300' : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                                >
                                                    {file.type === 'folder' ? (
                                                        <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                    ) : (
                                                        <FileCode className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                    )}
                                                    <span className="truncate font-mono text-xs">{file.name}</span>
                                                    {file.type === 'folder' && <ChevronRight className="w-3 h-3 ml-auto text-slate-300" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'changes' && (
                    <div className="border-t border-slate-200 bg-slate-50/65 dark:border-white/10 dark:bg-white/[0.03]">
                        {/* Remote URL config panel */}
                        {isRemoteConfigOpen && (
                            <div className="panel-body-compact animate-in fade-in slide-in-from-bottom-2 duration-150 border-b border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1"><Link className="w-3 h-3" /> Remote URL (origin)</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={remoteUrlInput}
                                        onChange={(e) => setRemoteUrlInput(e.target.value)}
                                        placeholder="https://github.com/user/repo.git"
                                        className="flex-1 rounded border border-slate-300/80 bg-slate-50/80 px-2 py-1.5 font-mono text-xs shadow-sm shadow-slate-200/40 focus:outline-none focus:ring-1 focus:ring-primary-500/30 dark:border-slate-600 dark:bg-slate-800 dark:shadow-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSaveRemote();
                                            }
                                            if (e.key === 'Escape') {
                                                setIsRemoteConfigOpen(false);
                                            }
                                        }}
                                    />
                                    <button onClick={handleSaveRemote} className="px-2 py-1.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 dark:focus-visible:ring-sky-500/20 font-medium">Salvar</button>
                                    <button onClick={() => setIsRemoteConfigOpen(false)} className="app-soft-icon-button rounded px-2 py-1.5 text-xs">✕</button>
                                </div>
                            </div>
                        )}
                            <div className="panel-body-compact">
                            <div className="relative">
                                <textarea className="app-input h-24 w-full resize-none rounded-2xl px-3 py-2.5 pr-10 text-sm font-sans leading-6 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-50 dark:text-slate-200" placeholder="Mensagem do commit..." value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} disabled={isGenerating}></textarea>
                                <button onClick={generateCommitMessage} disabled={stagedChanges.length === 0 || isGenerating} className="app-soft-icon-button absolute right-2 top-2 rounded-xl p-2 text-primary-600 dark:text-primary-300 disabled:opacity-30" title="Gerar mensagem sugerida"><Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-pulse' : ''}`} /></button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                A IA usa branch atual, repositório e arquivos em stage para sugerir uma mensagem de commit coerente. Se o Ollama falhar, o DevFlow usa o gerador local de fallback.
                            </p>
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleCommit} disabled={stagedChanges.length === 0 || !commitMessage.trim() || isGenerating} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white transition-colors shadow-md shadow-primary-500/20 hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
                                    <Check className="w-4 h-4" /> Commit
                                </button>
                                <button onClick={handlePush} disabled={isPushing || isPulling} title={remoteUrl ? `Push → ${remoteUrl}` : 'Configure o remote antes de fazer push'} className="flex items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-slate-300/40 transition-colors hover:-translate-y-0.5 hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 disabled:opacity-50 dark:shadow-none dark:focus-visible:ring-sky-500/20">
                                    {isPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />} Push
                                </button>
                                <button onClick={handlePull} disabled={isPulling || isPushing} title={remoteUrl ? `Pull ← ${remoteUrl}` : 'Configure o remote antes de fazer pull'} className="flex items-center gap-1.5 rounded-xl bg-slate-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm shadow-slate-300/40 transition-colors hover:-translate-y-0.5 hover:bg-slate-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 disabled:opacity-50 dark:shadow-none dark:focus-visible:ring-sky-500/20">
                                    {isPulling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />} Pull
                                </button>
                                <button onClick={() => setIsRemoteConfigOpen(v => !v)} title="Configurar remote URL" className={`app-soft-icon-button rounded-xl p-2.5 ${remoteUrl ? 'border-emerald-300 bg-emerald-50/80 text-emerald-600 shadow-sm shadow-emerald-100/60 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:shadow-none' : 'border-amber-300 bg-amber-50/80 text-amber-600 shadow-sm shadow-amber-100/60 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:shadow-none'}`}>
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
            <button
                type="button"
                aria-label="Redimensionar painel"
                onMouseDown={startResizing}
                className="hidden md:flex w-2 cursor-col-resize hover:bg-primary-500/30 items-center justify-center group transition-colors select-none"
            >
                <div className={`w-0.5 h-8 bg-slate-300 dark:bg-slate-600 rounded-full group-hover:bg-white transition-colors ${isResizing ? 'bg-white' : ''}`}></div>
            </button>
            <div className="surface-card relative hidden flex-1 flex-col overflow-hidden rounded-[1.6rem] border border-slate-200/75 bg-white/90 shadow-sm shadow-slate-200/60 md:flex dark:border-white/10 dark:bg-transparent dark:shadow-none">
                {isCheckingOut && <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center"></div>}
                {activeTab === 'changes' && activeFileObj && (
                    <>
                        <div className="panel-header-compact flex h-12 items-center justify-between border-b border-slate-200/80 bg-slate-50/60 dark:border-white/10 dark:bg-white/[0.03]"><span className="flex items-center gap-2 font-mono text-sm text-slate-600 dark:text-slate-300"><FileCode className="w-4 h-4" />{activeFileObj.file}</span><span className="flex items-center gap-2 text-xs text-slate-400">Visualizando diff</span></div>
                        <div className="flex-1 overflow-auto bg-white/88 font-mono text-xs md:text-sm dark:bg-slate-900">
                            {diffLines.map((line, idx) => {
                                const lineNo = idx + 1;
                                const marker = getDiffLineMarker(line.type);
                                return (
                                    <div key={`${line.type}-${line.content}-${lineNo}`} className={`flex ${getDiffLineBackgroundClass(line.type)} hover:bg-slate-50/80 dark:hover:bg-slate-800/20`}>
                                        <div className="w-10 select-none border-r border-slate-100 bg-slate-50/65 py-0.5 pr-3 text-right font-mono text-[10px] leading-5 text-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-600">{lineNo}</div>
                                        <div className="w-6 text-center py-0.5 select-none text-slate-300 dark:text-slate-600 font-mono text-[10px] leading-5">{marker}</div>
                                        <div className={`flex-1 py-0.5 px-2 whitespace-pre break-words font-mono text-[12px] leading-5 ${getDiffLineTextClass(line.type)}`}>{line.content}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
                {activeTab === 'changes' && !activeFileObj && <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><GitBranch className="w-16 h-16 mb-4 opacity-20" /><p>Selecione um arquivo alterado para ver as diferenças.</p></div>}
                {activeTab === 'source' && activeFileNode && selectedRepoId && <FileViewer node={activeFileNode} repoId={selectedRepoId} />}
                {activeTab === 'source' && (!activeFileNode || !selectedRepoId) && (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <FolderOpen className="w-16 h-16 mb-4 opacity-20" />
                        <p>Selecione um arquivo na árvore para visualizar o código.</p>
                    </div>
                )}
            </div>
            </div>
            </div>
        </div>
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
            <div className="flex-1 flex items-center justify-center bg-white/88 dark:bg-slate-900">
                <RefreshCw className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white/88 dark:bg-slate-900 text-red-500">
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

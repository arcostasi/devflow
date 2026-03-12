import React, { useState, useMemo, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { Task, TaskStatus, Subtask, Sprint, User, Repository, Comment } from '../types';
import { Plus, UserCircle2, X, MoreHorizontal, Filter, Check, Edit2, Trash2, Users, AlertTriangle, FlaskConical, GitBranch, GitPullRequest, Layout, CheckSquare, Link as LinkIcon, MessageSquare, Send } from 'lucide-react';
import Avatar from './Avatar';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useConfirm } from '../contexts/ConfirmContext';

interface KanbanProps {
    initialTasks: Task[];
    setTasks?: React.Dispatch<React.SetStateAction<Task[]>>;
    addToast: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
    openNewTaskModal?: (status: TaskStatus) => void;
    activeSprint: Sprint | null;
    teamMembers: User[];
    repositories: Repository[];
    selectedTaskId?: string | null;
    onSelectedTaskIdHandled?: () => void;
}

// Configuração das Colunas (inclui novo status 'ready' = Pronto para Release)
const columns: { id: TaskStatus; label: string; color: string; border: string; bg: string; wipLimit?: number }[] = [
    { id: 'todo', label: 'A Fazer', color: 'text-slate-600 dark:text-slate-300', border: 'border-t-slate-400', bg: 'bg-slate-50/70 dark:bg-slate-800/20', wipLimit: 0 },
    { id: 'doing', label: 'Em Progresso', color: 'text-blue-600 dark:text-blue-400', border: 'border-t-blue-500', bg: 'bg-blue-50/55 dark:bg-blue-900/10', wipLimit: 3 },
    { id: 'review', label: 'Revisão / QA', color: 'text-orange-600 dark:text-orange-400', border: 'border-t-orange-500', bg: 'bg-orange-50/55 dark:bg-orange-900/10', wipLimit: 2 },
    { id: 'ready', label: 'Pronto para Release', color: 'text-purple-600 dark:text-purple-400', border: 'border-t-purple-500', bg: 'bg-purple-50/55 dark:bg-purple-900/10', wipLimit: 0 },
    { id: 'done', label: 'Concluído', color: 'text-emerald-600 dark:text-emerald-400', border: 'border-t-emerald-500', bg: 'bg-emerald-50/55 dark:bg-emerald-900/10', wipLimit: 0 },
];

const getPriorityStyles = (p: string) => {
    switch (p) {
        case 'high': return { badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800', border: 'border-l-4 border-l-red-500' };
        case 'medium': return { badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', border: 'border-l-4 border-l-amber-500' };
        default: return { badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', border: 'border-l-4 border-l-slate-400' };
    }
};

const getPriorityLabel = (priority: Task['priority']): string => {
    if (priority === 'low') return 'Baixa';
    if (priority === 'medium') return 'Media';
    return 'Alta';
};

const getCommentsState = (loading: boolean, count: number): 'loading' | 'empty' | 'list' => {
    if (loading) return 'loading';
    if (count === 0) return 'empty';
    return 'list';
};

const boardInsetCard = 'rounded-2xl border border-slate-200/70 bg-slate-50/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

const TaskCard: React.FC<{
    task: Task;
    onClick: (task: Task) => void;
    onDragStart: (e: React.DragEvent<HTMLButtonElement>, task: Task) => void;
}> = ({ task, onClick, onDragStart }) => {
    const styles = getPriorityStyles(task.priority);
    const doneSubtasks = task.subtasks?.filter(s => s.done).length || 0;
    const totalSubtasks = task.subtasks?.length || 0;
    const progress = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

    return (
        <button
            type="button"
            draggable
            onDragStart={(e) => onDragStart(e, task)}
            onClick={() => onClick(task)}
            className={`surface-card group relative w-full cursor-grab rounded-2xl border px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_24px_40px_-32px_rgba(14,165,233,0.18)] active:cursor-grabbing dark:hover:border-primary-500/25 dark:hover:shadow-xl ${styles.border}`}
        >
            <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-slate-200/80 bg-white/72 px-2 py-0.5 text-[10px] font-mono text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">{task.id}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.badge}`}>{getPriorityLabel(task.priority)}</span>
                    {task.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="rounded-full border border-slate-200/80 bg-slate-50/72 px-2 py-0.5 text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)]">{tag}</span>
                    ))}
                </div>
                <span className="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                </span>
            </div>

            <h4 className="mb-3 line-clamp-2 text-sm font-medium leading-snug text-slate-800 dark:text-[var(--text-primary)]">
                {task.title}
            </h4>

            {totalSubtasks > 0 && (
                <div className="mb-3">
                    <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.14em] text-slate-400 dark:text-[var(--text-muted)]">
                        <span>Progresso</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                        <div className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-white/10">
                <div className="flex items-center gap-3 text-slate-500 dark:text-[var(--text-muted)]">
                    {Boolean(task.storyPoints) && (
                        <span className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/75 px-2 py-1 text-[11px] font-medium shadow-sm shadow-slate-200/35 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none" title="Story Points">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span> {task.storyPoints}
                        </span>
                    )}
                    {task.repositoryId && (
                        <span title="Repo Vinculado"><GitBranch className="w-3.5 h-3.5 text-slate-400" /></span>
                    )}
                </div>

                <div className="flex space-x-[3px]">
                    {task.assignee ? <Avatar name={task.assignee.name} size="sm" className="border-2 border-white dark:border-slate-800" /> : <UserCircle2 className="w-6 h-6 text-slate-300" />}
                    {task.pairAssignee && (
                        <div className="relative">
                            <Avatar name={task.pairAssignee.name} size="sm" className="border-2 border-white dark:border-slate-800" />
                            <div className="absolute -bottom-1 -right-1 bg-primary-500 text-white rounded-full p-[1px] border border-white dark:border-slate-800"><Users className="w-2 h-2" /></div>
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
};

export const Kanban: React.FC<KanbanProps> = ({ initialTasks, setTasks: setParentTasks, addToast, openNewTaskModal, activeSprint, teamMembers, repositories, selectedTaskId, onSelectedTaskIdHandled }) => {
    const { confirm } = useConfirm();
    const [localTasks, setLocalTasks] = useState<Task[]>(initialTasks);
    const tasks = setParentTasks ? initialTasks : localTasks;
    const setTasks = setParentTasks || setLocalTasks;

    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
    const [filterRepo, setFilterRepo] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'git' | 'comments'>('details');

    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);
    const [postingComment, setPostingComment] = useState(false);
    const [gitLinkDrafts, setGitLinkDrafts] = useState({ linkedBranch: '', linkedPRUrl: '', linkedMRIid: '' });

    // Reset tab and comments when switching tasks
    const prevTaskIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (selectedTask?.id !== prevTaskIdRef.current) {
            prevTaskIdRef.current = selectedTask?.id || null;
            if (selectedTask) {
                setActiveTab('details');
                setComments([]);
                setCommentText('');
            }
        }
    }, [selectedTask?.id]);

    useEffect(() => {
        if (!selectedTask || activeTab !== 'comments') return;
        setLoadingComments(true);
        api.getTaskComments(selectedTask.id)
            .then(setComments)
            .catch(() => {})
            .finally(() => setLoadingComments(false));
    }, [selectedTask?.id, activeTab]);

    useEffect(() => {
        setGitLinkDrafts({
            linkedBranch: selectedTask?.linkedBranch || '',
            linkedPRUrl: selectedTask?.linkedPRUrl || '',
            linkedMRIid: selectedTask?.linkedMRIid || '',
        });
    }, [selectedTask?.id, selectedTask?.linkedBranch, selectedTask?.linkedPRUrl, selectedTask?.linkedMRIid]);

    useEffect(() => {
        if (!selectedTaskId) return;

        const taskToOpen = tasks.find(task => task.id === selectedTaskId);
        if (taskToOpen) {
            setSelectedTask(taskToOpen);
        }

        onSelectedTaskIdHandled?.();
    }, [selectedTaskId, tasks, onSelectedTaskIdHandled]);

    const handlePostComment = async () => {
        if (!commentText.trim() || !selectedTask) return;
        setPostingComment(true);
        try {
            const newComment = await api.createTaskComment(selectedTask.id, commentText.trim());
            setComments(prev => [...prev, newComment]);
            setCommentText('');
        } catch (e: any) {
            addToast('Falha ao Comentar', 'error', e.message || 'Não foi possível publicar o comentário.');
        } finally {
            setPostingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!selectedTask) return;
        try {
            await api.deleteTaskComment(selectedTask.id, commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (e: any) {
            addToast('Falha ao Excluir', 'error', e.message || 'Não foi possível remover o comentário.');
        }
    };

    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    // Auto-animate para colunas
    const [todoRef] = useAutoAnimate();
    const [doingRef] = useAutoAnimate();
    const [reviewRef] = useAutoAnimate();
    const [readyRef] = useAutoAnimate();
    const [doneRef] = useAutoAnimate();
    const colRefs = { todo: todoRef, doing: doingRef, review: reviewRef, ready: readyRef, done: doneRef };

    const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, task: Task) => {
        setDraggedTaskId(task.id);
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // Necessário para permitir o drop
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');

        if (taskId) {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
            // Persist status change to backend
            api.updateTask(taskId, { status }).catch(() =>
                addToast('Falha ao Mover Tarefa', 'error', 'Não foi possível salvar a alteração de status.')
            );
        }
        setDraggedTaskId(null);
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesAssignee = filterAssignee ? (t.assignee?.id === filterAssignee || t.pairAssignee?.id === filterAssignee) : true;
            const matchesRepo = filterRepo ? t.repositoryId === filterRepo : true;
            return matchesAssignee && matchesRepo && t.status !== 'backlog';
        });
    }, [tasks, filterAssignee, filterRepo]);

    const completedCount = useMemo(() => filteredTasks.filter(t => t.status === 'done').length, [filteredTasks]);
    const inFlightCount = useMemo(() => filteredTasks.filter(t => ['doing', 'review', 'ready'].includes(t.status)).length, [filteredTasks]);
    const boardPoints = useMemo(() => filteredTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0), [filteredTasks]);

    // Debounce ref for text field updates
    const updateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateTask = (updates: Partial<Task>) => {
        if (!selectedTask) return;
        const updated = { ...selectedTask, ...updates };
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? updated : t));
        setSelectedTask(updated);

        // Debounce API call to avoid flooding on text input
        if (updateDebounceRef.current) clearTimeout(updateDebounceRef.current);
        updateDebounceRef.current = setTimeout(() => {
            api.updateTask(selectedTask.id, updates).catch(() =>
                addToast('Falha ao Salvar', 'error', 'Não foi possível salvar as alterações da tarefa.')
            );
        }, 600);
    };

    const addSubtask = (text: string) => {
        if (!text.trim()) return;
        const subtask: Subtask = { id: `st-${Date.now()}`, text, done: false };
        updateTask({ subtasks: [...(selectedTask?.subtasks || []), subtask] });
    };

    const saveGitLinkDraft = (field: 'linkedBranch' | 'linkedPRUrl' | 'linkedMRIid') => {
        if (!selectedTask) return;
        const nextValue = gitLinkDrafts[field].trim();
        const currentValue = (selectedTask[field] || '').trim();
        if (nextValue === currentValue) return;
        updateTask({ [field]: nextValue } as Partial<Task>);
    };

    return (
        <div className="page-shell flex min-h-[calc(100vh-4.25rem)] flex-col">

            {/* Header da Sprint */}
            <div className="surface-card mx-6 mt-6 rounded-[1.6rem]">
                                <div className="panel-header-block flex flex-col gap-5 border-b border-slate-200/70 bg-slate-50/45 dark:border-white/10 dark:bg-transparent xl:flex-row xl:items-start xl:justify-between">
                    {activeSprint ? (
                        <div className="max-w-3xl">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Sprint ativa</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-[var(--text-primary)]">{activeSprint.name}</h1>
                                <span className="rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 shadow-sm shadow-emerald-100/60 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300 dark:shadow-none">Ativo</span>
                            </div>
                            <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                                <TargetIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-500" />
                                <span><span className="font-medium text-slate-700 dark:text-[var(--text-secondary)]">Meta:</span> {activeSprint.goal}</span>
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-[var(--text-muted)]">Sprint ativa</p>
                            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-400">Nenhuma Sprint Ativa</h1>
                            <p className="mt-3 text-sm text-slate-500 dark:text-[var(--text-muted)]">Crie uma sprint para organizar capacidade, limites WIP e foco de entrega.</p>
                        </div>
                    )}

                    <div className="flex flex-col items-start gap-4 xl:items-end">
                        {activeSprint && (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div className={`${boardInsetCard} px-4 py-3`}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Período</p>
                                    <p className="mt-2 text-sm font-medium text-slate-700 dark:text-[var(--text-secondary)] font-mono">{activeSprint.startDate} → {activeSprint.endDate}</p>
                                </div>
                                <div className={`${boardInsetCard} border-blue-200/60 bg-blue-50/50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]`}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Em fluxo</p>
                                    <p className="mt-2 text-xl font-medium text-slate-800 dark:text-[var(--text-primary)]">{inFlightCount}</p>
                                </div>
                                <div className={`${boardInsetCard} border-emerald-200/60 bg-emerald-50/50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]`}>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Concluídas</p>
                                    <p className="mt-2 text-xl font-medium text-slate-800 dark:text-[var(--text-primary)]">{completedCount}</p>
                                </div>
                            </div>
                        )}
                        <button onClick={() => openNewTaskModal?.('todo')} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-500/20 transition-colors hover:bg-primary-700">
                            <Plus className="w-4 h-4" /> Nova Tarefa
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 bg-slate-50/35 px-6 py-4 dark:bg-transparent">
                    <div className="rounded-full border border-slate-200/80 bg-slate-50/78 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm shadow-slate-200/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-secondary)] dark:shadow-none">
                        {filteredTasks.length} itens no board
                    </div>
                    <div className="rounded-full border border-slate-200/80 bg-slate-50/78 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm shadow-slate-200/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-secondary)] dark:shadow-none">
                        {boardPoints} pontos mapeados
                    </div>
                    <div className="rounded-full border border-slate-200/80 bg-slate-50/78 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm shadow-slate-200/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-secondary)] dark:shadow-none">
                        {teamMembers.length} pessoas disponíveis
                    </div>
                </div>
            </div>

            {/* Filtros Rápidos */}
            <div className="surface-card panel-body-compact mx-6 mt-4 rounded-[1.35rem]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/78 px-3 py-2 text-slate-500 shadow-sm shadow-slate-200/45 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-muted)] dark:shadow-none">
                            <Filter className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Filtros</span>
                        </div>
                        <select
                            className="app-input rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-[var(--text-secondary)]"
                            value={filterRepo || ''}
                            onChange={(e) => setFilterRepo(e.target.value || null)}
                        >
                            <option value="">Todos os Projetos</option>
                            {(repositories || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setFilterAssignee(null)} className={`inline-flex h-8 items-center justify-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${filterAssignee === null ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200/80 bg-slate-50/78 text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-muted)] dark:shadow-none'}`}>Time</button>
                        {(teamMembers || []).map(m => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setFilterAssignee(filterAssignee === m.id ? null : m.id)}
                                className={`transition-transform hover:z-20 hover:scale-110 ${filterAssignee === m.id ? 'z-20 ring-2 ring-primary-500 rounded-full' : ''}`}
                                aria-label={`Filtrar por ${m.name}`}
                            >
                                <Avatar name={m.name} size="sm" className="border border-white dark:border-slate-900" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Board */}
            <div className="flex-1 overflow-x-auto px-6 pb-6 pt-5">
                <div className="flex h-[48rem] min-w-[1260px] gap-5 xl:h-[54rem] 2xl:h-[58rem]">
                    {columns.map(col => {
                        const colTasks = filteredTasks.filter(t => t.status === col.id);
                        const isOverLimit = col.wipLimit && col.wipLimit > 0 && colTasks.length > col.wipLimit;

                        return (
                            <div
                                key={col.id}
                                className={`surface-card flex h-full flex-1 flex-col rounded-[1.35rem] ${isOverLimit ? 'border-red-300 dark:border-red-900/60' : 'border-slate-200/70 dark:border-white/10'}`}
                            >
                                {/* Header Coluna */}
                                <div className={`panel-header-compact rounded-t-[1.35rem] border-b border-slate-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.56)] dark:border-white/10 dark:shadow-none ${col.bg} ${col.border} border-t-4`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <h3 className={`font-semibold ${col.color}`}>{col.label}</h3>
                                        </div>
                                        {isOverLimit && <span title="WIP Limit Exceeded"><AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" /></span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono font-medium ${isOverLimit ? 'bg-red-100/90 text-red-600 dark:bg-red-500/[0.1] dark:text-red-300' : 'bg-white/78 text-slate-500 shadow-sm shadow-slate-200/35 dark:bg-white/[0.06] dark:text-[var(--text-muted)] dark:shadow-none'}`}>
                                            {colTasks.length} {col.wipLimit ? `/ ${col.wipLimit}` : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* Area de Drop */}
                                <section
                                    ref={colRefs[col.id as keyof typeof colRefs]}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, col.id)}
                                    aria-label={`Coluna ${col.label}`}
                                    className={`panel-body-compact panel-stack-tight flex flex-1 overflow-y-auto transition-colors ${draggedTaskId ? 'bg-blue-50/35 dark:bg-blue-900/5' : ''}`}
                                >
                                    {colTasks.map(task => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            onClick={setSelectedTask}
                                            onDragStart={handleDragStart}
                                        />
                                    ))}

                                    {/* Botão Adicionar Rápido no rodapé da coluna */}
                                    <button
                                        onClick={() => openNewTaskModal?.(col.id)}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300/90 bg-slate-50/7 py-2.5 text-sm text-slate-400 transition-all hover:border-primary-500/50 hover:bg-slate-50/85 hover:text-primary-600 dark:border-white/10 dark:hover:bg-slate-800/50 dark:hover:text-primary-300"
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar
                                    </button>
                                </section>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Drawer de Detalhes da Tarefa */}
            {selectedTask && (
                <div className="absolute inset-0 z-50 flex justify-end">
                    <button
                        type="button"
                        aria-label="Fechar detalhes da tarefa"
                        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
                        onClick={() => setSelectedTask(null)}
                    />
                    <div className="app-flyout relative flex h-full w-full flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200 md:w-[620px] dark:border-white/10">

                        {/* Drawer Header */}
                        <div className="panel-header-block flex items-start justify-between gap-4 border-b border-slate-200/70 bg-slate-50/72 dark:border-white/10 dark:bg-white/[0.03]">
                            <div className="mr-4 flex-1">
                                <div className="mb-3 flex items-center gap-2 text-xs">
                                    <span className="rounded-full border border-slate-200/80 bg-white/78 px-2 py-1 font-mono text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">{selectedTask.id}</span>
                                    <div className={`rounded-full border px-2.5 py-1 capitalize font-semibold ${getPriorityStyles(selectedTask.priority).badge}`}>
                                        Prioridade {getPriorityLabel(selectedTask.priority)}
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={selectedTask.title}
                                    onChange={(e) => updateTask({ title: e.target.value })}
                                    className="w-full border-none bg-transparent p-0 text-2xl font-semibold tracking-tight text-slate-800 placeholder-slate-400 focus:ring-0 dark:text-[var(--text-primary)]"
                                />
                            </div>
                            <button onClick={() => setSelectedTask(null)} className="app-icon-button h-10 w-10 rounded-full border border-slate-200/80 bg-white/78 shadow-sm shadow-slate-200/45 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Tabs */}
                        <div className="panel-header-compact border-b border-slate-200/60 bg-slate-50/38 dark:border-white/10 dark:bg-transparent">
                            <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'details', label: 'Detalhes', icon: Layout },
                                { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                                { id: 'git', label: 'Conexões', icon: GitBranch },
                                { id: 'comments', label: 'Comentários', icon: MessageSquare },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200/80 bg-slate-50/78 text-slate-500 shadow-sm shadow-slate-200/40 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-muted)] dark:shadow-none dark:hover:text-[var(--text-primary)]'}`}
                                >
                                    <tab.icon className="w-4 h-4" /> {tab.label}
                                </button>
                            ))}
                            </div>
                        </div>

                        {/* Drawer Content */}
                                <div className="panel-body-compact flex-1 overflow-y-auto">

                            {activeTab === 'details' && (
                                <div className="panel-stack">
                                    {/* Propriedades Rápidas */}
                                    <div className="surface-muted panel-body-compact grid grid-cols-2 gap-4 rounded-2xl">
                                        <div>
                                            <label htmlFor="task-status" className="text-xs text-slate-500 uppercase font-semibold mb-1 block">Status</label>
                                            <select
                                                id="task-status"
                                                value={selectedTask.status}
                                                onChange={(e) => updateTask({ status: e.target.value as TaskStatus })}
                                                className="app-input w-full rounded-xl px-3 py-2 text-sm"
                                            >
                                                {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="task-assignee" className="text-xs text-slate-500 uppercase font-semibold mb-1 block">Responsavel</label>
                                            <div className="flex items-center gap-2">
                                                {selectedTask.assignee && <Avatar name={selectedTask.assignee.name} size="sm" />}
                                                <select
                                                    id="task-assignee"
                                                    value={selectedTask.assignee?.id || ''}
                                                    onChange={(e) => updateTask({ assignee: teamMembers.find(m => m.id === e.target.value) })}
                                                    className="app-input flex-1 rounded-xl px-3 py-2 text-sm"
                                                >
                                                    <option value="">Ninguém</option>
                                                    {(teamMembers || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="task-priority" className="text-xs text-slate-500 uppercase font-semibold mb-1 block">Prioridade</label>
                                            <select
                                                id="task-priority"
                                                value={selectedTask.priority}
                                                onChange={(e) => updateTask({ priority: e.target.value as any })}
                                                className="app-input w-full rounded-xl px-3 py-2 text-sm"
                                            >
                                                <option value="low">Baixa</option>
                                                <option value="medium">Média</option>
                                                <option value="high">Alta</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="task-story-points" className="text-xs text-slate-500 uppercase font-semibold mb-1 block">Story Points</label>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 5, 8, 13].map(pt => (
                                                    <button
                                                        key={pt}
                                                        onClick={() => updateTask({ storyPoints: pt })}
                                                        id={pt === 1 ? 'task-story-points' : undefined}
                                                        className={`h-9 w-9 rounded-xl border text-xs font-bold transition-all ${selectedTask.storyPoints === pt ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200/80 bg-slate-50/78 text-slate-600 shadow-sm shadow-slate-200/35 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-secondary)] dark:shadow-none'}`}
                                                    >
                                                        {pt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                            <Edit2 className="w-4 h-4" /> Descrição
                                        </label>
                                        <textarea
                                            value={selectedTask.description}
                                            onChange={(e) => updateTask({ description: e.target.value })}
                                            className="app-input h-40 w-full resize-none rounded-2xl p-4 text-sm leading-relaxed focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                            placeholder="Adicione detalhes, critérios de aceitação..."
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Práticas XP</h4>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200/80 bg-slate-50/7 p-3 hover:bg-slate-50/85 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/[0.03]">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(selectedTask.xpPractices?.tdd)}
                                                    onChange={(e) => updateTask({ xpPractices: { ...(selectedTask.xpPractices || { tdd: false, refactoring: false }), tdd: e.target.checked } })}
                                                    className="rounded text-primary-600"
                                                />
                                                <span className="text-sm">TDD (Test-First)</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200/80 bg-slate-50/7 p-3 hover:bg-slate-50/85 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/[0.03]">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(selectedTask.xpPractices?.refactoring)}
                                                    onChange={(e) => updateTask({ xpPractices: { ...(selectedTask.xpPractices || { tdd: false, refactoring: false }), refactoring: e.target.checked } })}
                                                    className="rounded text-primary-600"
                                                />
                                                <span className="text-sm">Refactoring</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'checklist' && (
                                <div className="panel-stack-tight">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-white/[0.06]">
                                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${selectedTask.subtasks?.length ? Math.round((selectedTask.subtasks.filter(s => s.done).length / selectedTask.subtasks.length) * 100) : 0}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{selectedTask.subtasks?.length ? Math.round((selectedTask.subtasks.filter(s => s.done).length / selectedTask.subtasks.length) * 100) : 0}%</span>
                                    </div>

                                    <div className="panel-stack-tight">
                                        {selectedTask.subtasks?.map(st => (
                                            <div key={st.id} className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/78 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                                                <button
                                                    onClick={() => {
                                                        const newSubtasks = selectedTask.subtasks?.map(s => s.id === st.id ? { ...s, done: !s.done } : s);
                                                        updateTask({ subtasks: newSubtasks });
                                                    }}
                                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${st.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                                                >
                                                    {st.done && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                                <input
                                                    type="text"
                                                    value={st.text}
                                                    onChange={(e) => {
                                                        const newSubtasks = selectedTask.subtasks?.map(s => s.id === st.id ? { ...s, text: e.target.value } : s);
                                                        updateTask({ subtasks: newSubtasks });
                                                    }}
                                                    className={`flex-1 bg-transparent border-none p-0 focus:ring-0 text-sm ${st.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
                                                />
                                                <button onClick={() => updateTask({ subtasks: selectedTask.subtasks?.filter(s => s.id !== st.id) })} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <input
                                            type="text"
                                            placeholder="Adicionar item à checklist..."
                                            className="app-input flex-1 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    addSubtask(e.currentTarget.value);
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                        <button className="rounded-xl border border-slate-200/80 bg-slate-50/78 p-2 text-slate-600 shadow-sm shadow-slate-200/35 hover:bg-slate-100/85 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:shadow-none dark:hover:bg-white/[0.08]">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'git' && (
                                <div className="panel-stack">
                                    <div className="flex items-start gap-3 rounded-2xl border border-blue-200/70 bg-blue-50/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-blue-900/30 dark:bg-blue-900/10 dark:shadow-none">
                                        <GitBranch className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">Vincular Repositório</h4>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Conecte esta tarefa a um branch ou PR para rastreamento automático.</p>
                                            <div className="flex gap-2 mt-3">
                                                <select
                                                    value={selectedTask.repositoryId || ''}
                                                    onChange={(e) => updateTask({ repositoryId: e.target.value })}
                                                    className="app-input flex-1 rounded-xl px-3 py-2 text-sm"
                                                >
                                                    <option value="">Selecionar Repositório...</option>
                                                    {repositories.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                                <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Link</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700 dark:text-white">
                                            <GitBranch className="w-4 h-4" /> Branch Vinculado
                                        </h4>
                                        <input
                                            type="text"
                                            value={gitLinkDrafts.linkedBranch}
                                            onChange={(e) => setGitLinkDrafts(prev => ({ ...prev, linkedBranch: e.target.value }))}
                                            onBlur={() => saveGitLinkDraft('linkedBranch')}
                                            placeholder="Ex: feature/TASK-123-minha-feature"
                                            className="app-input w-full rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700 dark:text-white">
                                            <GitPullRequest className="w-4 h-4" /> Pull Request / Merge Request
                                        </h4>
                                        <div className="panel-stack-tight">
                                            <input
                                                type="text"
                                                value={gitLinkDrafts.linkedPRUrl}
                                                onChange={(e) => setGitLinkDrafts(prev => ({ ...prev, linkedPRUrl: e.target.value }))}
                                                onBlur={() => saveGitLinkDraft('linkedPRUrl')}
                                                placeholder="URL do PR (ex: https://github.com/org/repo/pull/42)"
                                                className="app-input w-full rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                            />
                                            {selectedTask.linkedPRUrl && (
                                                <a
                                                    href={selectedTask.linkedPRUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/78 p-3 text-sm text-primary-600 shadow-sm shadow-slate-200/40 transition-colors hover:border-primary-400/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-primary-300 dark:shadow-none"
                                                >
                                                    <GitPullRequest className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                                    <span className="truncate font-mono text-xs">{selectedTask.linkedPRUrl}</span>
                                                    <LinkIcon className="w-3 h-3 ml-auto flex-shrink-0" />
                                                </a>
                                            )}
                                            <input
                                                type="text"
                                                value={gitLinkDrafts.linkedMRIid}
                                                onChange={(e) => setGitLinkDrafts(prev => ({ ...prev, linkedMRIid: e.target.value }))}
                                                onBlur={() => saveGitLinkDraft('linkedMRIid')}
                                                placeholder="GitLab MR IID (ex: 42)"
                                                className="app-input w-full rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'comments' && (
                                <div className="panel-stack-tight flex h-full">
                                    {getCommentsState(loadingComments, comments.length) === 'loading' && (
                                        <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                                            <MessageSquare className="w-4 h-4 animate-pulse" /> Carregando comentários...
                                        </div>
                                    )}

                                    {getCommentsState(loadingComments, comments.length) === 'empty' && (
                                        <div className="surface-empty rounded-2xl py-10 text-center text-sm italic text-slate-400 dark:text-[var(--text-muted)]">
                                            Nenhum comentário ainda. Seja o primeiro!
                                        </div>
                                    )}

                                    {getCommentsState(loadingComments, comments.length) === 'list' && (
                                        <div className="panel-stack-tight">
                                            {comments.map(comment => (
                                                <div key={comment.id} className="flex gap-3 group">
                                                    <Avatar name={comment.author?.name || '?'} size="sm" className="flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/78 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.58)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{comment.author?.name || 'Usuário'}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-slate-400">{new Date(comment.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                                    <button
                                                                        onClick={() => handleDeleteComment(comment.id)}
                                                                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-auto flex gap-2 border-t border-slate-200/60 pt-3 dark:border-white/10">
                                        <textarea
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }}
                                            placeholder="Escreva um comentário... (Enter para enviar)"
                                            rows={2}
                                            className="app-input flex-1 resize-none rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                        />
                                        <button
                                            onClick={handlePostComment}
                                            disabled={!commentText.trim() || postingComment}
                                            className="self-end rounded-2xl bg-primary-600 p-2.5 text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Drawer Footer */}
                        <div className="panel-header-compact flex items-center justify-between border-t border-slate-200/70 bg-slate-50/72 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-[var(--text-muted)]">
                            <span className="font-mono">{selectedTask.id}</span>
                            <button
                                onClick={async () => {
                                    if (!await confirm({ title: 'Excluir Tarefa', message: 'Excluir esta tarefa permanentemente?', confirmText: 'Excluir', variant: 'danger' })) return;
                                    try {
                                        await api.deleteTask(selectedTask.id);
                                        setTasks(prev => prev.filter(t => t.id !== selectedTask.id));
                                        setSelectedTask(null);
                                        addToast('Tarefa Excluída', 'info', 'A tarefa foi removida permanentemente.');
                                    } catch {
                                        addToast('Falha ao Excluir', 'error', 'Não foi possível excluir a tarefa.');
                                    }
                                }}
                                className="flex items-center gap-1 text-red-500 hover:text-red-600 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Excluir Tarefa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TargetIcon = ({ className }: { className?: string }) => (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
    </svg>
);

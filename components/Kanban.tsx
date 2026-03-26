import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { ActivityLog, ChecklistItem, Task, TaskStatus, Subtask, Sprint, User, Repository, Comment, RiskLevel, getErrorMessage } from '../types';
import { Plus, UserCircle2, X, MoreHorizontal, Filter, Check, Edit2, Trash2, Users, AlertTriangle, FlaskConical, GitBranch, GitPullRequest, Layout, CheckSquare, Link as LinkIcon, MessageSquare, Send, ChevronLeft, ChevronRight, ShieldCheck, TimerReset, Sparkles, Link2 } from 'lucide-react';
import Avatar from './Avatar';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useConfirm } from '../contexts/ConfirmContext';
import AIFieldAssist from './AIFieldAssist';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { getTaskPriorityLabel, getTaskPriorityToneClass, getTaskStatusLabel } from '../utils/statusPriority';

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
    isLoading?: boolean;
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
        case 'high': return { badge: getTaskPriorityToneClass('high', 'kanban-badge'), border: 'border-l-4 border-l-red-500' };
        case 'medium': return { badge: getTaskPriorityToneClass('medium', 'kanban-badge'), border: 'border-l-4 border-l-amber-500' };
        default: return { badge: getTaskPriorityToneClass('low', 'kanban-badge'), border: 'border-l-4 border-l-slate-400' };
    }
};

const getRiskLabel = (risk?: RiskLevel): string => {
    if (risk === 'high') return 'Alto';
    if (risk === 'low') return 'Baixo';
    return 'Médio';
};

const getRiskTone = (risk?: RiskLevel): string => {
    if (risk === 'high') return 'border-red-200/80 bg-red-50/75 text-red-700 dark:border-red-500/20 dark:bg-red-500/[0.12] dark:text-red-300';
    if (risk === 'low') return 'border-emerald-200/80 bg-emerald-50/75 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.12] dark:text-emerald-300';
    return 'border-amber-200/80 bg-amber-50/75 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/[0.12] dark:text-amber-300';
};

const formatTimelineTimestamp = (value?: string) => {
    if (!value) return 'Sem registro';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const getChecklistProgress = (items?: ChecklistItem[]) => {
    if (!items?.length) return 0;
    return Math.round((items.filter((item) => item.checked).length / items.length) * 100);
};

const summarizeRecentComments = (comments: Comment[], limit = 3) => comments
    .slice(-limit)
    .map((comment) => ({
        author: comment.author?.name || 'Usuário',
        text: comment.text,
        timestamp: comment.timestamp,
    }));

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
    onMoveRequest: (task: Task, rect: DOMRect) => void;
}> = React.memo(({ task, onClick, onDragStart, onMoveRequest }) => {
    const styles = getPriorityStyles(task.priority);
    const doneSubtasks = task.subtasks?.filter(s => s.done).length || 0;
    const totalSubtasks = task.subtasks?.length || 0;
    const progress = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onMoveRequest(task, rect);
        }
    };

    return (
        <button
            type="button"
            draggable
            onDragStart={(e) => onDragStart(e, task)}
            onClick={() => onClick(task)}
            onKeyDown={handleKeyDown}
            aria-label={`${task.title} — ${getTaskStatusLabel(task.status, 'kanban')}. Pressione M para mover.`}
            className={`surface-card group relative w-full cursor-grab rounded-2xl border px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary-500/20 hover:shadow-[0_24px_40px_-32px_rgba(14,165,233,0.18)] active:cursor-grabbing dark:hover:border-primary-500/25 dark:hover:shadow-xl ${styles.border}`}
        >
            <div className="mb-2.5 flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-slate-200/80 bg-white/72 px-2 py-0.5 text-[10px] font-mono text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">{task.id}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles.badge}`}>{getTaskPriorityLabel(task.priority)}</span>
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
});

export const Kanban: React.FC<KanbanProps> = ({ initialTasks, setTasks: setParentTasks, addToast, openNewTaskModal, activeSprint, teamMembers, repositories, selectedTaskId, onSelectedTaskIdHandled, isLoading = false }) => {
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
    const [taskActivities, setTaskActivities] = useState<ActivityLog[]>([]);
    const [loadingTaskActivities, setLoadingTaskActivities] = useState(false);
    const [gitLinkDrafts, setGitLinkDrafts] = useState({ linkedBranch: '', linkedPRUrl: '', linkedMRIid: '' });

    // Move-to menu state (keyboard accessible column move)
    const [moveMenu, setMoveMenu] = useState<{ task: Task; rect: DOMRect } | null>(null);
    const [moveMenuIndex, setMoveMenuIndex] = useState(0);
    const [liveAnnouncement, setLiveAnnouncement] = useState('');
    const moveMenuRef = useRef<HTMLDivElement>(null);

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
        const controller = new AbortController();
        setLoadingComments(true);
        api.getTaskComments(selectedTask.id)
            .then(data => { if (!controller.signal.aborted) setComments(data); })
            .catch(() => {})
            .finally(() => { if (!controller.signal.aborted) setLoadingComments(false); });
        return () => controller.abort();
    }, [selectedTask?.id, activeTab]);

    useEffect(() => {
        if (!selectedTask) {
            setTaskActivities([]);
            return;
        }

        const controller = new AbortController();
        setLoadingTaskActivities(true);
        api.getActivities()
            .then((activities) => {
                if (controller.signal.aborted) return;
                const normalizedTitle = selectedTask.title.trim().toLocaleLowerCase('pt-BR');
                const relatedActivities = (activities as ActivityLog[]).filter((activity) => {
                    if (activity.taskId === selectedTask.id) return true;
                    return activity.target?.trim().toLocaleLowerCase('pt-BR') === normalizedTitle;
                });
                setTaskActivities(relatedActivities.slice(0, 8));
            })
            .catch(() => { if (!controller.signal.aborted) setTaskActivities([]); })
            .finally(() => { if (!controller.signal.aborted) setLoadingTaskActivities(false); });
        return () => controller.abort();
    }, [selectedTask?.id, selectedTask?.title]);

    useEffect(() => {
        setGitLinkDrafts({
            linkedBranch: selectedTask?.linkedBranch || '',
            linkedPRUrl: selectedTask?.linkedPRUrl || '',
            linkedMRIid: selectedTask?.linkedMRIid || '',
        });
    }, [selectedTask?.id, selectedTask?.linkedBranch, selectedTask?.linkedPRUrl, selectedTask?.linkedMRIid]);

    useEffect(() => {
        const workspaceBody = document.querySelector<HTMLElement>('.app-workspace-body');
        if (!workspaceBody) return;

        const previousOverflowY = workspaceBody.style.overflowY;
        const previousOverscrollBehavior = workspaceBody.style.overscrollBehavior;

        if (selectedTask) {
            workspaceBody.style.overflowY = 'hidden';
            workspaceBody.style.overscrollBehavior = 'contain';
        }

        return () => {
            workspaceBody.style.overflowY = previousOverflowY;
            workspaceBody.style.overscrollBehavior = previousOverscrollBehavior;
        };
    }, [selectedTask]);

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
        } catch (e: unknown) {
            addToast('Falha ao Comentar', 'error', getErrorMessage(e) || 'Não foi possível publicar o comentário.');
        } finally {
            setPostingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!selectedTask) return;
        try {
            await api.deleteTaskComment(selectedTask.id, commentId);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (e: unknown) {
            addToast('Falha ao Excluir', 'error', getErrorMessage(e) || 'Não foi possível remover o comentário.');
        }
    };

    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const boardScrollRef = useRef<HTMLDivElement | null>(null);
    const [canScrollBoardLeft, setCanScrollBoardLeft] = useState(false);
    const [canScrollBoardRight, setCanScrollBoardRight] = useState(false);

    // Auto-animate para colunas
    const [todoRef] = useAutoAnimate();
    const [doingRef] = useAutoAnimate();
    const [reviewRef] = useAutoAnimate();
    const [readyRef] = useAutoAnimate();
    const [doneRef] = useAutoAnimate();
    const colRefs = { todo: todoRef, doing: doingRef, review: reviewRef, ready: readyRef, done: doneRef };

    const handleDragStart = React.useCallback((e: React.DragEvent<HTMLButtonElement>, task: Task) => {
        setDraggedTaskId(task.id);
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
    }, []);

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

    // Keyboard move-to menu handlers
    const handleMoveRequest = useCallback((task: Task, rect: DOMRect) => {
        const otherColumns = columns.filter(c => c.id !== task.status);
        if (otherColumns.length === 0) return;
        setMoveMenu({ task, rect });
        setMoveMenuIndex(0);
    }, []);

    const handleMoveSelect = useCallback((task: Task, newStatus: TaskStatus) => {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        api.updateTask(task.id, { status: newStatus }).catch(() =>
            addToast('Falha ao Mover Tarefa', 'error', 'Não foi possível salvar a alteração de status.')
        );
        const label = columns.find(c => c.id === newStatus)?.label || newStatus;
        setLiveAnnouncement(`Tarefa "${task.title}" movida para ${label}`);
        setMoveMenu(null);
    }, [setTasks, addToast]);

    const handleMoveMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!moveMenu) return;
        const otherColumns = columns.filter(c => c.id !== moveMenu.task.status);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            setMoveMenuIndex(i => (i + 1) % otherColumns.length);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            setMoveMenuIndex(i => (i - 1 + otherColumns.length) % otherColumns.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleMoveSelect(moveMenu.task, otherColumns[moveMenuIndex].id);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setMoveMenu(null);
        }
    }, [moveMenu, moveMenuIndex, handleMoveSelect]);

    // Focus the move menu when it opens
    useEffect(() => {
        if (moveMenu && moveMenuRef.current) {
            moveMenuRef.current.focus();
        }
    }, [moveMenu]);

    // Close move menu on outside click
    useEffect(() => {
        if (!moveMenu) return;
        const handleClick = (e: MouseEvent) => {
            if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) {
                setMoveMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [moveMenu]);

    const updateBoardScrollState = () => {
        const board = boardScrollRef.current;
        if (!board) {
            setCanScrollBoardLeft(false);
            setCanScrollBoardRight(false);
            return;
        }

        const maxScrollLeft = board.scrollWidth - board.clientWidth;
        setCanScrollBoardLeft(board.scrollLeft > 8);
        setCanScrollBoardRight(board.scrollLeft < maxScrollLeft - 8);
    };

    const scrollBoard = (direction: 'left' | 'right') => {
        const board = boardScrollRef.current;
        if (!board) return;

        const amount = Math.max(280, Math.round(board.clientWidth * 0.72));
        board.scrollBy({
            left: direction === 'left' ? -amount : amount,
            behavior: 'smooth',
        });
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesAssignee = filterAssignee ? (t.assignee?.id === filterAssignee || t.pairAssignee?.id === filterAssignee) : true;
            const matchesRepo = filterRepo ? t.repositoryId === filterRepo : true;
            return matchesAssignee && matchesRepo && t.status !== 'backlog';
        });
    }, [tasks, filterAssignee, filterRepo]);

    useEffect(() => {
        updateBoardScrollState();

        const board = boardScrollRef.current;
        if (!board) return;

        const handleScroll = () => updateBoardScrollState();
        const handleResize = () => updateBoardScrollState();

        board.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);

        return () => {
            board.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
    }, [filteredTasks.length]);

    const completedCount = useMemo(() => filteredTasks.filter(t => t.status === 'done').length, [filteredTasks]);
    const inFlightCount = useMemo(() => filteredTasks.filter(t => ['doing', 'review', 'ready'].includes(t.status)).length, [filteredTasks]);
    const boardPoints = useMemo(() => filteredTasks.reduce((sum, task) => sum + (task.storyPoints || 0), 0), [filteredTasks]);

    // Debounce ref for text field updates
    const updateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { setDirty } = useUnsavedChanges('kanban');

    const updateTask = (updates: Partial<Task>) => {
        if (!selectedTask) return;
        const updated = { ...selectedTask, ...updates };
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? updated : t));
        setSelectedTask(updated);

        // Debounce API call to avoid flooding on text input
        if (updateDebounceRef.current) clearTimeout(updateDebounceRef.current);
        setDirty(true);
        updateDebounceRef.current = setTimeout(() => {
            api.updateTask(selectedTask.id, updates)
                .then(() => setDirty(false))
                .catch(() => {
                    setDirty(false);
                    addToast('Falha ao Salvar', 'error', 'Não foi possível salvar as alterações da tarefa.');
                });
        }, 600);
    };

    const addSubtask = (text: string) => {
        if (!text.trim()) return;
        const subtask: Subtask = { id: `st-${Date.now()}`, text, done: false };
        updateTask({ subtasks: [...(selectedTask?.subtasks || []), subtask] });
    };

    const updateTaskChecklist = (field: 'dorChecklist' | 'dodChecklist', nextItems: ChecklistItem[]) => {
        updateTask({ [field]: nextItems } as Partial<Task>);
    };

    const addTaskChecklistItem = (field: 'dorChecklist' | 'dodChecklist', text: string) => {
        if (!text.trim() || !selectedTask) return;
        const nextItems = [
            ...(selectedTask[field] || []),
            { id: `${field}-${Date.now()}`, text: text.trim(), checked: false },
        ];
        updateTaskChecklist(field, nextItems);
    };

    const toggleTaskDependency = (dependencyId: string) => {
        if (!selectedTask) return;
        const current = new Set(selectedTask.dependencies || []);
        if (current.has(dependencyId)) current.delete(dependencyId);
        else current.add(dependencyId);
        updateTask({ dependencies: Array.from(current) });
    };

    const saveGitLinkDraft = (field: 'linkedBranch' | 'linkedPRUrl' | 'linkedMRIid') => {
        if (!selectedTask) return;
        const nextValue = gitLinkDrafts[field].trim();
        const currentValue = (selectedTask[field] || '').trim();
        if (nextValue === currentValue) return;
        updateTask({ [field]: nextValue } as Partial<Task>);
    };

    const selectedTaskRepository = selectedTask
        ? repositories.find((repo) => repo.id === selectedTask.repositoryId)
        : undefined;
    const selectedTaskStatusLabel = selectedTask ? getTaskStatusLabel(selectedTask.status, 'kanban') : '';
    const recentCommentsSummary = summarizeRecentComments(comments);
    const selectedTaskDependencies = useMemo(() => {
        if (!selectedTask?.dependencies?.length) return [];
        return selectedTask.dependencies
            .map((dependencyId) => tasks.find((task) => task.id === dependencyId))
            .filter(Boolean) as Task[];
    }, [selectedTask?.dependencies, tasks]);
    const dependencyOptions = useMemo(() => {
        if (!selectedTask) return [];
        return tasks.filter((task) => task.id !== selectedTask.id && task.status !== 'done');
    }, [selectedTask, tasks]);
    const dorProgress = getChecklistProgress(selectedTask?.dorChecklist);
    const dodProgress = getChecklistProgress(selectedTask?.dodChecklist);
    const subtaskProgress = selectedTask?.subtasks?.length ? Math.round((selectedTask.subtasks.filter((item) => item.done).length / selectedTask.subtasks.length) * 100) : 0;

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

            <div className="mx-6 mt-4 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-[var(--text-muted)]">
                    Navegar colunas
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => scrollBoard('left')}
                        disabled={!canScrollBoardLeft}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/78 text-slate-600 shadow-sm shadow-slate-200/45 transition-all hover:border-primary-500/30 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:shadow-none dark:hover:text-primary-300"
                        aria-label="Rolar colunas para a esquerda"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => scrollBoard('right')}
                        disabled={!canScrollBoardRight}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/78 text-slate-600 shadow-sm shadow-slate-200/45 transition-all hover:border-primary-500/30 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:shadow-none dark:hover:text-primary-300"
                        aria-label="Rolar colunas para a direita"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Board */}
            <div ref={boardScrollRef} className="flex-1 overflow-x-auto scroll-smooth px-6 pb-6 pt-5">
                {isLoading ? (
                    <div className="grid h-[42rem] place-items-center rounded-[1.35rem] border border-dashed border-slate-200/80 bg-slate-50/45 text-center dark:border-white/10 dark:bg-white/[0.02] xl:h-[48rem] 2xl:h-[52rem]">
                        <div className="max-w-md px-6">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                                <Layout className="h-6 w-6 animate-pulse text-primary-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Montando o quadro da sprint</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                                Carregando tarefas, responsáveis e sinais do fluxo para exibir um board consistente.
                            </p>
                        </div>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="grid h-[42rem] place-items-center rounded-[1.35rem] border border-dashed border-slate-200/80 bg-slate-50/45 text-center dark:border-white/10 dark:bg-white/[0.02] xl:h-[48rem] 2xl:h-[52rem]">
                        <div className="max-w-md px-6">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                                <CheckSquare className="h-6 w-6 text-slate-400 dark:text-slate-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Nenhum item visível no board</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                                Ajuste os filtros atuais ou adicione uma nova tarefa para começar a movimentar o fluxo desta sprint.
                            </p>
                            <div className="mt-4 flex justify-center gap-2">
                                <button onClick={() => setFilterAssignee(null)} className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-sm shadow-slate-200/40 hover:border-primary-500/30 hover:text-primary-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none">
                                    Limpar time
                                </button>
                                <button onClick={() => setFilterRepo(null)} className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 shadow-sm shadow-slate-200/40 hover:border-primary-500/30 hover:text-primary-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none">
                                    Limpar projeto
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                <div className="flex h-[42rem] min-w-[1330px] gap-5 xl:h-[48rem] xl:min-w-[1430px] 2xl:h-[52rem] 2xl:min-w-[1510px]">
                    {columns.map(col => {
                        const colTasks = filteredTasks.filter(t => t.status === col.id);
                        const isOverLimit = col.wipLimit && col.wipLimit > 0 && colTasks.length > col.wipLimit;

                        return (
                            <div
                                key={col.id}
                                className={`surface-card flex h-full min-w-[16.1rem] flex-1 flex-col rounded-[1.35rem] xl:min-w-[17rem] 2xl:min-w-[17.75rem] ${isOverLimit ? 'border-red-300 dark:border-red-900/60' : 'border-slate-200/70 dark:border-white/10'}`}
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
                                            onMoveRequest={handleMoveRequest}
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
                )}
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
                    <div className="app-flyout relative flex h-full w-full flex-col overflow-hidden animate-in slide-in-from-right duration-300 border-l border-slate-200 md:w-[680px] dark:border-white/10">

                        {/* Drawer Header */}
                        <div className="panel-header-block sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200/70 backdrop-blur dark:border-white/10" style={{ background: 'var(--bg-panel-primary)' }}>
                            <div className="mr-4 flex-1">
                                <div className="mb-3 flex items-center gap-2 text-xs">
                                    <span className="rounded-full border border-slate-200/80 bg-white/78 px-2 py-1 font-mono text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-muted)] dark:shadow-none">{selectedTask.id}</span>
                                    <div className={`rounded-full border px-2.5 py-1 capitalize font-semibold ${getPriorityStyles(selectedTask.priority).badge}`}>
                                        Prioridade {getTaskPriorityLabel(selectedTask.priority)}
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
                        <div className="panel-header-compact sticky top-[108px] z-10 border-b border-slate-200/60 backdrop-blur dark:border-white/10" style={{ background: 'var(--bg-panel-primary)' }}>
                            <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'details', label: 'Detalhes', icon: Layout },
                                { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                                { id: 'git', label: 'Conexões', icon: GitBranch },
                                { id: 'comments', label: 'Comentários', icon: MessageSquare },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${activeTab === tab.id ? 'border-primary-500 bg-primary-600 text-white shadow-lg shadow-primary-900/15' : 'border-slate-200/80 bg-slate-50/78 text-slate-500 shadow-sm shadow-slate-200/40 hover:border-slate-300 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.025] dark:text-slate-400 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/[0.045] dark:hover:text-white'}`}
                                >
                                    <tab.icon className="w-4 h-4" /> {tab.label}
                                </button>
                            ))}
                            </div>
                        </div>

                        {/* Drawer Content */}
                                <div className="panel-body-compact min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ background: 'var(--bg-panel-primary)' }}>

                            {activeTab === 'details' && (
                                <div className="panel-stack">
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <div className="surface-muted rounded-2xl p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Status</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">{selectedTaskStatusLabel}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-[var(--text-muted)]">Fluxo atual da entrega.</p>
                                        </div>
                                        <div className="surface-muted rounded-2xl p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Risco</p>
                                            <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRiskTone(selectedTask.risk)}`}>
                                                {getRiskLabel(selectedTask.risk)}
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500 dark:text-[var(--text-muted)]">Pressão operacional da entrega.</p>
                                        </div>
                                        <div className="surface-muted rounded-2xl p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Checklist</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">{subtaskProgress}%</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-[var(--text-muted)]">{selectedTask.subtasks?.length || 0} itens rastreados.</p>
                                        </div>
                                        <div className="surface-muted rounded-2xl p-4">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Dependências</p>
                                            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-white">{selectedTaskDependencies.length}</p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-[var(--text-muted)]">Itens que podem bloquear o fluxo.</p>
                                        </div>
                                    </div>

                                    <div className="surface-muted panel-body-compact rounded-2xl">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-[var(--text-muted)]">Resumo operacional</p>
                                                <h4 className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">Contexto, qualidade e rastreabilidade</h4>
                                            </div>
                                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3 py-1.5 text-xs text-slate-600 shadow-sm shadow-slate-200/35 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none">
                                                <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                                                Detalhe rico
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                                <label htmlFor="task-status" className="mb-1 block text-xs font-semibold uppercase text-slate-500">Status</label>
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
                                                <label htmlFor="task-assignee" className="mb-1 block text-xs font-semibold uppercase text-slate-500">Responsável</label>
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
                                                <label htmlFor="task-priority" className="mb-1 block text-xs font-semibold uppercase text-slate-500">Prioridade</label>
                                                <select
                                                    id="task-priority"
                                                    value={selectedTask.priority}
                                                    onChange={(e) => updateTask({ priority: e.target.value as Task['priority'] })}
                                                    className="app-input w-full rounded-xl px-3 py-2 text-sm"
                                                >
                                                    <option value="low">Baixa</option>
                                                    <option value="medium">Média</option>
                                                    <option value="high">Alta</option>
                                                </select>
                                            </div>
                                            <div>
                                                <p className="mb-1 block text-xs font-semibold uppercase text-slate-500">Risco</p>
                                                <div className="flex gap-2">
                                                    {(['low', 'medium', 'high'] as RiskLevel[]).map((risk) => (
                                                        <button
                                                            key={risk}
                                                            type="button"
                                                            onClick={() => updateTask({ risk })}
                                                            className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${selectedTask.risk === risk ? getRiskTone(risk) : 'border-slate-200/80 bg-slate-50/78 text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300'}`}
                                                        >
                                                            {getRiskLabel(risk)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="task-story-points" className="mb-1 block text-xs font-semibold uppercase text-slate-500">Story Points</label>
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 5, 8, 13].map(pt => (
                                                        <button
                                                            key={pt}
                                                            type="button"
                                                            onClick={() => updateTask({ storyPoints: pt })}
                                                            id={pt === 1 ? 'task-story-points' : undefined}
                                                            className={`h-9 w-9 rounded-xl border text-xs font-bold transition-all ${selectedTask.storyPoints === pt ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200/80 bg-slate-50/78 text-slate-600 shadow-sm shadow-slate-200/35 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--text-secondary)] dark:shadow-none'}`}
                                                        >
                                                            {pt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="mb-1 block text-xs font-semibold uppercase text-slate-500">Repositório</p>
                                                <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/78 px-3 py-2.5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                                                    <GitBranch className="h-4 w-4 text-slate-400" />
                                                    <span className="truncate">{selectedTaskRepository?.name || 'Sem repositório vinculado'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="task-description" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                            <Edit2 className="w-4 h-4" /> Descrição
                                        </label>
                                        <textarea
                                            id="task-description"
                                            value={selectedTask.description}
                                            onChange={(e) => updateTask({ description: e.target.value })}
                                            className="app-input h-36 w-full resize-none rounded-2xl p-4 text-sm leading-relaxed focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                            placeholder="Adicione detalhes, impacto, contexto técnico e objetivo."
                                        />
                                        <AIFieldAssist
                                            fieldType="task_description"
                                            variant="compact"
                                            surface="task_details"
                                            intent={selectedTask.description.trim() ? 'refine' : 'expand'}
                                            currentValue={selectedTask.description}
                                            helpText="Expande ou refina a descrição com base no estado atual da tarefa."
                                            buildContext={() => ({
                                                title: selectedTask.title,
                                                description: selectedTask.description,
                                                priority: selectedTask.priority,
                                                status: selectedTask.status,
                                                statusLabel: selectedTaskStatusLabel,
                                                repositoryName: selectedTaskRepository?.name || '',
                                                assigneeName: selectedTask.assignee?.name || '',
                                                pairAssigneeName: selectedTask.pairAssignee?.name || '',
                                                storyPoints: selectedTask.storyPoints || null,
                                                tags: selectedTask.tags,
                                            })}
                                            relatedEntities={{
                                                task: { id: selectedTask.id, title: selectedTask.title },
                                                repository: selectedTaskRepository ? { id: selectedTaskRepository.id, name: selectedTaskRepository.name, branch: selectedTaskRepository.branch } : {},
                                                sprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name, goal: activeSprint.goal } : {},
                                            }}
                                            constraints={{
                                                preserveFacts: true,
                                                sections: ['problema', 'objetivo', 'impacto', 'critério de entrega'],
                                            }}
                                            onApply={(result) => updateTask({ description: result.value || '' })}
                                            buttonLabel="Refinar descrição"
                                            className="mt-2"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            <ShieldCheck className="h-4 w-4" /> Critério de aceite
                                        </label>
                                        <textarea
                                            value={selectedTask.acceptanceCriteria || ''}
                                            onChange={(e) => updateTask({ acceptanceCriteria: e.target.value })}
                                            className="app-input h-28 w-full resize-none rounded-2xl p-4 text-sm leading-relaxed focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                            placeholder="Liste condições que precisam estar verdadeiras para a tarefa ser considerada entregue."
                                        />
                                    </div>

                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <div className="surface-muted rounded-2xl p-4">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">Definition of Ready</p>
                                                    <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">{dorProgress}% concluído</p>
                                                </div>
                                                <span className="rounded-full border border-slate-200/80 bg-white/75 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">{selectedTask.dorChecklist?.length || 0} itens</span>
                                            </div>
                                            <div className="panel-stack-tight">
                                                {(selectedTask.dorChecklist || []).map((item) => (
                                                    <div key={item.id} className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateTaskChecklist('dorChecklist', (selectedTask.dorChecklist || []).map((entry) => entry.id === item.id ? { ...entry, checked: !entry.checked } : entry))}
                                                            className={`flex h-5 w-5 items-center justify-center rounded border ${item.checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                                                        >
                                                            {item.checked && <Check className="h-3.5 w-3.5" />}
                                                        </button>
                                                        <input
                                                            type="text"
                                                            value={item.text}
                                                            onChange={(e) => updateTaskChecklist('dorChecklist', (selectedTask.dorChecklist || []).map((entry) => entry.id === item.id ? { ...entry, text: e.target.value } : entry))}
                                                            className={`flex-1 bg-transparent text-sm focus:outline-none ${item.checked ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
                                                        />
                                                        <button type="button" onClick={() => updateTaskChecklist('dorChecklist', (selectedTask.dorChecklist || []).filter((entry) => entry.id !== item.id))} className="opacity-0 transition-opacity group-hover:opacity-100 text-slate-300 hover:text-red-500">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <input
                                                    type="text"
                                                    placeholder="Adicionar item de pronto para iniciar..."
                                                    className="app-input w-full rounded-xl px-3 py-2 text-sm"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            addTaskChecklistItem('dorChecklist', e.currentTarget.value);
                                                            e.currentTarget.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="surface-muted rounded-2xl p-4">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">Definition of Done</p>
                                                    <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">{dodProgress}% concluído</p>
                                                </div>
                                                <span className="rounded-full border border-slate-200/80 bg-white/75 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">{selectedTask.dodChecklist?.length || 0} itens</span>
                                            </div>
                                            <div className="panel-stack-tight">
                                                {(selectedTask.dodChecklist || []).map((item) => (
                                                    <div key={item.id} className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateTaskChecklist('dodChecklist', (selectedTask.dodChecklist || []).map((entry) => entry.id === item.id ? { ...entry, checked: !entry.checked } : entry))}
                                                            className={`flex h-5 w-5 items-center justify-center rounded border ${item.checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                                                        >
                                                            {item.checked && <Check className="h-3.5 w-3.5" />}
                                                        </button>
                                                        <input
                                                            type="text"
                                                            value={item.text}
                                                            onChange={(e) => updateTaskChecklist('dodChecklist', (selectedTask.dodChecklist || []).map((entry) => entry.id === item.id ? { ...entry, text: e.target.value } : entry))}
                                                            className={`flex-1 bg-transparent text-sm focus:outline-none ${item.checked ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}
                                                        />
                                                        <button type="button" onClick={() => updateTaskChecklist('dodChecklist', (selectedTask.dodChecklist || []).filter((entry) => entry.id !== item.id))} className="opacity-0 transition-opacity group-hover:opacity-100 text-slate-300 hover:text-red-500">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <input
                                                    type="text"
                                                    placeholder="Adicionar item de pronto para concluir..."
                                                    className="app-input w-full rounded-xl px-3 py-2 text-sm"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            addTaskChecklistItem('dodChecklist', e.currentTarget.value);
                                                            e.currentTarget.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="surface-muted rounded-2xl p-4">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">Dependências e bloqueios</p>
                                                <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">Vincule itens que precisam avançar antes desta entrega.</p>
                                            </div>
                                            <span className="rounded-full border border-slate-200/80 bg-white/75 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">{selectedTaskDependencies.length} vinculadas</span>
                                        </div>
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {selectedTaskDependencies.length > 0 ? selectedTaskDependencies.map((dependency) => (
                                                <button
                                                    key={dependency.id}
                                                    type="button"
                                                    onClick={() => setSelectedTask(dependency)}
                                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-primary-500/30 hover:text-primary-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-primary-300"
                                                >
                                                    <Link2 className="h-3.5 w-3.5" />
                                                    {dependency.title}
                                                </button>
                                            )) : (
                                                <div className="rounded-2xl border border-dashed border-slate-200/80 px-3 py-2 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
                                                    Nenhuma dependência registrada.
                                                </div>
                                            )}
                                        </div>
                                        <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/70 p-2 dark:border-white/10 dark:bg-white/[0.03]">
                                            <div className="space-y-2">
                                                {dependencyOptions.map((task) => {
                                                    const selected = (selectedTask.dependencies || []).includes(task.id);
                                                    return (
                                                        <button
                                                            key={task.id}
                                                            type="button"
                                                            onClick={() => toggleTaskDependency(task.id)}
                                                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-all ${selected ? 'border border-primary-500/40 bg-primary-500/10 text-primary-700 dark:text-primary-300' : 'border border-transparent hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'}`}
                                                        >
                                                            <span className="min-w-0 truncate">{task.title}</span>
                                                            <span className="ml-3 text-[11px] uppercase tracking-[0.14em] text-slate-400">{getTaskStatusLabel(task.status, 'kanban')}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="surface-muted rounded-2xl p-4">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-white">Timeline relacionada</p>
                                                <p className="text-xs text-slate-500 dark:text-[var(--text-muted)]">Mudanças, comentários e vínculos técnicos mais recentes desta tarefa.</p>
                                            </div>
                                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3 py-1.5 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                                                <TimerReset className="h-3.5 w-3.5" />
                                                {taskActivities.length} eventos
                                            </div>
                                        </div>
                                        {loadingTaskActivities ? (
                                            <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-6 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
                                                Carregando histórico relacionado...
                                            </div>
                                        ) : taskActivities.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-6 text-sm text-slate-400 dark:border-white/10 dark:text-slate-500">
                                                Ainda não há histórico consolidado para esta tarefa.
                                            </div>
                                        ) : (
                                            <div className="panel-stack-tight">
                                                {taskActivities.map((activity) => (
                                                    <div key={activity.id} className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                        <Avatar name={activity.user?.name || '?'} size="sm" className="flex-shrink-0" />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="truncate text-sm font-medium text-slate-800 dark:text-white">{activity.user?.name || 'Sistema'}</span>
                                                                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{formatTimelineTimestamp(activity.timestamp)}</span>
                                                            </div>
                                                            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                                <span className="font-medium">{activity.action}</span>{' '}
                                                                <span className="text-primary-600 dark:text-primary-300">{activity.target}</span>
                                                            </p>
                                                            {activity.meta && (
                                                                <p className="mt-1 text-xs text-slate-500 dark:text-[var(--text-muted)]">{activity.meta}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
                                    <AIFieldAssist
                                        fieldType="checklist_items"
                                        variant="expanded"
                                        surface="task_details"
                                        intent="expand"
                                        currentValue={(selectedTask.subtasks || []).map((subtask) => subtask.text).join('; ')}
                                        helpText="Quebra o trabalho em etapas executáveis sem repetir a checklist existente."
                                        buildContext={() => ({
                                            title: selectedTask.title,
                                            description: selectedTask.description,
                                            priority: selectedTask.priority,
                                            status: selectedTask.status,
                                            statusLabel: selectedTaskStatusLabel,
                                            repositoryName: selectedTaskRepository?.name || '',
                                            existingChecklist: (selectedTask.subtasks || []).map(subtask => subtask.text),
                                        })}
                                        relatedEntities={{
                                            task: { id: selectedTask.id, title: selectedTask.title, tags: selectedTask.tags },
                                            repository: selectedTaskRepository ? { id: selectedTaskRepository.id, name: selectedTaskRepository.name } : {},
                                        }}
                                        constraints={{
                                            minItems: 3,
                                            maxItems: 7,
                                            avoidDuplicates: true,
                                        }}
                                        onApply={(result) => {
                                            const existingTexts = new Set((selectedTask.subtasks || []).map(subtask => subtask.text.trim().toLowerCase()));
                                            const generatedSubtasks = (result.values || [])
                                                .filter(text => !existingTexts.has(text.trim().toLowerCase()))
                                                .map((text, index) => ({
                                                    id: `st-ai-${Date.now()}-${index}`,
                                                    text,
                                                    done: false,
                                                }));
                                            if (generatedSubtasks.length > 0) {
                                                updateTask({ subtasks: [...(selectedTask.subtasks || []), ...generatedSubtasks] });
                                            }
                                        }}
                                        buttonLabel="Gerar checklist"
                                        className="mt-2"
                                    />
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
                                        <AIFieldAssist
                                            fieldType="branch_name"
                                            variant="compact"
                                            surface="task_git"
                                            intent={gitLinkDrafts.linkedBranch.trim() ? 'rewrite' : 'generate'}
                                            currentValue={gitLinkDrafts.linkedBranch}
                                            helpText="Sugere uma branch coerente com a tarefa e o repositório vinculado."
                                            buildContext={() => ({
                                                taskId: selectedTask.id,
                                                title: selectedTask.title,
                                                description: selectedTask.description,
                                                priority: selectedTask.priority,
                                                status: selectedTask.status,
                                                statusLabel: selectedTaskStatusLabel,
                                                repositoryName: selectedTaskRepository?.name || '',
                                                currentBranch: gitLinkDrafts.linkedBranch,
                                            })}
                                            relatedEntities={{
                                                task: { id: selectedTask.id, title: selectedTask.title },
                                                repository: selectedTaskRepository ? { id: selectedTaskRepository.id, name: selectedTaskRepository.name, branch: selectedTaskRepository.branch } : {},
                                            }}
                                            constraints={{
                                                branchPrefix: 'feature|fix|chore|refactor',
                                                maxLength: 120,
                                            }}
                                            onApply={(result) => {
                                                const nextBranch = result.value || '';
                                                setGitLinkDrafts(prev => ({ ...prev, linkedBranch: nextBranch }));
                                                updateTask({ linkedBranch: nextBranch });
                                            }}
                                            buttonLabel="Gerar branch"
                                            className="mt-2"
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
                                        <div className="flex-1">
                                            <textarea
                                                value={commentText}
                                                onChange={e => setCommentText(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }}
                                                placeholder="Escreva um comentário... (Enter para enviar)"
                                                rows={2}
                                                className="app-input w-full resize-none rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/30 focus:outline-none"
                                            />
                                            <AIFieldAssist
                                                fieldType="comment_reply"
                                                variant="inline"
                                                surface="task_comments"
                                                intent={commentText.trim() ? 'refine' : 'suggest'}
                                                currentValue={commentText}
                                                helpText="Sugere uma resposta coerente com a tarefa e os comentários recentes."
                                                buildContext={() => ({
                                                    taskId: selectedTask.id,
                                                    title: selectedTask.title,
                                                    description: selectedTask.description,
                                                    status: selectedTask.status,
                                                    priority: selectedTask.priority,
                                                    statusLabel: selectedTaskStatusLabel,
                                                    repositoryName: selectedTaskRepository?.name || '',
                                                    currentDraft: commentText,
                                                    recentComments: recentCommentsSummary,
                                                })}
                                                relatedEntities={{
                                                    task: { id: selectedTask.id, title: selectedTask.title, tags: selectedTask.tags },
                                                    repository: selectedTaskRepository ? { id: selectedTaskRepository.id, name: selectedTaskRepository.name } : {},
                                                }}
                                                constraints={{
                                                    tone: 'colaborativo',
                                                    avoidPromises: true,
                                                }}
                                                onApply={(result) => setCommentText(result.value || '')}
                                                buttonLabel="Sugerir comentário"
                                                className="mt-2"
                                            />
                                        </div>
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

            {/* Keyboard move-to menu */}
            {moveMenu && (() => {
                const otherColumns = columns.filter(c => c.id !== moveMenu.task.status);
                return (
                    <div
                        ref={moveMenuRef}
                        role="menu"
                        aria-label="Mover tarefa para coluna"
                        tabIndex={0}
                        onKeyDown={handleMoveMenuKeyDown}
                        onBlur={(e) => {
                            if (!moveMenuRef.current?.contains(e.relatedTarget as Node)) setMoveMenu(null);
                        }}
                        className="fixed z-[9999] min-w-[180px] rounded-xl border border-slate-200/80 bg-white/95 py-1.5 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-slate-800/95"
                        style={{
                            top: Math.min(moveMenu.rect.bottom + 4, window.innerHeight - (otherColumns.length * 36 + 12)),
                            left: Math.min(moveMenu.rect.left, window.innerWidth - 200),
                        }}
                    >
                        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Mover para</p>
                        {otherColumns.map((col, i) => (
                            <button
                                key={col.id}
                                role="menuitem"
                                aria-current={i === moveMenuIndex || undefined}
                                onClick={() => handleMoveSelect(moveMenu.task, col.id)}
                                onMouseEnter={() => setMoveMenuIndex(i)}
                                className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors ${i === moveMenuIndex ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'}`}
                            >
                                <span className={`h-2 w-2 rounded-full ${col.border.replace('border-t-', 'bg-')}`} />
                                {col.label}
                            </button>
                        ))}
                    </div>
                );
            })()}

            {/* Aria-live announcer for status changes */}
            <div aria-live="assertive" className="sr-only">{liveAnnouncement}</div>
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

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
}

// Configuração das Colunas (inclui novo status 'ready' = Pronto para Release)
const columns: { id: TaskStatus; label: string; color: string; border: string; bg: string; wipLimit?: number }[] = [
    { id: 'todo', label: 'A Fazer', color: 'text-slate-600 dark:text-slate-300', border: 'border-t-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/20', wipLimit: 0 },
    { id: 'doing', label: 'Em Progresso', color: 'text-blue-600 dark:text-blue-400', border: 'border-t-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/10', wipLimit: 3 },
    { id: 'review', label: 'Revisão / QA', color: 'text-orange-600 dark:text-orange-400', border: 'border-t-orange-500', bg: 'bg-orange-50/50 dark:bg-orange-900/10', wipLimit: 2 },
    { id: 'ready', label: 'Pronto para Release', color: 'text-purple-600 dark:text-purple-400', border: 'border-t-purple-500', bg: 'bg-purple-50/50 dark:bg-purple-900/10', wipLimit: 0 },
    { id: 'done', label: 'Concluído', color: 'text-emerald-600 dark:text-emerald-400', border: 'border-t-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10', wipLimit: 0 },
];

const getPriorityStyles = (p: string) => {
    switch (p) {
        case 'high': return { badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800', border: 'border-l-4 border-l-red-500' };
        case 'medium': return { badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', border: 'border-l-4 border-l-amber-500' };
        default: return { badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', border: 'border-l-4 border-l-slate-400' };
    }
};

const TaskCard: React.FC<{
    task: Task;
    onClick: (task: Task) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, task: Task) => void;
}> = ({ task, onClick, onDragStart }) => {
    const styles = getPriorityStyles(task.priority);
    const doneSubtasks = task.subtasks?.filter(s => s.done).length || 0;
    const totalSubtasks = task.subtasks?.length || 0;
    const progress = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, task)}
            onClick={() => onClick(task)}
            className={`
        bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600/30 
        hover:shadow-md hover:border-fiori-blue dark:hover:border-fiori-blue transition-all cursor-grab active:cursor-grabbing group relative
        ${styles.border}
      `}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-1 rounded">{task.id}</span>
                    {task.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{tag}</span>
                    ))}
                </div>
                <button className="text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </div>

            <h4 className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-3 leading-snug line-clamp-2">
                {task.title}
            </h4>

            {totalSubtasks > 0 && (
                <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Progresso</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-fiori-blue'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800/50">
                <div className="flex items-center gap-3">
                    {task.storyPoints && (
                        <span className="flex items-center gap-1 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded" title="Story Points">
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
                            <div className="absolute -bottom-1 -right-1 bg-fiori-blue text-white rounded-full p-[1px] border border-white dark:border-slate-800"><Users className="w-2 h-2" /></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const Kanban: React.FC<KanbanProps> = ({ initialTasks, setTasks: setParentTasks, addToast, openNewTaskModal, activeSprint, teamMembers, repositories }) => {
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

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
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

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-fiori-bgLight dark:bg-fiori-bgDark">

            {/* Header da Sprint */}
            <div className="px-6 py-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600/30 flex justify-between items-center shadow-sm z-10">
                {activeSprint ? (
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold text-fiori-textPrimary dark:text-white">{activeSprint.name}</h1>
                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider">Ativo</span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                            <TargetIcon className="w-4 h-4 text-fiori-blue" />
                            <span className="font-medium">Meta:</span> {activeSprint.goal}
                        </p>
                    </div>
                ) : (
                    <div>
                        <h1 className="text-xl font-bold text-slate-400">Nenhuma Sprint Ativa</h1>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    {activeSprint && (
                        <div className="text-right hidden md:block">
                            <p className="text-xs text-slate-400 uppercase">Período</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 font-mono">{activeSprint.startDate} → {activeSprint.endDate}</p>
                        </div>
                    )}
                    <button onClick={() => openNewTaskModal && openNewTaskModal('todo')} className="bg-fiori-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm flex items-center gap-2 transition-colors">
                        <Plus className="w-4 h-4" /> Nova Tarefa
                    </button>
                </div>
            </div>

            {/* Filtros Rápidos */}
            <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-600/30 bg-slate-50/50 dark:bg-slate-900 flex gap-4 overflow-x-auto items-center">
                <Filter className="w-4 h-4 text-slate-400" />
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>

                <select
                    className="bg-transparent text-sm text-slate-600 dark:text-slate-300 border-none focus:ring-0 cursor-pointer hover:text-fiori-blue"
                    value={filterRepo || ''}
                    onChange={(e) => setFilterRepo(e.target.value || null)}
                >
                    <option value="">Todos os Projetos</option>
                    {(repositories || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>

                <div className="flex space-x-[3px]">
                    <button onClick={() => setFilterAssignee(null)} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] border border-slate-300 dark:border-slate-600 ${!filterAssignee ? 'bg-fiori-blue text-white z-10' : 'bg-white dark:bg-slate-800 text-slate-500'}`}>T</button>
                    {(teamMembers || []).map(m => (
                        <div key={m.id} onClick={() => setFilterAssignee(filterAssignee === m.id ? null : m.id)} className={`cursor-pointer transition-transform hover:z-20 hover:scale-110 ${filterAssignee === m.id ? 'z-20 ring-2 ring-fiori-blue rounded-full' : ''}`}>
                            <Avatar name={m.name} size="sm" className="border border-white dark:border-slate-900" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Board */}
            <div className="flex-1 overflow-x-auto p-6">
                <div className="flex gap-6 h-full min-w-[1200px]">
                    {columns.map(col => {
                        const colTasks = filteredTasks.filter(t => t.status === col.id);
                        const isOverLimit = col.wipLimit && col.wipLimit > 0 && colTasks.length > col.wipLimit;

                        return (
                            <div
                                key={col.id}
                                className={`flex-1 flex flex-col h-full rounded-xl bg-slate-100/50 dark:bg-slate-800/30 border ${isOverLimit ? 'border-red-300 dark:border-red-900' : 'border-slate-200 dark:border-slate-600/25'}`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id)}
                            >
                                {/* Header Coluna */}
                                <div className={`p-3 border-b border-slate-200 dark:border-slate-600/30 flex justify-between items-center rounded-t-xl bg-white dark:bg-slate-800 ${col.border} border-t-4`}>
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-semibold ${col.color}`}>{col.label}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${isOverLimit ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                            {colTasks.length} {col.wipLimit ? `/ ${col.wipLimit}` : ''}
                                        </span>
                                    </div>
                                    {isOverLimit && <span title="WIP Limit Exceeded"><AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" /></span>}
                                </div>

                                {/* Area de Drop */}
                                <div
                                    ref={colRefs[col.id as keyof typeof colRefs]}
                                    className={`flex-1 p-3 space-y-3 overflow-y-auto transition-colors ${draggedTaskId ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
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
                                        onClick={() => openNewTaskModal && openNewTaskModal(col.id)}
                                        className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-fiori-blue hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 transition-all"
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Drawer de Detalhes da Tarefa */}
            {selectedTask && (
                <div className="absolute inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-[1px]" onClick={() => setSelectedTask(null)} />
                    <div className="relative w-full md:w-[600px] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-600/30">

                        {/* Drawer Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-600/30 flex justify-between items-start bg-slate-50/80 dark:bg-slate-800/80">
                            <div className="flex-1 mr-4">
                                <div className="flex items-center gap-2 mb-2 text-xs">
                                    <span className="font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">{selectedTask.id}</span>
                                    <div className={`px-2 py-0.5 rounded border capitalize font-semibold ${getPriorityStyles(selectedTask.priority).badge}`}>
                                        Prioridade {selectedTask.priority === 'low' ? 'Baixa' : selectedTask.priority === 'medium' ? 'Média' : 'Alta'}
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={selectedTask.title}
                                    onChange={(e) => updateTask({ title: e.target.value })}
                                    className="w-full bg-transparent text-xl font-bold text-slate-800 dark:text-white border-none focus:ring-0 p-0 placeholder-slate-400"
                                />
                            </div>
                            <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X className="w-6 h-6" /></button>
                        </div>

                        {/* Tabs */}
                        <div className="flex px-6 border-b border-slate-100 dark:border-slate-800">
                            {[
                                { id: 'details', label: 'Detalhes', icon: Layout },
                                { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                                { id: 'git', label: 'Conexões', icon: GitBranch },
                                { id: 'comments', label: 'Comentários', icon: MessageSquare },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-fiori-blue text-fiori-blue' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    <tab.icon className="w-4 h-4" /> {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6">

                            {activeTab === 'details' && (
                                <div className="space-y-6">
                                    {/* Propriedades Rápidas */}
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-600/25">
                                        <div>
                                            <label className="text-xs text-slate-500 uppercase font-semibold mb-1 block">Status</label>
                                            <select
                                                value={selectedTask.status}
                                                onChange={(e) => updateTask({ status: e.target.value as TaskStatus })}
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm"
                                            >
                                                {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 uppercase font-semibold mb-1 block">Responsável</label>
                                            <div className="flex items-center gap-2">
                                                {selectedTask.assignee && <Avatar name={selectedTask.assignee.name} size="sm" />}
                                                <select
                                                    value={selectedTask.assignee?.id || ''}
                                                    onChange={(e) => updateTask({ assignee: teamMembers.find(m => m.id === e.target.value) })}
                                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm"
                                                >
                                                    <option value="">Ninguém</option>
                                                    {(teamMembers || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 uppercase font-semibold mb-1 block">Prioridade</label>
                                            <select
                                                value={selectedTask.priority}
                                                onChange={(e) => updateTask({ priority: e.target.value as any })}
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm"
                                            >
                                                <option value="low">Baixa</option>
                                                <option value="medium">Média</option>
                                                <option value="high">Alta</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 uppercase font-semibold mb-1 block">Story Points</label>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 5, 8, 13].map(pt => (
                                                    <button
                                                        key={pt}
                                                        onClick={() => updateTask({ storyPoints: pt })}
                                                        className={`w-8 h-8 rounded border text-xs font-bold transition-all ${selectedTask.storyPoints === pt ? 'bg-fiori-blue text-white border-fiori-blue' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
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
                                            className="w-full h-40 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm leading-relaxed focus:ring-2 focus:ring-fiori-blue focus:outline-none resize-none"
                                            placeholder="Adicione detalhes, critérios de aceitação..."
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><FlaskConical className="w-4 h-4" /> Práticas XP</h4>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <input type="checkbox" checked={selectedTask.xpPractices?.tdd} onChange={(e) => updateTask({ xpPractices: { ...selectedTask.xpPractices!, tdd: e.target.checked } })} className="rounded text-fiori-blue" />
                                                <span className="text-sm">TDD (Test-First)</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <input type="checkbox" checked={selectedTask.xpPractices?.refactoring} onChange={(e) => updateTask({ xpPractices: { ...selectedTask.xpPractices!, refactoring: e.target.checked } })} className="rounded text-fiori-blue" />
                                                <span className="text-sm">Refactoring</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'checklist' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${selectedTask.subtasks?.length ? Math.round((selectedTask.subtasks.filter(s => s.done).length / selectedTask.subtasks.length) * 100) : 0}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{selectedTask.subtasks?.length ? Math.round((selectedTask.subtasks.filter(s => s.done).length / selectedTask.subtasks.length) * 100) : 0}%</span>
                                    </div>

                                    <div className="space-y-2">
                                        {selectedTask.subtasks?.map(st => (
                                            <div key={st.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/25 rounded-lg group">
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
                                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm focus:ring-2 focus:ring-fiori-blue focus:outline-none"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    addSubtask(e.currentTarget.value);
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                        <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'git' && (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                                        <GitBranch className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">Vincular Repositório</h4>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Conecte esta tarefa a um branch ou PR para rastreamento automático.</p>
                                            <div className="flex gap-2 mt-3">
                                                <select
                                                    value={selectedTask.repositoryId || ''}
                                                    onChange={(e) => updateTask({ repositoryId: e.target.value })}
                                                    className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded px-2 py-1 text-sm flex-1"
                                                >
                                                    <option value="">Selecionar Repositório...</option>
                                                    {repositories.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                                <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Link</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700 dark:text-white">
                                            <GitBranch className="w-4 h-4" /> Branch Vinculado
                                        </h4>
                                        <input
                                            type="text"
                                            value={selectedTask.linkedBranch || ''}
                                            onChange={(e) => updateTask({ linkedBranch: e.target.value })}
                                            placeholder="Ex: feature/TASK-123-minha-feature"
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-mono focus:ring-2 focus:ring-fiori-blue focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700 dark:text-white">
                                            <GitPullRequest className="w-4 h-4" /> Pull Request / Merge Request
                                        </h4>
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={selectedTask.linkedPRUrl || ''}
                                                onChange={(e) => updateTask({ linkedPRUrl: e.target.value })}
                                                placeholder="URL do PR (ex: https://github.com/org/repo/pull/42)"
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-mono focus:ring-2 focus:ring-fiori-blue focus:outline-none"
                                            />
                                            {selectedTask.linkedPRUrl && (
                                                <a
                                                    href={selectedTask.linkedPRUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/25 rounded-lg hover:border-purple-400 transition-colors text-sm text-fiori-blue"
                                                >
                                                    <GitPullRequest className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                                    <span className="truncate font-mono text-xs">{selectedTask.linkedPRUrl}</span>
                                                    <LinkIcon className="w-3 h-3 ml-auto flex-shrink-0" />
                                                </a>
                                            )}
                                            <input
                                                type="text"
                                                value={selectedTask.linkedMRIid || ''}
                                                onChange={(e) => updateTask({ linkedMRIid: e.target.value })}
                                                placeholder="GitLab MR IID (ex: 42)"
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm font-mono focus:ring-2 focus:ring-fiori-blue focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'comments' && (
                                <div className="flex flex-col h-full space-y-4">
                                    {loadingComments ? (
                                        <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                                            <MessageSquare className="w-4 h-4 animate-pulse" /> Carregando comentários...
                                        </div>
                                    ) : comments.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 text-sm italic">
                                            Nenhum comentário ainda. Seja o primeiro!
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {comments.map(comment => (
                                                <div key={comment.id} className="flex gap-3 group">
                                                    <Avatar name={comment.author?.name || '?'} size="sm" className="flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-700/50">
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

                                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-auto">
                                        <textarea
                                            value={commentText}
                                            onChange={e => setCommentText(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(); } }}
                                            placeholder="Escreva um comentário... (Enter para enviar)"
                                            rows={2}
                                            className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-fiori-blue focus:outline-none resize-none"
                                        />
                                        <button
                                            onClick={handlePostComment}
                                            disabled={!commentText.trim() || postingComment}
                                            className="self-end p-2.5 bg-fiori-blue hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-600/30 bg-slate-50 dark:bg-slate-800/70 flex justify-between items-center text-xs text-slate-500">
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

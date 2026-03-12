import React, { useState } from 'react';
import Modal from './Modal';
import { Sprint } from '../types';
import { api } from '../services/api';
import { Calendar, Plus, Trash2, Play, CheckCircle2, RotateCcw } from 'lucide-react';
import { useConfirm } from '../contexts/ConfirmContext';

interface ManageSprintsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sprints: Sprint[];
    onRefresh: () => void;
    addToast: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
}

const ManageSprintsModal: React.FC<ManageSprintsModalProps> = ({ isOpen, onClose, sprints, onRefresh, addToast }) => {
    const { confirm } = useConfirm();
    const [isCreating, setIsCreating] = useState(false);
    const activeCount = sprints.filter((sprint) => sprint.status === 'active').length;
    const futureCount = sprints.filter((sprint) => sprint.status === 'future').length;
    const completedCount = sprints.filter((sprint) => sprint.status === 'completed').length;

    // New Sprint Form
    const [name, setName] = useState('');
    const [goal, setGoal] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newSprint = {
                id: `sprint-${Date.now()}`,
                name,
                goal,
                startDate,
                endDate,
                status: 'future' as const
            };
            await api.createSprint(newSprint);
            addToast('Sprint Criada', 'success', `"${name}" foi adicionada ao projeto.`);
            setIsCreating(false);
            setName('');
            setGoal('');
            setStartDate('');
            setEndDate('');
            onRefresh();
        } catch (_err) {
            addToast('Falha ao Criar Sprint', 'error', 'Verifique os dados e tente novamente.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!await confirm({ title: 'Remover Sprint', message: 'Tem certeza? Tarefas associadas voltarão para o backlog.', confirmText: 'Remover', variant: 'danger' })) return;
        try {
            await api.deleteSprint(id);
            addToast('Sprint Removida', 'info', 'As tarefas associadas retornaram ao backlog.');
            onRefresh();
        } catch (_err) {
            addToast('Falha ao Remover Sprint', 'error', 'Não foi possível remover a sprint.');
        }
    };

    const handleStatusChange = async (sprint: Sprint, newStatus: Sprint['status']) => {
        try {
            await api.updateSprint(sprint.id, { status: newStatus });
            addToast(`Sprint ${newStatus === 'active' ? 'Iniciada' : newStatus === 'completed' ? 'Concluída' : 'Atualizada'}`, 'success', newStatus === 'active' ? 'A sprint está ativa e pronta para receber tarefas.' : newStatus === 'completed' ? 'Todas as tarefas pendentes retornarão ao backlog.' : 'O status da sprint foi atualizado.');
            onRefresh();
        } catch (_err) {
            addToast('Falha ao Atualizar', 'error', 'Não foi possível alterar o status da sprint.');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Sprints" size="lg">
            <div className="space-y-6">
                <div className="surface-muted rounded-2xl p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Cadência do time</p>
                            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                Planeje ciclos, acompanhe o status atual e mantenha a operação previsível.
                            </h4>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Ativas</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{activeCount}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Planejadas</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{futureCount}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Concluídas</p>
                                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{completedCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {!isCreating ? (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="app-empty-state w-full items-center justify-center rounded-2xl py-6 text-center"
                    >
                        <Plus className="w-5 h-5 text-sky-500" />
                        <div className="space-y-1">
                            <strong className="block text-sm">Criar Nova Sprint</strong>
                            <p className="text-sm">Defina nome, meta e janela de execução para o próximo ciclo.</p>
                        </div>
                    </button>
                ) : (
                    <form onSubmit={handleCreate} className="surface-muted rounded-2xl border p-5 space-y-4">
                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Nova sprint</p>
                            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Estruture o próximo ciclo com objetivo e datas claras.</h5>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Nome</label>
                                <input autoFocus required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Sprint 24..." className="app-input w-full rounded-xl px-3 py-2.5" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meta</label>
                                <input required type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Entregar MVP..." className="app-input w-full rounded-xl px-3 py-2.5" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Início</label>
                                <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="app-input w-full rounded-xl px-3 py-2.5" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fim</label>
                                <input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="app-input w-full rounded-xl px-3 py-2.5" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsCreating(false)} className="app-button-secondary min-h-0 px-4 py-2">Cancelar</button>
                            <button type="submit" className="app-button-primary min-h-0 px-4 py-2">Salvar Sprint</button>
                        </div>
                    </form>
                )}

                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sprints Agendadas</h4>
                    {sprints.length === 0 && !isCreating && (
                        <div className="app-empty-state rounded-2xl">
                            <strong className="text-sm">Nenhuma sprint encontrada</strong>
                            <p className="text-sm">Crie a primeira sprint para organizar capacidade, compromisso e acompanhamento do time.</p>
                        </div>
                    )}

                    {sprints.map(sprint => (
                        <div key={sprint.id} className={`rounded-2xl border p-4 transition-all ${sprint.status === 'active' ? 'border-sky-400/30 bg-sky-500/10' : 'surface-muted'}`}>
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <h5 className="font-semibold text-slate-800 dark:text-white">{sprint.name}</h5>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] ${sprint.status === 'active' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' :
                                            sprint.status === 'completed' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                                                'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                                            }`}>
                                        {sprint.status === 'future' ? 'Futura' : sprint.status === 'active' ? 'Em Andamento' : 'Concluída'}
                                        </span>
                                    </div>
                                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                        <Calendar className="w-3 h-3" /> {sprint.startDate} - {sprint.endDate}
                                    </p>
                                    <p className="text-sm italic text-slate-600 dark:text-slate-400">"{sprint.goal}"</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {sprint.status === 'future' && (
                                        <button onClick={() => handleStatusChange(sprint, 'active')} title="Iniciar Sprint" className="app-button-secondary min-h-0 px-3 py-2">
                                            <Play className="w-4 h-4" />
                                            Iniciar
                                        </button>
                                    )}
                                    {sprint.status === 'active' && (
                                        <button onClick={() => handleStatusChange(sprint, 'completed')} title="Concluir Sprint" className="app-button-secondary min-h-0 px-3 py-2 text-emerald-700 dark:text-emerald-300">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Concluir
                                        </button>
                                    )}
                                    {sprint.status === 'completed' && (
                                        <button onClick={() => handleStatusChange(sprint, 'active')} title="Reabrir Sprint" className="app-button-secondary min-h-0 px-3 py-2">
                                            <RotateCcw className="w-4 h-4" />
                                            Reabrir
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(sprint.id)} title="Excluir" className="app-button-danger min-h-0 px-3 py-2">
                                        <Trash2 className="w-4 h-4" />
                                        Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

export default ManageSprintsModal;

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

                {/* Create Sprint Button / Form */}
                {!isCreating ? (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-500 hover:text-fiori-blue hover:border-fiori-blue transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                        <Plus className="w-5 h-5" /> Criar Nova Sprint
                    </button>
                ) : (
                    <form onSubmit={handleCreate} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg space-y-4 border border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Nome</label>
                                <input autoFocus required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Sprint 24..." className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:border-fiori-blue dark:text-white" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Meta</label>
                                <input required type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Entregar MVP..." className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:border-fiori-blue dark:text-white" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Início</label>
                                <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:border-fiori-blue dark:text-white" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase text-slate-500">Fim</label>
                                <input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:border-fiori-blue dark:text-white" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-1 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                            <button type="submit" className="px-3 py-1 text-sm bg-fiori-blue text-white rounded hover:bg-blue-700">Salvar Sprint</button>
                        </div>
                    </form>
                )}

                {/* Sprints List */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sprints Agendadas</h4>
                    {sprints.length === 0 && !isCreating && <p className="text-sm text-slate-500 italic">Nenhuma sprint encontrada.</p>}

                    {sprints.map(sprint => (
                        <div key={sprint.id} className={`p-4 rounded-lg border flex items-center justify-between ${sprint.status === 'active' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-white border-slate-200 dark:bg-slate-800/30 dark:border-slate-700'}`}>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h5 className="font-semibold text-slate-800 dark:text-white">{sprint.name}</h5>
                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${sprint.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                        sprint.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                        {sprint.status === 'future' ? 'Futura' : sprint.status === 'active' ? 'Em Andamento' : 'Concluída'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> {sprint.startDate} - {sprint.endDate}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 italic">"{sprint.goal}"</p>
                            </div>

                            <div className="flex items-center gap-2">
                                {sprint.status === 'future' && (
                                    <button onClick={() => handleStatusChange(sprint, 'active')} title="Iniciar Sprint" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors">
                                        <Play className="w-4 h-4" />
                                    </button>
                                )}
                                {sprint.status === 'active' && (
                                    <button onClick={() => handleStatusChange(sprint, 'completed')} title="Concluir Sprint" className="p-2 text-blue-600 hover:text-green-600 hover:bg-green-100 rounded-full transition-colors">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                )}
                                {sprint.status === 'completed' && (
                                    <button onClick={() => handleStatusChange(sprint, 'active')} title="Reabrir Sprint" className="p-2 text-green-600 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors">
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => handleDelete(sprint.id)} title="Excluir" className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

export default ManageSprintsModal;

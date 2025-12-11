import React, { useState, useEffect } from 'react';
import { Environment, Deployment, Repository } from '../types';
import { api } from '../services/api';
import Modal from './Modal';
import { useConfirm } from '../contexts/ConfirmContext';
import {
    Cloud, Server, Rocket, ArrowRight, RefreshCw, RotateCcw,
    CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown,
    ChevronUp, Plus, AlertCircle, Activity
} from 'lucide-react';

interface EnvironmentsProps {
    repositories: Repository[];
    addToast: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
    onNavigateToGit?: () => void;
}

interface EnvWithDeployments extends Environment {
    deployments?: Deployment[];
    repoName?: string;
}

// ... (existing code matches until Environments component definition)



const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    healthy: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    degraded: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    down: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    unknown: { icon: AlertCircle, color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' }
};

const typeConfig: Record<string, { icon: React.ElementType; color: string; border: string }> = {
    dev: { icon: Cloud, color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500' },
    stage: { icon: Server, color: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500' },
    prod: { icon: Rocket, color: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500' }
};

const EnvironmentCard: React.FC<{
    env: EnvWithDeployments;
    onPromote?: () => void;
    onRollback?: () => void;
    canPromote?: boolean;
}> = ({ env, onPromote, onRollback, canPromote }) => {
    const [expanded, setExpanded] = useState(false);
    const status = statusConfig[env.status] || statusConfig.unknown;
    const type = typeConfig[env.type] || typeConfig.dev;
    const StatusIcon = status.icon;
    const TypeIcon = type.icon;

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-xl border-t-4 ${type.border} shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden`}>
            {/* Header */}
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${status.bg}`}>
                            <TypeIcon className={`w-5 h-5 ${type.color}`} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">{env.name}</h3>
                            <p className="text-xs text-slate-500 capitalize">{env.type}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${status.bg}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                        <span className={`text-xs font-medium ${status.color} capitalize`}>{env.status}</span>
                    </div>
                </div>

                {/* Version Info */}
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 mb-3 border border-slate-100 dark:border-slate-600/30">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 uppercase font-semibold">Versão Atual</span>
                        {env.currentVersion ? (
                            <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
                                {env.currentVersion.substring(0, 8)}
                            </span>
                        ) : (
                            <span className="text-sm text-slate-400 italic">Nenhum deploy</span>
                        )}
                    </div>
                    {env.lastDeployedAt && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>Deploy em {new Date(env.lastDeployedAt).toLocaleString('pt-BR')}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    {canPromote && onPromote && (
                        <button
                            onClick={onPromote}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-fiori-blue hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <ArrowRight className="w-4 h-4" />
                            Promover
                        </button>
                    )}
                    {env.currentVersion && onRollback && (
                        <button
                            onClick={onRollback}
                            className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Rollback
                        </button>
                    )}
                </div>
            </div>

            {/* Deployment History Toggle */}
            {env.deployments && env.deployments.length > 0 && (
                <>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                        <span>Histórico ({env.deployments.length} deploys)</span>
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expanded && (
                        <div className="border-t border-slate-100 dark:border-slate-800 max-h-48 overflow-y-auto">
                            {env.deployments.map((d, i) => (
                                <div key={d.id} className={`px-4 py-2 flex items-center justify-between text-xs ${i % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${d.status === 'success' ? 'bg-emerald-500' : d.rollbackOf ? 'bg-amber-500' : 'bg-red-500'}`} />
                                        <span className="font-mono text-slate-600 dark:text-slate-300">{d.version.substring(0, 8)}</span>
                                        {d.rollbackOf && <span className="text-amber-500">(rollback)</span>}
                                    </div>
                                    <span className="text-slate-400">{new Date(d.deployedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};



const NewDeploymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onDeploy: (version: string, notes: string) => Promise<void>;
    repoName: string;
}> = ({ isOpen, onClose, onDeploy, repoName }) => {
    const [version, setVersion] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onDeploy(version, notes);
        setLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Deploy para Dev (${repoName})`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Versão (Sem v)
                    </label>
                    <input
                        type="text"
                        value={version}
                        onChange={e => setVersion(e.target.value)}
                        placeholder="1.0.0"
                        pattern="^[0-9]+\.[0-9]+\.[0-9]+$"
                        title="Formato: x.y.z (ex: 1.0.0)"
                        required
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Notas de Deploy
                    </label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="O que há de novo nesta versão?"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-fiori-blue focus:outline-none h-24 resize-none dark:text-white"
                    />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-fiori-blue text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                        Deploy
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const NewEnvironmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: { name: string; type: 'dev' | 'stage' | 'prod'; repoId: string }) => Promise<void>;
    repositories: Repository[];
}> = ({ isOpen, onClose, onCreate, repositories }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'dev' | 'stage' | 'prod'>('dev');
    const [repoId, setRepoId] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setName('');
            setType('dev');
            setRepoId(repositories.length > 0 ? repositories[0].id : '');
        }
    }, [isOpen, repositories]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoId) return;

        setLoading(true);
        await onCreate({ name, type, repoId });
        setLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Novo Ambiente">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nome do Ambiente
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Desenvolvimento Alpha"
                        required
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Tipo de Ambiente
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {(['dev', 'stage', 'prod'] as const).map((t) => (
                            <div
                                key={t}
                                onClick={() => setType(t)}
                                className={`cursor-pointer border rounded-lg p-3 text-center transition-all ${type === t
                                    ? 'border-fiori-blue bg-blue-50 dark:bg-blue-900/20 text-fiori-blue'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                            >
                                <div className="font-semibold capitalize text-sm">{t}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Repositório
                    </label>
                    <select
                        value={repoId}
                        onChange={e => setRepoId(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-fiori-blue focus:outline-none dark:text-white"
                    >
                        {repositories.map(repo => (
                            <option key={repo.id} value={repo.id}>
                                {repo.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !repoId}
                        className="px-4 py-2 bg-fiori-blue text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                        Criar Ambiente
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const Environments: React.FC<EnvironmentsProps> = ({ repositories, addToast, onNavigateToGit }) => {
    const { confirm } = useConfirm();
    const [environments, setEnvironments] = useState<EnvWithDeployments[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRepo, setSelectedRepo] = useState<string>('');
    const [deployModal, setDeployModal] = useState<{ isOpen: boolean; envId: string; repoName: string } | null>(null);
    const [isNewEnvModalOpen, setIsNewEnvModalOpen] = useState(false);

    const loadEnvironments = async () => {
        setLoading(true);
        try {
            const envs = await api.getEnvironments(selectedRepo || undefined);

            // Load deployments for each environment
            const envsWithDeployments = await Promise.all(
                envs.map(async (env: Environment) => {
                    try {
                        const details = await api.getEnvironment(env.id);
                        return { ...env, deployments: details.deployments || [] };
                    } catch {
                        return { ...env, deployments: [] };
                    }
                })
            );

            setEnvironments(envsWithDeployments);
        } catch (err) {
            console.error('Failed to load environments:', err);
            addToast('Falha ao Carregar Ambientes', 'error', 'Não foi possível obter a lista de ambientes do servidor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEnvironments();
    }, [selectedRepo]);

    const handleDeploy = async (version: string, notes: string) => {
        if (!deployModal) return;

        try {
            const result = await api.deployToEnvironment(deployModal.envId, { version, notes });
            addToast('Deploy Realizado', 'success', result.message || 'A versão foi implantada no ambiente com sucesso.');
            loadEnvironments();
        } catch (err: any) {
            const errorMessage = err.message || 'Falha no deploy';
            if (errorMessage.includes('O repositório está vazio') && onNavigateToGit) {
                if (await confirm({ title: 'Repositório Vazio', message: 'O repositório está vazio. É necessário fazer o "Initial Commit" antes de realizar o deploy.\n\nDeseja ir para a tela de Controle de Fonte agora?', confirmText: 'Ir para Controle de Fonte', variant: 'warning' })) {
                    onNavigateToGit();
                    setDeployModal(null);
                }
            } else {
                addToast('Falha no Deploy', 'error', errorMessage);
            }
        }
    };

    const handlePromote = async (sourceEnv: EnvWithDeployments) => {
        // Find target environment (next level)
        const typeOrder = ['dev', 'stage', 'prod'];
        const sourceIdx = typeOrder.indexOf(sourceEnv.type);
        const targetType = typeOrder[sourceIdx + 1];

        const targetEnv = environments.find(e => e.repoId === sourceEnv.repoId && e.type === targetType);

        if (!targetEnv) {
            addToast('Ambiente Não Encontrado', 'error', `Não existe um ambiente ${targetType} configurado para este repositório.`);
            return;
        }

        try {
            const result = await api.promoteEnvironment(targetEnv.id, sourceEnv.id);
            addToast('Promoção Realizada', 'success', result.message || 'A versão foi promovida para o próximo ambiente.');
            loadEnvironments();
        } catch (err: any) {
            addToast('Falha na Promoção', 'error', err.message || 'Não foi possível promover a versão.');
        }
    };

    const handleRollback = async (env: EnvWithDeployments) => {
        try {
            const result = await api.rollbackEnvironment(env.id);
            addToast('Rollback Realizado', 'success', result.message || 'O ambiente foi revertido para a versão anterior.');
            loadEnvironments();
        } catch (err: any) {
            addToast('Falha no Rollback', 'error', err.message || 'Não foi possível reverter o ambiente.');
        }
    };

    const handleCreateEnvironment = async (data: { name: string; type: 'dev' | 'stage' | 'prod'; repoId: string }) => {
        try {
            await api.createEnvironment(data);
            addToast('Ambiente Criado', 'success', `O ambiente "${data.name}" está pronto para uso.`);
            loadEnvironments();
        } catch (err: any) {
            addToast('Falha ao Criar Ambiente', 'error', err.message || 'Não foi possível criar o ambiente. Verifique os dados informados.');
        }
    };

    // Group environments by repository
    const envsByRepo = environments.reduce((acc, env) => {
        const repoId = env.repoId;
        if (!acc[repoId]) {
            acc[repoId] = { repoName: env.repoName || repoId, envs: [] };
        }
        acc[repoId].envs.push(env);
        return acc;
    }, {} as Record<string, { repoName: string; envs: EnvWithDeployments[] }>);

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-fiori-bgLight dark:bg-fiori-bgDark">
            {/* Header */}
            <div className="px-6 py-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-600/30 flex justify-between items-center shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-fiori-textPrimary dark:text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-fiori-blue" />
                        Ambientes de Deploy
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Gerencie dev, stage e produção</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedRepo}
                        onChange={(e) => setSelectedRepo(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white"
                    >
                        <option value="">Todos os Repositórios</option>
                        {repositories.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={loadEnvironments}
                        className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Atualizar"
                    >
                        <RefreshCw className={`w-5 h-5 dark:text-slate-300 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsNewEnvModalOpen(true)}
                        className="p-2 bg-fiori-blue text-white rounded-lg hover:bg-blue-700 transition-colors"
                        title="Novo Ambiente"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="w-8 h-8 text-fiori-blue animate-spin" />
                    </div>
                ) : Object.keys(envsByRepo).length === 0 ? (
                    <div className="text-center py-16">
                        <Cloud className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">Nenhum ambiente configurado</h3>
                        <p className="text-sm text-slate-500 mb-4">Configure ambientes dev, stage e prod para seus repositórios</p>
                        <button
                            onClick={() => setIsNewEnvModalOpen(true)}
                            className="px-4 py-2 bg-fiori-blue text-white rounded-lg text-sm font-medium flex items-center gap-2 mx-auto"
                        >
                            <Plus className="w-4 h-4" />
                            Criar Ambiente
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(envsByRepo).map(([repoId, { repoName, envs }]) => {
                            // Sort by type order
                            const sortedEnvs = envs.sort((a, b) => {
                                const order = { dev: 0, stage: 1, prod: 2 };
                                return (order[a.type] || 0) - (order[b.type] || 0);
                            });

                            return (
                                <div key={repoId}>
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Server className="w-5 h-5 text-slate-400" />
                                        {repoName}
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {sortedEnvs.map((env, _idx) => (
                                            <div key={env.id} className="flex flex-col gap-2">
                                                <EnvironmentCard
                                                    key={env.id}
                                                    env={env}
                                                    canPromote={env.type !== 'prod' && env.currentVersion !== null}
                                                    onPromote={() => handlePromote(env)}
                                                    onRollback={() => handleRollback(env)}
                                                />
                                                {env.type === 'dev' && (
                                                    <button
                                                        onClick={() => setDeployModal({ isOpen: true, envId: env.id, repoName })}
                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-500 transition-colors"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Novo Deploy
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Promotion Flow Visualization */}
                                    {sortedEnvs.length >= 2 && (
                                        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
                                            {sortedEnvs.map((env, idx) => (
                                                <React.Fragment key={env.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full ${env.currentVersion
                                                            ? env.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                                                            : 'bg-slate-300'
                                                            }`} />
                                                        <span className="font-medium uppercase">{env.type}</span>
                                                        {env.currentVersion && (
                                                            <span className="font-mono">{env.currentVersion.substring(0, 6)}</span>
                                                        )}
                                                    </div>
                                                    {idx < sortedEnvs.length - 1 && (
                                                        <ArrowRight className="w-4 h-4" />
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {deployModal && (
                <NewDeploymentModal
                    isOpen={deployModal.isOpen}
                    onClose={() => setDeployModal(null)}
                    onDeploy={handleDeploy}
                    repoName={deployModal.repoName}
                />
            )}
            <NewEnvironmentModal
                isOpen={isNewEnvModalOpen}
                onClose={() => setIsNewEnvModalOpen(false)}
                onCreate={handleCreateEnvironment}
                repositories={repositories}
            />
        </div>
    );
};

export default Environments;

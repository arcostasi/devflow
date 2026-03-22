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

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    healthy: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    degraded: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    down: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    unknown: { icon: AlertCircle, color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' }
};

const normalizeEnvironmentStatus = (status?: string): Environment['status'] => {
    const normalizedStatus = status?.toLowerCase();

    if (normalizedStatus === 'healthy' || normalizedStatus === 'success') return 'healthy';
    if (normalizedStatus === 'degraded' || normalizedStatus === 'warning' || normalizedStatus === 'pending' || normalizedStatus === 'rolled_back') return 'degraded';
    if (normalizedStatus === 'down' || normalizedStatus === 'failed') return 'down';
    return 'unknown';
};

const getEnvironmentStatusLabel = (status: Environment['status']) => {
    if (status === 'healthy') return 'Saudavel';
    if (status === 'degraded') return 'Atencao';
    if (status === 'down') return 'Critico';
    return 'Indefinido';
};

const typeConfig: Record<string, { icon: React.ElementType; color: string; border: string }> = {
    dev: { icon: Cloud, color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500' },
    stage: { icon: Server, color: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500' },
    prod: { icon: Rocket, color: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500' }
};

const envInsetCard =
    'rounded-2xl border border-slate-200/75 bg-slate-50/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

const EnvironmentCard: React.FC<{
    env: EnvWithDeployments;
    onPromote?: () => void;
    onRollback?: () => void;
    canPromote?: boolean;
}> = ({ env, onPromote, onRollback, canPromote }) => {
    const [expanded, setExpanded] = useState(false);
    const normalizedStatus = normalizeEnvironmentStatus(env.status);
    const status = statusConfig[normalizedStatus] || statusConfig.unknown;
    const type = typeConfig[env.type] || typeConfig.dev;
    const StatusIcon = status.icon;
    const TypeIcon = type.icon;

    return (
        <div className={`surface-card overflow-hidden rounded-[1.35rem] border border-slate-200/75 border-t-4 bg-white/88 shadow-sm shadow-slate-200/60 ${type.border} dark:border-white/10 dark:bg-transparent dark:shadow-none`}>
            <div className="p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`rounded-2xl p-2.5 ${status.bg}`}>
                            <TypeIcon className={`h-5 w-5 ${type.color}`} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">{env.name}</h3>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-[var(--text-muted)]">{env.type}</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${status.bg}`}>
                        <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                        <span className={`text-xs font-semibold tracking-[0.02em] ${status.color}`}>{getEnvironmentStatusLabel(normalizedStatus)}</span>
                    </div>
                </div>

                <div className={envInsetCard}>
                    <div className="flex justify-between items-center">
                        <span className="app-metric-label tracking-[0.16em]">Versao atual</span>
                        {env.currentVersion ? (
                            <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
                                {env.currentVersion.substring(0, 8)}
                            </span>
                        ) : (
                            <span className="text-sm text-slate-400 italic">Nenhum deploy</span>
                        )}
                    </div>
                    {env.lastDeployedAt && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400 dark:text-[var(--text-muted)]">
                            <Clock className="h-3 w-3" />
                            <span>Deploy em {new Date(env.lastDeployedAt).toLocaleString('pt-BR')}</span>
                        </div>
                    )}
                </div>

                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                    {canPromote && onPromote && (
                        <button
                            onClick={onPromote}
                            className="rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                        >
                            <span className="inline-flex items-center justify-center gap-2"><ArrowRight className="h-4 w-4" /> Promover</span>
                        </button>
                    )}
                    {env.currentVersion && onRollback && (
                        <button
                            onClick={onRollback}
                            className="app-soft-button rounded-xl px-4 py-3 text-sm font-medium"
                        >
                            <span className="inline-flex items-center justify-center gap-2"><RotateCcw className="h-4 w-4" /> Rollback</span>
                        </button>
                    )}
                </div>
            </div>

            {env.deployments && env.deployments.length > 0 && (
                <>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500 transition-colors hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100/80 dark:border-white/10 dark:text-[var(--text-muted)] dark:hover:bg-white/[0.04] dark:focus-visible:ring-sky-500/20"
                    >
                        <span>Histórico ({env.deployments.length} deploys)</span>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {expanded && (
                        <div className="border-t border-slate-100 dark:border-white/10 max-h-48 overflow-y-auto">
                            {env.deployments.map((d, i) => (
                                <div key={d.id} className={`flex items-center justify-between px-4 py-2 text-xs ${i % 2 === 0 ? 'bg-slate-50/65 dark:bg-white/[0.03]' : ''}`}>
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
                <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                    <p className="app-section-label text-slate-500 dark:text-slate-400">Janela de deploy</p>
                    <p className="app-copy mt-2 text-slate-600 dark:text-slate-300">
                        Registre a versão publicada em <span className="font-medium text-slate-800 dark:text-slate-100">{repoName}</span> e deixe claro o que mudou para facilitar promoção e rollback.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">
                        Versao (sem v)
                    </label>
                    <input
                        type="text"
                        value={version}
                        onChange={e => setVersion(e.target.value)}
                        placeholder="1.0.0"
                        pattern="^[0-9]+\.[0-9]+\.[0-9]+$"
                        title="Formato: x.y.z (ex: 1.0.0)"
                        required
                        className="app-input w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                    />
                    <p className="mt-2 text-xs text-slate-400">Use versão semântica para manter leitura consistente entre deploys e histórico.</p>
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">
                        Notas de deploy
                    </label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="O que há de novo nesta versão?"
                        className="app-input h-24 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                    />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="app-soft-button rounded-lg px-4 py-2"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                    >
                        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
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
                <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                    <p className="app-section-label text-slate-500 dark:text-slate-400">Provisionamento</p>
                    <p className="app-copy mt-2 text-slate-600 dark:text-slate-300">
                        Crie um novo ambiente com tipo e repositório definidos para manter a trilha de promoção clara desde o primeiro deploy.
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">
                        Nome do ambiente
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex: Desenvolvimento Alpha"
                        required
                        className="app-input w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                    />
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">
                        Tipo de ambiente
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {(['dev', 'stage', 'prod'] as const).map((t) => (
                            <div
                                key={t}
                                onClick={() => setType(t)}
                                className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${type === t
                                    ? 'border-primary-500 bg-blue-50/85 text-primary-600 shadow-sm shadow-blue-100/70 dark:bg-blue-900/20 dark:text-primary-300 dark:shadow-none'
                                    : 'border-slate-200/80 bg-slate-50/72 text-slate-600 hover:border-slate-300 hover:bg-slate-50/90 dark:border-slate-700 dark:bg-transparent dark:hover:border-slate-600'
                                    }`}
                            >
                                <div className="font-semibold capitalize text-sm">{t}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">
                        Repositorio
                    </label>
                    <select
                        value={repoId}
                        onChange={e => setRepoId(e.target.value)}
                        required
                        className="app-input w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
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
                        className="app-soft-button rounded-lg px-4 py-2"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !repoId}
                        className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                    >
                        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                        Criar ambiente
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
            const repoNameById = new Map(repositories.map((repository) => [repository.id, repository.name]));

            // Load deployments for each environment
            const envsWithDeployments = await Promise.all(
                envs.map(async (env: Environment) => {
                    try {
                        const details = await api.getEnvironment(env.id);
                        return {
                            ...env,
                            status: normalizeEnvironmentStatus(env.status),
                            deployments: details.deployments || [],
                            repoName: repoNameById.get(env.repoId) || env.repoId
                        };
                    } catch {
                        return {
                            ...env,
                            status: normalizeEnvironmentStatus(env.status),
                            deployments: [],
                            repoName: repoNameById.get(env.repoId) || env.repoId
                        };
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
    }, [selectedRepo, repositories]);

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

    const healthyCount = environments.filter(env => env.status === 'healthy').length;
    const warningCount = environments.filter(env => env.status === 'degraded').length;
    const criticalCount = environments.filter(env => env.status === 'down').length;

    return (
        <div className="page-shell min-h-full">
            <div className="page-container page-stack">
                <section className="page-panel-grid xl:grid-cols-12">
                    <div className="surface-card overflow-hidden rounded-[1.6rem] xl:col-span-7">
                        <div className="panel-header-block border-b border-slate-200/70 bg-slate-50/45 dark:border-white/10 dark:bg-transparent">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="max-w-2xl">
                                    <p className="app-section-label">Pipeline de Entrega</p>
                                    <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-[var(--text-primary)]">
                                        <Activity className="h-6 w-6 text-primary-500" />
                                        Ambientes de deploy
                                    </h1>
                                    <p className="app-copy mt-2">
                                        Visualize saude de dev, stage e producao com foco em risco, promocao e rollback sem perder contexto por repositorio.
                                    </p>
                                </div>
                                <div className="page-actions">
                                    <select
                                        value={selectedRepo}
                                        onChange={(e) => setSelectedRepo(e.target.value)}
                                        className="app-input rounded-xl px-3 py-2.5 text-sm dark:text-white"
                                    >
                                        <option value="">Todos os Repositorios</option>
                                        {repositories.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={loadEnvironments}
                                        className="app-soft-icon-button rounded-xl p-2.5"
                                        title="Atualizar"
                                    >
                                        <RefreshCw className={`h-5 w-5 dark:text-slate-300 ${loading ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button
                                        onClick={() => setIsNewEnvModalOpen(true)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                                    >
                                        <Plus className="h-4 w-4" /> Novo ambiente
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-3">
                            <div className={envInsetCard}>
                                <p className="app-metric-label">Saudaveis</p>
                                <p className="mt-3 text-3xl font-light text-emerald-600 dark:text-emerald-300">{healthyCount}</p>
                                <p className="app-copy-compact mt-2">Ambientes operando sem degradacao aparente.</p>
                            </div>
                            <div className={envInsetCard}>
                                <p className="app-metric-label">Em alerta</p>
                                <p className="mt-3 text-3xl font-light text-amber-600 dark:text-amber-300">{warningCount}</p>
                                <p className="app-copy-compact mt-2">Ambientes degradados pedindo observacao ou promocao cuidadosa.</p>
                            </div>
                            <div className={envInsetCard}>
                                <p className="app-metric-label">Criticos</p>
                                <p className="mt-3 text-3xl font-light text-red-600 dark:text-red-300">{criticalCount}</p>
                                <p className="app-copy-compact mt-2">Ambientes fora do ar ou exigindo acao imediata.</p>
                            </div>
                        </div>
                    </div>
                    <div className="surface-card panel-body-block rounded-[1.6rem] xl:col-span-5">
                        <p className="app-section-label">Leitura Operacional</p>
                        <div className="mt-4 space-y-3.5">
                            <div className={envInsetCard}>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Promocoes e rollback</h3>
                                <p className="app-copy-compact mt-1">
                                    Dev inicia novos deploys, stage e prod priorizam leitura de risco e acoes de promocao seguras.
                                </p>
                            </div>
                            <div className={envInsetCard}>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-[var(--text-primary)]">Cobertura por repositorio</h3>
                                <p className="app-copy-compact mt-1">
                                    {Object.keys(envsByRepo).length} repositorio(s) com ambientes mapeados nesta visao.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="surface-card panel-body-block rounded-[1.6rem]">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
                        </div>
                    ) : Object.keys(envsByRepo).length === 0 ? (
                        <div className="text-center py-16 surface-empty rounded-2xl">
                            <Cloud className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">Nenhum ambiente configurado</h3>
                            <p className="text-sm text-slate-500 mb-4">Configure ambientes dev, stage e prod para seus repositórios</p>
                            <button
                                onClick={() => setIsNewEnvModalOpen(true)}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 mx-auto"
                            >
                                <Plus className="w-4 h-4" />
                                Criar Ambiente
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(envsByRepo).map(([repoId, { repoName, envs }]) => {
                                const sortedEnvs = envs.sort((a, b) => {
                                    const order = { dev: 0, stage: 1, prod: 2 };
                                    return (order[a.type] || 0) - (order[b.type] || 0);
                                });

                                return (
                                    <div key={repoId} className="surface-subtle rounded-[1.35rem] border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] space-y-5 dark:border-white/10 dark:bg-white/[0.02] dark:shadow-none">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                <Server className="w-5 h-5 text-slate-400" />
                                                {repoName}
                                            </h2>
                                            <div className="app-soft-badge">
                                                {sortedEnvs.length} ambiente(s)
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {sortedEnvs.map((env) => (
                                                <div key={env.id} className="flex flex-col gap-3">
                                                    <EnvironmentCard
                                                        env={env}
                                                        canPromote={env.type !== 'prod' && env.currentVersion !== null}
                                                        onPromote={() => handlePromote(env)}
                                                        onRollback={() => handleRollback(env)}
                                                    />
                                                    {env.type === 'dev' && (
                                                        <button
                                                            onClick={() => setDeployModal({ isOpen: true, envId: env.id, repoName })}
                                                            className="app-soft-button w-full rounded-xl border-dashed px-4 py-3 text-sm font-medium text-slate-500 dark:text-[var(--text-muted)]"
                                                        >
                                                            <span className="inline-flex items-center justify-center gap-2"><Plus className="w-3.5 h-3.5" /> Novo deploy</span>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

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

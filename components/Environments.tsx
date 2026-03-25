import React, { useEffect, useRef, useState } from 'react';
import { Environment, Deployment, Repository } from '../types';
import { api } from '../services/api';
import Modal from './Modal';
import { useConfirm } from '../contexts/ConfirmContext';
import {
    Cloud, Server, Rocket, ArrowRight, RefreshCw, RotateCcw,
    CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown,
    ChevronUp, Plus, AlertCircle, Activity, Pencil, X
} from 'lucide-react';
import AIFieldAssist from './AIFieldAssist';

interface EnvironmentsProps {
    repositories: Repository[];
    addToast: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
    onNavigateToGit?: () => void;
    preferredRepoId?: string | null;
    preferredEnvironmentId?: string | null;
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

const getEnvironmentTypeLabel = (type: Environment['type']) => {
    if (type === 'dev') return 'Desenvolvimento';
    if (type === 'stage') return 'Homologação';
    return 'Produção';
};

const getEnvironmentRiskHint = (type: Environment['type']) => {
    if (type === 'prod') return 'alto';
    if (type === 'stage') return 'medio';
    return 'baixo';
};

const summarizeDeployments = (deployments: Deployment[] = [], limit = 3) => deployments
    .slice(0, limit)
    .map((deployment) => ({
        version: deployment.version,
        status: deployment.status,
        deployedAt: deployment.deployedAt,
        notes: deployment.notes || '',
    }));

const typeConfig: Record<string, { icon: React.ElementType; color: string; border: string }> = {
    dev: { icon: Cloud, color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500' },
    stage: { icon: Server, color: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500' },
    prod: { icon: Rocket, color: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500' }
};

const envInsetCard =
    'rounded-2xl border border-slate-200/75 bg-slate-50/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none';

const formatRelativeSyncTime = (timestamp: number | null) => {
    if (!timestamp) return '';

    const diffMs = Date.now() - timestamp;
    const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSeconds < 5) return 'salvo agora';
    if (diffSeconds < 60) return `salvo ha ${diffSeconds}s`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `salvo ha ${diffMinutes}min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `salvo ha ${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `salvo ha ${diffDays}d`;
};

const EnvironmentCard: React.FC<{
    env: EnvWithDeployments;
    onPromote?: () => void;
    onRollback?: () => void;
    onEdit?: () => void;
    onQuickSave?: (envId: string, updates: { description?: string; internalNotes?: string }) => Promise<void>;
    canPromote?: boolean;
    highlighted?: boolean;
}> = ({ env, onPromote, onRollback, onEdit, onQuickSave, canPromote, highlighted = false }) => {
    const [expanded, setExpanded] = useState(false);
    const [isInlineEditing, setIsInlineEditing] = useState(false);
    const [draftDescription, setDraftDescription] = useState(env.description || '');
    const [draftInternalNotes, setDraftInternalNotes] = useState(env.internalNotes || '');
    const [isSavingInline, setIsSavingInline] = useState(false);
    const [inlineSaveState, setInlineSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
    const [relativeSyncLabel, setRelativeSyncLabel] = useState('');
    const normalizedStatus = normalizeEnvironmentStatus(env.status);
    const status = statusConfig[normalizedStatus] || statusConfig.unknown;
    const type = typeConfig[env.type] || typeConfig.dev;
    const StatusIcon = status.icon;
    const TypeIcon = type.icon;
    const inlineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedSignatureRef = useRef(`${env.description || ''}|||${env.internalNotes || ''}`);
    const currentDraftSignature = `${draftDescription.trim()}|||${draftInternalNotes.trim()}`;
    const hasUnsyncedChanges = isInlineEditing && currentDraftSignature !== lastSavedSignatureRef.current;
    const environmentTypeLabel = getEnvironmentTypeLabel(env.type);
    const recentDeployments = summarizeDeployments(env.deployments);

    useEffect(() => {
        setDraftDescription(env.description || '');
        setDraftInternalNotes(env.internalNotes || '');
        lastSavedSignatureRef.current = `${env.description || ''}|||${env.internalNotes || ''}`;
        setInlineSaveState('idle');
    }, [env.id, env.description, env.internalNotes]);

    useEffect(() => {
        setRelativeSyncLabel(formatRelativeSyncTime(lastSyncedAt));
        if (!lastSyncedAt) return;

        const interval = setInterval(() => {
            setRelativeSyncLabel(formatRelativeSyncTime(lastSyncedAt));
        }, 1000);

        return () => clearInterval(interval);
    }, [lastSyncedAt]);

    const handleInlineSave = async () => {
        if (!onQuickSave) return;
        setIsSavingInline(true);
        setInlineSaveState('saving');
        try {
            const nextDescription = draftDescription.trim() || '';
            const nextInternalNotes = draftInternalNotes.trim() || '';
            await onQuickSave(env.id, {
                description: nextDescription,
                internalNotes: nextInternalNotes,
            });
            lastSavedSignatureRef.current = `${nextDescription}|||${nextInternalNotes}`;
            setLastSyncedAt(Date.now());
            setInlineSaveState('saved');
        } catch (_err) {
            setInlineSaveState('error');
        } finally {
            setIsSavingInline(false);
        }
    };

    useEffect(() => {
        if (!isInlineEditing || !onQuickSave) return;

        if (currentDraftSignature === lastSavedSignatureRef.current) return;

        if (inlineDebounceRef.current) clearTimeout(inlineDebounceRef.current);
        setInlineSaveState('idle');
        inlineDebounceRef.current = setTimeout(() => {
            handleInlineSave();
        }, 900);

        return () => {
            if (inlineDebounceRef.current) clearTimeout(inlineDebounceRef.current);
        };
    }, [currentDraftSignature, isInlineEditing, onQuickSave]);

    const handleInlineClose = () => {
        if (inlineDebounceRef.current) clearTimeout(inlineDebounceRef.current);
        setDraftDescription(env.description || '');
        setDraftInternalNotes(env.internalNotes || '');
        setIsInlineEditing(false);
        setInlineSaveState('idle');
    };

    return (
        <div
            data-environment-id={env.id}
            className={`surface-card overflow-hidden rounded-[1.35rem] border border-slate-200/75 border-t-4 bg-white/88 shadow-sm shadow-slate-200/60 transition-all ${type.border} ${highlighted ? 'ring-2 ring-primary-500/40 shadow-[0_0_0_1px_rgba(14,165,233,0.16),0_18px_40px_-28px_rgba(14,165,233,0.35)] dark:ring-primary-400/40' : ''} dark:border-white/10 dark:bg-transparent dark:shadow-none`}
        >
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
                    {!isInlineEditing && (
                        <>
                            {env.description ? (
                                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    {env.description}
                                </p>
                            ) : (
                                <p className="mt-3 text-sm italic text-slate-400 dark:text-slate-500">
                                    Ambiente sem descrição operacional registrada.
                                </p>
                            )}
                            {env.internalNotes ? (
                                <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                    <strong className="block font-semibold">Notas internas</strong>
                                    <span className="mt-1 block whitespace-pre-wrap">{env.internalNotes}</span>
                                </div>
                            ) : (
                                <p className="mt-3 text-xs italic text-slate-400 dark:text-slate-500">
                                    Sem notas internas registradas.
                                </p>
                            )}
                        </>
                    )}

                    {isInlineEditing && (
                        <div className="mt-3 space-y-4">
                            <div>
                                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    Descrição do ambiente
                                </label>
                                <textarea
                                    value={draftDescription}
                                    onChange={(event) => setDraftDescription(event.target.value)}
                                    placeholder="Explique o papel operacional deste ambiente."
                                    className="app-input h-24 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                                />
                                <AIFieldAssist
                                    fieldType="environment_description"
                                    variant="compact"
                                    surface="environment_inline"
                                    intent={draftDescription.trim() ? 'rewrite' : 'generate'}
                                    currentValue={draftDescription}
                                    helpText="Reescreve a descrição com foco operacional e no uso real do ambiente."
                                    buildContext={() => ({
                                        name: env.name,
                                        type: env.type,
                                        typeLabel: environmentTypeLabel,
                                        repoName: env.repoName || env.repoId,
                                        currentDescription: draftDescription,
                                        currentVersion: env.currentVersion || '',
                                        status: normalizedStatus,
                                        statusLabel: getEnvironmentStatusLabel(normalizedStatus),
                                    })}
                                    relatedEntities={{
                                        environment: {
                                            id: env.id,
                                            name: env.name,
                                            type: env.type,
                                            currentVersion: env.currentVersion || '',
                                        },
                                        repository: {
                                            id: env.repoId,
                                            name: env.repoName || env.repoId,
                                        },
                                    }}
                                    constraints={{
                                        targetAudience: 'operacao',
                                        riskLevel: getEnvironmentRiskHint(env.type),
                                    }}
                                    onApply={(result) => setDraftDescription(result.value || '')}
                                    buttonLabel="Reescrever descrição"
                                    className="mt-2"
                                    disabled={isSavingInline}
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    Notas internas
                                </label>
                                <textarea
                                    value={draftInternalNotes}
                                    onChange={(event) => setDraftInternalNotes(event.target.value)}
                                    placeholder="Registre dependências, cuidados operacionais ou combinados do time."
                                    className="app-input h-24 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                                />
                                <AIFieldAssist
                                    fieldType="internal_notes"
                                    variant="compact"
                                    surface="environment_inline"
                                    intent={draftInternalNotes.trim() ? 'rewrite' : 'suggest'}
                                    currentValue={draftInternalNotes}
                                    helpText="Sugere notas internas úteis sem inventar acessos ou combinados."
                                    buildContext={() => ({
                                        name: env.name,
                                        type: env.type,
                                        typeLabel: environmentTypeLabel,
                                        repoName: env.repoName || env.repoId,
                                        description: draftDescription,
                                        currentInternalNotes: draftInternalNotes,
                                        currentVersion: env.currentVersion || '',
                                        recentDeployments,
                                    })}
                                    relatedEntities={{
                                        environment: {
                                            id: env.id,
                                            name: env.name,
                                            type: env.type,
                                        },
                                        repository: {
                                            id: env.repoId,
                                            name: env.repoName || env.repoId,
                                        },
                                    }}
                                    constraints={{
                                        targetAudience: 'time-interno',
                                        mentionOnlyKnownFacts: true,
                                    }}
                                    onApply={(result) => setDraftInternalNotes(result.value || '')}
                                    buttonLabel="Reescrever notas"
                                    className="mt-2"
                                    disabled={isSavingInline}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {hasUnsyncedChanges && inlineSaveState !== 'saving' && (
                                    <div className="inline-flex items-center rounded-xl border border-amber-200/80 bg-amber-50/85 px-3 py-2 text-xs font-medium text-amber-700 shadow-sm shadow-amber-100/60 dark:border-amber-500/20 dark:bg-amber-500/[0.08] dark:text-amber-300 dark:shadow-none">
                                        Rascunho local
                                    </div>
                                )}
                                <div className="inline-flex items-center rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-500 shadow-sm shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:shadow-none">
                                    {inlineSaveState === 'saving' && (
                                        <span className="inline-flex items-center gap-2">
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            Salvando automaticamente...
                                        </span>
                                    )}
                                    {inlineSaveState === 'saved' && !isSavingInline && (
                                        <span>Salvo automaticamente</span>
                                    )}
                                    {inlineSaveState === 'error' && !isSavingInline && (
                                        <span className="text-red-600 dark:text-red-300">Falha no autosave</span>
                                    )}
                                    {inlineSaveState === 'idle' && !isSavingInline && (
                                        <span>Aguardando pausa para salvar</span>
                                    )}
                                </div>
                                {relativeSyncLabel && inlineSaveState !== 'saving' && inlineSaveState !== 'error' && (
                                    <div className="inline-flex items-center rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-700 shadow-sm shadow-emerald-100/60 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08] dark:text-emerald-300 dark:shadow-none">
                                        Ultima sincronizacao: {relativeSyncLabel}
                                    </div>
                                )}
                                <button
                                    onClick={handleInlineClose}
                                    disabled={isSavingInline}
                                    className="app-soft-button rounded-xl px-4 py-2.5 text-sm font-medium"
                                >
                                    <span className="inline-flex items-center gap-2"><X className="h-4 w-4" /> Fechar edição</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                    {onQuickSave && !isInlineEditing && (
                        <button
                            onClick={() => setIsInlineEditing(true)}
                            className="app-soft-button rounded-xl px-4 py-3 text-sm font-medium"
                        >
                            <span className="inline-flex items-center justify-center gap-2"><Pencil className="h-4 w-4" /> Editar descrição e notas</span>
                        </button>
                    )}
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="app-soft-button rounded-xl px-4 py-3 text-sm font-medium"
                        >
                            <span className="inline-flex items-center justify-center gap-2"><Pencil className="h-4 w-4" /> Editar ambiente</span>
                        </button>
                    )}
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
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
                    <AIFieldAssist
                        fieldType="deploy_notes"
                        variant="compact"
                        surface="environment_deploy"
                        intent={notes.trim() ? 'refine' : 'summarize'}
                        currentValue={notes}
                        helpText="Resume o que entrou na versão em linguagem clara para operação."
                        buildContext={() => ({
                            repoName,
                            version,
                            notes,
                        })}
                        relatedEntities={{
                            repository: { name: repoName },
                        }}
                        constraints={{
                            audience: 'operacao',
                            versionFormat: 'semver',
                        }}
                        onApply={(result) => setNotes(result.value || '')}
                        buttonLabel="Gerar notas"
                        className="mt-2"
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
    onCreate: (data: { name: string; type: 'dev' | 'stage' | 'prod'; repoId: string; description?: string; internalNotes?: string }) => Promise<void>;
    repositories: Repository[];
}> = ({ isOpen, onClose, onCreate, repositories }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'dev' | 'stage' | 'prod'>('dev');
    const [repoId, setRepoId] = useState('');
    const [description, setDescription] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setName('');
            setType('dev');
            setRepoId(repositories.length > 0 ? repositories[0].id : '');
            setDescription('');
            setInternalNotes('');
        }
    }, [isOpen, repositories]);

    if (!isOpen) return null;
    const selectedRepository = repositories.find((repo) => repo.id === repoId);
    const environmentTypeLabel = getEnvironmentTypeLabel(type);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoId) return;

        setLoading(true);
        await onCreate({ name, type, repoId, description, internalNotes });
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
                        Descrição do ambiente
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Explique o papel deste ambiente no fluxo de entrega, quem o usa e o tipo de validação esperado."
                        className="app-input h-24 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                    />
                    <AIFieldAssist
                        fieldType="environment_description"
                        variant="compact"
                        surface="environment_create"
                        intent={description.trim() ? 'refine' : 'generate'}
                        currentValue={description}
                        helpText="Gera uma descrição operacional clara para o novo ambiente."
                        buildContext={() => ({
                            name,
                            type,
                            typeLabel: environmentTypeLabel,
                            repoName: selectedRepository?.name || '',
                            currentDescription: description,
                        })}
                        relatedEntities={{
                            repository: selectedRepository ? { id: selectedRepository.id, name: selectedRepository.name, branch: selectedRepository.branch } : {},
                        }}
                        constraints={{
                            targetAudience: 'operacao',
                            riskLevel: getEnvironmentRiskHint(type),
                        }}
                        onApply={(result) => setDescription(result.value || '')}
                        buttonLabel="Gerar descrição"
                        className="mt-2"
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

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">
                        Notas internas
                    </label>
                    <textarea
                        value={internalNotes}
                        onChange={e => setInternalNotes(e.target.value)}
                        placeholder="Registre dependências, cuidados operacionais, acessos ou combinados relevantes para o time."
                        className="app-input h-24 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                    />
                    <AIFieldAssist
                        fieldType="internal_notes"
                        variant="compact"
                        surface="environment_create"
                        intent={internalNotes.trim() ? 'rewrite' : 'suggest'}
                        currentValue={internalNotes}
                        helpText="Sugere notas internas úteis com base no ambiente e no repositório."
                        buildContext={() => ({
                            name,
                            type,
                            typeLabel: environmentTypeLabel,
                            repoName: selectedRepository?.name || '',
                            description,
                            currentInternalNotes: internalNotes,
                        })}
                        relatedEntities={{
                            repository: selectedRepository ? { id: selectedRepository.id, name: selectedRepository.name } : {},
                        }}
                        constraints={{
                            mentionOnlyKnownFacts: true,
                        }}
                        onApply={(result) => setInternalNotes(result.value || '')}
                        buttonLabel="Gerar notas internas"
                        className="mt-2"
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

const EditEnvironmentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; type: 'dev' | 'stage' | 'prod'; description?: string; internalNotes?: string }) => Promise<void>;
    environment: EnvWithDeployments | null;
    repositories: Repository[];
}> = ({ isOpen, onClose, onSave, environment, repositories }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'dev' | 'stage' | 'prod'>('dev');
    const [description, setDescription] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !environment) return;
        setName(environment.name || '');
        setType(environment.type || 'dev');
        setDescription(environment.description || '');
        setInternalNotes(environment.internalNotes || '');
    }, [isOpen, environment]);

    if (!isOpen || !environment) return null;

    const repoName = repositories.find((repo) => repo.id === environment.repoId)?.name || environment.repoName || environment.repoId;
    const linkedRepository = repositories.find((repo) => repo.id === environment.repoId);
    const environmentTypeLabel = getEnvironmentTypeLabel(type);
    const recentDeployments = summarizeDeployments(environment.deployments);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onSave({ name, type, description, internalNotes });
        setLoading(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Ambiente (${environment.name})`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
                    <p className="app-section-label text-slate-500 dark:text-slate-400">Configuração contínua</p>
                    <p className="app-copy mt-2 text-slate-600 dark:text-slate-300">
                        Ajuste nome, tipo, descrição e notas internas sem perder o histórico de deploy do ambiente.
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Repositório vinculado: <span className="font-medium">{repoName}</span>
                    </p>
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">Nome do ambiente</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        className="app-input w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                    />
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">Descrição do ambiente</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Explique o papel deste ambiente no fluxo de entrega, quem o usa e o tipo de validação esperado."
                        className="app-input h-24 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                    />
                    <AIFieldAssist
                        fieldType="environment_description"
                        variant="compact"
                        surface="environment_edit"
                        intent={description.trim() ? 'rewrite' : 'generate'}
                        currentValue={description}
                        helpText="Reescreve a descrição do ambiente sem perder o histórico operacional."
                        buildContext={() => ({
                            name,
                            type,
                            typeLabel: environmentTypeLabel,
                            repoName,
                            currentDescription: description,
                            currentVersion: environment.currentVersion || '',
                            status: normalizeEnvironmentStatus(environment.status),
                        })}
                        relatedEntities={{
                            environment: {
                                id: environment.id,
                                name: environment.name,
                                type: environment.type,
                                currentVersion: environment.currentVersion || '',
                            },
                            repository: linkedRepository ? { id: linkedRepository.id, name: linkedRepository.name, branch: linkedRepository.branch } : { name: repoName },
                        }}
                        constraints={{
                            targetAudience: 'operacao',
                            riskLevel: getEnvironmentRiskHint(type),
                        }}
                        onApply={(result) => setDescription(result.value || '')}
                        buttonLabel="Reescrever descrição"
                        className="mt-2"
                    />
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">Tipo de ambiente</label>
                    <div className="grid grid-cols-3 gap-3">
                        {(['dev', 'stage', 'prod'] as const).map((itemType) => (
                            <div
                                key={itemType}
                                onClick={() => setType(itemType)}
                                className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${type === itemType
                                    ? 'border-primary-500 bg-blue-50/85 text-primary-600 shadow-sm shadow-blue-100/70 dark:bg-blue-900/20 dark:text-primary-300 dark:shadow-none'
                                    : 'border-slate-200/80 bg-slate-50/72 text-slate-600 hover:border-slate-300 hover:bg-slate-50/90 dark:border-slate-700 dark:bg-transparent dark:hover:border-slate-600'
                                    }`}
                            >
                                <div className="font-semibold capitalize text-sm">{itemType}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200/75 bg-white/82 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-transparent dark:shadow-none">
                    <label className="app-metric-label mb-2 block tracking-[0.16em]">Notas internas</label>
                    <textarea
                        value={internalNotes}
                        onChange={e => setInternalNotes(e.target.value)}
                        placeholder="Registre dependências, cuidados operacionais, acessos ou combinados relevantes para o time."
                        className="app-input h-24 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:text-white"
                    />
                    <AIFieldAssist
                        fieldType="internal_notes"
                        variant="compact"
                        surface="environment_edit"
                        intent={internalNotes.trim() ? 'rewrite' : 'suggest'}
                        currentValue={internalNotes}
                        helpText="Apoia a escrita de notas internas mais úteis para quem opera o ambiente."
                        buildContext={() => ({
                            name,
                            type,
                            typeLabel: environmentTypeLabel,
                            repoName,
                            description,
                            currentInternalNotes: internalNotes,
                            currentVersion: environment.currentVersion || '',
                            recentDeployments,
                        })}
                        relatedEntities={{
                            environment: {
                                id: environment.id,
                                name: environment.name,
                                type: environment.type,
                            },
                            repository: linkedRepository ? { id: linkedRepository.id, name: linkedRepository.name } : { name: repoName },
                        }}
                        constraints={{
                            mentionOnlyKnownFacts: true,
                            targetAudience: 'time-interno',
                        }}
                        onApply={(result) => setInternalNotes(result.value || '')}
                        buttonLabel="Reescrever notas internas"
                        className="mt-2"
                    />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={onClose} className="app-soft-button rounded-lg px-4 py-2">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                    >
                        {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                        Salvar ambiente
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const Environments: React.FC<EnvironmentsProps> = ({ repositories, addToast, onNavigateToGit, preferredRepoId = null, preferredEnvironmentId = null }) => {
    const { confirm } = useConfirm();
    const [environments, setEnvironments] = useState<EnvWithDeployments[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRepo, setSelectedRepo] = useState<string>('');
    const [deployModal, setDeployModal] = useState<{ isOpen: boolean; envId: string; repoName: string } | null>(null);
    const [isNewEnvModalOpen, setIsNewEnvModalOpen] = useState(false);
    const [editingEnvironment, setEditingEnvironment] = useState<EnvWithDeployments | null>(null);
    const [highlightedEnvironmentId, setHighlightedEnvironmentId] = useState<string | null>(null);

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

    useEffect(() => {
        if (!preferredRepoId) return;
        setSelectedRepo((current) => current === preferredRepoId ? current : preferredRepoId);
    }, [preferredRepoId]);

    useEffect(() => {
        if (!preferredEnvironmentId || loading) return;

        setHighlightedEnvironmentId(preferredEnvironmentId);

        const timeout = setTimeout(() => {
            const element = document.querySelector<HTMLElement>(`[data-environment-id="${preferredEnvironmentId}"]`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 180);

        const clearHighlight = setTimeout(() => {
            setHighlightedEnvironmentId((current) => current === preferredEnvironmentId ? null : current);
        }, 3200);

        return () => {
            clearTimeout(timeout);
            clearTimeout(clearHighlight);
        };
    }, [preferredEnvironmentId, loading, environments]);

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

    const handleCreateEnvironment = async (data: { name: string; type: 'dev' | 'stage' | 'prod'; repoId: string; description?: string; internalNotes?: string }) => {
        try {
            await api.createEnvironment(data);
            addToast('Ambiente Criado', 'success', `O ambiente "${data.name}" está pronto para uso.`);
            loadEnvironments();
        } catch (err: any) {
            addToast('Falha ao Criar Ambiente', 'error', err.message || 'Não foi possível criar o ambiente. Verifique os dados informados.');
        }
    };

    const handleUpdateEnvironment = async (data: { name: string; type: 'dev' | 'stage' | 'prod'; description?: string; internalNotes?: string }) => {
        if (!editingEnvironment) return;

        try {
            await api.updateEnvironment(editingEnvironment.id, data);
            addToast('Ambiente Atualizado', 'success', `As informações de "${data.name}" foram atualizadas.`);
            loadEnvironments();
        } catch (err: any) {
            addToast('Falha ao Atualizar Ambiente', 'error', err.message || 'Não foi possível atualizar o ambiente.');
        }
    };

    const handleQuickUpdateEnvironment = async (envId: string, updates: { description?: string; internalNotes?: string }) => {
        const environment = environments.find((item) => item.id === envId);
        if (!environment) return;

        try {
            await api.updateEnvironment(envId, updates);
            setEnvironments((prev) => prev.map((item) => item.id === envId ? { ...item, ...updates } : item));
            addToast('Texto do Ambiente Atualizado', 'success', `Descrição e notas de "${environment.name}" foram salvas.`);
            await loadEnvironments();
        } catch (err: any) {
            addToast('Falha ao Salvar Texto', 'error', err.message || 'Não foi possível salvar descrição e notas internas.');
            throw err;
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
                        <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/45 text-center dark:border-white/10 dark:bg-white/[0.02]">
                            <div className="max-w-md px-6">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                                    <RefreshCw className="h-6 w-6 animate-spin text-primary-500" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Sincronizando ambientes</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                                    Carregando histórico de deploy, estados operacionais e vínculos com repositórios.
                                </p>
                            </div>
                        </div>
                    ) : Object.keys(envsByRepo).length === 0 ? (
                        <div className="surface-empty rounded-2xl px-6 py-16 text-center">
                            <Cloud className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-600" />
                            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Nenhum ambiente configurado</h3>
                            <p className="mx-auto mb-4 max-w-md text-sm leading-6 text-slate-500 dark:text-[var(--text-muted)]">
                                Comece mapeando dev, stage e prod para transformar deploy, rollback e histórico operacional em um fluxo visível dentro do workspace.
                            </p>
                            <button
                                onClick={() => setIsNewEnvModalOpen(true)}
                                className="mx-auto inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-900/15 transition-colors hover:bg-primary-700"
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
                                                        onEdit={() => setEditingEnvironment(env)}
                                                        onQuickSave={handleQuickUpdateEnvironment}
                                                        highlighted={highlightedEnvironmentId === env.id}
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
            <EditEnvironmentModal
                isOpen={Boolean(editingEnvironment)}
                onClose={() => setEditingEnvironment(null)}
                onSave={handleUpdateEnvironment}
                environment={editingEnvironment}
                repositories={repositories}
            />
        </div>
    );
};

export default Environments;

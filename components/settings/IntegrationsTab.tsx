import React, { useState, useEffect, useCallback } from 'react';
import { Globe, CheckCircle2, LogOut, RefreshCw, Zap } from 'lucide-react';
import { ClickUpTool, McpAuditItem, Integration, getErrorMessage } from '../../types';
import Modal from '../Modal';
import { useConfirm } from '../../contexts/ConfirmContext';
import { api } from '../../services/api';

const clickUpSyncDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const formatClickUpSyncTime = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return clickUpSyncDateFormatter.format(parsed);
};

interface IntegrationsTabProps {
  addToast?: (title: string, type: 'success' | 'error' | 'info', desc?: string) => void;
  onIntegrationsCountChange?: (count: number) => void;
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({ addToast, onIntegrationsCountChange }) => {
  const { confirm } = useConfirm();

  const [gitlabConfig, setGitlabConfig] = useState({ connected: false, token: '', username: '', gitlabUrl: '' });
  const [clickupConfig, setClickupConfig] = useState({
    connected: false,
    workspaceId: '',
    listId: '',
    mcpConnected: false,
    mcpWorkspaceId: '',
    lastSyncUsedWorkspaceFallback: false,
    lastSyncAt: '',
  });

  const [activeModal, setActiveModal] = useState<'gitlab' | 'clickup' | null>(null);
  const [gitlabForm, setGitlabForm] = useState({ token: '', username: '', gitlabUrl: '' });
  const [clickupForm, setClickupForm] = useState({ apiToken: '', workspaceId: '', listId: '', mcpAccessToken: '', mcpWorkspaceId: '' });

  const [clickupTools, setClickupTools] = useState<ClickUpTool[]>([]);
  const [clickupToolsSource, setClickupToolsSource] = useState<'runtime' | 'catalog' | 'catalog-fallback'>('catalog');
  const [isLoadingClickupTools, setIsLoadingClickupTools] = useState(false);
  const [toolToExecute, setToolToExecute] = useState('get_workspace_hierarchy');
  const [toolArgsJson, setToolArgsJson] = useState('{\n  "workspace_id": ""\n}');
  const [toolDryRun, setToolDryRun] = useState(true);
  const [toolExecutionResult, setToolExecutionResult] = useState('');
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const [mcpAuditItems, setMcpAuditItems] = useState<McpAuditItem[]>([]);
  const [isLoadingMcpAudit, setIsLoadingMcpAudit] = useState(false);

  // Load integrations on mount
  useEffect(() => {
    api.getIntegrations()
      .then(data => {
        const gitlab = data.find((i: Integration) => i.provider === 'gitlab');
        if (gitlab) {
          setGitlabConfig({
            connected: true,
            token: '********',
            username: gitlab.meta.username,
            gitlabUrl: gitlab.meta.gitlabUrl || 'https://gitlab.com'
          });
        }

        const clickup = data.find((i: Integration) => i.provider === 'clickup');
        const clickupMcp = data.find((i: Integration) => i.provider === 'clickup_mcp');
        if (clickup) {
          setClickupConfig({
            connected: true,
            workspaceId: clickup.meta.workspaceId || '',
            listId: clickup.meta.listId || '',
            mcpConnected: Boolean(clickupMcp),
            mcpWorkspaceId: clickup.meta.mcpWorkspaceId || clickup.meta.workspaceId || '',
            lastSyncUsedWorkspaceFallback: Boolean(clickup.meta.lastSyncUsedWorkspaceFallback),
            lastSyncAt: clickup.meta.lastSyncAt || '',
          });
        }
      })
      .catch(err => console.error('Failed to load integrations', err));
  }, []);

  // Report count changes
  useEffect(() => {
    onIntegrationsCountChange?.(Number(gitlabConfig.connected) + Number(clickupConfig.connected));
  }, [gitlabConfig.connected, clickupConfig.connected, onIntegrationsCountChange]);

  // Load ClickUp tools & audit when connected
  useEffect(() => {
    if (!clickupConfig.connected) return;
    loadClickUpTools();
    loadClickUpMcpAudit();
  }, [clickupConfig.connected]);

  const loadClickUpTools = useCallback(async () => {
    setIsLoadingClickupTools(true);
    try {
      const result = await api.getClickUpTools();
      setClickupTools(Array.isArray(result.tools) ? result.tools : []);
      setClickupToolsSource((result.source as 'runtime' | 'catalog' | 'catalog-fallback') || 'catalog');
    } catch (e: unknown) {
      addToast?.('Falha ao Carregar Tools MCP', 'error', getErrorMessage(e));
    } finally {
      setIsLoadingClickupTools(false);
    }
  }, [addToast]);

  const loadClickUpMcpAudit = useCallback(async () => {
    setIsLoadingMcpAudit(true);
    try {
      const result = await api.getClickUpMcpAudit(30);
      setMcpAuditItems(Array.isArray(result.items) ? result.items : []);
    } catch (e: unknown) {
      addToast?.('Falha ao Carregar Auditoria', 'error', getErrorMessage(e));
    } finally {
      setIsLoadingMcpAudit(false);
    }
  }, [addToast]);

  const handleRefreshClickUpMcpStatus = useCallback(async () => {
    try {
      const status = await api.getClickUpStatus();
      setClickupConfig(prev => ({
        ...prev,
        connected: status.connected,
        mcpConnected: status.mcpConnected && status.mcpHealthy,
        workspaceId: status.workspaceId || prev.workspaceId,
        listId: status.listId || prev.listId,
        mcpWorkspaceId: status.mcpWorkspaceId || prev.mcpWorkspaceId,
        lastSyncUsedWorkspaceFallback: Boolean(status.lastSyncUsedWorkspaceFallback),
        lastSyncAt: status.lastSyncAt || prev.lastSyncAt,
      }));
      if (status.mcpConnected && status.mcpHealthy) {
        addToast?.('Status Atualizado', 'success', 'ClickUp MCP validado com sucesso.');
      } else {
        addToast?.('Status Atualizado', 'info', status.mcpError || 'MCP não está conectado.');
      }
    } catch (e: unknown) {
      addToast?.('Falha ao Atualizar Status', 'error', getErrorMessage(e));
    }
  }, [addToast]);

  const handleSyncGitlab = useCallback(async () => {
    try {
      addToast?.('Sincronizando GitLab...', 'info', 'Buscando repositórios e dados remotos.');
      const data = await api.syncGitlab();
      addToast?.('GitLab Sincronizado', 'success', data.message || 'Dados atualizados com sucesso.');
    } catch (e: unknown) {
      addToast?.('Falha na Sincronização', 'error', getErrorMessage(e));
    }
  }, [addToast]);

  const handleConnectGitlab = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gitlabForm.token || !gitlabForm.username) {
      addToast?.('Campos Obrigatórios', 'error', 'Informe o Personal Access Token e o nome de usuário do GitLab.');
      return;
    }
    try {
      const data = await api.connectGitlab(gitlabForm);
      setGitlabConfig({ connected: true, ...gitlabForm });
      setActiveModal(null);
      addToast?.('GitLab Conectado', 'success', `Conta @${data.user} vinculada com sucesso.`);
      setGitlabForm({ token: '', username: '', gitlabUrl: '' });
    } catch (e: unknown) {
      addToast?.('Falha na Conexão GitLab', 'error', getErrorMessage(e));
    }
  }, [gitlabForm, addToast]);

  const handleDisconnectGitlab = useCallback(async () => {
    if (!await confirm({ title: 'Desconectar GitLab', message: 'Tem certeza que deseja desconectar o GitLab?', confirmText: 'Desconectar', variant: 'warning' })) return;
    try {
      await api.disconnectGitlab();
      setGitlabConfig({ connected: false, token: '', username: '', gitlabUrl: '' });
      addToast?.('GitLab Desconectado', 'info', 'A integração com o GitLab foi removida.');
    } catch (e: unknown) {
      addToast?.('Falha ao Desconectar', 'error', getErrorMessage(e));
    }
  }, [confirm, addToast]);

  const handleSyncClickUp = useCallback(async () => {
    try {
      addToast?.('Sincronizando ClickUp...', 'info', 'Importando tarefas via API v3.');
      const data = await api.syncClickUp();
      setClickupConfig(prev => ({
        ...prev,
        lastSyncUsedWorkspaceFallback: Boolean(data.usedWorkspaceFallback),
        lastSyncAt: data.syncedAt || new Date().toISOString(),
      }));
      addToast?.('ClickUp Sincronizado', 'success', data.message || 'Dados importados com sucesso.');
    } catch (e: unknown) {
      addToast?.('Falha na Sincronização', 'error', getErrorMessage(e));
    }
  }, [addToast]);

  const handleConnectClickUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickupForm.apiToken || !clickupForm.workspaceId) {
      addToast?.('Campos Obrigatórios', 'error', 'Informe o API Token e o Workspace ID do ClickUp.');
      return;
    }
    try {
      const result = await api.connectClickUp(clickupForm);
      const attemptedMcp = Boolean(clickupForm.mcpAccessToken?.trim());
      setClickupConfig({
        connected: true,
        workspaceId: clickupForm.workspaceId,
        listId: clickupForm.listId,
        mcpConnected: Boolean(result.mcpConnected),
        mcpWorkspaceId: clickupForm.mcpWorkspaceId || clickupForm.workspaceId,
        lastSyncUsedWorkspaceFallback: false,
        lastSyncAt: '',
      });
      setActiveModal(null);
      if (attemptedMcp && !result.mcpConnected) {
        addToast?.('ClickUp API Conectada', 'info', result.mcpError || 'API conectou, mas o MCP não validou.');
      } else if (attemptedMcp && result.mcpConnected) {
        addToast?.('ClickUp Conectado', 'success', 'Integração com API v3 e MCP configurada.');
      } else {
        addToast?.('ClickUp API Conectada', 'success', 'API v3 conectada com sucesso.');
      }
      setClickupForm({ apiToken: '', workspaceId: '', listId: '', mcpAccessToken: '', mcpWorkspaceId: '' });
    } catch (e: unknown) {
      addToast?.('Falha na Conexão ClickUp', 'error', getErrorMessage(e));
    }
  }, [clickupForm, addToast]);

  const handleDisconnectClickUp = useCallback(async () => {
    if (!await confirm({ title: 'Desconectar ClickUp', message: 'Desconectar integração com ClickUp API v3 e MCP?', confirmText: 'Desconectar', variant: 'warning' })) return;
    try {
      await api.disconnectClickUp();
      setClickupConfig({
        connected: false, workspaceId: '', listId: '',
        mcpConnected: false, mcpWorkspaceId: '',
        lastSyncUsedWorkspaceFallback: false, lastSyncAt: '',
      });
      addToast?.('ClickUp Desconectado', 'info', 'A integração com o ClickUp foi removida.');
    } catch (e: unknown) {
      addToast?.('Falha ao Desconectar', 'error', getErrorMessage(e));
    }
  }, [confirm, addToast]);

  const handleConnectClickUpMcpOAuth = useCallback(async () => {
    try {
      const result = await api.startClickUpMcpOAuth(clickupConfig.workspaceId || clickupForm.workspaceId || undefined);
      const popup = globalThis.open(result.authorizeUrl, 'clickup-mcp-oauth', 'width=640,height=760');
      if (!popup) {
        addToast?.('Popup Bloqueado', 'error', 'Habilite popups para concluir o OAuth do ClickUp MCP.');
        return;
      }
      addToast?.('OAuth Iniciado', 'info', 'Finalize a autorização na janela do ClickUp.');

      const interval = globalThis.setInterval(async () => {
        if (!popup || popup.closed) {
          globalThis.clearInterval(interval);
          await handleRefreshClickUpMcpStatus();
          await loadClickUpTools();
          await loadClickUpMcpAudit();
        }
      }, 1500);
    } catch (e: unknown) {
      addToast?.('Falha no OAuth', 'error', getErrorMessage(e));
    }
  }, [clickupConfig.workspaceId, clickupForm.workspaceId, addToast, handleRefreshClickUpMcpStatus, loadClickUpTools, loadClickUpMcpAudit]);

  const handleExecuteMcpTool = useCallback(async () => {
    if (!toolToExecute) {
      addToast?.('Tool Obrigatória', 'error', 'Selecione uma tool para executar.');
      return;
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = toolArgsJson.trim() ? JSON.parse(toolArgsJson) : {};
    } catch {
      addToast?.('JSON Inválido', 'error', 'Os argumentos da tool precisam estar em JSON válido.');
      return;
    }

    setIsExecutingTool(true);
    try {
      const result = await api.executeClickUpMcpTool({
        toolName: toolToExecute,
        arguments: parsedArgs,
        dryRun: toolDryRun,
      });
      setToolExecutionResult(JSON.stringify(result, null, 2));
      addToast?.('Tool MCP Executada', 'success', toolDryRun ? 'Dry-run executado com sucesso.' : 'Execução concluída.');
      await loadClickUpMcpAudit();
    } catch (e: unknown) {
      setToolExecutionResult(JSON.stringify({ error: getErrorMessage(e) }, null, 2));
      addToast?.('Falha ao Executar Tool', 'error', getErrorMessage(e));
      await loadClickUpMcpAudit();
    } finally {
      setIsExecutingTool(false);
    }
  }, [toolToExecute, toolArgsJson, toolDryRun, addToast, loadClickUpMcpAudit]);

  return (
    <>
      <div className="panel-stack pb-6">
        {/* GITLAB */}
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/75 bg-slate-50/72 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] xl:flex-row xl:items-center xl:justify-between dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
          <div className="flex items-center gap-5">
            <div className={`p-4 rounded-full ${gitlabConfig.connected ? 'bg-orange-600 text-white' : 'bg-orange-50 dark:bg-slate-800'}`}>
              <svg className={`w-8 h-8 ${!gitlabConfig.connected ? 'text-orange-600' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">GitLab</h4>
                {gitlabConfig.connected && (
                  <span className="text-xs flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Conectado como {gitlabConfig.username}
                  </span>
                )}
              </div>
              <p className="text-sm text-fiori-textSecondary dark:text-slate-400">Sincronização de issues e merge requests com GitLab</p>
              {gitlabConfig.connected && gitlabConfig.gitlabUrl && (
                <p className="text-xs text-slate-400 mt-1">{gitlabConfig.gitlabUrl}</p>
              )}
            </div>
          </div>
          {gitlabConfig.connected ? (
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button onClick={handleSyncGitlab} className="app-button-secondary">
                <RefreshCw className="w-4 h-4" /> Sincronizar
              </button>
              <button onClick={handleDisconnectGitlab} className="app-button-danger">
                <LogOut className="w-4 h-4" /> Desconectar
              </button>
            </div>
          ) : (
            <button onClick={() => setActiveModal('gitlab')} className="app-button-secondary">Configurar</button>
          )}
        </div>

        {/* CLICKUP */}
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200/75 bg-slate-50/72 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] xl:flex-row xl:items-center xl:justify-between dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
          <div className="flex items-center gap-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${clickupConfig.connected ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300'}`}>
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-semibold text-fiori-textPrimary dark:text-white">ClickUp (API v3 + MCP)</h4>
                {clickupConfig.connected && (
                  <span className="text-xs flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Workspace {clickupConfig.workspaceId}
                  </span>
                )}
              </div>
              <p className="text-sm text-fiori-textSecondary dark:text-slate-400">
                {clickupConfig.connected
                  ? `Escopo: ${clickupConfig.listId || 'workspace completo'} • MCP: ${clickupConfig.mcpConnected ? 'ativo' : 'inativo'}`
                  : 'Integração completa com ClickUp API v3 para sync de tarefas e ClickUp MCP para execução de tools.'}
              </p>
              {clickupConfig.connected && clickupConfig.lastSyncAt && (
                <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${clickupConfig.lastSyncUsedWorkspaceFallback ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/[0.1] dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/[0.1] dark:text-emerald-300'}`}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {clickupConfig.lastSyncUsedWorkspaceFallback
                    ? `Última sync via fallback do workspace em ${formatClickUpSyncTime(clickupConfig.lastSyncAt)}`
                    : `Última sync direta do escopo em ${formatClickUpSyncTime(clickupConfig.lastSyncAt)}`}
                </div>
              )}
            </div>
          </div>
          {clickupConfig.connected ? (
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button onClick={handleSyncClickUp} className="app-button-secondary">
                <RefreshCw className="w-4 h-4" /> Sincronizar
              </button>
              <button onClick={handleRefreshClickUpMcpStatus} className="app-button-secondary text-indigo-600 dark:text-indigo-300">
                <Globe className="w-4 h-4" /> Validar MCP
              </button>
              <button onClick={handleDisconnectClickUp} className="app-button-danger">
                <LogOut className="w-4 h-4" /> Desconectar
              </button>
            </div>
          ) : (
            <button onClick={() => setActiveModal('clickup')} className="app-button-primary">Conectar</button>
          )}
        </div>

        {clickupConfig.connected && (
          <div className="space-y-6">
            {/* MCP Tool Catalog */}
            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Catálogo de Tools MCP</h5>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Fonte: {clickupToolsSource}</span>
                  <button onClick={loadClickUpTools} className="app-button-secondary min-h-0 px-3 py-1.5 text-xs">Atualizar</button>
                </div>
              </div>
              {isLoadingClickupTools ? (
                <p className="text-sm text-slate-500">Carregando tools MCP...</p>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
                  {clickupTools.length === 0 ? (
                    <div className="app-empty-state rounded-none border-0">
                      <strong className="text-sm">Nenhuma tool disponível</strong>
                      <p className="text-sm">Valide o MCP para carregar o catálogo operacional.</p>
                    </div>
                  ) : (
                    clickupTools.map((tool: ClickUpTool, idx: number) => (
                      <div key={`${tool.name}-${idx}`} className="px-3 py-2 text-xs border-b border-slate-100 dark:border-slate-800 last:border-b-0 flex items-center justify-between gap-3">
                        <span className="font-mono text-slate-700 dark:text-slate-300">{tool.name}</span>
                        <span className="text-slate-400">runtime</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* MCP Console */}
            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Console Assistido MCP</h5>
                <div className="flex items-center gap-2">
                  <button onClick={handleConnectClickUpMcpOAuth} className="app-button-secondary min-h-0 px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-300">Conectar OAuth PKCE</button>
                  <button onClick={handleRefreshClickUpMcpStatus} className="app-button-secondary min-h-0 px-3 py-1.5 text-xs">Status</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Tool</label>
                  <select value={toolToExecute} onChange={(e) => setToolToExecute(e.target.value)} className="app-input w-full rounded-xl px-3 py-2 text-sm">
                    {(clickupTools.length > 0 ? clickupTools : [{ name: 'get_workspace_hierarchy' }]).map((tool: ClickUpTool, idx: number) => (
                      <option key={`${tool.name}-${idx}`} value={tool.name}>{tool.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={toolDryRun} onChange={(e) => setToolDryRun(e.target.checked)} />
                    Dry-run
                  </label>
                </div>
              </div>

              <label className="text-xs text-slate-500 mb-1 block">Arguments (JSON)</label>
              <textarea value={toolArgsJson} onChange={(e) => setToolArgsJson(e.target.value)} rows={7} className="app-input mb-3 w-full rounded-xl px-3 py-2 text-xs font-mono" />

              <div className="flex items-center justify-between gap-3">
                <button onClick={handleExecuteMcpTool} disabled={isExecutingTool} className="app-button-primary disabled:opacity-50 disabled:shadow-none">
                  {isExecutingTool ? 'Executando...' : 'Executar Tool'}
                </button>
                <span className="text-xs text-slate-500">Workspace MCP: {clickupConfig.mcpWorkspaceId || clickupConfig.workspaceId || 'n/d'}</span>
              </div>

              {toolExecutionResult && (
                <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/70">{toolExecutionResult}</pre>
              )}
            </div>

            {/* MCP Audit */}
            <div className="rounded-2xl border border-slate-200/75 bg-slate-50/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Auditoria MCP</h5>
                <button onClick={loadClickUpMcpAudit} className="app-button-secondary min-h-0 px-3 py-1.5 text-xs">Atualizar</button>
              </div>
              {isLoadingMcpAudit ? (
                <p className="text-sm text-slate-500">Carregando trilha de auditoria...</p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {mcpAuditItems.length === 0 ? (
                    <div className="app-empty-state">
                      <strong className="text-sm">Sem eventos de auditoria MCP</strong>
                      <p className="text-sm">As execuções realizadas por esta conexão aparecerão aqui.</p>
                    </div>
                  ) : (
                    mcpAuditItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-mono text-slate-700 dark:text-slate-200">{item.toolName || item.actionType}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>{item.status}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.createdAt} • workspace {item.workspaceId || 'n/d'}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.responseSummary || '-'}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!clickupConfig.connected && (
          <div className="app-empty-state mt-4">
            <strong className="text-sm">Ferramentas MCP indisponíveis</strong>
            <p className="text-sm">Conecte o ClickUp para habilitar catálogo MCP, console assistido e trilha de auditoria.</p>
          </div>
        )}
      </div>

      {/* GitLab Configuration Modal */}
      <Modal isOpen={activeModal === 'gitlab'} onClose={() => setActiveModal(null)} title="Configurar GitLab" size="md">
        <form onSubmit={handleConnectGitlab} className="space-y-4">
          <div className="rounded-2xl border border-orange-200/70 bg-orange-50/80 p-4 text-sm text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">
            Crie um Personal Access Token (PAT) no GitLab com escopo <code>api</code> ou <code>read_api</code> para permitir a integração.
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">URL do GitLab <span className="text-slate-400">(opcional)</span></label>
            <input
              type="text"
              value={gitlabForm.gitlabUrl}
              onChange={(e) => setGitlabForm({ ...gitlabForm, gitlabUrl: e.target.value })}
              placeholder="https://gitlab.com (padrão)"
              className="app-input w-full rounded-xl px-3 py-2.5"
            />
            <p className="text-xs text-slate-400">Deixe em branco para usar gitlab.com ou insira a URL do seu GitLab self-hosted.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">GitLab Username</label>
            <input
              type="text"
              value={gitlabForm.username}
              onChange={(e) => setGitlabForm({ ...gitlabForm, username: e.target.value })}
              className="app-input w-full rounded-xl px-3 py-2.5"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Personal Access Token</label>
            <input
              type="password"
              value={gitlabForm.token}
              onChange={(e) => setGitlabForm({ ...gitlabForm, token: e.target.value })}
              className="app-input w-full rounded-xl px-3 py-2.5"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActiveModal(null)} className="app-button-secondary">Cancelar</button>
            <button type="submit" className="app-button-primary">Conectar GitLab</button>
          </div>
        </form>
      </Modal>

      {/* ClickUp Configuration Modal */}
      <Modal isOpen={activeModal === 'clickup'} onClose={() => setActiveModal(null)} title="Conectar ClickUp" size="md">
        <form onSubmit={handleConnectClickUp} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">API Token (v3)</label>
            <input
              type="password"
              value={clickupForm.apiToken}
              onChange={(e) => setClickupForm({ ...clickupForm, apiToken: e.target.value })}
              className="app-input w-full rounded-xl px-3 py-2.5"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Workspace ID</label>
            <input
              type="text"
              value={clickupForm.workspaceId}
              onChange={(e) => setClickupForm({ ...clickupForm, workspaceId: e.target.value })}
              className="app-input w-full rounded-xl px-3 py-2.5"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">List ID <span className="text-slate-400">(opcional)</span></label>
            <input
              type="text"
              value={clickupForm.listId}
              onChange={(e) => setClickupForm({ ...clickupForm, listId: e.target.value })}
              className="app-input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">MCP Access Token <span className="text-slate-400">(opcional)</span></label>
            <input
              type="password"
              value={clickupForm.mcpAccessToken}
              onChange={(e) => setClickupForm({ ...clickupForm, mcpAccessToken: e.target.value })}
              className="app-input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">MCP Workspace ID <span className="text-slate-400">(opcional)</span></label>
            <input
              type="text"
              value={clickupForm.mcpWorkspaceId}
              onChange={(e) => setClickupForm({ ...clickupForm, mcpWorkspaceId: e.target.value })}
              className="app-input w-full rounded-xl px-3 py-2.5"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActiveModal(null)} className="app-button-secondary">Cancelar</button>
            <button type="submit" className="app-button-primary">Conectar ClickUp</button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default IntegrationsTab;

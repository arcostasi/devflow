
import express from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../crypto.js';

const router = express.Router();
const CLICKUP_API_BASE = 'https://api.clickup.com';
const CLICKUP_MCP_ENDPOINT = 'https://mcp.clickup.com/mcp';
const CLICKUP_MCP_OAUTH_AUTHORIZE_URL = process.env.CLICKUP_MCP_OAUTH_AUTHORIZE_URL || 'https://app.clickup.com/api';
const CLICKUP_MCP_OAUTH_TOKEN_URL = process.env.CLICKUP_MCP_OAUTH_TOKEN_URL || 'https://api.clickup.com/api/v2/oauth/token';

const CLICKUP_MCP_TOOL_CATALOG = [
    { name: 'search_workspace', mode: 'read', category: 'search' },
    { name: 'create_task', mode: 'write', category: 'task' },
    { name: 'get_task', mode: 'read', category: 'task' },
    { name: 'update_task', mode: 'write', category: 'task' },
    { name: 'create_bulk_tasks', mode: 'write', category: 'task' },
    { name: 'update_bulk_tasks', mode: 'write', category: 'task' },
    { name: 'delete_task', mode: 'sensitive', category: 'task' },
    { name: 'attach_file_to_task', mode: 'write', category: 'task' },
    { name: 'add_tag_to_task', mode: 'write', category: 'task' },
    { name: 'remove_tag_from_task', mode: 'write', category: 'task' },
    { name: 'get_task_comments', mode: 'read', category: 'comments' },
    { name: 'get_threaded_replies', mode: 'read', category: 'comments' },
    { name: 'create_task_comment', mode: 'write', category: 'comments' },
    { name: 'add_task_link', mode: 'write', category: 'relationships' },
    { name: 'remove_task_link', mode: 'write', category: 'relationships' },
    { name: 'add_dependency', mode: 'write', category: 'relationships' },
    { name: 'remove_dependency', mode: 'write', category: 'relationships' },
    { name: 'get_task_time_entries', mode: 'read', category: 'time' },
    { name: 'start_time_tracking', mode: 'write', category: 'time' },
    { name: 'stop_time_tracking', mode: 'write', category: 'time' },
    { name: 'add_time_entry', mode: 'write', category: 'time' },
    { name: 'get_current_time_entry', mode: 'read', category: 'time' },
    { name: 'get_workspace_hierarchy', mode: 'read', category: 'workspace' },
    { name: 'create_list', mode: 'write', category: 'workspace' },
    { name: 'create_list_in_folder', mode: 'write', category: 'workspace' },
    { name: 'get_list', mode: 'read', category: 'workspace' },
    { name: 'update_list', mode: 'write', category: 'workspace' },
    { name: 'get_folder', mode: 'read', category: 'workspace' },
    { name: 'create_folder', mode: 'write', category: 'workspace' },
    { name: 'update_folder', mode: 'write', category: 'workspace' },
    { name: 'get_workspace_members', mode: 'read', category: 'members' },
    { name: 'find_member_by_name', mode: 'read', category: 'members' },
    { name: 'resolve_assignees', mode: 'read', category: 'members' },
    { name: 'get_chat_channels', mode: 'read', category: 'chat' },
    { name: 'send_chat_message', mode: 'write', category: 'chat' },
    { name: 'create_document', mode: 'write', category: 'docs' },
    { name: 'list_document_pages', mode: 'read', category: 'docs' },
    { name: 'get_document_pages', mode: 'read', category: 'docs' },
    { name: 'create_document_page', mode: 'write', category: 'docs' },
    { name: 'update_document_page', mode: 'write', category: 'docs' },
];

const withClickUpAuthorization = (token) => {
    const trimmed = token?.trim() || '';
    if (!trimmed) return '';
    if (trimmed.toLowerCase().startsWith('bearer ')) return trimmed;
    return `Bearer ${trimmed}`;
};

const getClickUpAuthCandidates = (token) => {
    const trimmed = token?.trim() || '';
    if (!trimmed) return [];
    const bearer = withClickUpAuthorization(trimmed);
    if (bearer === trimmed) return [trimmed];
    return [bearer, trimmed];
};

const fetchClickUpWithAuthFallback = async (url, token) => {
    const authCandidates = getClickUpAuthCandidates(token);
    let lastResponse = null;

    for (const auth of authCandidates) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': auth,
            }
        });

        lastResponse = response;
        // Stop early on success or non-auth errors.
        if (response.ok || (response.status !== 401 && response.status !== 403)) {
            break;
        }
    }

    return lastResponse;
};

const fetchClickUpJsonWithAuthFallback = async (url, token) => {
    const authCandidates = getClickUpAuthCandidates(token);
    let last = { ok: false, status: 500, payload: {}, detail: 'Falha ao chamar API do ClickUp.' };

    for (const auth of authCandidates) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': auth,
            }
        });

        const rawText = await response.text();
        let payload = {};
        if (rawText) {
            try {
                payload = JSON.parse(rawText);
            } catch {
                payload = {};
            }
        }

        const detail = payload?.error || payload?.message || rawText || `HTTP ${response.status}`;
        last = { ok: response.ok, status: response.status, payload, detail };

        if (response.ok || (response.status !== 401 && response.status !== 403)) {
            return last;
        }
    }

    return last;
};

const validateClickUpWorkspaceAccess = async ({ token, workspaceId }) => {
    const probes = [
        `${CLICKUP_API_BASE}/api/v3/workspaces/${workspaceId}`,
        `${CLICKUP_API_BASE}/api/v2/team/${workspaceId}`,
    ];

    let lastStatus = 500;
    for (const url of probes) {
        const response = await fetchClickUpWithAuthFallback(url, token);
        if (!response) continue;
        lastStatus = response.status;
        if (response.ok) {
            return { ok: true, status: response.status };
        }
        if (response.status === 401 || response.status === 403 || response.status === 404) {
            continue;
        }
    }

    return { ok: false, status: lastStatus };
};

const parseTaskDescription = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        if (typeof value.text_content === 'string') return value.text_content;
        if (typeof value.content === 'string') return value.content;
    }
    return '';
};

const mapClickUpPriority = (priority) => {
    const normalized = String(priority || '').toLowerCase();
    if (['urgent', 'high', 'highest'].includes(normalized)) return 'high';
    if (['low', 'lowest'].includes(normalized)) return 'low';
    return 'medium';
};

const parseClickUpTaskArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.tasks)) return payload.tasks;
    if (Array.isArray(payload?.data?.tasks)) return payload.data.tasks;
    return [];
};

const getClickUpTaskScopeIds = (task) => {
    return [
        task?.list?.id,
        task?.project?.id,
        task?.folder?.id,
        task?.space?.id,
        task?.list_id,
        task?.project_id,
        task?.folder_id,
        task?.space_id,
    ]
        .filter(Boolean)
        .map((value) => String(value));
};

const filterClickUpTasksByScope = (tasks, scopeId) => {
    const normalizedScopeId = String(scopeId || '').trim();
    if (!normalizedScopeId) return tasks;
    return tasks.filter((task) => getClickUpTaskScopeIds(task).includes(normalizedScopeId));
};

const fetchAllClickUpTasks = async ({ endpoint, token, maxPages = 20 }) => {
    const collected = [];
    let page = 0;
    let lastResult = null;

    while (page < maxPages) {
        const url = new URL(endpoint);
        if (!url.searchParams.has('page')) {
            url.searchParams.set('page', String(page));
        } else {
            url.searchParams.set('page', String(page));
        }

        const result = await fetchClickUpJsonWithAuthFallback(url.toString(), token);
        lastResult = result;

        if (!result.ok) {
            return {
                ok: false,
                status: result.status,
                detail: result.detail,
                payload: result.payload,
                tasks: collected,
            };
        }

        const pageTasks = parseClickUpTaskArray(result.payload);
        collected.push(...pageTasks);

        const isLastPage = result.payload?.last_page === true || pageTasks.length === 0;
        if (isLastPage) {
            return {
                ok: true,
                status: result.status,
                detail: result.detail,
                payload: result.payload,
                tasks: collected,
            };
        }

        page += 1;
    }

    return {
        ok: true,
        status: lastResult?.status || 200,
        detail: lastResult?.detail || '',
        payload: lastResult?.payload || {},
        tasks: collected,
    };
};

const callClickUpMcp = async ({ token, method, params }) => {
    const rpcId = `rpc-${Date.now()}`;
    const authCandidates = getClickUpAuthCandidates(token);
    let lastError = null;

    for (const auth of authCandidates) {
        const response = await fetch(CLICKUP_MCP_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'Authorization': auth,
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: rpcId, method, params })
        });

        const rawText = await response.text();
        let result = {};
        if (rawText) {
            try {
                result = JSON.parse(rawText);
            } catch {
                result = {};
            }
        }

        if (response.ok && !result?.error) {
            return result?.result ?? result;
        }

        const message = result?.error?.message || result?.message || rawText || 'Falha ao executar chamada MCP no ClickUp.';
        lastError = new Error(`MCP ${method} falhou (HTTP ${response.status}): ${message}`);

        // Retry only if this could be an auth header format issue.
        if (response.status !== 401 && response.status !== 403) {
            break;
        }
    }

    throw lastError || new Error('Falha ao executar chamada MCP no ClickUp.');
};

const redactPayload = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
        if (value.length > 400) return `${value.slice(0, 400)}...`;
        return value;
    }
    if (Array.isArray(value)) return value.map((item) => redactPayload(item));
    if (typeof value !== 'object') return value;

    const SENSITIVE_KEYS = ['token', 'access_token', 'refresh_token', 'authorization', 'password', 'secret'];
    const output = {};
    for (const [key, val] of Object.entries(value)) {
        if (SENSITIVE_KEYS.includes(String(key).toLowerCase())) {
            output[key] = '[redacted]';
        } else {
            output[key] = redactPayload(val);
        }
    }
    return output;
};

const writeMcpAudit = ({ userId, actionType, toolName, workspaceId, requestPayload, responseSummary, status }) => {
    const id = `mcp-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
        INSERT INTO mcp_audit (id, userId, provider, actionType, toolName, workspaceId, requestPayloadRedacted, responseSummary, status, createdAt)
        VALUES (?, ?, 'clickup-mcp', ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        userId,
        actionType,
        toolName || null,
        workspaceId || null,
        JSON.stringify(redactPayload(requestPayload || {})),
        responseSummary || '',
        status,
        new Date().toISOString(),
    );
};

const buildPkceChallenge = (codeVerifier) => {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
};

// POST /api/integrations/clickup/mcp/oauth/start
router.post('/clickup/mcp/oauth/start', requireAuth, (req, res) => {
    const clientId = process.env.CLICKUP_MCP_CLIENT_ID;
    const redirectUri = process.env.CLICKUP_MCP_REDIRECT_URI;
    const workspaceId = req.body?.workspaceId || null;

    if (!clientId || !redirectUri) {
        return res.status(400).json({ error: 'CLICKUP_MCP_CLIENT_ID e CLICKUP_MCP_REDIRECT_URI são obrigatórios no servidor.' });
    }

    const state = crypto.randomBytes(24).toString('base64url');
    const codeVerifier = crypto.randomBytes(64).toString('base64url');
    const codeChallenge = buildPkceChallenge(codeVerifier);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    const id = `oauth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    db.prepare(`
        INSERT INTO clickup_oauth_states (id, userId, state, codeVerifier, workspaceId, createdAt, expiresAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, state, encrypt(codeVerifier), workspaceId, createdAt.toISOString(), expiresAt.toISOString());

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });

    const authorizeUrl = `${CLICKUP_MCP_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
    res.json({ success: true, authorizeUrl, state, expiresAt: expiresAt.toISOString() });
});

// GET /api/integrations/clickup/mcp/oauth/callback
router.get('/clickup/mcp/oauth/callback', async (req, res) => {
    const { code, state, error, error_description: errorDescription } = req.query;

    if (error) {
        const encoded = encodeURIComponent(String(errorDescription || error));
        return res.redirect(`/auth/callback?provider=clickup-mcp&status=error&message=${encoded}`);
    }

    if (!code || !state) {
        return res.status(400).send('Callback inválido do ClickUp MCP.');
    }

    const clientId = process.env.CLICKUP_MCP_CLIENT_ID;
    const clientSecret = process.env.CLICKUP_MCP_CLIENT_SECRET;
    const redirectUri = process.env.CLICKUP_MCP_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        return res.status(500).send('Servidor sem variáveis OAuth do ClickUp MCP configuradas.');
    }

    const oauthState = db.prepare('SELECT * FROM clickup_oauth_states WHERE state = ?').get(String(state));
    if (!oauthState) {
        return res.status(400).send('State OAuth inválido ou expirado.');
    }

    if (new Date(oauthState.expiresAt).getTime() < Date.now()) {
        db.prepare('DELETE FROM clickup_oauth_states WHERE id = ?').run(oauthState.id);
        return res.status(400).send('State OAuth expirado.');
    }

    try {
        const codeVerifier = decrypt(oauthState.codeVerifier);
        const tokenRes = await fetch(CLICKUP_MCP_OAUTH_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code: String(code),
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier,
            })
        });

        const tokenPayload = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenPayload?.access_token) {
            const msg = tokenPayload?.error_description || tokenPayload?.error || 'Falha ao trocar authorization code no ClickUp MCP.';
            throw new Error(msg);
        }

        const mcpIntegrationId = `int-clickup-mcp-${Date.now()}`;
        const accessToken = tokenPayload.access_token;
        const refreshToken = tokenPayload.refresh_token || '';
        const expiresAt = tokenPayload.expires_in
            ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString()
            : null;

        const mcpMeta = JSON.stringify({
            workspaceId: oauthState.workspaceId || null,
            tokenType: tokenPayload.token_type || 'Bearer',
            scope: tokenPayload.scope || '',
            expiresAt,
            oauthConnectedAt: new Date().toISOString(),
            hasRefreshToken: Boolean(refreshToken),
        });

        db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(oauthState.userId, 'clickup_mcp');
        db.prepare('INSERT INTO integrations (id, userId, provider, token, meta) VALUES (?, ?, ?, ?, ?)')
            .run(mcpIntegrationId, oauthState.userId, 'clickup_mcp', encrypt(accessToken), mcpMeta);

        const apiIntegration = db.prepare('SELECT id, meta FROM integrations WHERE userId = ? AND provider = ?').get(oauthState.userId, 'clickup');
        if (apiIntegration) {
            const apiMeta = apiIntegration.meta ? JSON.parse(apiIntegration.meta) : {};
            apiMeta.mcpConnected = true;
            if (!apiMeta.mcpWorkspaceId && oauthState.workspaceId) {
                apiMeta.mcpWorkspaceId = oauthState.workspaceId;
            }
            db.prepare('UPDATE integrations SET meta = ? WHERE id = ?').run(JSON.stringify(apiMeta), apiIntegration.id);
        }

        db.prepare('DELETE FROM clickup_oauth_states WHERE id = ?').run(oauthState.id);

        writeMcpAudit({
            userId: oauthState.userId,
            actionType: 'auth.connect',
            toolName: 'oauth_callback',
            workspaceId: oauthState.workspaceId,
            requestPayload: { provider: 'clickup-mcp' },
            responseSummary: 'OAuth PKCE completed successfully',
            status: 'success',
        });

        res.redirect('/?clickupMcpConnected=1');
    } catch (err) {
        db.prepare('DELETE FROM clickup_oauth_states WHERE id = ?').run(oauthState.id);
        writeMcpAudit({
            userId: oauthState.userId,
            actionType: 'auth.connect',
            toolName: 'oauth_callback',
            workspaceId: oauthState.workspaceId,
            requestPayload: { provider: 'clickup-mcp' },
            responseSummary: err.message || 'OAuth callback failed',
            status: 'failed',
        });
        const encoded = encodeURIComponent(err.message || 'Falha no OAuth do ClickUp MCP');
        res.redirect(`/?clickupMcpConnected=0&message=${encoded}`);
    }
});

// GET /api/integrations - List user integrations
router.get('/', requireAuth, (req, res) => {
    try {
        const integrations = db.prepare('SELECT id, provider, meta, createdAt FROM integrations WHERE userId = ?').all(req.user.id);

        // Parse meta JSON
        const formatted = integrations.map(i => ({
            ...i,
            meta: i.meta ? JSON.parse(i.meta) : {}
        }));

        res.json(formatted);
    } catch (err) {
        console.error('Integrations list error:', err);
        res.status(500).json({ error: 'Failed to fetch integrations' });
    }
});

// POST /api/integrations/gitlab - Connect GitLab
router.post('/gitlab', requireAuth, async (req, res) => {
    const { token, username, gitlabUrl } = req.body;

    if (!token || !username) {
        return res.status(400).json({ error: 'Token e Username são obrigatórios' });
    }

    // Default to gitlab.com if no URL provided
    const baseUrl = gitlabUrl?.trim() || 'https://gitlab.com';
    const apiUrl = `${baseUrl}/api/v4`;

    try {
        // Validate with GitLab API
        const response = await fetch(`${apiUrl}/user`, {
            headers: {
                'PRIVATE-TOKEN': token
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                return res.status(401).json({ error: 'Token GitLab inválido' });
            }
            return res.status(response.status).json({ error: 'Falha ao conectar com GitLab' });
        }

        const data = await response.json();

        // Check if username matches
        if (data.username.toLowerCase() !== username.toLowerCase()) {
            return res.status(400).json({ error: `Token pertence ao usuário ${data.username}, não ${username}` });
        }

        // Save to DB
        const id = `int-gl-${Date.now()}`;
        const meta = JSON.stringify({
            username: data.username,
            avatar: data.avatar_url,
            name: data.name,
            gitlabUrl: baseUrl
        });

        // Upsert (remove old if exists for this provider)
        db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(req.user.id, 'gitlab');

        db.prepare('INSERT INTO integrations (id, userId, provider, token, meta) VALUES (?, ?, ?, ?, ?)')
            .run(id, req.user.id, 'gitlab', encrypt(token), meta);

        res.json({ success: true, message: 'GitLab conectado com sucesso', user: data.username });

    } catch (err) {
        console.error('GitLab integration error:', err);
        res.status(500).json({ error: 'Falha ao conectar com GitLab' });
    }
});

// POST /api/integrations/gitlab/sync - Sync assignments
router.post('/gitlab/sync', requireAuth, async (req, res) => {
    try {
        const integration = db.prepare('SELECT token, meta FROM integrations WHERE userId = ? AND provider = ?').get(req.user.id, 'gitlab');

        if (!integration) {
            return res.status(400).json({ error: 'GitLab não conectado' });
        }

        const token = decrypt(integration.token);
        const meta = JSON.parse(integration.meta);
        const baseUrl = meta.gitlabUrl || 'https://gitlab.com';
        const apiUrl = `${baseUrl}/api/v4`;

        // Fetch assigned issues
        // https://docs.gitlab.com/ee/api/issues.html#list-issues
        const response = await fetch(`${apiUrl}/issues?assignee_username=${meta.username}&state=opened&scope=all`, {
            headers: {
                'PRIVATE-TOKEN': token
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Falha ao buscar issues do GitLab' });
        }

        const issues = await response.json();
        const syncedTasks = [];

        // Insert/Update tasks
        const stmt = db.prepare(`
            INSERT INTO tasks (id, title, description, status, priority, assigneeId, storyPoints, tags, repositoryId, xpPractices)
            VALUES (?, ?, ?, 'backlog', 'medium', ?, 3, ?, NULL, '{}')
            ON CONFLICT(id) DO UPDATE SET title=excluded.title
        `);

        for (const issue of issues) {
            const taskId = `gl-${issue.iid}-${issue.project_id}`; // Prefix to avoid collision
            const tags = JSON.stringify(issue.labels || []);

            stmt.run(taskId, issue.title, issue.description || '', req.user.id, tags);
            syncedTasks.push(taskId);
        }

        res.json({ success: true, count: syncedTasks.length, message: `Sincronizadas ${syncedTasks.length} issues` });

    } catch (err) {
        console.error('Sync error:', err);
        res.status(500).json({ error: 'Sincronização falhou' });
    }
});


// POST /api/integrations/clickup - Connect ClickUp API v3 + MCP credentials
router.post('/clickup', requireAuth, async (req, res) => {
    const { apiToken, workspaceId, listId, mcpAccessToken, mcpWorkspaceId } = req.body;

    if (!apiToken || !workspaceId) {
        return res.status(400).json({ error: 'API Token e Workspace ID do ClickUp são obrigatórios.' });
    }

    try {
        const validation = await validateClickUpWorkspaceAccess({ token: apiToken, workspaceId });

        if (!validation.ok) {
            if (validation.status === 401 || validation.status === 403) {
                return res.status(401).json({ error: 'Credenciais ClickUp inválidas ou sem acesso ao workspace informado.' });
            }
            if (validation.status === 404) {
                return res.status(404).json({ error: 'Workspace ID não encontrado no ClickUp para este token.' });
            }
            return res.status(validation.status || 500).json({ error: 'Falha ao validar conexão com a API do ClickUp.' });
        }

        let mcpConnected = false;
        let mcpError = null;
        const mcpTokenToUse = (mcpAccessToken && mcpAccessToken.trim()) ? mcpAccessToken : apiToken;
        if (mcpTokenToUse) {
            try {
                await callClickUpMcp({ token: mcpTokenToUse, method: 'tools/list', params: {} });
                mcpConnected = true;
            } catch (err) {
                mcpConnected = false;
                mcpError = err.message || 'Não foi possível validar MCP com o token informado (MCP Access Token ou API Token).';
            }
        }

        const id = `int-clickup-${Date.now()}`;
        const meta = JSON.stringify({
            workspaceId,
            listId: listId || '',
            mcpWorkspaceId: mcpWorkspaceId || workspaceId,
            mcpConnected,
            mcpLastError: mcpError,
            lastSyncUsedWorkspaceFallback: false,
            lastSyncAt: null,
            providerVersion: 'v3',
        });

        db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(req.user.id, 'clickup');
        db.prepare('INSERT INTO integrations (id, userId, provider, token, meta) VALUES (?, ?, ?, ?, ?)')
            .run(id, req.user.id, 'clickup', encrypt(apiToken), meta);

        if (mcpConnected) {
            db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(req.user.id, 'clickup_mcp');
            db.prepare('INSERT INTO integrations (id, userId, provider, token, meta) VALUES (?, ?, ?, ?, ?)')
                .run(`${id}-mcp`, req.user.id, 'clickup_mcp', encrypt(mcpTokenToUse), JSON.stringify({ workspaceId: mcpWorkspaceId || workspaceId }));
        } else {
            // Prevent stale MCP credentials from previous connections causing false errors.
            db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(req.user.id, 'clickup_mcp');
        }

        res.json({
            success: true,
            message: 'ClickUp conectado com sucesso.',
            workspaceId,
            mcpConnected,
            mcpError,
        });
    } catch (err) {
        console.error('ClickUp integration error:', err);
        res.status(500).json({ error: 'Falha ao conectar com o ClickUp.' });
    }
});

// GET /api/integrations/clickup/status
router.get('/clickup/status', requireAuth, async (req, res) => {
    try {
        const apiIntegration = db.prepare('SELECT token, meta FROM integrations WHERE userId = ? AND provider = ?').get(req.user.id, 'clickup');
        const mcpIntegration = db.prepare('SELECT token, meta FROM integrations WHERE userId = ? AND provider = ?').get(req.user.id, 'clickup_mcp');

        if (!apiIntegration) {
            return res.json({ connected: false, mcpConnected: false, providerVersion: 'v3' });
        }

        const meta = apiIntegration.meta ? JSON.parse(apiIntegration.meta) : {};
        const apiToken = decrypt(apiIntegration.token);
        let apiHealthy = false;
        let mcpError = meta.mcpLastError || null;

        if (meta.workspaceId) {
            const validation = await validateClickUpWorkspaceAccess({ token: apiToken, workspaceId: meta.workspaceId });
            apiHealthy = validation.ok;
        }

        let mcpHealthy = false;
        if (mcpIntegration) {
            try {
                const mcpToken = decrypt(mcpIntegration.token);
                await callClickUpMcp({ token: mcpToken, method: 'tools/list', params: {} });
                mcpHealthy = true;
                mcpError = null;
            } catch (err) {
                mcpHealthy = false;
                mcpError = err.message || 'Falha ao validar conexão MCP.';
            }
        }

        res.json({
            connected: true,
            apiHealthy,
            mcpConnected: Boolean(mcpIntegration),
            mcpHealthy,
            workspaceId: meta.workspaceId,
            listId: meta.listId || '',
            mcpWorkspaceId: meta.mcpWorkspaceId || meta.workspaceId,
            lastSyncUsedWorkspaceFallback: Boolean(meta.lastSyncUsedWorkspaceFallback),
            lastSyncAt: meta.lastSyncAt || null,
            mcpError,
            providerVersion: 'v3',
        });
    } catch (err) {
        console.error('ClickUp status error:', err);
        res.status(500).json({ error: 'Falha ao consultar status da integração ClickUp.' });
    }
});

// GET /api/integrations/clickup/tools
router.get('/clickup/tools', requireAuth, async (req, res) => {
    try {
        const mcpIntegration = db.prepare('SELECT token FROM integrations WHERE userId = ? AND provider = ?').get(req.user.id, 'clickup_mcp');

        if (!mcpIntegration) {
            return res.json({
                source: 'catalog',
                tools: CLICKUP_MCP_TOOL_CATALOG,
                mcpConnected: false,
                mcpError: 'MCP não configurado para este usuário. Conecte via token MCP ou OAuth PKCE.',
            });
        }

        const mcpToken = decrypt(mcpIntegration.token);
        try {
            const runtime = await callClickUpMcp({ token: mcpToken, method: 'tools/list', params: {} });
            const runtimeTools = Array.isArray(runtime?.tools) ? runtime.tools : [];
            return res.json({
                source: 'runtime',
                tools: runtimeTools,
                documentedTools: CLICKUP_MCP_TOOL_CATALOG,
                mcpConnected: true,
            });
        } catch (err) {
            return res.json({
                source: 'catalog-fallback',
                tools: CLICKUP_MCP_TOOL_CATALOG,
                mcpConnected: false,
                mcpError: err.message || 'Falha ao validar tools/list do MCP.',
            });
        }
    } catch (err) {
        console.error('ClickUp tools error:', err);
        res.status(500).json({ error: 'Falha ao obter catálogo de tools do ClickUp MCP.' });
    }
});

// POST /api/integrations/clickup/mcp/execute
router.post('/clickup/mcp/execute', requireAuth, async (req, res) => {
    const { toolName, arguments: toolArgs = {}, dryRun = false } = req.body;

    if (!toolName) {
        return res.status(400).json({ error: 'toolName é obrigatório.' });
    }

    try {
        const mcpIntegration = db.prepare('SELECT token, meta FROM integrations WHERE userId = ? AND provider = ?').get(req.user.id, 'clickup_mcp');
        if (!mcpIntegration) {
            return res.status(400).json({ error: 'ClickUp MCP não está conectado.' });
        }

        if (dryRun) {
            writeMcpAudit({
                userId: req.user.id,
                actionType: 'tool.write',
                toolName,
                workspaceId: mcpIntegration.meta ? JSON.parse(mcpIntegration.meta).workspaceId : null,
                requestPayload: { toolName, arguments: toolArgs, dryRun: true },
                responseSummary: 'Dry-run executado sem envio ao MCP',
                status: 'success',
            });
            return res.json({ success: true, dryRun: true, toolName, arguments: toolArgs });
        }

        const mcpToken = decrypt(mcpIntegration.token);
        const result = await callClickUpMcp({
            token: mcpToken,
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: toolArgs,
            }
        });

        writeMcpAudit({
            userId: req.user.id,
            actionType: 'tool.write',
            toolName,
            workspaceId: mcpIntegration.meta ? JSON.parse(mcpIntegration.meta).workspaceId : null,
            requestPayload: { toolName, arguments: toolArgs, dryRun: false },
            responseSummary: 'Tool executada com sucesso',
            status: 'success',
        });

        res.json({ success: true, toolName, result });
    } catch (err) {
        console.error('ClickUp MCP execute error:', err);
        writeMcpAudit({
            userId: req.user.id,
            actionType: 'tool.write',
            toolName,
            workspaceId: null,
            requestPayload: { toolName, arguments: toolArgs, dryRun: false },
            responseSummary: err.message || 'Falha na execução de tool MCP',
            status: 'failed',
        });
        res.status(500).json({ error: err.message || 'Falha ao executar tool no ClickUp MCP.' });
    }
});

// POST /api/integrations/clickup/mcp/chat
router.post('/clickup/mcp/chat', requireAuth, async (req, res) => {
    const { channelId, text } = req.body;
    if (!channelId || !text) {
        return res.status(400).json({ error: 'channelId e text são obrigatórios.' });
    }

    try {
        const mcpIntegration = db.prepare('SELECT token FROM integrations WHERE userId = ? AND provider = ?').get(req.user.id, 'clickup_mcp');
        if (!mcpIntegration) {
            return res.status(400).json({ error: 'ClickUp MCP não está conectado.' });
        }

        const mcpToken = decrypt(mcpIntegration.token);
        const workspaceId = mcpIntegration.meta ? JSON.parse(mcpIntegration.meta).workspaceId : null;
        const result = await callClickUpMcp({
            token: mcpToken,
            method: 'tools/call',
            params: {
                name: 'send_chat_message',
                arguments: { channel_id: channelId, text }
            }
        });

        writeMcpAudit({
            userId: req.user.id,
            actionType: 'tool.write',
            toolName: 'send_chat_message',
            workspaceId,
            requestPayload: { channelId, text },
            responseSummary: 'Mensagem enviada via MCP',
            status: 'success',
        });

        res.json({ success: true, result });
    } catch (err) {
        console.error('ClickUp MCP chat error:', err);
        writeMcpAudit({
            userId: req.user.id,
            actionType: 'tool.write',
            toolName: 'send_chat_message',
            workspaceId: null,
            requestPayload: { channelId, text },
            responseSummary: err.message || 'Falha no envio de mensagem MCP',
            status: 'failed',
        });
        res.status(500).json({ error: err.message || 'Falha ao enviar mensagem via ClickUp MCP.' });
    }
});

// GET /api/integrations/clickup/mcp/audit
router.get('/clickup/mcp/audit', requireAuth, (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 50), 200);
        const rows = db.prepare(`
            SELECT id, actionType, toolName, workspaceId, requestPayloadRedacted, responseSummary, status, createdAt
            FROM mcp_audit
            WHERE userId = ? AND provider = 'clickup-mcp'
            ORDER BY createdAt DESC
            LIMIT ?
        `).all(req.user.id, limit);

        const parsed = rows.map((row) => ({
            ...row,
            requestPayloadRedacted: row.requestPayloadRedacted ? JSON.parse(row.requestPayloadRedacted) : {},
        }));

        res.json({ success: true, items: parsed });
    } catch (err) {
        console.error('ClickUp MCP audit list error:', err);
        res.status(500).json({ error: 'Falha ao carregar trilha de auditoria MCP.' });
    }
});

// POST /api/integrations/clickup/sync - Import ClickUp tasks as local tasks
router.post('/clickup/sync', requireAuth, async (req, res) => {
    try {
        const integration = db.prepare('SELECT token, meta FROM integrations WHERE userId = ? AND provider = ?').get(req.user.id, 'clickup');
        if (!integration) {
            return res.status(400).json({ error: 'ClickUp não conectado.' });
        }

        const token = decrypt(integration.token);
        const meta = integration.meta ? JSON.parse(integration.meta) : {};
        const workspaceId = meta.workspaceId;
        const listId = meta.listId;

        if (!workspaceId) {
            return res.status(400).json({ error: 'Workspace ID não configurado para sincronização.' });
        }

        const workspaceEndpoint = `${CLICKUP_API_BASE}/api/v2/team/${workspaceId}/task?archived=false`;
        let clickUpTasks = [];
        let lastSyncError = null;
        let usedWorkspaceFallback = false;

        if (listId) {
            const listResult = await fetchAllClickUpTasks({
                endpoint: `${CLICKUP_API_BASE}/api/v2/list/${listId}/task?archived=false`,
                token,
            });

            if (listResult.ok) {
                clickUpTasks = listResult.tasks;
            } else {
                lastSyncError = listResult;
            }
        }

        if (clickUpTasks.length === 0) {
            const workspaceResult = await fetchAllClickUpTasks({
                endpoint: workspaceEndpoint,
                token,
            });

            if (!workspaceResult.ok) {
                const status = workspaceResult.status || lastSyncError?.status || 500;
                const detail = workspaceResult.detail || lastSyncError?.detail || 'Falha ao buscar tarefas no ClickUp.';
                const hint = (status === 401 || status === 403)
                    ? 'Token sem permissão para leitura de tarefas/listas no ClickUp API.'
                    : 'Verifique Workspace/List ID e permissões do token.';
                return res.status(status).json({ error: `${detail} ${hint}`.trim() });
            }

            usedWorkspaceFallback = Boolean(listId);
            clickUpTasks = listId
                ? filterClickUpTasksByScope(workspaceResult.tasks, listId)
                : workspaceResult.tasks;

            if (listId && clickUpTasks.length === 0 && workspaceResult.tasks.length > 0) {
                return res.status(400).json({
                    error: 'O escopo informado no ClickUp não retornou tarefas. Use um List ID válido ou deixe o campo vazio para sincronizar todo o workspace.',
                });
            }
        }

        const stmt = db.prepare(`
            INSERT INTO tasks (id, title, description, status, priority, assigneeId, storyPoints, tags, repositoryId, xpPractices)
            VALUES (?, ?, ?, 'backlog', ?, ?, 3, ?, NULL, '{}')
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, priority=excluded.priority
        `);

        let count = 0;
        for (const task of clickUpTasks) {
            const taskId = `clickup-${task.id}`;
            const title = task.name || 'Sem título';
            const description = parseTaskDescription(task.description);
            const priority = mapClickUpPriority(task.priority?.priority || task.priority?.name || task.priority);
            const tags = JSON.stringify((task.tags || []).map((tag) => tag.name || tag));
            stmt.run(taskId, title, description, priority, req.user.id, tags);
            count += 1;
        }

        const syncedAt = new Date().toISOString();
        const nextMeta = {
            ...meta,
            lastSyncUsedWorkspaceFallback: usedWorkspaceFallback,
            lastSyncAt: syncedAt,
        };
        db.prepare('UPDATE integrations SET meta = ? WHERE userId = ? AND provider = ?')
            .run(JSON.stringify(nextMeta), req.user.id, 'clickup');

        const message = usedWorkspaceFallback
            ? `${count} tarefa(s) importadas do ClickUp usando fallback do workspace.`
            : `${count} tarefa(s) importadas do ClickUp.`;

        res.json({ success: true, count, message, usedWorkspaceFallback, syncedAt });
    } catch (err) {
        console.error('ClickUp sync error:', err);
        res.status(500).json({ error: err.message || 'Falha na sincronização com ClickUp.' });
    }
});

// DELETE /api/integrations/:provider
router.delete('/:provider', requireAuth, (req, res) => {
    const { provider } = req.params;

    try {
        db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(req.user.id, provider);
        if (provider === 'clickup') {
            db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(req.user.id, 'clickup_mcp');
        }
        res.json({ success: true, message: `${provider} disconnected` });
    } catch (err) {
        console.error('Integration disconnect error:', err);
        res.status(500).json({ error: 'Failed to disconnect interface' });
    }
});

export default router;

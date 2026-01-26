
import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../crypto.js';

const router = express.Router();

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
    } catch (_err) {
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


// POST /api/integrations/jira - Connect Jira (free plan)
// Uses Jira REST API v3 with Basic Auth (email + API token)
// Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
router.post('/jira', requireAuth, async (req, res) => {
    const { email, apiToken, domain } = req.body;

    if (!email || !apiToken || !domain) {
        return res.status(400).json({ error: 'E-mail, API Token e domínio Jira são obrigatórios' });
    }

    // Normalize domain: strip protocol and trailing slash, e.g. "myorg.atlassian.net"
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const baseUrl = `https://${cleanDomain}`;
    const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');

    try {
        // Validate credentials against Jira Cloud REST API
        const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                return res.status(401).json({ error: 'Credenciais Jira inválidas. Verifique o e-mail, API Token e domínio.' });
            }
            return res.status(response.status).json({ error: 'Falha ao conectar com o Jira' });
        }

        const data = await response.json();

        // Save to DB — store email+token as "email:apiToken" encrypted, domain in meta
        const id = `int-jira-${Date.now()}`;
        const meta = JSON.stringify({
            email: data.emailAddress,
            displayName: data.displayName,
            accountId: data.accountId,
            domain: cleanDomain
        });

        db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(req.user.id, 'jira');
        db.prepare('INSERT INTO integrations (id, userId, provider, token, meta) VALUES (?, ?, ?, ?, ?)')
            .run(id, req.user.id, 'jira', encrypt(`${email}:${apiToken}`), meta);

        res.json({ success: true, message: 'Jira conectado com sucesso', displayName: data.displayName });

    } catch (err) {
        console.error('Jira integration error:', err);
        res.status(500).json({ error: 'Falha ao conectar com o Jira' });
    }
});

// POST /api/integrations/jira/sync - Import assigned Jira issues as tasks
router.post('/jira/sync', requireAuth, async (req, res) => {
    try {
        const integration = db.prepare('SELECT token, meta FROM integrations WHERE userId = ? AND provider = ?').get(req.user.id, 'jira');

        if (!integration) {
            return res.status(400).json({ error: 'Jira não conectado' });
        }

        const [email, apiToken] = decrypt(integration.token).split(':');
        const meta = JSON.parse(integration.meta);
        const baseUrl = `https://${meta.domain}`;
        const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const authHeader = { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' };

        // JQL: issues assigned to current user, not done, free plan compatible
        const jql = encodeURIComponent(`assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC`);
        const issuesRes = await fetch(`${baseUrl}/rest/api/3/search?jql=${jql}&maxResults=50&fields=summary,description,priority,labels,status`, {
            headers: authHeader
        });

        if (!issuesRes.ok) throw new Error('Falha ao buscar issues do Jira');

        const issuesData = await issuesRes.json();
        const syncedTasks = [];

        const stmt = db.prepare(`
            INSERT INTO tasks (id, title, description, status, priority, assigneeId, storyPoints, tags, repositoryId, xpPractices)
            VALUES (?, ?, ?, 'backlog', ?, ?, 3, ?, NULL, '{}')
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, priority=excluded.priority
        `);

        for (const issue of issuesData.issues) {
            const taskId = `jira-${issue.key}`;
            const title = issue.fields.summary;
            const description = issue.fields.description
                ? (issue.fields.description.content?.[0]?.content?.[0]?.text || '')
                : '';
            const jiraPriority = issue.fields.priority?.name?.toLowerCase() || 'medium';
            const priority = ['highest', 'high'].includes(jiraPriority) ? 'high'
                : ['lowest', 'low'].includes(jiraPriority) ? 'low' : 'medium';
            const tags = JSON.stringify(issue.fields.labels || []);

            stmt.run(taskId, title, description, priority, req.user.id, tags);
            syncedTasks.push(taskId);
        }

        res.json({ success: true, count: syncedTasks.length, message: `${syncedTasks.length} issue(s) importadas do Jira` });

    } catch (err) {
        console.error('Jira sync error:', err);
        res.status(500).json({ error: 'Falha na sincronização com Jira', details: err.message });
    }
});

// DELETE /api/integrations/:provider
router.delete('/:provider', requireAuth, (req, res) => {
    const { provider } = req.params;

    try {
        db.prepare('DELETE FROM integrations WHERE userId = ? AND provider = ?').run(req.user.id, provider);
        res.json({ success: true, message: `${provider} disconnected` });
    } catch (_err) {
        res.status(500).json({ error: 'Failed to disconnect interface' });
    }
});

export default router;

import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { decrypt } from '../crypto.js';

const router = express.Router();

// GET /api/pipelines - List all pipelines (optionally filtered)
router.get('/', requireAuth, (req, res) => {
    const { repoId, taskId, status, limit = 50 } = req.query;

    try {
        let sql = 'SELECT * FROM pipelines WHERE 1=1';
        const params = [];

        if (repoId) {
            sql += ' AND repoId = ?';
            params.push(repoId);
        }
        if (taskId) {
            sql += ' AND taskId = ?';
            params.push(taskId);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY createdAt DESC LIMIT ?';
        params.push(parseInt(limit));

        const pipelines = db.prepare(sql).all(...params);

        // Parse stages JSON
        const formatted = pipelines.map(p => ({
            ...p,
            stages: p.stages ? JSON.parse(p.stages) : []
        }));

        res.json(formatted);
    } catch (err) {
        console.error('Failed to fetch pipelines:', err);
        res.status(500).json({ error: 'Failed to fetch pipelines' });
    }
});

// GET /api/pipelines/:id - Get single pipeline details
router.get('/:id', requireAuth, (req, res) => {
    try {
        const pipeline = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(req.params.id);

        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        res.json({
            ...pipeline,
            stages: pipeline.stages ? JSON.parse(pipeline.stages) : []
        });
    } catch (_err) {
        res.status(500).json({ error: 'Failed to fetch pipeline' });
    }
});

// POST /api/pipelines/sync/:repoId - Sync pipelines from GitLab for a repository
router.post('/sync/:repoId', requireAuth, async (req, res) => {
    const { repoId } = req.params;
    const { ref } = req.body; // Optional: filter by ref (branch)

    try {
        // Get GitLab integration
        const integration = db.prepare(
            'SELECT token, meta FROM integrations WHERE userId = ? AND provider = ?'
        ).get(req.user.id, 'gitlab');

        if (!integration) {
            return res.status(400).json({ error: 'GitLab not connected' });
        }

        // Get repository info
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(repoId);
        if (!repo) {
            return res.status(404).json({ error: 'Repository not found' });
        }

        const token = decrypt(integration.token);
        const meta = JSON.parse(integration.meta);
        const baseUrl = meta.gitlabUrl || 'https://gitlab.com';
        const apiUrl = `${baseUrl}/api/v4`;

        // Use explicit gitlabProjectPath if set, otherwise fall back to repo.name
        const rawProjectPath = repo.gitlabProjectPath || repo.name;
        if (!rawProjectPath || !rawProjectPath.includes('/')) {
            return res.status(400).json({
                error: `Configure o "GitLab Project Path" do repositório (ex: namespace/projeto). Valor atual: "${rawProjectPath}"`
            });
        }
        const projectPath = encodeURIComponent(rawProjectPath);

        // Fetch pipelines from GitLab
        let pipelinesUrl = `${apiUrl}/projects/${projectPath}/pipelines?per_page=20`;
        if (ref) {
            pipelinesUrl += `&ref=${encodeURIComponent(ref)}`;
        }

        const response = await fetch(pipelinesUrl, {
            headers: { 'PRIVATE-TOKEN': token }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitLab API error:', response.status, errorText);
            return res.status(response.status).json({
                error: 'Failed to fetch pipelines from GitLab',
                details: errorText
            });
        }

        const gitlabPipelines = await response.json();
        const syncedPipelines = [];

        // Upsert pipelines
        const stmt = db.prepare(`
            INSERT INTO pipelines (id, repoId, gitlabPipelineId, status, stages, webUrl, ref, sha, createdAt, finishedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
                status = excluded.status,
                stages = excluded.stages,
                finishedAt = excluded.finishedAt
        `);

        for (const pl of gitlabPipelines) {
            const pipelineId = `gl-pipe-${pl.id}`;

            // Fetch detailed pipeline info including jobs (stages)
            let stages = [];
            try {
                const jobsResponse = await fetch(
                    `${apiUrl}/projects/${projectPath}/pipelines/${pl.id}/jobs`,
                    { headers: { 'PRIVATE-TOKEN': token } }
                );
                if (jobsResponse.ok) {
                    const jobs = await jobsResponse.json();
                    // Group jobs by stage
                    const stageMap = new Map();
                    for (const job of jobs) {
                        if (!stageMap.has(job.stage)) {
                            stageMap.set(job.stage, { name: job.stage, status: job.status });
                        } else {
                            // If any job in stage failed, mark stage as failed
                            const curr = stageMap.get(job.stage);
                            if (job.status === 'failed') curr.status = 'failed';
                            else if (job.status === 'running' && curr.status !== 'failed') curr.status = 'running';
                        }
                    }
                    stages = Array.from(stageMap.values());
                }
            } catch (_e) {
                console.warn('Failed to fetch jobs for pipeline:', pl.id);
            }

            stmt.run(
                pipelineId,
                repoId,
                String(pl.id),
                pl.status,
                JSON.stringify(stages),
                pl.web_url,
                pl.ref,
                pl.sha,
                pl.created_at,
                pl.finished_at || null
            );

            syncedPipelines.push(pipelineId);
        }

        res.json({
            success: true,
            count: syncedPipelines.length,
            message: `Synchronized ${syncedPipelines.length} pipelines`
        });

    } catch (err) {
        console.error('Pipeline sync error:', err);
        res.status(500).json({ error: 'Pipeline synchronization failed' });
    }
});

// GET /api/tasks/:taskId/pipelines - Get pipelines linked to a task
router.get('/task/:taskId', requireAuth, (req, res) => {
    try {
        const pipelines = db.prepare(
            'SELECT * FROM pipelines WHERE taskId = ? ORDER BY createdAt DESC'
        ).all(req.params.taskId);

        const formatted = pipelines.map(p => ({
            ...p,
            stages: p.stages ? JSON.parse(p.stages) : []
        }));

        res.json(formatted);
    } catch (_err) {
        res.status(500).json({ error: 'Failed to fetch task pipelines' });
    }
});

// POST /api/pipelines/:id/link/:taskId - Link a pipeline to a task
router.post('/:id/link/:taskId', requireAuth, (req, res) => {
    const { id, taskId } = req.params;

    try {
        const pipeline = db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id);
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }

        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        db.prepare('UPDATE pipelines SET taskId = ? WHERE id = ?').run(taskId, id);

        res.json({ success: true, message: 'Pipeline linked to task' });
    } catch (_err) {
        res.status(500).json({ error: 'Failed to link pipeline' });
    }
});

// DELETE /api/pipelines/:id/link - Unlink a pipeline from its task
router.delete('/:id/link', requireAuth, (req, res) => {
    try {
        db.prepare('UPDATE pipelines SET taskId = NULL WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Pipeline unlinked' });
    } catch (_err) {
        res.status(500).json({ error: 'Failed to unlink pipeline' });
    }
});

export default router;

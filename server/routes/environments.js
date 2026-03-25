import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { execFile } from 'child_process';
import util from 'util';

import fs from 'fs';

const router = express.Router();
const execFileAsync = util.promisify(execFile);

const createActivityLog = ({ userId, action, target, targetType, meta = null }) => {
    db.prepare(`
        INSERT INTO activities (id, userId, action, target, targetType, taskId, timestamp, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId, action, target, targetType, null, new Date().toISOString(), meta);
};

// Helper to execute git commands safely
const runGitCommand = async (repoId, args) => {
    const repo = db.prepare('SELECT localPath FROM repositories WHERE id = ?').get(repoId);
    if (!repo || !repo.localPath) {
        console.error(`runGitCommand: Repository not found or no localPath for repoId: ${repoId}`);
        throw new Error('Repository path not found');
    }

    if (!fs.existsSync(repo.localPath)) {
        console.error(`runGitCommand: Repository path does not exist on disk: ${repo.localPath}`);
        throw new Error(`Repository path does not exist: ${repo.localPath}`);
    }

    try {
        const { stdout, stderr } = await execFileAsync('git', args, { cwd: repo.localPath });
        return { stdout, stderr };
    } catch (error) {
        console.error(`Git command failed: git ${args.join(' ')} in ${repo.localPath}`);
        console.error('Error details:', error);
        console.error('Stderr:', error.stderr);
        throw new Error(`Git command failed: ${error.message} \nStderr: ${error.stderr}`);
    }
};

// GET /api/environments - List all environments (optionally filtered by repoId)
router.get('/', requireAuth, (req, res) => {
    const { repoId } = req.query;

    try {
        let environments;
        if (repoId) {
            environments = db.prepare('SELECT * FROM environments WHERE repoId = ?').all(repoId);
        } else {
            environments = db.prepare('SELECT * FROM environments').all();
        }
        res.json(environments);
    } catch (err) {
        console.error('Failed to fetch environments:', err);
        res.status(500).json({ error: 'Failed to fetch environments' });
    }
});

// GET /api/environments/:id - Get specific environment details
router.get('/:id', requireAuth, (req, res) => {
    try {
        const environment = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);

        if (!environment) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        // Get deployments
        const deployments = db.prepare('SELECT * FROM deployments WHERE environmentId = ? ORDER BY deployedAt DESC').all(req.params.id);

        res.json({ ...environment, deployments });
    } catch (_err) {
        res.status(500).json({ error: 'Failed to fetch environment details' });
    }
});

// POST /api/environments - Create a new environment
router.post('/', requireAuth, async (req, res) => {
    const { name, type, repoId, description, internalNotes } = req.body;

    if (!name || !type || !repoId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const id = `env-${Date.now()}`;

        db.prepare(`
            INSERT INTO environments (id, name, type, repoId, description, internalNotes, status, currentVersion)
            VALUES (?, ?, ?, ?, ?, ?, 'unknown', NULL)
        `).run(id, name, type, repoId, description || null, internalNotes || null);

        const newEnv = db.prepare('SELECT * FROM environments WHERE id = ?').get(id);
        const repo = db.prepare('SELECT id, name FROM repositories WHERE id = ?').get(repoId);
        createActivityLog({
            userId: req.user.id,
            action: 'criou ambiente',
            target: name,
            targetType: 'environment',
            meta: JSON.stringify({
                repoId,
                repoName: repo?.name || repoId,
                environmentId: id,
                type,
            }),
        });
        res.status(201).json(newEnv);
    } catch (err) {
        console.error('Failed to create environment:', err);
        res.status(500).json({ error: 'Failed to create environment' });
    }
});

// PUT /api/environments/:id - Update environment
router.put('/:id', requireAuth, (req, res) => {
    const { name, type, description, internalNotes } = req.body;

    try {
        const existingEnvironment = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        if (!existingEnvironment) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        const result = db.prepare(`
            UPDATE environments 
            SET name = COALESCE(?, name),
                type = COALESCE(?, type),
                description = COALESCE(?, description),
                internalNotes = COALESCE(?, internalNotes)
            WHERE id = ?
        `).run(name, type, description, internalNotes, req.params.id);

        const updated = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        if ((name && name !== existingEnvironment.name) || (type && type !== existingEnvironment.type) || (description && description !== existingEnvironment.description) || (internalNotes && internalNotes !== existingEnvironment.internalNotes)) {
            const repo = db.prepare('SELECT id, name FROM repositories WHERE id = ?').get(updated.repoId);
            createActivityLog({
                userId: req.user.id,
                action: 'atualizou ambiente',
                target: updated.name,
                targetType: 'environment',
                meta: JSON.stringify({
                    repoId: updated.repoId,
                    repoName: repo?.name || updated.repoId,
                    environmentId: updated.id,
                    type: updated.type,
                }),
            });
        }
        res.json(updated);
    } catch (err) {
        console.error('Failed to update environment:', err);
        res.status(500).json({ error: 'Failed to update environment' });
    }
});

// POST /api/environments/:id/deploy - Deploy to an environment
router.post('/:id/deploy', requireAuth, async (req, res) => {
    const { version, buildId, pipelineId, notes, force } = req.body; // Accept force flag

    if (!version) {
        return res.status(400).json({ error: 'Version is required' });
    }

    try {
        const environment = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        if (!environment) {
            return res.status(404).json({ error: 'Environment not found' });
        }
        const repo = db.prepare('SELECT id, name FROM repositories WHERE id = ?').get(environment.repoId);

        const tagName = `env-${environment.type}-v${version}`;

        // --- GitOps: Create and Push Tag ---
        try {
            // 0. Check if repo has commits (HEAD exists)
            try {
                await runGitCommand(environment.repoId, ['rev-parse', 'HEAD']);
            } catch (_err) {
                return res.status(400).json({ error: 'O repositório está vazio. Faça pelo menos um commit antes de realizar o deploy.' });
            }

            // Check if tag exists locally
            try {
                await runGitCommand(environment.repoId, ['rev-parse', tagName]);
                if (!force) {
                    return res.status(409).json({ error: `Tag ${tagName} already exists. Use a new version or force deploy.` });
                }
            } catch (_ignore) {
                // Tag doesn't exist, proceed
            }


            await runGitCommand(environment.repoId, ['tag', '-a', tagName, '-m', `Deploy version ${version} to ${environment.type}`]);

            // Try pushing (don't fail hard if no remote)
            try {
                await runGitCommand(environment.repoId, ['push', 'origin', tagName]);
            } catch (pushErr) {
                console.warn('Git push failed (might be no remote):', pushErr.message);
            }

        } catch (gitErr) {
            console.error('Git operation failed:', gitErr);
            return res.status(500).json({ error: `Git deployment failed: ${gitErr.message}` });
        }
        // -----------------------------------

        // ... (deployment record insertion unchanged)
        const deploymentId = `deploy-${Date.now()}`;
        const now = new Date().toISOString();

        // Create deployment record
        db.prepare(`
            INSERT INTO deployments (id, environmentId, repoId, version, buildId, pipelineId, status, deployedAt, deployedBy, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'success', ?, ?, ?)
        `).run(deploymentId, req.params.id, environment.repoId, version, buildId || null, pipelineId || null, now, req.user.id, notes || null);

        // Update environment
        db.prepare(`
            UPDATE environments 
            SET currentVersion = ?, currentBuildId = ?, lastDeployedAt = ?, lastDeployedBy = ?, status = 'healthy'
            WHERE id = ?
        `).run(version, buildId || null, now, req.user.id, req.params.id);

        const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
        createActivityLog({
            userId: req.user.id,
            action: 'publicou atualização',
            target: environment.name,
            targetType: 'environment',
            meta: JSON.stringify({
                repoId: environment.repoId,
                repoName: repo?.name || environment.repoId,
                environmentId: environment.id,
                version,
                pipelineId: pipelineId || null,
                type: environment.type,
            }),
        });

        res.status(201).json({
            success: true,
            deployment,
            message: `Deployed version ${version} to ${environment.name} (Tag: ${tagName})`
        });
    } catch (err) {
        console.error('Deploy failed:', err);
        res.status(500).json({
            error: 'Deployment failed',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// POST /api/environments/:id/promote - Promote from another environment
router.post('/:id/promote', requireAuth, async (req, res) => {
    const { sourceEnvironmentId } = req.body;

    if (!sourceEnvironmentId) {
        return res.status(400).json({ error: 'sourceEnvironmentId is required' });
    }

    try {
        const targetEnv = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        const sourceEnv = db.prepare('SELECT * FROM environments WHERE id = ?').get(sourceEnvironmentId);

        if (!targetEnv || !sourceEnv) {
            return res.status(404).json({ error: 'Environment not found' });
        }
        const repo = db.prepare('SELECT id, name FROM repositories WHERE id = ?').get(targetEnv.repoId);

        if (!sourceEnv.currentVersion) {
            return res.status(400).json({ error: 'Source environment has no deployed version' });
        }

        // Validate promotion path (dev -> stage -> prod)
        const typeOrder = { dev: 0, stage: 1, prod: 2 };
        if (typeOrder[sourceEnv.type] >= typeOrder[targetEnv.type]) {
            return res.status(400).json({
                error: `Cannot promote from ${sourceEnv.type} to ${targetEnv.type}. Must promote to a higher environment.`
            });
        }

        const tagName = `env-${targetEnv.type}-v${sourceEnv.currentVersion}`;

        // --- GitOps: Create and Push Tag ---
        try {
            await runGitCommand(targetEnv.repoId, ['tag', '-a', tagName, '-m', `Promote version ${sourceEnv.currentVersion} from ${sourceEnv.type} to ${targetEnv.type}`]);
            try {
                await runGitCommand(targetEnv.repoId, ['push', 'origin', tagName]);
            } catch (pushErr) {
                console.warn('Git push failed:', pushErr.message);
            }
        } catch (gitErr) {
            console.error('Git promotion failed:', gitErr);
            return res.status(500).json({ error: `Git promotion failed: ${gitErr.message}. Tag might already exist.` });
        }

        // -----------------------------------

        const deploymentId = `deploy-${Date.now()}`;
        const now = new Date().toISOString();

        // Create deployment record (same build as source)
        db.prepare(`
            INSERT INTO deployments (id, environmentId, repoId, version, buildId, pipelineId, status, deployedAt, deployedBy, notes)
            VALUES (?, ?, ?, ?, ?, NULL, 'success', ?, ?, ?)
        `).run(
            deploymentId,
            req.params.id,
            targetEnv.repoId,
            sourceEnv.currentVersion,
            sourceEnv.currentBuildId,
            now,
            req.user.id,
            `Promoted from ${sourceEnv.name}`
        );

        // Update target environment
        db.prepare(`
            UPDATE environments 
            SET currentVersion = ?, currentBuildId = ?, lastDeployedAt = ?, lastDeployedBy = ?, status = 'healthy'
            WHERE id = ?
        `).run(sourceEnv.currentVersion, sourceEnv.currentBuildId, now, req.user.id, req.params.id);
        createActivityLog({
            userId: req.user.id,
            action: `promoveu ${sourceEnv.type} para ${targetEnv.type}`,
            target: targetEnv.name,
            targetType: 'environment',
            meta: JSON.stringify({
                repoId: targetEnv.repoId,
                repoName: repo?.name || targetEnv.repoId,
                environmentId: targetEnv.id,
                sourceEnvironmentId: sourceEnv.id,
                version: sourceEnv.currentVersion,
                type: targetEnv.type,
            }),
        });

        res.status(201).json({
            success: true,
            message: `Promoted ${sourceEnv.currentVersion} from ${sourceEnv.name} to ${targetEnv.name}`,
            promotedVersion: sourceEnv.currentVersion,
            promotedBuild: sourceEnv.currentBuildId
        });
    } catch (err) {
        console.error('Promotion failed:', err);
        res.status(500).json({ error: 'Promotion failed' });
    }
});

// POST /api/environments/:id/rollback - Rollback to a previous deployment
router.post('/:id/rollback', requireAuth, async (req, res) => {
    const { deploymentId } = req.body;

    try {
        const environment = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        if (!environment) {
            return res.status(404).json({ error: 'Environment not found' });
        }
        const repo = db.prepare('SELECT id, name FROM repositories WHERE id = ?').get(environment.repoId);

        let targetDeployment;

        if (deploymentId) {
            // Rollback to specific deployment
            targetDeployment = db.prepare('SELECT * FROM deployments WHERE id = ? AND environmentId = ?').get(deploymentId, req.params.id);
        } else {
            // Rollback to previous successful deployment
            targetDeployment = db.prepare(`
                SELECT * FROM deployments 
                WHERE environmentId = ? AND status = 'success' AND version != ?
                ORDER BY deployedAt DESC
                LIMIT 1
            `).get(req.params.id, environment.currentVersion);
        }

        if (!targetDeployment) {
            return res.status(404).json({ error: 'No valid deployment to rollback to' });
        }

        // --- GitOps: Tag for Rollback ---
        // We create a new tag because rollback is a new deployment event in time, even if version is old.
        // Format: env-{type}-rollback-to-v{version}-{timestamp}
        const tagName = `env-${environment.type}-rollback-to-v${targetDeployment.version}-${Date.now()}`;
        try {
            await runGitCommand(environment.repoId, ['tag', '-a', tagName, '-m', `Rollback to version ${targetDeployment.version}`]);
            try {
                await runGitCommand(environment.repoId, ['push', 'origin', tagName]);
            } catch (pushErr) {
                console.warn('Git push failed:', pushErr.message);
            }
        } catch (gitErr) {
            console.error('Git rollback failed:', gitErr);
            return res.status(500).json({ error: `Git rollback failed: ${gitErr.message}` });
        }
        // --------------------------------

        const rollbackId = `deploy-${Date.now()}`;
        const now = new Date().toISOString();

        // Create rollback deployment record
        db.prepare(`
            INSERT INTO deployments (id, environmentId, repoId, version, buildId, status, deployedAt, deployedBy, rollbackOf, notes)
            VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?, ?)
        `).run(
            rollbackId,
            req.params.id,
            environment.repoId,
            targetDeployment.version,
            targetDeployment.buildId,
            now,
            req.user.id,
            environment.currentVersion,
            `Rollback from ${environment.currentVersion} to ${targetDeployment.version}`
        );

        // Update environment
        db.prepare(`
            UPDATE environments 
            SET currentVersion = ?, currentBuildId = ?, lastDeployedAt = ?, lastDeployedBy = ?, status = 'healthy'
            WHERE id = ?
        `).run(targetDeployment.version, targetDeployment.buildId, now, req.user.id, req.params.id);
        createActivityLog({
            userId: req.user.id,
            action: 'executou rollback',
            target: environment.name,
            targetType: 'environment',
            meta: JSON.stringify({
                repoId: environment.repoId,
                repoName: repo?.name || environment.repoId,
                environmentId: environment.id,
                fromVersion: environment.currentVersion,
                toVersion: targetDeployment.version,
                type: environment.type,
            }),
        });

        res.json({
            success: true,
            message: `Rolled back to version ${targetDeployment.version}`,
            previousVersion: environment.currentVersion,
            currentVersion: targetDeployment.version
        });
    } catch (err) {
        console.error('Rollback failed:', err);
        res.status(500).json({ error: 'Rollback failed' });
    }
});

// DELETE /api/environments/:id - Delete an environment
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM environments WHERE id = ?').run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        res.json({ success: true, message: 'Environment deleted' });
    } catch (_err) {
        res.status(500).json({ error: 'Failed to delete environment' });
    }
});

// GET /api/environments/summary - Get environment summary per repo
router.get('/summary/all', requireAuth, (req, res) => {
    try {
        const summary = db.prepare(`
            SELECT 
                r.id as repoId,
                r.name as repoName,
                GROUP_CONCAT(e.type || ':' || COALESCE(e.currentVersion, 'none') || ':' || e.status, '|') as environments
            FROM repositories r
            LEFT JOIN environments e ON r.id = e.repoId
            GROUP BY r.id
        `).all();

        // Parse the concatenated string into structured data
        const formatted = summary.map(row => {
            const envData = row.environments ? row.environments.split('|').map(e => {
                const [type, version, status] = e.split(':');
                return { type, version: version === 'none' ? null : version, status };
            }) : [];

            return {
                repoId: row.repoId,
                repoName: row.repoName,
                dev: envData.find(e => e.type === 'dev'),
                stage: envData.find(e => e.type === 'stage'),
                prod: envData.find(e => e.type === 'prod')
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Failed to fetch environment summary:', err);
        res.status(500).json({ error: 'Failed to fetch environment summary' });
    }
});

export default router;

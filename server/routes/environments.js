import express from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { execFile } from 'child_process';
import util from 'util';
import { validate, createEnvironmentSchema, updateEnvironmentSchema, deployEnvironmentSchema, promoteEnvironmentSchema, rollbackEnvironmentSchema } from '../validation.js';
import { uid, sendError } from '../utils.js';

import fs from 'fs';

const router = express.Router();
const execFileAsync = util.promisify(execFile);

const createActivityLog = ({ userId, action, target, targetType, meta = null }) => {
    db.prepare(`
        INSERT INTO activities (id, userId, action, target, targetType, taskId, timestamp, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uid('a'), userId, action, target, targetType, null, new Date().toISOString(), meta);
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
        sendError(res, 500, 'Failed to fetch environments');
    }
});

// GET /api/environments/:id - Get specific environment details
router.get('/:id', requireAuth, (req, res) => {
    try {
        const environment = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);

        if (!environment) {
            return sendError(res, 404, 'Environment not found');
        }

        // Get deployments
        const deployments = db.prepare('SELECT * FROM deployments WHERE environmentId = ? ORDER BY deployedAt DESC').all(req.params.id);

        res.json({ ...environment, deployments });
    } catch (_err) {
        sendError(res, 500, 'Failed to fetch environment details');
    }
});

// POST /api/environments - Create a new environment
router.post('/', requireAuth, validate(createEnvironmentSchema), async (req, res) => {
    const { name, type, repoId, description, internalNotes } = req.body;

    try {
        const id = uid('env');

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
        sendError(res, 500, 'Failed to create environment');
    }
});

// PUT /api/environments/:id - Update environment
router.put('/:id', requireAuth, validate(updateEnvironmentSchema), (req, res) => {
    const { name, type, description, internalNotes } = req.body;

    try {
        const existingEnvironment = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        if (!existingEnvironment) {
            return sendError(res, 404, 'Environment not found');
        }

        db.prepare(`
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
        sendError(res, 500, 'Failed to update environment');
    }
});

// POST /api/environments/:id/deploy - Deploy to an environment
router.post('/:id/deploy', requireAuth, validate(deployEnvironmentSchema), async (req, res) => {
    const { version, buildId, pipelineId, notes, force } = req.body; // Accept force flag

    // Sanitize version for git tag safety: allow semver-like patterns
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(version)) {
        return sendError(res, 400, 'Formato de versão inválido. Use caracteres alfanuméricos, pontos, hífens e underscores.');
    }

    try {
        const environment = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        if (!environment) {
            return sendError(res, 404, 'Environment not found');
        }
        const repo = db.prepare('SELECT id, name FROM repositories WHERE id = ?').get(environment.repoId);

        const tagName = `env-${environment.type}-v${version}`;

        // --- GitOps: Create and Push Tag ---
        try {
            // 0. Check if repo has commits (HEAD exists)
            try {
                await runGitCommand(environment.repoId, ['rev-parse', 'HEAD']);
            } catch (_err) {
                return sendError(res, 400, 'O repositório está vazio. Faça pelo menos um commit antes de realizar o deploy.');
            }

            // Check if tag exists locally
            try {
                await runGitCommand(environment.repoId, ['rev-parse', tagName]);
                if (!force) {
                    return sendError(res, 409, `Tag ${tagName} already exists. Use a new version or force deploy.`);
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
            return sendError(res, 500, `Git deployment failed: ${gitErr.message}`);
        }
        // -----------------------------------

        // ... (deployment record insertion unchanged)
        const deploymentId = uid('deploy');
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
        sendError(res, 500, 'Deployment failed', err.message);
    }
});

// POST /api/environments/:id/promote - Promote from another environment
router.post('/:id/promote', requireAuth, validate(promoteEnvironmentSchema), async (req, res) => {
    const { sourceEnvironmentId } = req.body;

    try {
        const targetEnv = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        const sourceEnv = db.prepare('SELECT * FROM environments WHERE id = ?').get(sourceEnvironmentId);

        if (!targetEnv || !sourceEnv) {
            return sendError(res, 404, 'Environment not found');
        }
        const repo = db.prepare('SELECT id, name FROM repositories WHERE id = ?').get(targetEnv.repoId);

        if (!sourceEnv.currentVersion) {
            return sendError(res, 400, 'Source environment has no deployed version');
        }

        // Validate promotion path (dev -> stage -> prod)
        const typeOrder = { dev: 0, stage: 1, prod: 2 };
        if (typeOrder[sourceEnv.type] >= typeOrder[targetEnv.type]) {
            return sendError(res, 400, `Cannot promote from ${sourceEnv.type} to ${targetEnv.type}. Must promote to a higher environment.`);
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
            return sendError(res, 500, `Git promotion failed: ${gitErr.message}. Tag might already exist.`);
        }

        // -----------------------------------

        const deploymentId = uid('deploy');
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
        sendError(res, 500, 'Promotion failed');
    }
});

// POST /api/environments/:id/rollback - Rollback to a previous deployment
router.post('/:id/rollback', requireAuth, validate(rollbackEnvironmentSchema), async (req, res) => {
    const { deploymentId } = req.body;

    try {
        const environment = db.prepare('SELECT * FROM environments WHERE id = ?').get(req.params.id);
        if (!environment) {
            return sendError(res, 404, 'Environment not found');
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
            return sendError(res, 404, 'No valid deployment to rollback to');
        }

        // --- GitOps: Tag for Rollback ---
        // We create a new tag because rollback is a new deployment event in time, even if version is old.
        // Format: env-{type}-rollback-to-v{version}-{timestamp}
        const tagName = `env-${environment.type}-rollback-to-v${targetDeployment.version}-${uid('rb')}`;
        try {
            await runGitCommand(environment.repoId, ['tag', '-a', tagName, '-m', `Rollback to version ${targetDeployment.version}`]);
            try {
                await runGitCommand(environment.repoId, ['push', 'origin', tagName]);
            } catch (pushErr) {
                console.warn('Git push failed:', pushErr.message);
            }
        } catch (gitErr) {
            console.error('Git rollback failed:', gitErr);
            return sendError(res, 500, `Git rollback failed: ${gitErr.message}`);
        }
        // --------------------------------

        const rollbackId = uid('deploy');
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
        sendError(res, 500, 'Rollback failed');
    }
});

// DELETE /api/environments/:id - Delete an environment
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM environments WHERE id = ?').run(req.params.id);

        if (result.changes === 0) {
            return sendError(res, 404, 'Environment not found');
        }

        res.json({ success: true, message: 'Environment deleted' });
    } catch (_err) {
        sendError(res, 500, 'Failed to delete environment');
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
        sendError(res, 500, 'Failed to fetch environment summary');
    }
});

export default router;

import express from 'express';
import db from '../db.js';
import { execFile, execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin, requirePermission } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { createTaskSchema, updateTaskSchema, createSprintSchema, updateSprintSchema, createRepoSchema, validate } from '../validation.js';
import { uid, sendError } from '../utils.js';

const router = express.Router();

// --- Input Sanitization Helpers for Git operations ---

/** Validate a Git ref name (branch, tag, remote). Rejects traversal and control chars. */
const isValidGitRef = (ref) => {
    if (!ref || typeof ref !== 'string') return false;
    // Git ref rules: no space, ~, ^, :, ?, *, [, \, .., @{, trailing dot/slash, ASCII control
    return /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(ref)
        && !ref.includes('..')
        && !ref.includes('@{')
        && !ref.endsWith('.')
        && !ref.endsWith('/')
        && ref.length <= 255;
};

/** Validate a remote name. Very restrictive (alphanumeric + hyphens). */
const isValidRemoteName = (name) => {
    if (!name || typeof name !== 'string') return false;
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name) && name.length <= 64;
};

/** Validate file paths passed to git commands. Blocks traversal and null bytes. */
const isValidGitFilePath = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return false;
    // Block null bytes and absolute paths
    if (filePath.includes('\0')) return false;
    // Normalize and check for traversal outside repo root
    const normalized = path.normalize(filePath);
    if (path.isAbsolute(normalized)) return false;
    if (normalized.startsWith('..')) return false;
    return true;
};

/** Validate a remote URL (basic format check). */
const isValidRemoteUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    if (url.includes('\0')) return false;
    // Allow https://, git://, ssh://, git@host: patterns
    return /^(https?:\/\/|git:\/\/|ssh:\/\/|git@[\w.-]+:).+$/.test(url) && url.length <= 2048;
};

// Helper para executar Git em um diretório específico
const runGitInDir = (args, cwd) => {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Git error: ${stderr}`);
                reject({ error: error.message, stderr });
            } else {
                resolve(stdout.trim());
            }
        });
    });
};

const normalizePathForComparison = (targetPath) => {
    const resolvedPath = path.resolve(targetPath);
    return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
};

const isPathInsideRoot = (rootPath, targetPath) => {
    const normalizedRoot = normalizePathForComparison(rootPath);
    const normalizedTarget = normalizePathForComparison(targetPath);
    return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
};

const taskStatusLabels = {
    backlog: 'Backlog',
    todo: 'A Fazer',
    doing: 'Em Progresso',
    review: 'Em Revisao',
    ready: 'Pronto para Release',
    done: 'Concluido',
};

const collectNotifyTargets = (userId, taskId, targetType, parsedMeta) => {
    const targets = new Set();

    try {
        if (taskId) {
            const task = db.prepare('SELECT assigneeId, pairAssigneeId FROM tasks WHERE id = ?').get(taskId);
            if (task?.assigneeId && task.assigneeId !== userId) targets.add(task.assigneeId);
            if (task?.pairAssigneeId && task.pairAssigneeId !== userId) targets.add(task.pairAssigneeId);
        }

        if (parsedMeta?.repoId && ['commit', 'environment'].includes(targetType)) {
            const recentAuthors = db.prepare(`
                SELECT DISTINCT userId FROM activities
                WHERE meta LIKE ? AND userId != ? AND timestamp > datetime('now', '-30 days')
            `).all(`%"repoId":"${parsedMeta.repoId}"%`, userId);
            for (const row of recentAuthors) targets.add(row.userId);
        }
    } catch {
        // Best-effort: don't block activity logging if notify target lookup fails
    }

    return targets;
};

const generateNotifications = ({ userId, action, target, targetType, taskId, meta, timestamp }) => {
    const parsedMeta = meta ? (() => { try { return JSON.parse(meta); } catch { return null; } })() : null;
    const notifyUserIds = collectNotifyTargets(userId, taskId, targetType, parsedMeta);
    if (notifyUserIds.size === 0) return;

    const notifTypeMap = { issue: 'task', commit: 'commit', pr: 'pr', sprint: 'sprint', environment: 'deploy', repo: 'repo' };
    const notifType = notifTypeMap[targetType] || 'activity';
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
    const title = `${actor?.name || 'Alguém'} ${action}`;

    const insertNotif = db.prepare(`
        INSERT INTO notifications (id, userId, type, title, body, relatedType, relatedId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const recipientId of notifyUserIds) {
        insertNotif.run(
            uid('n'),
            recipientId, notifType, title, target, targetType, taskId || parsedMeta?.repoId || null, timestamp
        );
    }
};

const createActivityLog = ({ userId, action, target, targetType, taskId = null, meta = null }) => {
    const timestamp = new Date().toISOString();
    try {
        db.prepare(`
            INSERT INTO activities (id, userId, action, target, targetType, taskId, timestamp, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uid('a'), userId, action, target, targetType, taskId, timestamp, meta);
    } catch {
        // Activity logging should never crash the request
        return;
    }

    try {
        generateNotifications({ userId, action, target, targetType, taskId, meta, timestamp });
    } catch {
        // Notification generation should never block activity logging
    }
};

const summarizeComment = (text) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.length > 84 ? `${normalized.slice(0, 81)}...` : normalized;
};

/* --- GIT ENDPOINTS POR REPOSITÓRIO --- */

// Status Git de um repositório específico
router.get('/repos/:id/git/status', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return sendError(res, 404, 'Repositório não encontrado');
        }
        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return sendError(res, 404, 'Diretório do repositório não encontrado');
        }

        const statusOutput = await runGitInDir(['status', '--porcelain'], repo.localPath);
        const branchOutput = await runGitInDir(['branch', '--show-current'], repo.localPath);

        const changes = statusOutput.split('\n').filter(Boolean).map((line, index) => {
            // Formatar para remover \r do Windows
            const cleanLine = line.replace(/\r/g, '');
            // git status --porcelain formato: XY arquivo (2 chars status + 1 espaço)
            const status = cleanLine.substring(0, 2);
            // Usar substring(2) e trim para ser mais seguro contra variações de espaçamento
            const file = cleanLine.substring(2).trim();

            return {
                id: `g${index}`,
                file,
                status: status.includes('??') ? 'added' : status.includes('D') ? 'deleted' : 'modified'
            };
        });

        res.json({
            branch: branchOutput || 'main',
            changes,
            localPath: repo.localPath
        });
    } catch (err) {
        sendError(res, 500, 'Falha ao obter status Git', err);
    }
});

// Diff de um arquivo específico
router.get('/repos/:id/git/diff', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { file, staged } = req.query;

    if (!file) {
        return sendError(res, 400, 'Arquivo não especificado');
    }
    if (!isValidGitFilePath(file)) {
        return sendError(res, 400, 'Caminho de arquivo inválido');
    }

    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return sendError(res, 404, 'Repositório não encontrado');
        }
        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return sendError(res, 404, 'Diretório do repositório não encontrado');
        }

        // Verificar status do arquivo para saber se é Untracked
        const statusOutput = await runGitInDir(['status', '--porcelain', file], repo.localPath);
        const isUntracked = statusOutput.trim().startsWith('??');

        if (isUntracked) {
            // Se for untracked, lê o arquivo e retorna como adicionado
            const filePath = path.join(repo.localPath, file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                // Formato diff simples (apenas linhas adicionadas)
                const diff = content.split('\n').map(line => `+${line}`).join('\n');
                return res.json({ diff });
            } else {
                return res.json({ diff: '' });
            }
        }

        // Se não for untracked, usa git diff
        const args = staged === 'true' ? ['diff', '--cached', file] : ['diff', file];
        const diffOutput = await runGitInDir(args, repo.localPath);

        // Se git diff não retornar nada (ex: arquivo binário ou sem mudanças), mas arquivo existe
        if (!diffOutput && fs.existsSync(path.join(repo.localPath, file))) {
            // Pode ser que esteja staged e pedimos unstaged, ou vice-versa, ou é binário
            if (diffOutput === '') return res.json({ diff: '' });
        }

        // Remover cabeçalho do git diff para mostrar apenas as mudanças (opcional, mas o frontend pode esperar raw)
        // O mockDiff gera linhas com + e -. O git diff gera cabeçalho.
        // Vamos retornar o output completo e deixar o frontend processar ou processar aqui.
        // O frontend atual espera array de linhas com type: 'add' | 'del'.
        // Vamos retornar o raw diff string e adaptar o frontend para parsear diff real.

        res.json({ diff: diffOutput });

    } catch (err) {
        console.error(err);
        sendError(res, 500, 'Falha ao obter diff', err);
    }
});

// Estatísticas do Dashboard (Agregado de todos os repos)
router.get('/dashboard/stats', requireAuth, async (req, res) => {
    try {
        const repos = db.prepare('SELECT * FROM repositories').all();
        const stats = {
            totalCommits: 0, // Total no período (1 ano)
            weeklyCommits: 0, // Últimos 7 dias
            contributions: {}, // data (YYYY-MM-DD) -> count
            failedRepos: 0,
            failedRepoDetails: [] // { id, name, reason }
        };

        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(today.getDate() - 7);

        for (const repo of repos) {
            if (!repo.localPath || !fs.existsSync(repo.localPath)) {
                stats.failedRepos++;
                stats.failedRepoDetails.push({
                    id: repo.id,
                    name: repo.name,
                    reason: !repo.localPath ? 'Caminho local não configurado' : 'Diretório não encontrado'
                });
                continue;
            }

            try {
                // Obter commits do último ano, apenas datas
                // %ad = data do autor, --date=short = YYYY-MM-DD
                // Obter commits do último ano, apenas datas
                // %ad = data do autor, --date=short = YYYY-MM-DD
                const logOutput = await runGitInDir(['log', `--since=${oneYearAgo.toISOString()}`, '--format=%ad', '--date=iso-strict'], repo.localPath);

                if (!logOutput) continue;

                const lines = logOutput.split('\n').filter(Boolean);
                for (const line of lines) {
                    const dateStr = line.split('T')[0]; // Pegar YYYY-MM-DD da data ISO
                    if (!dateStr) continue;

                    stats.totalCommits++;
                    stats.contributions[dateStr] = (stats.contributions[dateStr] || 0) + 1;

                    // Verificar se é da última semana
                    const commitDate = new Date(line);
                    if (commitDate >= oneWeekAgo) {
                        stats.weeklyCommits++;
                    }
                }
            } catch (_err) {
                // Se falhar o git log (repo vazio ou sem commits), apenas ignora
            }
        }

        res.json(stats);
    } catch (err) {
        console.error('Failed to generate dashboard stats:', err);
        sendError(res, 500, 'Falha ao gerar estatísticas', err.message);
    }
});

// Branches de um repositório específico
router.get('/repos/:id/git/branches', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return sendError(res, 404, 'Repositório não encontrado');
        }
        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return sendError(res, 404, 'Diretório do repositório não encontrado');
        }

        const branchOutput = await runGitInDir(['branch'], repo.localPath);
        const currentBranchOutput = await runGitInDir(['branch', '--show-current'], repo.localPath);

        const branches = branchOutput.split('\n')
            .map(b => b.trim().replace(/^\* /, ''))
            .filter(Boolean);

        res.json({
            branches,
            currentBranch: currentBranchOutput || 'main'
        });
    } catch (err) {
        sendError(res, 500, 'Falha ao listar branches', err);
    }
});

// Helper: validar que o repo existe e tem localPath
const getRepoOrError = (id, res) => {
    const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
    if (!repo) { sendError(res, 404, 'Repositório não encontrado'); return null; }
    if (!repo.localPath || !fs.existsSync(repo.localPath)) {
        sendError(res, 404, 'Diretório do repositório não encontrado');
        return null;
    }
    return repo;
};

// Stage arquivos específicos (git add <file> ...)
router.post('/repos/:id/git/stage', requireAuth, requirePermission('git:write'), async (req, res) => {
    const { id } = req.params;
    const { files } = req.body; // array of file paths
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!files || files.length === 0) {
            return sendError(res, 400, 'Nenhum arquivo especificado');
        }
        if (!Array.isArray(files) || files.some(f => !isValidGitFilePath(f))) {
            return sendError(res, 400, 'Caminhos de arquivo inválidos');
        }
        await runGitInDir(['add', '--', ...files], repo.localPath);
        res.json({ success: true, message: `${files.length} arquivo(s) adicionado(s) ao stage` });
    } catch (err) {
        sendError(res, 500, 'Falha ao adicionar arquivos ao stage', err);
    }
});

// Unstage arquivos específicos (git restore --staged <file> ...)
router.post('/repos/:id/git/unstage', requireAuth, requirePermission('git:write'), async (req, res) => {
    const { id } = req.params;
    const { files } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!files || files.length === 0) {
            return sendError(res, 400, 'Nenhum arquivo especificado');
        }
        if (!Array.isArray(files) || files.some(f => !isValidGitFilePath(f))) {
            return sendError(res, 400, 'Caminhos de arquivo inválidos');
        }
        await runGitInDir(['restore', '--staged', '--', ...files], repo.localPath);
        res.json({ success: true, message: `${files.length} arquivo(s) removido(s) do stage` });
    } catch (err) {
        sendError(res, 500, 'Falha ao remover arquivos do stage', err);
    }
});

// Commit em um repositório específico (usa apenas arquivos já staged)
router.post('/repos/:id/git/commit', requireAuth, requirePermission('git:write'), async (req, res) => {
    const { id } = req.params;
    const { message, files } = req.body;
    // files: optional array — if provided, stage them first; otherwise commit what's already staged
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        if (!message || !message.trim()) {
            return sendError(res, 400, 'Mensagem de commit é obrigatória');
        }

        // If files array provided, validate and stage them explicitly; otherwise use what's already staged
        if (files && files.length > 0) {
            if (!Array.isArray(files) || files.some(f => !isValidGitFilePath(f))) {
                return sendError(res, 400, 'Caminhos de arquivo inválidos');
            }
            await runGitInDir(['add', '--', ...files], repo.localPath);
        }

        await runGitInDir(['commit', '-m', message], repo.localPath);

        // Update lastUpdated in DB
        db.prepare('UPDATE repositories SET lastUpdated = ? WHERE id = ?')
            .run(new Date().toISOString(), id);

        res.json({ success: true, message: 'Commit realizado com sucesso' });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        // Detect "nothing to commit"
        if (errMsg.includes('nothing to commit') || errMsg.includes('nothing added to commit')) {
            return sendError(res, 400, 'Nada para commitar. Adicione arquivos ao stage primeiro.');
        }
        sendError(res, 500, 'Falha ao realizar commit', errMsg);
    }
});

// Push para o remote
router.post('/repos/:id/git/push', requireAuth, requirePermission('git:write'), async (req, res) => {
    const { id } = req.params;
    const { remote = 'origin', branch } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        if (!isValidRemoteName(remote)) {
            return sendError(res, 400, 'Nome de remote inválido');
        }
        // Get current branch if not specified
        let targetBranch = branch;
        if (!targetBranch) {
            targetBranch = await runGitInDir(['branch', '--show-current'], repo.localPath);
        }

        if (!targetBranch) {
            return sendError(res, 400, 'Não foi possível determinar o branch atual');
        }
        if (!isValidGitRef(targetBranch)) {
            return sendError(res, 400, 'Nome de branch inválido');
        }

        await runGitInDir(['push', remote, targetBranch], repo.localPath);

        res.json({ success: true, message: `Push realizado para ${remote}/${targetBranch}` });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        // Provide helpful error messages
        if (errMsg.includes('No configured push destination') || errMsg.includes('no upstream')) {
            return sendError(res, 400, 'Nenhum remote configurado. Configure a URL do remote nas configurações do repositório.', errMsg);
        }
        if (errMsg.includes('Authentication failed') || errMsg.includes('could not read Username')) {
            return sendError(res, 401, 'Falha de autenticação no remote Git.', errMsg);
        }
        sendError(res, 500, 'Falha ao realizar push', errMsg);
    }
});

// Pull do remote
router.post('/repos/:id/git/pull', requireAuth, requirePermission('git:write'), async (req, res) => {
    const { id } = req.params;
    const { remote = 'origin', branch } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        if (!isValidRemoteName(remote)) {
            return sendError(res, 400, 'Nome de remote inválido');
        }
        const args = ['pull', remote];
        if (branch) {
            if (!isValidGitRef(branch)) {
                return sendError(res, 400, 'Nome de branch inválido');
            }
            args.push(branch);
        }

        const output = await runGitInDir(args, repo.localPath);
        res.json({ success: true, message: output || 'Pull realizado com sucesso' });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        sendError(res, 500, 'Falha ao realizar pull', errMsg);
    }
});

// Checkout de branch existente
router.post('/repos/:id/git/checkout', requireAuth, requirePermission('git:write'), async (req, res) => {
    const { id } = req.params;
    const { branch } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!branch) return sendError(res, 400, 'Branch não especificado');
        if (!isValidGitRef(branch)) return sendError(res, 400, 'Nome de branch inválido');

        await runGitInDir(['checkout', branch], repo.localPath);
        res.json({ success: true, message: `Checkout realizado para ${branch}` });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        sendError(res, 500, 'Falha ao realizar checkout', errMsg);
    }
});

// Criar novo branch (e fazer checkout)
router.post('/repos/:id/git/branch', requireAuth, requirePermission('git:write'), async (req, res) => {
    const { id } = req.params;
    const { name, checkout = true } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!name || !name.trim()) return sendError(res, 400, 'Nome do branch é obrigatório');

        // Sanitize branch name
        const safeName = name.trim().replace(/[^a-zA-Z0-9/_\-.]/g, '-');

        if (checkout) {
            await runGitInDir(['checkout', '-b', safeName], repo.localPath);
        } else {
            await runGitInDir(['branch', safeName], repo.localPath);
        }

        res.json({ success: true, branch: safeName, message: `Branch "${safeName}" criado${checkout ? ' e checkout realizado' : ''}` });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        if (errMsg.includes('already exists')) {
            return sendError(res, 409, `Branch já existe`, errMsg);
        }
        sendError(res, 500, 'Falha ao criar branch', errMsg);
    }
});

// Configurar remote URL do repositório
router.put('/repos/:id/git/remote', requireAuth, requirePermission('git:write'), async (req, res) => {
    const { id } = req.params;
    const { url, remote = 'origin' } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!url) return sendError(res, 400, 'URL do remote é obrigatória');
        if (!isValidRemoteName(remote)) return sendError(res, 400, 'Nome de remote inválido');
        if (!isValidRemoteUrl(url)) return sendError(res, 400, 'URL de remote inválida. Use https://, git://, ssh:// ou git@host:');

        // Check if remote exists
        try {
            await runGitInDir(['remote', 'get-url', remote], repo.localPath);
            // Remote exists — update it
            await runGitInDir(['remote', 'set-url', remote, url], repo.localPath);
        } catch {
            // Remote doesn't exist — add it
            await runGitInDir(['remote', 'add', remote, url], repo.localPath);
        }

        // Save remoteUrl to DB
        db.prepare('UPDATE repositories SET remoteUrl = ? WHERE id = ?').run(url, id);

        res.json({ success: true, message: `Remote "${remote}" configurado para ${url}` });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        sendError(res, 500, 'Falha ao configurar remote', errMsg);
    }
});

// Git log com paginação e filtro por branch
router.get('/repos/:id/git/log', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { branch, limit = 30, skip = 0, author } = req.query;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 30, 500));
        const safeSkip = Math.max(0, Number.parseInt(skip, 10) || 0);

        const args = [
            'log',
            `--max-count=${safeLimit}`,
            `--skip=${safeSkip}`,
            '--format=%H|%h|%an|%ae|%ai|%s',
        ];
        if (branch) {
            if (!isValidGitRef(branch)) return sendError(res, 400, 'Nome de branch inválido');
            args.push(branch);
        }
        if (author) {
            // Sanitize author: strip control chars and limit length
            const safeAuthor = String(author)
                .split('')
                .filter((char) => {
                    const code = char.charCodeAt(0);
                    return code >= 32 && code !== 127;
                })
                .join('')
                .slice(0, 128);
            if (safeAuthor) args.push(`--author=${safeAuthor}`);
        }

        const output = await runGitInDir(args, repo.localPath);

        const commits = output.split('\n').filter(Boolean).map(line => {
            const [fullHash, hash, author, email, date, ...msgParts] = line.split('|');
            return { fullHash, hash, author, email, date, message: msgParts.join('|') };
        });

        // Get total count for pagination
        const countArgs = ['rev-list', '--count'];
        if (branch) countArgs.push(branch); else countArgs.push('HEAD');
        let total = 0;
        try {
            const countOut = await runGitInDir(countArgs, repo.localPath);
            total = parseInt(countOut.trim(), 10) || 0;
        } catch { /* empty repo */ }

        res.json({ commits, total, limit: Number(limit), skip: Number(skip) });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        if (errMsg.includes('does not have any commits')) {
            return res.json({ commits: [], total: 0, limit: Number(limit), skip: Number(skip) });
        }
        sendError(res, 500, 'Falha ao obter log do Git', errMsg);
    }
});

// Obter remotes configurados
router.get('/repos/:id/git/remotes', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        const output = await runGitInDir(['remote', '-v'], repo.localPath);
        const remotes = {};
        output.split('\n').filter(Boolean).forEach(line => {
            const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
            if (match) remotes[match[1]] = match[2];
        });

        res.json({ remotes });
    } catch (_err) {
        res.json({ remotes: {} });
    }
});


// PUBLIC SETTINGS (for login page - no auth required)
router.get('/settings/public', (req, res) => {
    const allowSelfRegister = db.prepare('SELECT value FROM settings WHERE key = ?').get('allowSelfRegister');
    res.json({
        allowSelfRegister: allowSelfRegister?.value === 'true'
    });
});

/* --- DATA ENDPOINTS --- */

// ACTIVITIES
router.get('/activities', requireAuth, (req, res) => {
    try {
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
        const skip = Math.max(Number.parseInt(req.query.skip, 10) || 0, 0);

        const total = db.prepare('SELECT COUNT(*) as count FROM activities').get().count;
        const activities = db.prepare(`
            SELECT a.*, u.id as user_id, u.name as user_name, u.avatar as user_avatar
            FROM activities a
            LEFT JOIN users u ON a.userId = u.id
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        `).all(limit, skip);

        // Parse user object
        const parsedActivities = activities.map(act => ({
            id: act.id,
            action: act.action,
            target: act.target,
            targetType: act.targetType,
            taskId: act.taskId || undefined,
            timestamp: act.timestamp,
            meta: act.meta,
            user: {
                id: act.user_id,
                name: act.user_name,
                avatar: act.user_avatar
            }
        }));

        res.json({ items: parsedActivities, total, limit, skip });
    } catch (err) {
        sendError(res, 500, 'Falha ao carregar atividades', err.message);
    }
});

// NOTIFICATIONS
router.get('/notifications', requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
        const skip = Math.max(Number.parseInt(req.query.skip, 10) || 0, 0);

        const total = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE userId = ?').get(userId).count;
        const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND read = 0').get(userId).count;
        const notifications = db.prepare(`
            SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?
        `).all(userId, limit, skip);

        res.json({ items: notifications, total, unreadCount, limit, skip });
    } catch (err) {
        sendError(res, 500, 'Falha ao carregar notificações', err.message);
    }
});

router.put('/notifications/:id/read', requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?').run(id, req.user.id);
        if (result.changes === 0) return sendError(res, 404, 'Notificação não encontrada');
        res.json({ success: true });
    } catch (err) {
        sendError(res, 500, 'Falha ao marcar notificação como lida', err.message);
    }
});

router.put('/notifications/read-all', requireAuth, (req, res) => {
    try {
        db.prepare('UPDATE notifications SET read = 1 WHERE userId = ? AND read = 0').run(req.user.id);
        res.json({ success: true });
    } catch (err) {
        sendError(res, 500, 'Falha ao marcar notificações como lidas', err.message);
    }
});

// USERS
router.get('/users', requireAuth, (req, res) => {
    try {
        const users = db.prepare('SELECT * FROM users').all();
        res.json(users);
    } catch (err) {
        sendError(res, 500, 'Falha ao carregar usuários', err.message);
    }
});

// REPOSITORIES
router.get('/repos', requireAuth, (req, res) => {
    try {
        const repos = db.prepare(`
            SELECT r.*,
                   p.status as lastPipelineStatus,
                   p.finishedAt as lastPipelineDate
            FROM repositories r
            LEFT JOIN pipelines p ON p.id = (
                SELECT id FROM pipelines
                WHERE repoId = r.id
                ORDER BY createdAt DESC
                LIMIT 1
            )
        `).all();
        const reposWithStatus = repos.map(r => ({
            ...r,
            pathMissing: r.localPath ? !fs.existsSync(r.localPath) : false
        }));
        res.json(reposWithStatus);
    } catch (err) {
        sendError(res, 500, 'Falha ao carregar repositórios', err.message);
    }
});

router.post('/repos', requireAuth, requirePermission('repos:write'), validate(createRepoSchema), (req, res) => {
    const { id, name, description, status, lastUpdated, branch, issues, localPath: providedLocalPath, linkExisting } = req.body;
    try {
        let fullPath;

        if (linkExisting && providedLocalPath) {
            // --- LINK EXISTING REPO MODE ---
            fullPath = path.resolve(providedLocalPath);

            if (!fs.existsSync(fullPath)) {
                return sendError(res, 400, `Caminho não encontrado: ${fullPath}`);
            }

            // Verify it's a git repo
            const gitDir = path.join(fullPath, '.git');
            if (!fs.existsSync(gitDir)) {
                return sendError(res, 400, 'O diretório não contém um repositório Git (.git não encontrado).');
            }

        } else {
            // --- CREATE NEW REPO MODE ---
            const setting = db.prepare("SELECT value FROM settings WHERE key = 'gitDirectory'").get();
            if (!setting || !setting.value) {
                return sendError(res, 400, 'Diretório Git não configurado nas Configurações do Sistema.');
            }
            const gitDir = setting.value;

            const safeName = name.replace(/[^a-zA-Z0-9-_.]/g, '');
            fullPath = path.join(gitDir, safeName);

            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }

            // Git init
            try {
                execFileSync('git', ['init', '-b', branch || 'main'], { cwd: fullPath });
            } catch {
                // Older git versions don't support -b flag
                execFileSync('git', ['init'], { cwd: fullPath });
            }

            // Create README and initial commit
            const readmePath = path.join(fullPath, 'README.md');
            if (!fs.existsSync(readmePath)) {
                fs.writeFileSync(readmePath, `# ${name}\n\n${description || 'Novo projeto.'}\n`);
                execFileSync('git', ['add', '.'], { cwd: fullPath });
                try {
                    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: fullPath });
                } catch (_commitErr) {
                    // Fallback: set local git user config if global is missing
                    execFileSync('git', ['config', 'user.email', 'devflow@localhost'], { cwd: fullPath });
                    execFileSync('git', ['config', 'user.name', 'DevFlow'], { cwd: fullPath });
                    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: fullPath });
                }
            }
        }

        // Save to DB
        const stmt = db.prepare('INSERT INTO repositories (id, name, description, status, lastUpdated, branch, issues, localPath) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        stmt.run(id, name, description, status || 'active', lastUpdated || new Date().toISOString(), branch || 'main', issues || 0, fullPath);

        res.json({ success: true, repo: { id, name, description, localPath: fullPath } });
    } catch (error) {
        console.error(error);
        sendError(res, 500, 'Falha ao criar/vincular repositório', error.message);
    }
});

router.put('/repos/:id/settings', requireAuth, (req, res) => {
    const { id } = req.params;
    const { gitlabProjectPath, remoteUrl } = req.body;
    try {
        const repo = db.prepare('SELECT id FROM repositories WHERE id = ?').get(id);
        if (!repo) return sendError(res, 404, 'Repositório não encontrado');

        const updates = [];
        const values = [];
        if (gitlabProjectPath !== undefined) { updates.push('gitlabProjectPath = ?'); values.push(gitlabProjectPath); }
        if (remoteUrl !== undefined) { updates.push('remoteUrl = ?'); values.push(remoteUrl); }

        if (updates.length === 0) return res.json({ success: true });

        values.push(id);
        db.prepare(`UPDATE repositories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        res.json({ success: true });
    } catch (error) {
        sendError(res, 500, 'Falha ao salvar configurações', error.message);
    }
});

router.delete('/repos/:id', requireAuth, requirePermission('repos:write'), (req, res) => {
    const { id } = req.params;
    try {
        const result = db.prepare('DELETE FROM repositories WHERE id = ?').run(id);
        if (result.changes === 0) {
            return sendError(res, 404, 'Repositório não encontrado');
        }
        // Também remove tarefas associadas ao repositório (opcional, pode ser um soft-delete)
        db.prepare('UPDATE tasks SET repositoryId = NULL WHERE repositoryId = ?').run(id);
        res.json({ message: 'Repositório removido com sucesso' });
    } catch (error) {
        console.error(error);
        sendError(res, 500, 'Falha ao remover repositório', error.message);
    }
});

// Listar arquivos reais do repositório (suporta subPath para navegação em subdiretórios)
router.get('/repos/:id/files', requireAuth, (req, res) => {
    const { id } = req.params;
    const { subPath = '' } = req.query; // relative path inside repo, e.g. "src/components"
    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return sendError(res, 404, 'Repositório não encontrado');
        }

        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return sendError(res, 404, 'Diretório do repositório não encontrado');
        }

        // Build safe target directory
        const safeSub = subPath ? path.normalize(subPath).replace(/^(\.\.(\/|\\))+/, '') : '';
        const targetDir = safeSub ? path.join(repo.localPath, safeSub) : repo.localPath;

        // Prevent path traversal
        if (!isPathInsideRoot(repo.localPath, targetDir)) {
            return sendError(res, 403, 'Acesso negado');
        }

        if (!fs.existsSync(targetDir)) {
            return sendError(res, 404, 'Diretório não encontrado');
        }

        const items = fs.readdirSync(targetDir, { withFileTypes: true });
        const files = items
            .filter(item => item.name !== '.git')
            .map(item => {
                const itemRelPath = safeSub ? `${safeSub}/${item.name}` : item.name;
                return {
                    name: item.name,
                    relativePath: itemRelPath, // full relative path from repo root
                    type: item.isDirectory() ? 'directory' : 'file',
                    modifiedAt: fs.statSync(path.join(targetDir, item.name)).mtime
                };
            })
            .sort((a, b) => {
                if (a.type === 'directory' && b.type !== 'directory') return -1;
                if (a.type !== 'directory' && b.type === 'directory') return 1;
                return a.name.localeCompare(b.name);
            });

        res.json({ files, localPath: repo.localPath, currentPath: safeSub });
    } catch (error) {
        console.error(error);
        sendError(res, 500, 'Falha ao listar arquivos', error.message);
    }
});

// Ler conteúdo de arquivo do repositório
router.get('/repos/:id/file', requireAuth, (req, res) => {
    const { id } = req.params;
    const { filePath } = req.query;

    if (!filePath) {
        return sendError(res, 400, 'Caminho do arquivo é obrigatório');
    }

    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return sendError(res, 404, 'Repositório não encontrado');
        }

        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return sendError(res, 404, 'Diretório do repositório não encontrado');
        }

        // Construir caminho seguro (prevenir path traversal)
        const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\))+/, '');
        const fullPath = path.join(repo.localPath, safePath);

        // Verificar se o arquivo está dentro do diretório do repositório
        if (!isPathInsideRoot(repo.localPath, fullPath)) {
            return sendError(res, 403, 'Acesso negado');
        }

        if (!fs.existsSync(fullPath)) {
            return sendError(res, 404, 'Arquivo não encontrado');
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            return sendError(res, 400, 'O caminho aponta para um diretório');
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        res.json({ content, fileName: path.basename(fullPath) });
    } catch (error) {
        console.error(error);
        sendError(res, 500, 'Falha ao ler arquivo', error.message);
    }
});

// Salvar conteúdo de arquivo do repositório (com opção de commit Git)
router.put('/repos/:id/file', requireAuth, requirePermission('repos:write'), async (req, res) => {
    const { id } = req.params;
    const { filePath, content, commitMessage } = req.body;

    if (!filePath) {
        return sendError(res, 400, 'Caminho do arquivo é obrigatório');
    }

    if (content === undefined) {
        return sendError(res, 400, 'Conteúdo é obrigatório');
    }

    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return sendError(res, 404, 'Repositório não encontrado');
        }

        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return sendError(res, 404, 'Diretório do repositório não encontrado');
        }

        // Construir caminho seguro (prevenir path traversal)
        const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\))+/, '');
        const fullPath = path.join(repo.localPath, safePath);

        // Verificar se o arquivo está dentro do diretório do repositório
        if (!isPathInsideRoot(repo.localPath, fullPath)) {
            return sendError(res, 403, 'Acesso negado');
        }

        // Salvar arquivo
        fs.writeFileSync(fullPath, content, 'utf-8');

        // Se commitMessage foi fornecido, fazer git add e commit
        if (commitMessage) {
            try {
                await runGitInDir(['add', safePath], repo.localPath);
                // Escapar aspas duplas na mensagem
                await runGitInDir(['commit', '-m', commitMessage], repo.localPath);

                // Atualizar lastUpdated no banco
                db.prepare('UPDATE repositories SET lastUpdated = ? WHERE id = ?')
                    .run(new Date().toISOString(), id);

                res.json({ success: true, message: 'Arquivo salvo e commit realizado com sucesso', committed: true });
            } catch (gitError) {
                console.error('Erro no Git:', gitError);
                // Arquivo foi salvo mas commit falhou
                res.json({ success: true, message: 'Arquivo salvo, mas commit falhou: ' + (gitError.stderr || gitError.error), committed: false });
            }
        } else {
            res.json({ success: true, message: 'Arquivo salvo com sucesso (sem commit)', committed: false });
        }
    } catch (error) {
        console.error(error);
        sendError(res, 500, 'Falha ao salvar arquivo', error.message);
    }
});

// Listar commits de um repositório
router.get('/repos/:id/git/commits', requireAuth, async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return sendError(res, 404, 'Repositório não encontrado');
        }

        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return sendError(res, 404, 'Diretório do repositório não encontrado');
        }

        // Obter logs de commits formatados
        const logOutput = await runGitInDir(
            ['log', '--pretty=format:%H|%an|%ae|%ad|%s', '--date=iso', '-n', String(limit)],
            repo.localPath
        );

        const commits = logOutput.split('\n').filter(Boolean).map(line => {
            const [hash, author, email, date, ...messageParts] = line.split('|');
            return {
                hash: hash.substring(0, 7), // Short hash
                fullHash: hash,
                author,
                email,
                date,
                message: messageParts.join('|'), // Caso a mensagem tenha |
                relativeDate: getRelativeTime(new Date(date))
            };
        });

        res.json({ commits });
    } catch (err) {
        console.error('Erro ao listar commits:', err);
        res.json({ commits: [], error: 'Falha ao listar commits' });
    }
});

// Função para tempo relativo
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'agora';
    if (diffMinutes < 60) return `há ${diffMinutes} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return 'ontem';
    if (diffDays < 7) return `há ${diffDays} dias`;
    if (diffDays < 30) return `há ${Math.floor(diffDays / 7)} semanas`;
    return date.toLocaleDateString('pt-BR');
}

// SPRINTS
router.get('/sprints', requireAuth, (req, res) => {
    try {
        const sprints = db.prepare('SELECT * FROM sprints').all();
        res.json(sprints);
    } catch (err) {
        sendError(res, 500, 'Falha ao carregar sprints', err.message);
    }
});

router.post('/sprints', requireAuth, requirePermission('tasks:write'), validate(createSprintSchema), (req, res) => {
    const { id, name, goal, startDate, endDate, status } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO sprints (id, name, goal, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run(id, name, goal, startDate, endDate, status);
        createActivityLog({
            userId: req.user.id,
            action: 'criou sprint',
            target: name,
            targetType: 'sprint',
            meta: JSON.stringify({
                sprintId: id,
                goal: goal || '',
                startDate: startDate || null,
                endDate: endDate || null,
                status: status || 'future',
            }),
        });
        res.json({ message: 'Sprint created' });
    } catch (err) {
        sendError(res, 500, 'Falha ao criar sprint', err.message);
    }
});

router.put('/sprints/:id', requireAuth, requirePermission('tasks:write'), validate(updateSprintSchema), (req, res) => {
    const { id } = req.params;
    const { status, goal, name, startDate, endDate } = req.body;

    try {
        const existingSprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
        if (!existingSprint) {
            return sendError(res, 404, 'Sprint não encontrada');
        }

        // If setting to active, simple check to ensure no other active sprints (optional, but good practice)
        if (status === 'active') {
            db.prepare('UPDATE sprints SET status = "completed" WHERE status = "active"').run();
        }

        const updates = [];
        const values = [];

        if (status) { updates.push('status = ?'); values.push(status); }
        if (goal) { updates.push('goal = ?'); values.push(goal); }
        if (name) { updates.push('name = ?'); values.push(name); }
        if (startDate) { updates.push('startDate = ?'); values.push(startDate); }
        if (endDate) { updates.push('endDate = ?'); values.push(endDate); }

        values.push(id);

        if (updates.length > 0) {
            db.prepare(`UPDATE sprints SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        }

        const sprintName = (name || existingSprint.name || 'Sprint').trim();
        const metadata = JSON.stringify({
            sprintId: id,
            previousStatus: existingSprint.status,
            nextStatus: status || existingSprint.status,
            startDate: startDate || existingSprint.startDate || null,
            endDate: endDate || existingSprint.endDate || null,
        });

        if (status && status !== existingSprint.status) {
            const actionByStatus = {
                active: 'iniciou sprint',
                completed: 'concluiu sprint',
                future: 'replanejou sprint',
            };

            createActivityLog({
                userId: req.user.id,
                action: actionByStatus[status] || 'atualizou sprint',
                target: sprintName,
                targetType: 'sprint',
                meta: metadata,
            });
        } else if ((goal && goal !== existingSprint.goal) || (name && name !== existingSprint.name) || (startDate && startDate !== existingSprint.startDate) || (endDate && endDate !== existingSprint.endDate)) {
            createActivityLog({
                userId: req.user.id,
                action: 'atualizou sprint',
                target: sprintName,
                targetType: 'sprint',
                meta: metadata,
            });
        }

        res.json({ message: 'Sprint updated' });
    } catch (err) {
        sendError(res, 500, 'Falha ao atualizar sprint', err.message);
    }
});

router.delete('/sprints/:id', requireAuth, requirePermission('tasks:write'), (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM sprints WHERE id = ?').run(id);
        db.prepare('UPDATE tasks SET sprintId = NULL WHERE sprintId = ?').run(id);
        res.json({ message: 'Sprint deleted' });
    } catch (err) {
        sendError(res, 500, 'Falha ao remover sprint', err.message);
    }
});

// TASKS
router.get('/tasks', requireAuth, (req, res) => {
    try {
        const tasks = db.prepare(`
        SELECT t.*,
               u.id as assignee_id, u.name as assignee_name, u.avatar as assignee_avatar,
               p.id as pair_id, p.name as pair_name, p.avatar as pair_avatar,
               s.name as sprint_name
        FROM tasks t
        LEFT JOIN users u ON t.assigneeId = u.id
        LEFT JOIN users p ON t.pairAssigneeId = p.id
        LEFT JOIN sprints s ON t.sprintId = s.id
      `).all();

        // Load all subtasks in one query, then group by taskId
        const allSubtasks = db.prepare('SELECT * FROM subtasks').all();
        const subtasksByTask = {};
        for (const st of allSubtasks) {
            if (!subtasksByTask[st.taskId]) subtasksByTask[st.taskId] = [];
            subtasksByTask[st.taskId].push({ id: st.id, text: st.text, done: st.done === 1 });
        }

        // Parse JSON fields
        const parsedTasks = tasks.map(task => ({
            ...task,
            tags: task.tags ? JSON.parse(task.tags) : [],
            xpPractices: task.xpPractices ? JSON.parse(task.xpPractices) : {},
            dorChecklist: task.dorChecklist ? JSON.parse(task.dorChecklist) : [],
            dodChecklist: task.dodChecklist ? JSON.parse(task.dodChecklist) : [],
            dependencies: task.dependencies ? JSON.parse(task.dependencies) : [],
            assignee: task.assignee_id ? { id: task.assignee_id, name: task.assignee_name, avatar: task.assignee_avatar } : undefined,
            pairAssignee: task.pair_id ? { id: task.pair_id, name: task.pair_name, avatar: task.pair_avatar } : undefined,
            subtasks: subtasksByTask[task.id] || []
        }));

        res.json(parsedTasks);
    } catch (err) {
        console.error('Failed to fetch tasks:', err);
        sendError(res, 500, 'Falha ao carregar tarefas', err.message);
    }
});

router.post('/tasks', requireAuth, requirePermission('tasks:write'), validate(createTaskSchema), (req, res) => {
    const task = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO tasks (
                id, title, description, status, priority, assigneeId, pairAssigneeId, storyPoints,
                tags, sprintId, repositoryId, xpPractices, type, acceptanceCriteria, dorChecklist,
                dodChecklist, dependencies, risk, linkedBranch, linkedPRUrl, linkedMRIid
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            task.id,
            task.title,
            task.description,
            task.status,
            task.priority,
            task.assigneeId || null,
            task.pairAssigneeId || null,
            task.storyPoints || null,
            JSON.stringify(task.tags || []),
            task.sprintId || null,
            task.repositoryId || null,
            JSON.stringify(task.xpPractices || {}),
            task.type || 'feature',
            task.acceptanceCriteria || null,
            JSON.stringify(task.dorChecklist || []),
            JSON.stringify(task.dodChecklist || []),
            JSON.stringify(task.dependencies || []),
            task.risk || 'medium',
            task.linkedBranch || null,
            task.linkedPRUrl || null,
            task.linkedMRIid || null
        );

        // Persist subtasks if provided
        if (task.subtasks && task.subtasks.length > 0) {
            const subtaskStmt = db.prepare('INSERT INTO subtasks (id, taskId, text, done) VALUES (?, ?, ?, ?)');
            for (const st of task.subtasks) {
                subtaskStmt.run(st.id, task.id, st.text, st.done ? 1 : 0);
            }
        }

        res.json({ message: 'Task created', id: task.id });
    } catch (err) {
        sendError(res, 500, 'Falha ao criar tarefa', err.message);
    }
});

router.delete('/tasks/:id', requireAuth, requirePermission('tasks:write'), (req, res) => {
    const { id } = req.params;
    try {
        const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        if (result.changes === 0) return sendError(res, 404, 'Tarefa não encontrada');
        db.prepare('DELETE FROM subtasks WHERE taskId = ?').run(id);
        db.prepare('DELETE FROM comments WHERE taskId = ?').run(id);
        res.json({ message: 'Tarefa removida' });
    } catch (error) {
        sendError(res, 500, 'Falha ao remover tarefa', error.message);
    }
});

// ACTIVITIES
router.post('/activities', requireAuth, (req, res) => {
    const { id, userId, action, target, targetType, taskId, meta } = req.body;
    const timestamp = new Date().toISOString();
    try {
        db.prepare(`
            INSERT INTO activities (id, userId, action, target, targetType, taskId, timestamp, meta)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id || uid('a'), userId, action, target, targetType, taskId || null, timestamp, meta || null);
        res.json({ success: true });
    } catch (err) {
        sendError(res, 500, 'Failed to log activity', err.message);
    }
});

router.put('/tasks/:id', requireAuth, requirePermission('tasks:write'), validate(updateTaskSchema), (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        const existingTask = db.prepare(`
            SELECT id, title, status, linkedBranch, linkedPRUrl, linkedMRIid
            FROM tasks
            WHERE id = ?
        `).get(id);
        if (!existingTask) return sendError(res, 404, 'Tarefa não encontrada');

        const allowed = ['title', 'description', 'status', 'priority', 'assigneeId', 'pairAssigneeId',
            'storyPoints', 'tags', 'sprintId', 'repositoryId', 'timeSpent', 'xpPractices',
            'type', 'acceptanceCriteria', 'dorChecklist', 'dodChecklist', 'dependencies',
            'risk', 'linkedBranch', 'linkedPRUrl', 'linkedMRIid'];

        const setClauses = [];
        const values = [];

        for (const field of allowed) {
            if (updates[field] !== undefined) {
                setClauses.push(`${field} = ?`);
                const val = updates[field];
                // Serialize arrays/objects to JSON
                values.push((typeof val === 'object' && val !== null) ? JSON.stringify(val) : val);
            }
        }

        if (setClauses.length > 0) {
            values.push(id);
            db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
        }

        // Persist subtasks if provided
        if (updates.subtasks !== undefined && Array.isArray(updates.subtasks)) {
            db.prepare('DELETE FROM subtasks WHERE taskId = ?').run(id);
            const subtaskStmt = db.prepare('INSERT INTO subtasks (id, taskId, text, done) VALUES (?, ?, ?, ?)');
            for (const st of updates.subtasks) {
                subtaskStmt.run(st.id || uid('st'), id, st.text, st.done ? 1 : 0);
            }
        }

        const taskTitle = (updates.title ?? existingTask.title ?? 'Tarefa').trim();

        if (updates.status !== undefined && updates.status !== existingTask.status) {
            createActivityLog({
                userId: req.user.id,
                action: `moveu tarefa para ${taskStatusLabels[updates.status] || updates.status}`,
                target: taskTitle,
                targetType: 'issue',
                taskId: id,
                meta: `${taskStatusLabels[existingTask.status] || existingTask.status} -> ${taskStatusLabels[updates.status] || updates.status}`,
            });
        }

        if (updates.linkedBranch !== undefined && updates.linkedBranch !== existingTask.linkedBranch && `${updates.linkedBranch}`.trim()) {
            createActivityLog({
                userId: req.user.id,
                action: 'vinculou branch',
                target: taskTitle,
                targetType: 'issue',
                taskId: id,
                meta: `${updates.linkedBranch}`.trim(),
            });
        }

        if (updates.linkedPRUrl !== undefined && updates.linkedPRUrl !== existingTask.linkedPRUrl && `${updates.linkedPRUrl}`.trim()) {
            createActivityLog({
                userId: req.user.id,
                action: 'vinculou pull request',
                target: taskTitle,
                targetType: 'issue',
                taskId: id,
                meta: `${updates.linkedPRUrl}`.trim(),
            });
        }

        if (updates.linkedMRIid !== undefined && updates.linkedMRIid !== existingTask.linkedMRIid && `${updates.linkedMRIid}`.trim()) {
            createActivityLog({
                userId: req.user.id,
                action: 'vinculou merge request',
                target: taskTitle,
                targetType: 'issue',
                taskId: id,
                meta: `MR !${`${updates.linkedMRIid}`.trim()}`,
            });
        }

        res.json({ message: 'Task updated' });
    } catch (err) {
        sendError(res, 500, 'Falha ao atualizar tarefa', err.message);
    }
});

// COMMENTS
router.get('/tasks/:id/comments', requireAuth, (req, res) => {
    const { id } = req.params;
    try {
        const comments = db.prepare(`
            SELECT c.id, c.text, c.timestamp, u.id as author_id, u.name as author_name, u.avatar as author_avatar
            FROM comments c
            LEFT JOIN users u ON c.authorId = u.id
            WHERE c.taskId = ?
            ORDER BY c.timestamp ASC
        `).all(id);
        res.json(comments.map(c => ({
            id: c.id,
            text: c.text,
            timestamp: c.timestamp,
            author: { id: c.author_id, name: c.author_name, avatar: c.author_avatar }
        })));
    } catch (err) {
        sendError(res, 500, 'Falha ao carregar comentários', err.message);
    }
});

router.post('/tasks/:id/comments', requireAuth, (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return sendError(res, 400, 'Texto do comentário é obrigatório');
    try {
        const task = db.prepare('SELECT id, title FROM tasks WHERE id = ?').get(id);
        if (!task) return sendError(res, 404, 'Tarefa não encontrada');
        const commentId = uid('c');
        const timestamp = new Date().toISOString();
        const normalizedText = text.trim();
        db.prepare('INSERT INTO comments (id, taskId, authorId, text, timestamp) VALUES (?, ?, ?, ?, ?)').run(commentId, id, req.user.id, normalizedText, timestamp);
        createActivityLog({
            userId: req.user.id,
            action: 'comentou na tarefa',
            target: task.title,
            targetType: 'issue',
            taskId: id,
            meta: summarizeComment(normalizedText),
        });
        const user = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(req.user.id);
        res.status(201).json({ id: commentId, text: normalizedText, timestamp, author: user });
    } catch (err) {
        sendError(res, 500, 'Falha ao criar comentário', err.message);
    }
});

router.delete('/tasks/:taskId/comments/:commentId', requireAuth, (req, res) => {
    const { taskId, commentId } = req.params;
    try {
        const comment = db.prepare('SELECT authorId FROM comments WHERE id = ? AND taskId = ?').get(commentId, taskId);
        if (!comment) return sendError(res, 404, 'Comentário não encontrado');
        if (comment.authorId !== req.user.id && req.user.role !== 'admin') {
            return sendError(res, 403, 'Sem permissão para excluir este comentário');
        }
        db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
        res.json({ success: true });
    } catch (err) {
        sendError(res, 500, 'Falha ao excluir comentário', err.message);
    }
});

/* --- ADMIN ENDPOINTS --- */

// USERS (Admin)
router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
    const users = db.prepare(`
        SELECT u.id, u.name, u.email, u.avatar, u.role, u.status, u.createdAt,
               GROUP_CONCAT(g.name) as groupNames
        FROM users u
        LEFT JOIN user_groups ug ON u.id = ug.userId
        LEFT JOIN groups g ON ug.groupId = g.id
        GROUP BY u.id
    `).all();
    res.json(users);
});

router.put('/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, email, role, status, groupIds } = req.body;

    try {
        if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
        if (email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, id);
        if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
        if (status) db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);

        // Update groups
        if (groupIds) {
            db.prepare('DELETE FROM user_groups WHERE userId = ?').run(id);
            groupIds.forEach(gid => {
                db.prepare('INSERT INTO user_groups (userId, groupId) VALUES (?, ?)').run(id, gid);
            });
        }

        res.json({ message: 'Usuário atualizado' });
    } catch (err) {
        sendError(res, 500, 'Falha ao atualizar usuário', err.message);
    }
});

router.delete('/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;

    if (id === 'admin') {
        return sendError(res, 400, 'Não é possível deletar o administrador principal');
    }

    try {
        db.prepare('DELETE FROM user_groups WHERE userId = ?').run(id);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        res.json({ message: 'Usuário removido' });
    } catch (err) {
        sendError(res, 500, 'Falha ao remover usuário', err.message);
    }
});

router.post('/admin/users', requireAuth, requireAdmin, (req, res) => {
    const { name, email, password, role, groupIds } = req.body;

    if (!name || !email || !password) {
        return sendError(res, 400, 'Nome, email e senha são obrigatórios');
    }

    try {
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return sendError(res, 409, 'Email já cadastrado');
        }

        const userId = uid('u');
        const hashedPassword = bcrypt.hashSync(password, 10);

        db.prepare(`
            INSERT INTO users (id, name, email, password, avatar, role, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId, name, email, hashedPassword,
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
            role || 'user', 'active', new Date().toISOString()
        );

        if (groupIds && groupIds.length > 0) {
            groupIds.forEach(gid => {
                db.prepare('INSERT INTO user_groups (userId, groupId) VALUES (?, ?)').run(userId, gid);
            });
        }

        res.json({ message: 'Usuário criado', userId });
    } catch (err) {
        sendError(res, 500, 'Falha ao criar usuário', err.message);
    }
});

// GROUPS (Admin)
router.get('/admin/groups', requireAuth, requireAdmin, (req, res) => {
    try {
        const groups = db.prepare('SELECT * FROM groups').all();
        res.json(groups.map(g => ({
            ...g,
            permissions: JSON.parse(g.permissions || '[]')
        })));
    } catch (err) {
        sendError(res, 500, 'Falha ao carregar grupos', err.message);
    }
});

router.post('/admin/groups', requireAuth, requireAdmin, (req, res) => {
    const { name, description, permissions } = req.body;
    try {
        if (!name) return sendError(res, 400, 'Nome do grupo é obrigatório');
        const groupId = uid('g');
        db.prepare('INSERT INTO groups (id, name, description, permissions) VALUES (?, ?, ?, ?)').run(
            groupId, name, description, JSON.stringify(permissions || [])
        );
        res.json({ message: 'Grupo criado', groupId });
    } catch (err) {
        sendError(res, 500, 'Falha ao criar grupo', err.message);
    }
});

router.put('/admin/groups/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    try {
        if (name) db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(name, id);
        if (description) db.prepare('UPDATE groups SET description = ? WHERE id = ?').run(description, id);
        if (permissions) db.prepare('UPDATE groups SET permissions = ? WHERE id = ?').run(JSON.stringify(permissions), id);
        res.json({ message: 'Grupo atualizado' });
    } catch (err) {
        sendError(res, 500, 'Falha ao atualizar grupo', err.message);
    }
});

router.delete('/admin/groups/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;

    if (['g-admins', 'g-devs', 'g-viewers'].includes(id)) {
        return sendError(res, 400, 'Não é possível deletar grupos padrão');
    }

    try {
        db.prepare('DELETE FROM user_groups WHERE groupId = ?').run(id);
        db.prepare('DELETE FROM groups WHERE id = ?').run(id);
        res.json({ message: 'Grupo removido' });
    } catch (err) {
        sendError(res, 500, 'Falha ao remover grupo', err.message);
    }
});

// SETTINGS (Admin)
router.get('/admin/settings', requireAuth, requireAdmin, (req, res) => {
    try {
        const settings = db.prepare('SELECT * FROM settings').all();
        const result = {};
        settings.forEach(s => result[s.key] = s.value);
        res.json(result);
    } catch (err) {
        sendError(res, 500, 'Falha ao carregar configurações', err.message);
    }
});

router.put('/admin/settings', requireAuth, requireAdmin, (req, res) => {
    const updates = req.body;

    try {
        Object.entries(updates).forEach(([key, value]) => {
            const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get(key);
            if (existing) {
                db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(value), key);
            } else {
                db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
            }
        });

        res.json({ message: 'Configurações atualizadas' });
    } catch (err) {
        sendError(res, 500, 'Falha ao salvar configurações', err.message);
    }
});

export default router;

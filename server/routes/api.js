import express from 'express';
import db from '../db.js';
import { execFile, execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();
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

const createActivityLog = ({ userId, action, target, targetType, taskId = null, meta = null }) => {
    db.prepare(`
        INSERT INTO activities (id, userId, action, target, targetType, taskId, timestamp, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId, action, target, targetType, taskId, new Date().toISOString(), meta);
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
            return res.status(404).json({ error: 'Repositório não encontrado' });
        }
        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return res.status(404).json({ error: 'Diretório do repositório não encontrado' });
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
        res.status(500).json({ error: 'Falha ao obter status Git', details: err });
    }
});

// Diff de um arquivo específico
router.get('/repos/:id/git/diff', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { file, staged } = req.query;

    if (!file) {
        return res.status(400).json({ error: 'Arquivo não especificado' });
    }

    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return res.status(404).json({ error: 'Repositório não encontrado' });
        }
        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return res.status(404).json({ error: 'Diretório do repositório não encontrado' });
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
        res.status(500).json({ error: 'Falha ao obter diff', details: err });
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
        res.status(500).json({ error: 'Falha ao gerar estatísticas', details: err.message });
    }
});

// Branches de um repositório específico
router.get('/repos/:id/git/branches', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return res.status(404).json({ error: 'Repositório não encontrado' });
        }
        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return res.status(404).json({ error: 'Diretório do repositório não encontrado' });
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
        res.status(500).json({ error: 'Falha ao listar branches', details: err });
    }
});

// Helper: validar que o repo existe e tem localPath
const getRepoOrError = (id, res) => {
    const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
    if (!repo) { res.status(404).json({ error: 'Repositório não encontrado' }); return null; }
    if (!repo.localPath || !fs.existsSync(repo.localPath)) {
        res.status(404).json({ error: 'Diretório do repositório não encontrado', path: repo.localPath });
        return null;
    }
    return repo;
};

// Stage arquivos específicos (git add <file> ...)
router.post('/repos/:id/git/stage', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { files } = req.body; // array of file paths
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo especificado' });
        }
        await runGitInDir(['add', '--', ...files], repo.localPath);
        res.json({ success: true, message: `${files.length} arquivo(s) adicionado(s) ao stage` });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao adicionar arquivos ao stage', details: err });
    }
});

// Unstage arquivos específicos (git restore --staged <file> ...)
router.post('/repos/:id/git/unstage', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { files } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo especificado' });
        }
        await runGitInDir(['restore', '--staged', '--', ...files], repo.localPath);
        res.json({ success: true, message: `${files.length} arquivo(s) removido(s) do stage` });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao remover arquivos do stage', details: err });
    }
});

// Commit em um repositório específico (usa apenas arquivos já staged)
router.post('/repos/:id/git/commit', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { message, files } = req.body;
    // files: optional array — if provided, stage them first; otherwise commit what's already staged
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Mensagem de commit é obrigatória' });
        }

        // If files array provided, stage them explicitly; otherwise use what's already staged
        if (files && files.length > 0) {
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
            return res.status(400).json({ error: 'Nada para commitar. Adicione arquivos ao stage primeiro.' });
        }
        res.status(500).json({ error: 'Falha ao realizar commit', details: errMsg });
    }
});

// Push para o remote
router.post('/repos/:id/git/push', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { remote = 'origin', branch } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        // Get current branch if not specified
        let targetBranch = branch;
        if (!targetBranch) {
            targetBranch = await runGitInDir(['branch', '--show-current'], repo.localPath);
        }

        if (!targetBranch) {
            return res.status(400).json({ error: 'Não foi possível determinar o branch atual' });
        }

        await runGitInDir(['push', remote, targetBranch], repo.localPath);

        res.json({ success: true, message: `Push realizado para ${remote}/${targetBranch}` });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        // Provide helpful error messages
        if (errMsg.includes('No configured push destination') || errMsg.includes('no upstream')) {
            return res.status(400).json({
                error: 'Nenhum remote configurado. Configure a URL do remote nas configurações do repositório.',
                details: errMsg
            });
        }
        if (errMsg.includes('Authentication failed') || errMsg.includes('could not read Username')) {
            return res.status(401).json({ error: 'Falha de autenticação no remote Git.', details: errMsg });
        }
        res.status(500).json({ error: 'Falha ao realizar push', details: errMsg });
    }
});

// Pull do remote
router.post('/repos/:id/git/pull', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { remote = 'origin', branch } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        const args = ['pull', remote];
        if (branch) args.push(branch);

        const output = await runGitInDir(args, repo.localPath);
        res.json({ success: true, message: output || 'Pull realizado com sucesso' });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        res.status(500).json({ error: 'Falha ao realizar pull', details: errMsg });
    }
});

// Checkout de branch existente
router.post('/repos/:id/git/checkout', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { branch } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!branch) return res.status(400).json({ error: 'Branch não especificado' });

        await runGitInDir(['checkout', branch], repo.localPath);
        res.json({ success: true, message: `Checkout realizado para ${branch}` });
    } catch (err) {
        const errMsg = err.stderr || err.error || String(err);
        res.status(500).json({ error: 'Falha ao realizar checkout', details: errMsg });
    }
});

// Criar novo branch (e fazer checkout)
router.post('/repos/:id/git/branch', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, checkout = true } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nome do branch é obrigatório' });

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
            return res.status(409).json({ error: `Branch já existe`, details: errMsg });
        }
        res.status(500).json({ error: 'Falha ao criar branch', details: errMsg });
    }
});

// Configurar remote URL do repositório
router.put('/repos/:id/git/remote', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { url, remote = 'origin' } = req.body;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;
        if (!url) return res.status(400).json({ error: 'URL do remote é obrigatória' });

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
        res.status(500).json({ error: 'Falha ao configurar remote', details: errMsg });
    }
});

// Git log com paginação e filtro por branch
router.get('/repos/:id/git/log', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { branch, limit = 30, skip = 0, author } = req.query;
    try {
        const repo = getRepoOrError(id, res);
        if (!repo) return;

        const args = [
            'log',
            `--max-count=${limit}`,
            `--skip=${skip}`,
            '--format=%H|%h|%an|%ae|%ai|%s',
        ];
        if (branch) args.push(branch);
        if (author) args.push(`--author=${author}`);

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
        res.status(500).json({ error: 'Falha ao obter log do Git', details: errMsg });
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
        const activities = db.prepare(`
            SELECT a.*, u.id as user_id, u.name as user_name, u.avatar as user_avatar
            FROM activities a
            LEFT JOIN users u ON a.userId = u.id
            ORDER BY timestamp DESC
        `).all();

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

        res.json(parsedActivities);
    } catch (err) {
        res.status(500).json({ error: 'Falha ao carregar atividades', details: err.message });
    }
});

// USERS
router.get('/users', requireAuth, (req, res) => {
    try {
        const users = db.prepare('SELECT * FROM users').all();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Falha ao carregar usuários', details: err.message });
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
        res.status(500).json({ error: 'Falha ao carregar repositórios', details: err.message });
    }
});

router.post('/repos', requireAuth, (req, res) => {
    const { id, name, description, status, lastUpdated, branch, issues, localPath: providedLocalPath, linkExisting } = req.body;
    try {
        let fullPath;

        if (linkExisting && providedLocalPath) {
            // --- LINK EXISTING REPO MODE ---
            fullPath = path.resolve(providedLocalPath);

            if (!fs.existsSync(fullPath)) {
                return res.status(400).json({ error: `Caminho não encontrado: ${fullPath}` });
            }

            // Verify it's a git repo
            const gitDir = path.join(fullPath, '.git');
            if (!fs.existsSync(gitDir)) {
                return res.status(400).json({ error: 'O diretório não contém um repositório Git (.git não encontrado).' });
            }

        } else {
            // --- CREATE NEW REPO MODE ---
            const setting = db.prepare("SELECT value FROM settings WHERE key = 'gitDirectory'").get();
            if (!setting || !setting.value) {
                return res.status(400).json({ error: 'Diretório Git não configurado nas Configurações do Sistema.' });
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
        res.status(500).json({ error: 'Falha ao criar/vincular repositório', details: error.message });
    }
});

router.put('/repos/:id/settings', requireAuth, (req, res) => {
    const { id } = req.params;
    const { gitlabProjectPath, remoteUrl } = req.body;
    try {
        const repo = db.prepare('SELECT id FROM repositories WHERE id = ?').get(id);
        if (!repo) return res.status(404).json({ error: 'Repositório não encontrado' });

        const updates = [];
        const values = [];
        if (gitlabProjectPath !== undefined) { updates.push('gitlabProjectPath = ?'); values.push(gitlabProjectPath); }
        if (remoteUrl !== undefined) { updates.push('remoteUrl = ?'); values.push(remoteUrl); }

        if (updates.length === 0) return res.json({ success: true });

        values.push(id);
        db.prepare(`UPDATE repositories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Falha ao salvar configurações', details: error.message });
    }
});

router.delete('/repos/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    try {
        const result = db.prepare('DELETE FROM repositories WHERE id = ?').run(id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Repositório não encontrado' });
        }
        // Também remove tarefas associadas ao repositório (opcional, pode ser um soft-delete)
        db.prepare('UPDATE tasks SET repositoryId = NULL WHERE repositoryId = ?').run(id);
        res.json({ message: 'Repositório removido com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Falha ao remover repositório', details: error.message });
    }
});

// Listar arquivos reais do repositório (suporta subPath para navegação em subdiretórios)
router.get('/repos/:id/files', requireAuth, (req, res) => {
    const { id } = req.params;
    const { subPath = '' } = req.query; // relative path inside repo, e.g. "src/components"
    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return res.status(404).json({ error: 'Repositório não encontrado' });
        }

        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return res.status(404).json({ error: 'Diretório do repositório não encontrado', path: repo.localPath });
        }

        // Build safe target directory
        const safeSub = subPath ? path.normalize(subPath).replace(/^(\.\.(\/|\\))+/, '') : '';
        const targetDir = safeSub ? path.join(repo.localPath, safeSub) : repo.localPath;

        // Prevent path traversal
        if (!isPathInsideRoot(repo.localPath, targetDir)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        if (!fs.existsSync(targetDir)) {
            return res.status(404).json({ error: 'Diretório não encontrado', path: targetDir });
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
        res.status(500).json({ error: 'Falha ao listar arquivos', details: error.message });
    }
});

// Ler conteúdo de arquivo do repositório
router.get('/repos/:id/file', requireAuth, (req, res) => {
    const { id } = req.params;
    const { filePath } = req.query;

    if (!filePath) {
        return res.status(400).json({ error: 'Caminho do arquivo é obrigatório' });
    }

    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return res.status(404).json({ error: 'Repositório não encontrado' });
        }

        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return res.status(404).json({ error: 'Diretório do repositório não encontrado' });
        }

        // Construir caminho seguro (prevenir path traversal)
        const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\))+/, '');
        const fullPath = path.join(repo.localPath, safePath);

        // Verificar se o arquivo está dentro do diretório do repositório
        if (!isPathInsideRoot(repo.localPath, fullPath)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'Arquivo não encontrado' });
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            return res.status(400).json({ error: 'O caminho aponta para um diretório' });
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        res.json({ content, fileName: path.basename(fullPath) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Falha ao ler arquivo', details: error.message });
    }
});

// Salvar conteúdo de arquivo do repositório (com opção de commit Git)
router.put('/repos/:id/file', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { filePath, content, commitMessage } = req.body;

    if (!filePath) {
        return res.status(400).json({ error: 'Caminho do arquivo é obrigatório' });
    }

    if (content === undefined) {
        return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return res.status(404).json({ error: 'Repositório não encontrado' });
        }

        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return res.status(404).json({ error: 'Diretório do repositório não encontrado' });
        }

        // Construir caminho seguro (prevenir path traversal)
        const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\))+/, '');
        const fullPath = path.join(repo.localPath, safePath);

        // Verificar se o arquivo está dentro do diretório do repositório
        if (!isPathInsideRoot(repo.localPath, fullPath)) {
            return res.status(403).json({ error: 'Acesso negado' });
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
        res.status(500).json({ error: 'Falha ao salvar arquivo', details: error.message });
    }
});

// Listar commits de um repositório
router.get('/repos/:id/git/commits', requireAuth, async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(id);
        if (!repo) {
            return res.status(404).json({ error: 'Repositório não encontrado' });
        }

        if (!repo.localPath || !fs.existsSync(repo.localPath)) {
            return res.status(404).json({ error: 'Diretório do repositório não encontrado' });
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
        res.status(500).json({ error: 'Falha ao carregar sprints', details: err.message });
    }
});

router.post('/sprints', requireAuth, (req, res) => {
    const { id, name, goal, startDate, endDate, status } = req.body;
    try {
        if (!id || !name) return res.status(400).json({ error: 'ID e nome são obrigatórios' });
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
        res.status(500).json({ error: 'Falha ao criar sprint', details: err.message });
    }
});

router.put('/sprints/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { status, goal, name, startDate, endDate } = req.body;

    try {
        const existingSprint = db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
        if (!existingSprint) {
            return res.status(404).json({ error: 'Sprint não encontrada' });
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
        res.status(500).json({ error: 'Falha ao atualizar sprint', details: err.message });
    }
});

router.delete('/sprints/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM sprints WHERE id = ?').run(id);
        db.prepare('UPDATE tasks SET sprintId = NULL WHERE sprintId = ?').run(id);
        res.json({ message: 'Sprint deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao remover sprint', details: err.message });
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
        res.status(500).json({ error: 'Falha ao carregar tarefas', details: err.message });
    }
});

router.post('/tasks', requireAuth, (req, res) => {
    const task = req.body;
    try {
        if (!task.id || !task.title || !task.status || !task.priority) {
            return res.status(400).json({ error: 'Campos obrigatórios: id, title, status, priority' });
        }
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
        res.status(500).json({ error: 'Falha ao criar tarefa', details: err.message });
    }
});

router.delete('/tasks/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    try {
        const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        if (result.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
        db.prepare('DELETE FROM subtasks WHERE taskId = ?').run(id);
        db.prepare('DELETE FROM comments WHERE taskId = ?').run(id);
        res.json({ message: 'Tarefa removida' });
    } catch (error) {
        res.status(500).json({ error: 'Falha ao remover tarefa', details: error.message });
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
        `).run(id || `a-${Date.now()}`, userId, action, target, targetType, taskId || null, timestamp, meta || null);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to log activity', details: err.message });
    }
});

router.put('/tasks/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        const existingTask = db.prepare(`
            SELECT id, title, status, linkedBranch, linkedPRUrl, linkedMRIid
            FROM tasks
            WHERE id = ?
        `).get(id);
        if (!existingTask) return res.status(404).json({ error: 'Tarefa não encontrada' });

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
                subtaskStmt.run(st.id || `st-${Date.now()}-${Math.random()}`, id, st.text, st.done ? 1 : 0);
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
        res.status(500).json({ error: 'Falha ao atualizar tarefa', details: err.message });
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
        res.status(500).json({ error: 'Falha ao carregar comentários', details: err.message });
    }
});

router.post('/tasks/:id/comments', requireAuth, (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Texto do comentário é obrigatório' });
    try {
        const task = db.prepare('SELECT id, title FROM tasks WHERE id = ?').get(id);
        if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });
        const commentId = `c-${Date.now()}`;
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
        res.status(500).json({ error: 'Falha ao criar comentário', details: err.message });
    }
});

router.delete('/tasks/:taskId/comments/:commentId', requireAuth, (req, res) => {
    const { taskId, commentId } = req.params;
    try {
        const comment = db.prepare('SELECT authorId FROM comments WHERE id = ? AND taskId = ?').get(commentId, taskId);
        if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });
        if (comment.authorId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Sem permissão para excluir este comentário' });
        }
        db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao excluir comentário', details: err.message });
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
        res.status(500).json({ error: 'Falha ao atualizar usuário', details: err.message });
    }
});

router.delete('/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;

    if (id === 'admin') {
        return res.status(400).json({ error: 'Não é possível deletar o administrador principal' });
    }

    try {
        db.prepare('DELETE FROM user_groups WHERE userId = ?').run(id);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        res.json({ message: 'Usuário removido' });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao remover usuário', details: err.message });
    }
});

router.post('/admin/users', requireAuth, requireAdmin, (req, res) => {
    const { name, email, password, role, groupIds } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    try {
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return res.status(409).json({ error: 'Email já cadastrado' });
        }

        const userId = `u-${Date.now()}`;
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
        res.status(500).json({ error: 'Falha ao criar usuário', details: err.message });
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
        res.status(500).json({ error: 'Falha ao carregar grupos', details: err.message });
    }
});

router.post('/admin/groups', requireAuth, requireAdmin, (req, res) => {
    const { name, description, permissions } = req.body;
    try {
        if (!name) return res.status(400).json({ error: 'Nome do grupo é obrigatório' });
        const groupId = `g-${Date.now()}`;
        db.prepare('INSERT INTO groups (id, name, description, permissions) VALUES (?, ?, ?, ?)').run(
            groupId, name, description, JSON.stringify(permissions || [])
        );
        res.json({ message: 'Grupo criado', groupId });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao criar grupo', details: err.message });
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
        res.status(500).json({ error: 'Falha ao atualizar grupo', details: err.message });
    }
});

router.delete('/admin/groups/:id', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;

    if (['g-admins', 'g-devs', 'g-viewers'].includes(id)) {
        return res.status(400).json({ error: 'Não é possível deletar grupos padrão' });
    }

    try {
        db.prepare('DELETE FROM user_groups WHERE groupId = ?').run(id);
        db.prepare('DELETE FROM groups WHERE id = ?').run(id);
        res.json({ message: 'Grupo removido' });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao remover grupo', details: err.message });
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
        res.status(500).json({ error: 'Falha ao carregar configurações', details: err.message });
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
        res.status(500).json({ error: 'Falha ao salvar configurações', details: err.message });
    }
});

export default router;

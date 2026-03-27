import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
import db from '../db.js';
import { generateToken, generateRefreshToken, rotateRefreshToken, cleanupExpiredTokens, requireAuth } from '../middleware/auth.js';
import { loginSchema, registerSchema, updateProfileSchema, updatePasswordSchema, refreshTokenSchema, validate } from '../validation.js';
import { uid, sendError } from '../utils.js';

const router = express.Router();

// Periodic cleanup of expired refresh tokens (every 6 hours)
setInterval(cleanupExpiredTokens, 6 * 60 * 60 * 1000);

// Login
router.post('/login', validate(loginSchema), (req, res) => {
    try {
        const { email, password } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
            return sendError(res, 401, 'Credenciais inválidas');
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return sendError(res, 401, 'Credenciais inválidas');
        }

        if (user.status === 'pending') {
            return sendError(res, 403, 'Conta aguardando aprovação do administrador');
        }

        if (user.status === 'inactive') {
            return sendError(res, 403, 'Conta desativada. Contate o administrador');
        }

        const token = generateToken(user.id);
        const { refreshToken } = generateRefreshToken(user.id);

        // Get user groups
        const groups = db.prepare(`
            SELECT g.* FROM groups g
            JOIN user_groups ug ON g.id = ug.groupId
            WHERE ug.userId = ?
        `).all(user.id);

        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                preferences: user.preferences ? JSON.parse(user.preferences) : {},
                groups: groups.map(g => ({ id: g.id, name: g.name }))
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        sendError(res, 500, 'Erro interno do servidor', err.message);
    }
});

// Register (self-registration)
router.post('/register', validate(registerSchema), (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if self-registration is allowed
        const allowSelfRegister = db.prepare('SELECT value FROM settings WHERE key = ?').get('allowSelfRegister');
        if (!allowSelfRegister || allowSelfRegister.value !== 'true') {
            return sendError(res, 403, 'Cadastro automático está desabilitado');
        }

        // Check if email already exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return sendError(res, 409, 'Este email já está cadastrado');
        }

        // Check if approval is required
        const requireApproval = db.prepare('SELECT value FROM settings WHERE key = ?').get('requireApproval');
        const status = (requireApproval && requireApproval.value === 'true') ? 'pending' : 'active';

        // Create user
        const hashedPassword = bcrypt.hashSync(password, 10);
        const userId = uid('u');

        db.prepare(`
            INSERT INTO users (id, name, email, password, avatar, role, status, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            name,
            email,
            hashedPassword,
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
            'user',
            status,
            new Date().toISOString()
        );

        // Add to default group (Viewers)
        db.prepare('INSERT INTO user_groups (userId, groupId) VALUES (?, ?)').run(userId, 'g-viewers');

        if (status === 'pending') {
            res.status(201).json({
                message: 'Cadastro realizado! Aguarde aprovação do administrador.',
                pending: true
            });
        } else {
            const token = generateToken(userId);
            const { refreshToken } = generateRefreshToken(userId);
            res.status(201).json({
                message: 'Cadastro realizado com sucesso!',
                token,
                refreshToken,
                user: { id: userId, name, email, role: 'user' }
            });
        }
    } catch (err) {
        sendError(res, 500, 'Erro ao registrar usuário', err.message);
    }
});

// Refresh token — issue a new access token + rotated refresh token
router.post('/refresh', validate(refreshTokenSchema), (req, res) => {
    const { refreshToken } = req.body;

    const result = rotateRefreshToken(refreshToken);
    if (!result) {
        return sendError(res, 401, 'Refresh token inválido ou expirado');
    }

    res.json({
        token: result.accessToken,
        refreshToken: result.refreshToken,
    });
});

// Get current user
router.get('/me', requireAuth, (req, res) => {
    const groups = db.prepare(`
        SELECT g.* FROM groups g
        JOIN user_groups ug ON g.id = ug.groupId
        WHERE ug.userId = ?
    `).all(req.user.id);

    res.json({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        role: req.user.role,
        preferences: req.user.preferences ? JSON.parse(req.user.preferences) : {},
        groups: groups.map(g => ({ id: g.id, name: g.name, permissions: JSON.parse(g.permissions || '[]') }))
    });
});

// Update current user (Profile + Preferences)
router.put('/me', requireAuth, validate(updateProfileSchema), (req, res) => {
    const { name, email, avatar, preferences } = req.body;

    try {
        const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        // Prepare updates
        const newName = name || currentUser.name;

        // If updating email, check uniqueness
        if (email && email !== currentUser.email) {
            const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (existing) {
                return sendError(res, 409, 'Email já está em uso');
            }
        }
        const newEmail = email || currentUser.email;
        const newAvatar = avatar || currentUser.avatar;
        const newPrefs = preferences ? JSON.stringify(preferences) : currentUser.preferences;

        db.prepare(`
            UPDATE users
            SET name = ?, email = ?, avatar = ?, preferences = ?
            WHERE id = ?
        `).run(newName, newEmail, newAvatar, newPrefs, req.user.id);

        res.json({
            success: true,
            user: {
                id: req.user.id,
                name: newName,
                email: newEmail,
                avatar: newAvatar,
                role: currentUser.role,
                preferences: newPrefs ? JSON.parse(newPrefs) : {}
            }
        });

    } catch (err) {
        console.error('Update profile error:', err);
        sendError(res, 500, 'Falha ao atualizar perfil', err.message);
    }
});

// Update password
router.put('/password', requireAuth, validate(updatePasswordSchema), (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

        const validPassword = bcrypt.compareSync(currentPassword, user.password);
        if (!validPassword) {
            return sendError(res, 401, 'Senha atual incorreta');
        }

        const hashed = bcrypt.hashSync(newPassword, 10);

        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);

        res.json({ success: true, message: 'Senha atualizada com sucesso' });

    } catch (err) {
        console.error('Update password error:', err);
        sendError(res, 500, 'Falha ao atualizar senha');
    }
});

// Delete own account
router.delete('/me', requireAuth, (req, res) => {
    try {
        const userId = req.user.id;
        // Prevent deleting the last admin
        const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
        if (req.user.role === 'admin' && adminCount.count <= 1) {
            return sendError(res, 400, 'Não é possível excluir o único administrador do sistema');
        }
        db.prepare('DELETE FROM user_groups WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM activities WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM integrations WHERE userId = ?').run(userId);
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        res.json({ success: true, message: 'Conta excluída com sucesso' });
    } catch (err) {
        console.error('Delete account error:', err);
        sendError(res, 500, 'Falha ao excluir conta');
    }
});

export default router;

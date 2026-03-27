import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
import crypto from 'crypto';
import db from '../db.js';
import { uid, sendError } from '../utils.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devflow-secret-key-change-in-production';

// Access token: short-lived (1 hour)
const ACCESS_TOKEN_EXPIRY = '1h';
// Refresh token: long-lived (30 days)
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendError(res, 401, 'Token não fornecido');
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);

        if (!user) {
            return sendError(res, 401, 'Usuário não encontrado');
        }

        if (user.status !== 'active') {
            return sendError(res, 403, 'Conta não ativada');
        }

        // Load user permissions from groups
        const groups = db.prepare(`
            SELECT g.permissions FROM groups g
            JOIN user_groups ug ON g.id = ug.groupId
            WHERE ug.userId = ?
        `).all(user.id);

        const permissions = new Set();
        for (const g of groups) {
            const perms = JSON.parse(g.permissions || '[]');
            perms.forEach(p => permissions.add(p));
        }
        user._permissions = permissions;

        req.user = user;
        next();
    } catch (_err) {
        return sendError(res, 401, 'Token inválido');
    }
};

export const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return sendError(res, 403, 'Acesso restrito a administradores');
    }
    next();
};

/**
 * Middleware to enforce group-based permissions.
 * @param {string} requiredPermission - e.g. 'tasks:read', 'tasks:write', 'repos:read', 'git:write'
 */
export const requirePermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user || !req.user._permissions) {
            return sendError(res, 403, 'Permissão insuficiente');
        }
        const perms = req.user._permissions;

        // Admin wildcard
        if (perms.has('*')) return next();

        // Exact match
        if (perms.has(requiredPermission)) return next();

        // Category wildcard (e.g. 'tasks:*' covers 'tasks:read' and 'tasks:write')
        const [category] = requiredPermission.split(':');
        if (perms.has(`${category}:*`)) return next();

        return sendError(res, 403, 'Permissão insuficiente para esta operação');
    };
};

export const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

/**
 * Generate a cryptographically secure refresh token, store it in DB, and return it.
 */
export const generateRefreshToken = (userId) => {
    const token = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const id = uid('rt');

    db.prepare('INSERT INTO refresh_tokens (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)').run(id, userId, token, expiresAt);

    return { refreshToken: token, expiresAt };
};

/**
 * Validate and rotate a refresh token (one-time use).
 * Returns new { accessToken, refreshToken } or null if invalid.
 */
export const rotateRefreshToken = (oldToken) => {
    const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(oldToken);
    if (!row) return null;

    // Delete used token (one-time use)
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);

    // Check expiry
    if (new Date(row.expiresAt).getTime() < Date.now()) return null;

    // Check user still exists and is active
    const user = db.prepare('SELECT id, status FROM users WHERE id = ?').get(row.userId);
    if (!user || user.status !== 'active') return null;

    // Issue new pair
    const accessToken = generateToken(row.userId);
    const { refreshToken, expiresAt } = generateRefreshToken(row.userId);

    return { accessToken, refreshToken, expiresAt, userId: row.userId };
};

/**
 * Clean up expired refresh tokens. Called periodically.
 */
export const cleanupExpiredTokens = () => {
    db.prepare('DELETE FROM refresh_tokens WHERE expiresAt < ?').run(new Date().toISOString());
};

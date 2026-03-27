import { randomUUID } from 'node:crypto';

/**
 * Generate a collision-safe unique ID with an optional prefix.
 * Uses crypto.randomUUID() (RFC 4122 v4) instead of Date.now().
 * Example: uid('task') → 'task-a1b2c3d4-e5f6-...'
 */
export const uid = (prefix) => prefix ? `${prefix}-${randomUUID()}` : randomUUID();

/**
 * Send a standardised JSON error response.
 * Shape: { error: string } in production, { error, details } in development.
 * Never leaks raw Error objects or stack traces to clients.
 */
export function sendError(res, status, error, details) {
    const body = { error };
    if (details && process.env.NODE_ENV !== 'production') {
        body.details = typeof details === 'string' ? details : String(details);
    }
    return res.status(status).json(body);
}

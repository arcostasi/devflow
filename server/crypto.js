import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Derive a 32-byte key from JWT_SECRET (or fallback) using SHA-256
const getRawKey = () => {
    const secret = process.env.JWT_SECRET || 'devflow-secret-key-change-in-production';
    return crypto.createHash('sha256').update(secret).digest(); // always 32 bytes
};

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a string: iv:authTag:ciphertext (all hex-encoded)
 */
export const encrypt = (plaintext) => {
    const key = getRawKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt a string produced by encrypt().
 * Supports legacy base64 tokens (plain base64 without ':' separators).
 */
export const decrypt = (stored) => {
    if (!stored) return '';

    // Legacy base64 fallback (tokens stored before AES migration)
    if (!stored.includes(':')) {
        try {
            return Buffer.from(stored, 'base64').toString('utf-8');
        } catch {
            return stored;
        }
    }

    try {
        const [ivHex, authTagHex, ciphertext] = stored.split(':');
        const key = getRawKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('Decrypt error:', err.message);
        return '';
    }
};

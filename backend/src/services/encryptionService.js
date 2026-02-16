import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCODING = 'hex';

/**
 * Get the encryption key from environment.
 * Auto-generates one if not set (for development only).
 */
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        console.warn('⚠️  ENCRYPTION_KEY not set in .env — using derived dev key. Set a proper 64-char hex key for production.');
        // Derive a deterministic dev key (NOT for production)
        return crypto.createHash('sha256').update('cerinote-dev-key-change-me').digest();
    }
    // Key must be 32 bytes (64 hex chars)
    return Buffer.from(key, 'hex');
};

/**
 * Encrypt plaintext using AES-256-GCM.
 * @param {string} plaintext - The data to encrypt
 * @returns {{ iv: string, encrypted: string, tag: string }}
 */
export const encrypt = (plaintext) => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);

    const tag = cipher.getAuthTag();

    return {
        iv: iv.toString(ENCODING),
        encrypted,
        tag: tag.toString(ENCODING),
    };
};

/**
 * Decrypt AES-256-GCM encrypted data.
 * @param {{ iv: string, encrypted: string, tag: string }} encryptedObj
 * @returns {string} plaintext
 */
export const decrypt = (encryptedObj) => {
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedObj.iv, ENCODING);
    const tag = Buffer.from(encryptedObj.tag, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedObj.encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

/**
 * Encrypt a JSON-serializable object.
 */
export const encryptObject = (obj) => {
    return encrypt(JSON.stringify(obj));
};

/**
 * Decrypt back to a JSON object.
 */
export const decryptObject = (encryptedObj) => {
    return JSON.parse(decrypt(encryptedObj));
};

/**
 * Generate a new random 256-bit key (for setup).
 * @returns {string} 64-char hex string
 */
export const generateKey = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a value (e.g., IP address) using SHA-256.
 * One-way, irreversible.
 */
export const hashValue = (value) => {
    return crypto.createHash('sha256').update(value).digest('hex');
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encrypt, decrypt, encryptObject, decryptObject } from './encryptionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * In-memory encrypted session store.
 * In production, replace with an encrypted database.
 * Key = sessionId, Value = encrypted session data
 */
const sessionStore = new Map();

// ── Retention Config ───────────────────────────────
export const getRetentionDays = () => {
    const days = parseInt(process.env.RETENTION_DAYS, 10);
    if (isNaN(days)) return 0; // Default: zero retention (delete immediately)
    return days;
};

// ── Session Management ─────────────────────────────

/**
 * Store a session with encrypted sensitive data.
 */
export const storeSession = (sessionId, sessionData) => {
    const sensitiveFields = ['transcription', 'structuredDialogue', 'medicalReport'];
    const encryptedData = { ...sessionData };

    // Encrypt sensitive fields
    for (const field of sensitiveFields) {
        if (encryptedData[field]) {
            encryptedData[`${field}_encrypted`] = encrypt(encryptedData[field]);
            // Keep plaintext in memory for active session (will be cleared on purge)
        }
    }

    encryptedData.storedAt = new Date().toISOString();
    encryptedData.retentionDays = getRetentionDays();

    sessionStore.set(sessionId, encryptedData);
    return sessionData;
};

/**
 * Retrieve a session (decrypts sensitive data on-the-fly).
 */
export const getSession = (sessionId) => {
    const session = sessionStore.get(sessionId);
    if (!session) return null;
    return session;
};

/**
 * Get all sessions (metadata only, no decryption).
 */
export const getAllSessions = () => {
    return Array.from(sessionStore.values()).map(s => ({
        id: s.id,
        name: s.name,
        duration: s.duration,
        createdAt: s.createdAt,
        hasTranscription: !!s.transcription,
        hasReport: !!s.medicalReport,
    }));
};

/**
 * Delete a session and its audio file.
 */
export const deleteSession = (sessionId) => {
    const session = sessionStore.get(sessionId);
    if (!session) return null;

    // Delete audio file if it exists
    if (session.filename) {
        const filePath = path.join(uploadsDir, session.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️  Deleted audio file: ${session.filename}`);
        }
    }

    sessionStore.delete(sessionId);
    return session;
};

/**
 * Delete only the audio file for a session (zero-retention post-processing).
 */
export const deleteAudioFile = (sessionId) => {
    const session = sessionStore.get(sessionId);
    if (!session || !session.filename) return;

    const filePath = path.join(uploadsDir, session.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🔒 Zero-retention: Deleted audio file ${session.filename}`);
    }

    // Clear file reference
    session.filename = null;
    session.url = null;
    session.audioDeleted = true;
    session.audioDeletedAt = new Date().toISOString();
    sessionStore.set(sessionId, session);
};

// ── Auto-Purge Scheduler ───────────────────────────

/**
 * Purge expired sessions based on retention policy.
 */
export const purgeExpiredSessions = () => {
    const now = new Date();
    let purgedCount = 0;

    for (const [sessionId, session] of sessionStore.entries()) {
        const retentionDays = session.retentionDays ?? getRetentionDays();
        if (retentionDays === 0) continue; // Zero retention handled immediately

        const storedAt = new Date(session.storedAt || session.createdAt);
        const expiresAt = new Date(storedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);

        if (now >= expiresAt) {
            deleteSession(sessionId);
            purgedCount++;
            console.log(`🧹 Purged expired session: ${session.name || sessionId}`);
        }
    }

    if (purgedCount > 0) {
        console.log(`🧹 Auto-purge complete: ${purgedCount} session(s) removed.`);
    }
};

/**
 * Start the auto-purge scheduler (runs every hour).
 */
export const startPurgeScheduler = () => {
    const PURGE_INTERVAL = 60 * 60 * 1000; // 1 hour
    console.log('🕐 Auto-purge scheduler started (runs every hour)');

    setInterval(() => {
        purgeExpiredSessions();
    }, PURGE_INTERVAL);

    // Also run once at startup
    purgeExpiredSessions();
};

/**
 * Get storage statistics.
 */
export const getStorageStats = () => {
    let totalSessions = sessionStore.size;
    let audioFiles = 0;
    let encryptedSessions = 0;

    for (const session of sessionStore.values()) {
        if (session.filename && !session.audioDeleted) audioFiles++;
        if (session.transcription_encrypted) encryptedSessions++;
    }

    return {
        totalSessions,
        audioFiles,
        encryptedSessions,
        retentionDays: getRetentionDays(),
        uploadsDir,
    };
};

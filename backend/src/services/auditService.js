/**
 * Audit Log Service
 * Tracks all session lifecycle events with timestamps.
 * Enterprise-grade action tracking.
 */

// In-memory audit store. In production, use append-only persistent storage.
const auditLog = [];

/**
 * Supported audit actions.
 */
export const AUDIT_ACTIONS = {
    SESSION_CREATED: 'SESSION_CREATED',
    SESSION_EDITED: 'SESSION_EDITED',
    SESSION_DELETED: 'SESSION_DELETED',
    SESSION_EXPORTED: 'SESSION_EXPORTED',
    CONSENT_GIVEN: 'CONSENT_GIVEN',
    RECORDING_STARTED: 'RECORDING_STARTED',
    RECORDING_STOPPED: 'RECORDING_STOPPED',
    TRANSCRIPTION_COMPLETED: 'TRANSCRIPTION_COMPLETED',
    DIALOGUE_STRUCTURED: 'DIALOGUE_STRUCTURED',
    REPORT_GENERATED: 'REPORT_GENERATED',
    SOAP_GENERATED: 'SOAP_GENERATED',
    AUDIO_DELETED: 'AUDIO_DELETED',
    RISK_DETECTED: 'RISK_DETECTED',
    ICD_CODES_GENERATED: 'ICD_CODES_GENERATED',
    SCALES_CALCULATED: 'SCALES_CALCULATED',
    PDF_DOWNLOADED: 'PDF_DOWNLOADED',
};

/**
 * Log an audit action.
 * @param {string} action - One of AUDIT_ACTIONS
 * @param {string} sessionId - Associated session ID
 * @param {object} [metadata] - Additional context
 * @returns {object} The audit entry
 */
export const logAction = (action, sessionId, metadata = {}) => {
    const entry = {
        auditId: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        action,
        sessionId,
        timestamp: new Date().toISOString(),
        metadata,
    };

    auditLog.push(entry);
    return entry;
};

/**
 * Get audit log for a specific session.
 */
export const getSessionAuditLog = (sessionId) => {
    return auditLog.filter(entry => entry.sessionId === sessionId);
};

/**
 * Get the full audit log (admin).
 */
export const getFullAuditLog = () => {
    return [...auditLog];
};

/**
 * Get audit log summary (counts per action type).
 */
export const getAuditSummary = () => {
    const summary = {};
    for (const entry of auditLog) {
        summary[entry.action] = (summary[entry.action] || 0) + 1;
    }
    return {
        totalEvents: auditLog.length,
        actionCounts: summary,
        oldestEvent: auditLog[0]?.timestamp || null,
        newestEvent: auditLog[auditLog.length - 1]?.timestamp || null,
    };
};

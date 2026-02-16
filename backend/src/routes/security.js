import express from 'express';
import { logConsent, getConsent, exportConsentLog, getAllConsents } from '../services/consentService.js';
import { logAction, getSessionAuditLog, getFullAuditLog, getAuditSummary, AUDIT_ACTIONS } from '../services/auditService.js';
import { getStorageStats } from '../services/storageService.js';
import { getRiskCategories } from '../services/riskDetectionService.js';
import { getAllMedicationReferences } from '../services/clinicalService.js';

const router = express.Router();

// ── POST /api/security/consent ─────────────────────
// Log patient consent before recording
router.post('/consent', (req, res) => {
    try {
        const { sessionId, doctorId, patientRef } = req.body;

        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'sessionId is required.' });
        }

        const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
        const consent = logConsent({ sessionId, doctorId, ipAddress, patientRef });
        logAction(AUDIT_ACTIONS.CONSENT_GIVEN, sessionId, { doctorId });

        res.json({ success: true, consent });
    } catch (error) {
        console.error('❌ Consent logging error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── GET /api/security/consent/:sessionId ───────────
// Get consent record for a session
router.get('/consent/:sessionId', (req, res) => {
    const consent = getConsent(req.params.sessionId);
    if (!consent) {
        return res.status(404).json({ success: false, error: 'No consent record found for this session.' });
    }
    res.json({ success: true, consent });
});

// ── GET /api/security/consent/:sessionId/export ────
// Export consent log for download
router.get('/consent/:sessionId/export', (req, res) => {
    const exported = exportConsentLog(req.params.sessionId);
    if (!exported) {
        return res.status(404).json({ success: false, error: 'No consent record found.' });
    }
    res.json({ success: true, consentLog: exported });
});

// ── GET /api/security/audit/:sessionId ─────────────
// Get audit log for a specific session
router.get('/audit/:sessionId', (req, res) => {
    const log = getSessionAuditLog(req.params.sessionId);
    res.json({ success: true, auditLog: log, count: log.length });
});

// ── GET /api/security/audit ────────────────────────
// Get full audit log (admin)
router.get('/audit', (req, res) => {
    const log = getFullAuditLog();
    const summary = getAuditSummary();
    res.json({ success: true, auditLog: log, summary });
});

// ── GET /api/security/storage ──────────────────────
// Get storage statistics
router.get('/storage', (req, res) => {
    const stats = getStorageStats();
    res.json({ success: true, stats });
});

// ── GET /api/security/risk-categories ──────────────
// Get the risk detection categories configuration
router.get('/risk-categories', (req, res) => {
    const categories = getRiskCategories();
    res.json({ success: true, categories });
});

// ── GET /api/security/medications ──────────────────
// Get medication reference data
router.get('/medications', (req, res) => {
    const references = getAllMedicationReferences();
    res.json({ success: true, ...references });
});

// ── GET /api/security/privacy-policy ───────────────
// Transparent data flow documentation
router.get('/privacy-policy', (req, res) => {
    res.json({
        success: true,
        policy: {
            title: 'CeriNote Privacy & Security Policy',
            version: '2.0',
            lastUpdated: '2026-02-17',
            sections: [
                {
                    title: 'Data Flow',
                    content: 'Audio is captured in-browser → Uploaded over encrypted HTTPS → Processed by AI (Groq API) → Transcription & reports generated → Audio auto-deleted (zero-retention default).',
                },
                {
                    title: 'Retention Policy',
                    content: 'Default: Zero retention. Audio files are automatically deleted immediately after processing. Configurable retention windows: 0, 7, or 30 days. Auto-purge scheduler runs hourly to remove expired sessions.',
                },
                {
                    title: 'Encryption',
                    content: 'All sensitive clinical data (transcriptions, reports, SOAP notes) is encrypted using AES-256-GCM before storage. Encryption keys are stored in environment vaults, never hardcoded. If breached, data remains unreadable.',
                },
                {
                    title: 'Third-Party AI Processing',
                    content: 'CeriNote uses the Groq API for AI processing (Whisper for transcription, LLama for structuring). Per Groq\'s API terms, data is not used for model training. Audio is transmitted over encrypted channels.',
                },
                {
                    title: 'No Training Usage',
                    content: 'CeriNote does NOT use patient data for training AI models. All processing is inference-only through third-party APIs with no-training agreements.',
                },
                {
                    title: 'Access Control',
                    content: 'Session-based tenant isolation. Each doctor can only access their own sessions. No shared directories. Strict session ownership validation.',
                },
                {
                    title: 'Future Roadmap',
                    content: 'Planned: Self-hosted deployment option, private in-house AI model hosting, per-clinic encryption keys, and HIPAA Business Associate Agreement (BAA) compliance.',
                },
            ],
        },
    });
});

export { router as securityRouter };

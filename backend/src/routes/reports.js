import express from 'express';
import { generateMedicalReport } from '../services/reportService.js';
import { generateSOAPNote } from '../services/soapService.js';
import { suggestICDCodes, estimateScaleScores, getMedicationReference } from '../services/clinicalService.js';
import { logAction, AUDIT_ACTIONS } from '../services/auditService.js';

const router = express.Router();

// ── POST /api/reports/generate ─────────────────────
router.post('/generate', async (req, res) => {
    try {
        const { text, recordingId, recordingName } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Please provide dialogue text to analyze.',
            });
        }

        console.log(`📋 Generating medical report${recordingName ? ` for: ${recordingName}` : ''}...`);

        const report = await generateMedicalReport(text);

        console.log(`✅ Report generated (${report.length} chars)`);
        logAction(AUDIT_ACTIONS.REPORT_GENERATED, recordingId || 'unknown', { chars: report.length });

        res.json({
            success: true,
            report,
            recordingId: recordingId || null,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('❌ Report generation error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'An internal server error occurred.',
        });
    }
});

// ── POST /api/reports/soap ─────────────────────────
router.post('/soap', async (req, res) => {
    try {
        const { analyzedText, sessionId } = req.body;

        if (!analyzedText || !analyzedText.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Please provide analyzed report text to convert to SOAP format.',
            });
        }

        console.log('🩺 Converting to SOAP Note format...');

        const soapNote = await generateSOAPNote(analyzedText);

        console.log(`✅ SOAP Note generated (${soapNote.length} chars)`);
        logAction(AUDIT_ACTIONS.SOAP_GENERATED, sessionId || 'unknown', { chars: soapNote.length });

        res.json({
            success: true,
            soapNote,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('❌ SOAP generation error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'An internal server error occurred.',
        });
    }
});

// ── POST /api/reports/icd-codes ────────────────────
// ICD-10 / DSM-5 code suggestion engine
router.post('/icd-codes', async (req, res) => {
    try {
        const { clinicalText, sessionId } = req.body;

        if (!clinicalText || !clinicalText.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Please provide clinical text for ICD-10/DSM-5 coding.',
            });
        }

        console.log('🏥 Generating ICD-10/DSM-5 suggestions...');

        const result = await suggestICDCodes(clinicalText);

        console.log(`✅ ICD codes suggested: ${result.codes?.length || 0} codes`);
        logAction(AUDIT_ACTIONS.ICD_CODES_GENERATED, sessionId || 'unknown', {
            codeCount: result.codes?.length || 0,
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('❌ ICD code generation error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate ICD codes.',
        });
    }
});

// ── POST /api/reports/scales ───────────────────────
// PHQ-9, GAD-7, YMRS, HAM-D scale estimation
router.post('/scales', async (req, res) => {
    try {
        const { clinicalText, sessionId } = req.body;

        if (!clinicalText || !clinicalText.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Please provide clinical text for scale estimation.',
            });
        }

        console.log('📊 Estimating psychiatric scale scores...');

        const result = await estimateScaleScores(clinicalText);

        console.log(`✅ Scale scores estimated`);
        logAction(AUDIT_ACTIONS.SCALES_CALCULATED, sessionId || 'unknown');

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('❌ Scale estimation error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to estimate scale scores.',
        });
    }
});

// ── GET /api/reports/medications/:category ─────────
// Medication reference lookup
router.get('/medications/:category', (req, res) => {
    const reference = getMedicationReference(req.params.category);
    res.json({ success: true, ...reference });
});

export { router as reportsRouter };

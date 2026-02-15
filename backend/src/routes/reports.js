import express from 'express';
import { generateMedicalReport } from '../services/reportService.js';
import { generateSOAPNote } from '../services/soapService.js';

const router = express.Router();

// ── POST /api/reports/generate ─────────────────────
// Generate a structured medical report from dialogue text
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
// Convert analyzed medical report into SOAP Note format
router.post('/soap', async (req, res) => {
    try {
        const { analyzedText } = req.body;

        if (!analyzedText || !analyzedText.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Please provide analyzed report text to convert to SOAP format.',
            });
        }

        console.log('🩺 Converting to SOAP Note format...');

        const soapNote = await generateSOAPNote(analyzedText);

        console.log(`✅ SOAP Note generated (${soapNote.length} chars)`);

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

export { router as reportsRouter };

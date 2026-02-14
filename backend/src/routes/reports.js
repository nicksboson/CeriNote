import express from 'express';
import { generateMedicalReport } from '../services/reportService.js';

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

export { router as reportsRouter };

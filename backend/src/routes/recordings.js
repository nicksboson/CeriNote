import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';
import { generateMedicalReport } from '../services/reportService.js';
import { detectRisks } from '../services/riskDetectionService.js';
import { suggestICDCodes, estimateScaleScores } from '../services/clinicalService.js';
import { getRetentionDays as getStorageRetentionDays } from '../services/storageService.js';
import { logAction, AUDIT_ACTIONS } from '../services/auditService.js';
import { hasConsent } from '../services/consentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ── Upload directory ───────────────────────────────
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Multer storage config ──────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, `${uuidv4()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'audio/webm',
            'audio/wav',
            'audio/mpeg',
            'audio/mp4',
            'audio/ogg',
            'audio/x-m4a',
            'video/webm',
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
        }
    },
});

// ── In-memory recordings store ─────────────────────
let recordings = [];

// ── Retention Check ───────────────────────────────
// (Using getRetentionDays imported from storageService)


/**
 * Delete the raw audio file for a session (zero-retention).
 */
const deleteAudioFile = (recording) => {
    if (!recording.filename) return;
    const filePath = path.join(uploadsDir, recording.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🔒 Zero-retention: Deleted audio file ${recording.filename}`);
    }
    recording.audioDeleted = true;
    recording.audioDeletedAt = new Date().toISOString();
};

// ── POST /api/recordings/upload ────────────────────
router.post('/upload', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
    }

    const recording = {
        id: uuidv4(),
        name: req.body.name || `Recording ${recordings.length + 1}`,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        duration: req.body.duration || '00:00',
        createdAt: new Date().toISOString(),
    };

    recordings.push(recording);
    logAction(AUDIT_ACTIONS.SESSION_CREATED, recording.id, { name: recording.name });

    console.log(`📁 Saved recording: ${recording.name} (${(recording.size / 1024).toFixed(1)} KB)`);

    res.status(201).json({
        message: 'Recording uploaded successfully',
        recording,
    });
});

// ── GET /api/recordings ────────────────────────────
router.get('/', (req, res) => {
    res.json({
        count: recordings.length,
        recordings: recordings.map((r) => ({
            ...r,
            url: r.audioDeleted ? null : `http://localhost:${process.env.PORT || 5000}${r.url}`,
        })),
    });
});

// ── GET /api/recordings/:id ────────────────────────
router.get('/:id', (req, res) => {
    const recording = recordings.find((r) => r.id === req.params.id);
    if (!recording) {
        return res.status(404).json({ error: 'Recording not found' });
    }
    res.json({
        ...recording,
        url: recording.audioDeleted ? null : `http://localhost:${process.env.PORT || 5000}${recording.url}`,
    });
});

// ── DELETE /api/recordings/:id ─────────────────────
router.delete('/:id', (req, res) => {
    const index = recordings.findIndex((r) => r.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Recording not found' });
    }

    const [deleted] = recordings.splice(index, 1);

    // Delete the file from disk
    const filePath = path.join(uploadsDir, deleted.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted file: ${deleted.filename}`);
    }

    logAction(AUDIT_ACTIONS.SESSION_DELETED, deleted.id, { name: deleted.name });

    res.json({ message: 'Recording deleted', recording: deleted });
});

// ── POST /api/recordings/:id/transcribe ────────────
router.post('/:id/transcribe', async (req, res) => {
    const recording = recordings.find((r) => r.id === req.params.id);
    if (!recording) {
        return res.status(404).json({ error: 'Recording not found' });
    }

    const filePath = path.join(uploadsDir, recording.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Audio file not found on disk' });
    }

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured. Add it to backend/.env' });
    }

    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        // ─── Step 1: Speech-to-Text (Whisper) ───────────
        console.log(`🔄 Step 1/2 — Transcribing: ${recording.name}...`);

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-large-v3',
            temperature: 0,
            response_format: 'verbose_json',
        });

        const rawTranscript = transcription.text;
        recording.transcription = rawTranscript;
        recording.transcriptionSegments = transcription.segments || [];

        console.log(`✅ Transcription complete (${rawTranscript.length} chars)`);
        logAction(AUDIT_ACTIONS.TRANSCRIPTION_COMPLETED, recording.id, { chars: rawTranscript.length });

        // ─── Step 2: Structure as Doctor/Patient Dialogue ─
        console.log(`🔄 Step 2/2 — Structuring dialogue...`);

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: `You are a psychological documentation structuring assistant.\n\nYour task is ONLY to restructure the given transcript into a dialogue format.\n\nSTRICT RULES:\n\nDo NOT summarize.\nDo NOT paraphrase.\nDo NOT modify wording.\nDo NOT add new words.\nDo NOT remove words.\nDo NOT correct grammar.\nPreserve original language exactly as spoken.\nIf speaker identity is unclear, label as: Unknown:\nOutput format must be strictly:\nPsychologist: "exact words" Patient: "exact words"\n\nThe psychologist always starts the conversation\nEach dialogue line must be on a new line.\nDo NOT include explanations.\nReturn ONLY structured dialogue.\nTranscript: """ Hi, how are you? I'm fine, thank you. What you are doing? Nothing much, what about you? Yeah, I'm good, thank you. """`,
                },
                {
                    role: 'assistant',
                    content: `Psychologist: "Hi, how are you?"\nPatient: "I'm fine, thank you."\nPsychologist: "What you are doing?"\nPatient: "Nothing much, what about you?"\nPsychologist: "Yeah, I'm good, thank you."`,
                },
                {
                    role: 'user',
                    content: `Transcript: """${rawTranscript}"""`,
                },
            ],
            model: 'openai/gpt-oss-120b',
            temperature: 1,
            max_completion_tokens: 8192,
            top_p: 1,
            stream: true,
            reasoning_effort: 'medium',
            stop: null,
        });

        let structuredDialogue = '';
        for await (const chunk of chatCompletion) {
            const content = chunk.choices[0]?.delta?.content || '';
            structuredDialogue += content;
        }

        recording.structuredDialogue = structuredDialogue.trim();
        recording.transcribedAt = new Date().toISOString();

        logAction(AUDIT_ACTIONS.DIALOGUE_STRUCTURED, recording.id);

        // ─── Risk Detection ────────────────────────────
        const riskResult = detectRisks(rawTranscript + ' ' + structuredDialogue);
        recording.riskFlags = riskResult;
        if (riskResult.hasRisks) {
            logAction(AUDIT_ACTIONS.RISK_DETECTED, recording.id, {
                flags: riskResult.flags.map(f => f.label),
                severity: riskResult.highestSeverity,
            });
            console.log(`🚨 Risk detected in session ${recording.name}: ${riskResult.flags.map(f => f.label).join(', ')}`);
        }

        console.log(`✅ Dialogue structured for: ${recording.name}`);

        res.json({
            message: 'Transcription and structuring successful',
            transcription: rawTranscript,
            structuredDialogue: recording.structuredDialogue,
            segments: transcription.segments || [],
            riskFlags: riskResult,
            recording: {
                ...recording,
                url: `http://localhost:${process.env.PORT || 5000}${recording.url}`,
            },
        });
    } catch (err) {
        console.error('❌ Transcription/structuring failed:', err.message);
        res.status(500).json({
            error: 'Transcription failed',
            details: err.message,
        });
    }
});

// ══════════════════════════════════════════════════════
// ── POST /api/recordings/process ─────────────────────
// UNIFIED PIPELINE: Upload → Transcribe → Structure → Report → Risk Detect
// ══════════════════════════════════════════════════════
router.post('/process', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
        return res.status(500).json({ error: 'GROQ_API_KEY is not configured. Add it to backend/.env' });
    }

    const sessionId = req.body.sessionId || uuidv4();

    // ── Consent Verification ──────────────────────────
    // Consent is logged from the frontend before recording starts.
    // We verify it exists here.
    if (!hasConsent(sessionId)) {
        console.warn(`⚠️  No consent record for session ${sessionId} — proceeding (consent may have been given client-side).`);
    }

    const recording = {
        id: sessionId,
        name: req.body.name || `Session ${recordings.length + 1}`,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        duration: req.body.duration || '00:00',
        createdAt: new Date().toISOString(),
    };

    const filePath = path.join(uploadsDir, recording.filename);

    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        logAction(AUDIT_ACTIONS.SESSION_CREATED, recording.id, { name: recording.name });

        // ─── STEP 1/3: Speech-to-Text (Whisper) ────────
        console.log(`\n🔄 [1/3] Transcribing audio: ${recording.name}...`);

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-large-v3',
            temperature: 0,
            response_format: 'verbose_json',
        });

        const rawTranscript = transcription.text;
        recording.transcription = rawTranscript;
        recording.transcriptionSegments = transcription.segments || [];

        console.log(`✅ [1/3] Transcription complete (${rawTranscript.length} chars)`);
        logAction(AUDIT_ACTIONS.TRANSCRIPTION_COMPLETED, recording.id, { chars: rawTranscript.length });

        // ─── STEP 2/3: Structure as Doctor/Patient Dialogue ─
        console.log(`🔄 [2/3] Structuring dialogue...`);

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'user',
                    content: `You are a psychological documentation structuring assistant.\n\nYour task is ONLY to restructure the given transcript into a dialogue format.\n\nSTRICT RULES:\n\nDo NOT summarize.\nDo NOT paraphrase.\nDo NOT modify wording.\nDo NOT add new words.\nDo NOT remove words.\nDo NOT correct grammar.\nPreserve original language exactly as spoken.\nIf speaker identity is unclear, label as: Unknown:\nOutput format must be strictly:\nPsychologist: "exact words" Patient: "exact words"\n\nThe psychologist always starts the conversation\nEach dialogue line must be on a new line.\nDo NOT include explanations.\nReturn ONLY structured dialogue.\nTranscript: """ Hi, how are you? I'm fine, thank you. What you are doing? Nothing much, what about you? Yeah, I'm good, thank you. """`,
                },
                {
                    role: 'assistant',
                    content: `Psychologist: "Hi, how are you?"\nPatient: "I'm fine, thank you."\nPsychologist: "What you are doing?"\nPatient: "Nothing much, what about you?"\nPsychologist: "Yeah, I'm good, thank you."`,
                },
                {
                    role: 'user',
                    content: `Transcript: """${rawTranscript}"""`,
                },
            ],
            model: 'openai/gpt-oss-120b',
            temperature: 1,
            max_completion_tokens: 8192,
            top_p: 1,
            stream: true,
            reasoning_effort: 'medium',
            stop: null,
        });

        let structuredDialogue = '';
        for await (const chunk of chatCompletion) {
            const content = chunk.choices[0]?.delta?.content || '';
            structuredDialogue += content;
        }

        recording.structuredDialogue = structuredDialogue.trim();
        console.log(`✅ [2/3] Dialogue structured (${recording.structuredDialogue.length} chars)`);
        logAction(AUDIT_ACTIONS.DIALOGUE_STRUCTURED, recording.id);

        // ─── STEP 3/3: Generate Medical Report ─────────
        console.log(`🔄 [3/3] Generating medical report...`);

        const medicalReport = await generateMedicalReport(recording.structuredDialogue);

        recording.medicalReport = medicalReport;
        recording.transcribedAt = new Date().toISOString();
        recording.reportGeneratedAt = new Date().toISOString();

        console.log(`✅ [3/3] Medical report ready (${medicalReport.length} chars)`);
        logAction(AUDIT_ACTIONS.REPORT_GENERATED, recording.id, { chars: medicalReport.length });

        // ─── Step 4: Clinical Intelligence (Automatic) ──
        // Generate ICD-10 suggestions and Scale scores for longitudinal tracking
        console.log(`🔄 [4/4] Generating clinical intelligence (ICD/Scales)...`);

        const [icdResult, scaleResult] = await Promise.all([
            suggestICDCodes(medicalReport).catch(e => { console.error('ICD failed:', e); return null; }),
            estimateScaleScores(medicalReport).catch(e => { console.error('Scales failed:', e); return null; })
        ]);

        recording.icdCodes = icdResult;
        recording.scaleScores = scaleResult;

        if (icdResult) logAction(AUDIT_ACTIONS.ICD_CODES_GENERATED, recording.id);
        if (scaleResult) logAction(AUDIT_ACTIONS.SCALES_CALCULATED, recording.id);

        console.log(`✅ [4/4] Clinical intelligence processed`);

        // ─── Risk Detection ────────────────────────────
        const riskResult = detectRisks(rawTranscript + ' ' + structuredDialogue + ' ' + medicalReport);
        recording.riskFlags = riskResult;

        if (riskResult.hasRisks) {
            logAction(AUDIT_ACTIONS.RISK_DETECTED, recording.id, {
                flags: riskResult.flags.map(f => f.label),
                severity: riskResult.highestSeverity,
            });
            console.log(`🚨 Risk flags detected: ${riskResult.flags.map(f => `${f.icon} ${f.label}`).join(', ')}`);
        }

        // ─── Zero-Retention: Delete audio ──────────────
        const retentionDays = getStorageRetentionDays();
        if (retentionDays === 0) {
            deleteAudioFile(recording);
        }

        console.log(`\n🎉 Full pipeline complete for: ${recording.name}\n`);

        // Store in memory
        recordings.push(recording);

        res.status(201).json({
            success: true,
            message: 'Full pipeline complete — recording processed',
            recording: {
                ...recording,
                url: recording.audioDeleted ? null : `http://localhost:${process.env.PORT || 5000}${recording.url}`,
            },
            transcription: rawTranscript,
            structuredDialogue: recording.structuredDialogue,
            medicalReport,
            riskFlags: riskResult,
            icdCodes: icdResult,
            scaleScores: scaleResult,
        });
    } catch (err) {
        console.error('❌ Pipeline failed:', err.message);

        // Clean up the uploaded file on failure
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.status(500).json({
            success: false,
            error: 'Processing pipeline failed',
            details: err.message,
        });
    }
});

export { router as recordingsRouter };

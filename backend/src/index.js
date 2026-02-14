import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { recordingsRouter } from './routes/recordings.js';
import { reportsRouter } from './routes/reports.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Serve uploaded audio files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes ─────────────────────────────────────────
app.use('/api/recordings', recordingsRouter);
app.use('/api/reports', reportsRouter);

// ── Health Check ───────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'CeriNote API',
        timestamp: new Date().toISOString(),
    });
});

// ── Start Server ───────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n  🎙️  CeriNote API running at http://localhost:${PORT}`);
    console.log(`  📂  Uploads served at   http://localhost:${PORT}/uploads\n`);
});

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { recordingsRouter } from './routes/recordings.js';
import { reportsRouter } from './routes/reports.js';
import { securityRouter } from './routes/security.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Headers ──────────────────────────────
app.use((req, res, next) => {
    // HSTS — Force HTTPS (in production)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'microphone=(self), camera=()');
    next();
});

// ── Middleware ──────────────────────────────────────
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ⚠️  REMOVED: Static /uploads exposure
// Audio files are no longer served statically.
// They are processed and deleted (zero-retention default).
// app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes ─────────────────────────────────────────
app.use('/api/recordings', recordingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/security', securityRouter);

// ── Health Check ───────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'CeriNote API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        security: {
            encryption: 'AES-256-GCM',
            retention: `${process.env.RETENTION_DAYS || 0} days`,
            hsts: true,
            auditLogging: true,
            consentTracking: true,
            riskDetection: true,
        },
    });
});

// ── Start Server ───────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n  🎙️  CeriNote API v2.0 running at http://localhost:${PORT}`);
    console.log(`  🔒 Security: AES-256-GCM | Zero-Retention | HSTS | Audit Logging`);
    console.log(`  📊 Clinical: Risk Detection | ICD-10/DSM-5 | Scale Estimation`);
    console.log(`  ⚙️  Retention: ${process.env.RETENTION_DAYS || 0} days\n`);
});

# CeriNote 2.0 — Implementation Plan

## Phase 1: Backend Infrastructure (Trust + Security + Core)

### 1A. Encryption Service (`backend/src/services/encryptionService.js`)
- AES-256-GCM encryption/decryption using Node.js crypto
- Encryption key from ENV (`ENCRYPTION_KEY`)
- `encrypt(plaintext)` → `{ iv, encrypted, tag }`
- `decrypt(encryptedObj)` → plaintext
- Used before any data storage

### 1B. Secure Storage Service (`backend/src/services/storageService.js`)
- Replaces raw `/uploads` folder exposure
- Auto-delete audio after processing (zero-retention default)
- Configurable retention (0/7/30 days via `RETENTION_DAYS` env)
- Auto-purge scheduler (runs every hour)
- Session data stored encrypted in-memory (pre-DB)

### 1C. Consent Service (`backend/src/services/consentService.js`)
- `logConsent(sessionId, doctorId, ipHash, timestamp)`
- Stores consent records
- `getConsent(sessionId)` → consent record
- `exportConsentLog(sessionId)` → downloadable JSON

### 1D. Audit Log Service (`backend/src/services/auditService.js`)
- `logAction(action, sessionId, metadata)`
- Actions: SESSION_CREATED, SESSION_EDITED, SESSION_DELETED, SESSION_EXPORTED, CONSENT_GIVEN, REPORT_GENERATED, SOAP_GENERATED
- Timestamped, immutable log
- `getAuditLog(sessionId)` → array of events

### 1E. Risk Detection Service (`backend/src/services/riskDetectionService.js`)
- Scans transcription text for risk keywords/patterns
- Categories: SUICIDE_RISK, SELF_HARM, HOMICIDAL, PSYCHOSIS, SUBSTANCE_SEVERE
- Returns risk flags with matched phrases
- Used after transcription step

### 1F. Clinical Intelligence Service (`backend/src/services/clinicalService.js`)
- ICD-10/DSM-5 code suggestion (LLM-powered)
- PHQ-9, GAD-7, YMRS, HAM-D score estimation from symptoms
- Medication reference lookup (static data)
- All marked "For Clinical Review Only"

### 1G. Update Routes
- `recordings.js`: Add consent logging, audit logging, risk detection, auto-delete audio, encryption
- `reports.js`: Add ICD-10/DSM-5 endpoint, scale scoring endpoint, audit logging
- New route: `security.js` for consent/audit APIs

### 1H. Update `index.js`
- Add security headers (helmet-like)
- Remove static `/uploads` exposure
- Add new security routes
- Add retention scheduler startup

---

## Phase 2: Frontend Features

### 2A. Consent Modal (Pre-Recording)
- Mandatory consent confirmation before recording starts
- Logs consent to backend

### 2B. Risk Alert Banner
- After processing, if risk flags detected → show prominent alert
- "⚠️ Suicide risk language detected — Review required"

### 2C. ICD-10/DSM-5 Panel
- New tab or section in results
- Shows suggested codes with "For Clinical Review Only" disclaimer

### 2D. Scale Scores Panel
- PHQ-9, GAD-7 estimated scores
- Visual numeric display

### 2E. Security & Privacy Page (`/security`)
- Data flow diagram
- Retention policy
- Encryption practices
- Third-party AI processing disclosure
- No-training guarantee

### 2F. Multi-Mode Input
- Full Recording (existing)
- Manual Text Input mode (paste text → pipeline)

### 2G. EHR-Ready Export
- PDF (existing)
- Plain Text export
- FHIR-compatible JSON export

### 2H. Update Navbar
- Add Security link
- Update footer

---

## Phase 3: Execution Order

1. Backend services (encryption, storage, consent, audit, risk, clinical)
2. Update backend routes (recordings, reports, new security route)
3. Update backend index.js
4. Frontend consent modal
5. Frontend risk alerts + ICD/scale panels
6. Frontend security page
7. Frontend multi-mode + export enhancements
8. Update description.md

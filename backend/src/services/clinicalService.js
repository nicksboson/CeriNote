import Groq from 'groq-sdk';

/**
 * Clinical Intelligence Service
 * - ICD-10 / DSM-5 code suggestion
 * - PHQ-9, GAD-7, YMRS, HAM-D scale estimation
 * - Medication reference data
 *
 * All output marked "For Clinical Review Only"
 */

// ── ICD-10 / DSM-5 Suggestion Engine ───────────────

const ICD_DSM_PROMPT = `You are a clinical coding assistant for psychologists. Based on the psychological assessment text provided, suggest the most relevant ICD-10 codes and DSM-5-TR alignments.

STRICT RULES:
1. Only suggest codes based on symptoms and diagnoses EXPLICITLY mentioned.
2. Do NOT infer conditions not discussed.
3. For each suggestion, provide:
   - ICD-10 Code
   - DSM-5-TR Category
   - Description
   - Confidence: HIGH / MODERATE / LOW
4. Maximum 5 suggestions, ranked by relevance.
5. Include a disclaimer: "FOR CLINICAL REVIEW ONLY — Verify before use in billing or official documentation."

OUTPUT FORMAT (JSON array):
[
  {
    "icd10": "F32.1",
    "dsm5": "Major Depressive Disorder, Single Episode, Moderate",
    "description": "Brief clinical rationale",
    "confidence": "HIGH"
  }
]

Return ONLY valid JSON array. No other text.`;

/**
 * Generate ICD-10 / DSM-5 code suggestions from clinical text.
 */
export const suggestICDCodes = async (clinicalText) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: ICD_DSM_PROMPT },
            { role: 'user', content: clinicalText },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '[]';
    try {
        const parsed = JSON.parse(raw);
        // Handle both direct array and { codes: [...] } shapes
        const codes = Array.isArray(parsed) ? parsed : (parsed.codes || parsed.suggestions || [parsed]);
        return {
            codes,
            disclaimer: 'FOR CLINICAL REVIEW ONLY — Verify codes before use in billing or official documentation.',
            generatedAt: new Date().toISOString(),
        };
    } catch {
        return {
            codes: [],
            raw,
            disclaimer: 'FOR CLINICAL REVIEW ONLY',
            generatedAt: new Date().toISOString(),
        };
    }
};

// ── Psychiatric Scale Estimation ───────────────────

const SCALES_PROMPT = `You are a clinical psychology assessment specialist. Based on the clinical text provided, estimate scores for the following standardized scales based ONLY on symptoms and behavioral patterns explicitly mentioned.

For each scale, assign a score and severity based on the criteria below:

1. PHQ-9 (Patient Health Questionnaire-9) — Depression
   Score range: 0-27
   Severity: 0-4 Minimal, 5-9 Mild, 10-14 Moderate, 15-19 Moderately Severe, 20-27 Severe

2. GAD-7 (Generalized Anxiety Disorder-7) — Anxiety
   Score range: 0-21
   Severity: 0-4 Minimal, 5-9 Mild, 10-14 Moderate, 15-21 Severe

3. YMRS (Young Mania Rating Scale) — Mania
   Score range: 0-60
   Severity: 0-11 None, 12-19 Minimal, 20-25 Mild, 26-37 Moderate, 38+ Severe

4. HAM-D (Hamilton Rating Scale for Depression) — Depression (Clinician-rated)
   Score range: 0-52
   Severity: 0-7 Normal, 8-13 Mild, 14-18 Moderate, 19-22 Severe, 23+ Very Severe

RULES:
- Only score items where symptoms are explicitly documented
- If a symptom is not mentioned, score that item as 0
- Return estimated total score with severity category
- Mark each scale as "ESTIMATED — Not a substitute for formal administration"

OUTPUT FORMAT (JSON):
{
  "phq9": { "score": 0, "severity": "", "items": [] },
  "gad7": { "score": 0, "severity": "", "items": [] },
  "ymrs": { "score": 0, "severity": "", "items": [] },
  "hamd": { "score": 0, "severity": "", "items": [] },
  "disclaimer": "ESTIMATED — These scores are derived from clinical documentation and are not a substitute for formal scale administration."
}

Return ONLY valid JSON. No other text.`;

/**
 * Estimate psychiatric scale scores from clinical text.
 */
export const estimateScaleScores = async (clinicalText) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: SCALES_PROMPT },
            { role: 'user', content: clinicalText },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    try {
        const scales = JSON.parse(raw);
        return {
            scales,
            disclaimer: 'ESTIMATED — These scores are derived from clinical documentation and are not a substitute for formal scale administration.',
            generatedAt: new Date().toISOString(),
        };
    } catch {
        return {
            scales: {},
            raw,
            disclaimer: 'ESTIMATED',
            generatedAt: new Date().toISOString(),
        };
    }
};

// ── Medication Reference Layer ─────────────────────

const MEDICATION_REFERENCE = {
    depression: {
        firstLine: [
            { name: 'Sertraline (Zoloft)', class: 'SSRI', dosageRange: '50-200mg/day', notes: 'FDA-approved for MDD, OCD, PTSD, Panic Disorder. Generally well-tolerated.' },
            { name: 'Escitalopram (Lexapro)', class: 'SSRI', dosageRange: '10-20mg/day', notes: 'High selectivity. Minimal drug interactions.' },
            { name: 'Fluoxetine (Prozac)', class: 'SSRI', dosageRange: '20-80mg/day', notes: 'Long half-life. FDA-approved for adolescent depression.' },
            { name: 'Venlafaxine (Effexor XR)', class: 'SNRI', dosageRange: '75-375mg/day', notes: 'Dual mechanism. Monitor BP at higher doses.' },
            { name: 'Bupropion (Wellbutrin)', class: 'NDRI', dosageRange: '150-450mg/day', notes: 'No sexual side effects. Contraindicated with seizure disorders.' },
        ],
        monitoring: ['CBC at baseline', 'Metabolic panel', 'Suicidality risk (first 4 weeks)', 'Weight monitoring'],
    },
    anxiety: {
        firstLine: [
            { name: 'Sertraline (Zoloft)', class: 'SSRI', dosageRange: '50-200mg/day', notes: 'First-line for GAD, Social Anxiety, PTSD.' },
            { name: 'Escitalopram (Lexapro)', class: 'SSRI', dosageRange: '10-20mg/day', notes: 'FDA-approved for GAD.' },
            { name: 'Duloxetine (Cymbalta)', class: 'SNRI', dosageRange: '60-120mg/day', notes: 'FDA-approved for GAD. Also treats neuropathic pain.' },
            { name: 'Buspirone (BuSpar)', class: 'Azapirone', dosageRange: '15-60mg/day', notes: 'Non-addictive. No withdrawal. Takes 2-4 weeks.' },
        ],
        monitoring: ['Hepatic function (duloxetine)', 'Response assessment at 4-6 weeks'],
    },
    psychosis: {
        firstLine: [
            { name: 'Risperidone (Risperdal)', class: 'Atypical Antipsychotic', dosageRange: '2-8mg/day', notes: 'First-line for schizophrenia. Monitor EPS, prolactin.' },
            { name: 'Aripiprazole (Abilify)', class: 'Atypical Antipsychotic', dosageRange: '10-30mg/day', notes: 'Partial D2 agonist. Lower metabolic risk.' },
            { name: 'Olanzapine (Zyprexa)', class: 'Atypical Antipsychotic', dosageRange: '5-20mg/day', notes: 'Effective but significant metabolic side effects.' },
            { name: 'Quetiapine (Seroquel)', class: 'Atypical Antipsychotic', dosageRange: '150-800mg/day', notes: 'Sedating. Used for bipolar depression and insomnia.' },
        ],
        monitoring: ['Fasting glucose/lipids', 'HbA1c', 'Weight/BMI', 'EPS assessment', 'Prolactin levels'],
    },
    bipolar: {
        firstLine: [
            { name: 'Lithium', class: 'Mood Stabilizer', dosageRange: '600-1200mg/day', notes: 'Gold standard. Narrow therapeutic window (0.6-1.2 mEq/L). Anti-suicidal properties.' },
            { name: 'Valproate (Depakote)', class: 'Anticonvulsant', dosageRange: '750-2000mg/day', notes: 'Level monitoring required. Avoid in pregnancy.' },
            { name: 'Lamotrigine (Lamictal)', class: 'Anticonvulsant', dosageRange: '100-400mg/day', notes: 'Best for bipolar depression maintenance. Slow titration (SJS risk).' },
        ],
        monitoring: ['Lithium levels q3-6mo', 'Renal function', 'Thyroid function', 'Valproate levels', 'CBC with valproate'],
    },
    insomnia: {
        firstLine: [
            { name: 'Melatonin', class: 'Hormone', dosageRange: '0.5-5mg at bedtime', notes: 'First-line non-pharmacologic. CBT-I preferred.' },
            { name: 'Trazodone', class: 'SARI', dosageRange: '25-100mg at bedtime', notes: 'Low-dose for sleep. Minimal dependency risk.' },
            { name: 'Hydroxyzine (Vistaril)', class: 'Antihistamine', dosageRange: '25-100mg at bedtime', notes: 'Non-addictive. Also anxiolytic.' },
        ],
        monitoring: ['Sleep diary', 'Daytime drowsiness assessment'],
    },
};

/**
 * Get medication references for a given clinical category.
 */
export const getMedicationReference = (category) => {
    const normalized = category?.toLowerCase().replace(/[\s-]/g, '');
    for (const [key, data] of Object.entries(MEDICATION_REFERENCE)) {
        if (normalized?.includes(key) || key.includes(normalized || '')) {
            return {
                category: key,
                ...data,
                disclaimer: 'PSYCHOLOGICAL OVERSIGHT ONLY — This reference is provided for clinical monitoring. All prescribing decisions remain the responsibility of a licensed medical professional.',
            };
        }
    }

    // Return all categories if no specific match
    return {
        categories: Object.keys(MEDICATION_REFERENCE),
        disclaimer: 'PSYCHOLOGICAL OVERSIGHT ONLY — Specify a category (depression, anxiety, psychosis, bipolar, insomnia) for targeted monitoring references.',
    };
};

/**
 * Get all medication references.
 */
export const getAllMedicationReferences = () => {
    return {
        references: MEDICATION_REFERENCE,
        disclaimer: 'PSYCHOLOGICAL OVERSIGHT ONLY — This information is for clinical monitoring only.',
    };
};

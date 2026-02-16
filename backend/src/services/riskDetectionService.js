/**
 * Real-Time Risk Intelligence Engine
 *
 * Scans transcription and clinical text for high-risk psychiatric indicators.
 * Detects: Suicide ideation, Self-harm, Homicidal ideation, Psychosis, Severe substance dependence.
 */

const RISK_CATEGORIES = {
    SUICIDE_RISK: {
        label: 'Suicide Risk',
        severity: 'CRITICAL',
        color: '#ef4444',
        icon: '🚨',
        patterns: [
            /\b(suicid\w*)\b/i,
            /\bkill\s*(my)?self\b/i,
            /\bend\s*(my)?\s*life\b/i,
            /\bwant\s*to\s*die\b/i,
            /\bwish\s*i\s*was\s*dead\b/i,
            /\bbetter\s*off\s*dead\b/i,
            /\bno\s*reason\s*to\s*live\b/i,
            /\bdon'?t\s*want\s*to\s*(be|live)\s*(here|anymore)\b/i,
            /\bthoughts?\s*of\s*death\b/i,
            /\boverdos(e|ing)\b/i,
            /\bjump(ing)?\s*(off|from)\b/i,
            /\bhang(ing)?\s*my\s*self\b/i,
            /\bpassive\s*suicidal\b/i,
            /\bactive\s*suicidal\b/i,
            /\bsuicidal\s*ideation\b/i,
            /\b(SI|si)\s*(present|positive|endorses?|reports?)\b/i,
        ],
    },
    SELF_HARM: {
        label: 'Self-Harm',
        severity: 'HIGH',
        color: '#f97316',
        icon: '⚠️',
        patterns: [
            /\bself[\s-]*harm\w*\b/i,
            /\bcutting\s*(my)?\s*(self|arms?|wrists?|legs?)\b/i,
            /\bburnin?g?\s*(my)?\s*self\b/i,
            /\bhitting\s*(my)?\s*self\b/i,
            /\bself[\s-]*injur\w*\b/i,
            /\bself[\s-]*mutilat\w*\b/i,
            /\bnon[\s-]*suicidal\s*self[\s-]*injur\w*\b/i,
            /\bNSSI\b/,
            /\bdeliberate\s*self[\s-]*harm\b/i,
            /\bscratching\s*(my)?\s*(self|skin)\b/i,
        ],
    },
    HOMICIDAL: {
        label: 'Homicidal Ideation',
        severity: 'CRITICAL',
        color: '#dc2626',
        icon: '🔴',
        patterns: [
            /\bhomicid\w*\b/i,
            /\bkill\s*(someone|them|him|her|people|others?)\b/i,
            /\bhurt\s*(someone|them|him|her|people|others?)\b/i,
            /\bwant\s*to\s*(murder|attack|assault)\b/i,
            /\bviolent\s*(thoughts?|urges?|impulses?)\b/i,
            /\bthoughts?\s*of\s*(hurting|harming|killing)\s*(others?|someone|people)\b/i,
            /\b(HI|hi)\s*(present|positive|endorses?|reports?)\b/i,
        ],
    },
    PSYCHOSIS: {
        label: 'Psychosis Indicators',
        severity: 'HIGH',
        color: '#a855f7',
        icon: '🔮',
        patterns: [
            /\bhallucinat\w*\b/i,
            /\bdelusion\w*\b/i,
            /\bparanoi\w*\b/i,
            /\bhearing\s*voices?\b/i,
            /\bseeing\s*things\b/i,
            /\bvoices?\s*(telling|commanding|saying)\b/i,
            /\bthought\s*(insertion|broadcasting|withdrawal)\b/i,
            /\bideas?\s*of\s*reference\b/i,
            /\bpersecutory\b/i,
            /\bgrandiose?\b/i,
            /\bdisorganized\s*(thinking|speech|thought|behavior)\b/i,
            /\bcatatoni\w*\b/i,
            /\bpsychotic\w*\b/i,
            /\breality\s*testing\b/i,
        ],
    },
    SUBSTANCE_SEVERE: {
        label: 'Severe Substance Dependence',
        severity: 'MODERATE',
        color: '#eab308',
        icon: '💊',
        patterns: [
            /\bsubstance\s*(abuse|dependence|use\s*disorder)\b/i,
            /\b(alcohol|drug)\s*(dependenc|addicti|withdr)\w*\b/i,
            /\bdetox\w*\b/i,
            /\bDTs\b/,
            /\bdelirium\s*tremens\b/i,
            /\boverdos(e|ed|ing)\b/i,
            /\bIV\s*(drug|substance)\s*use\b/i,
            /\bheroin\b/i,
            /\bmethamphetamine\b/i,
            /\bfentanyl\b/i,
            /\bcocaine\s*(use|abuse|dependence)\b/i,
            /\bopioid\s*(use|abuse|dependence|disorder)\b/i,
            /\bbinge\s*drinking\b/i,
            /\bsevere\s*alcohol\b/i,
            /\bwithdrawal\s*(symptoms?|seizures?|syndrome)\b/i,
        ],
    },
};

/**
 * Scan text for risk indicators.
 * @param {string} text - Transcription or clinical text to scan
 * @returns {{ hasRisks: boolean, flags: Array<{ category, label, severity, color, icon, matches: string[] }> }}
 */
export const detectRisks = (text) => {
    if (!text || typeof text !== 'string') {
        return { hasRisks: false, flags: [] };
    }

    const flags = [];

    for (const [category, config] of Object.entries(RISK_CATEGORIES)) {
        const matches = [];

        for (const pattern of config.patterns) {
            const found = text.match(new RegExp(pattern, 'gi'));
            if (found) {
                matches.push(...found.map(m => m.trim()));
            }
        }

        if (matches.length > 0) {
            // Deduplicate matches
            const uniqueMatches = [...new Set(matches.map(m => m.toLowerCase()))];
            flags.push({
                category,
                label: config.label,
                severity: config.severity,
                color: config.color,
                icon: config.icon,
                matches: uniqueMatches,
                count: uniqueMatches.length,
            });
        }
    }

    // Sort by severity: CRITICAL first, then HIGH, then MODERATE
    const severityOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2 };
    flags.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

    return {
        hasRisks: flags.length > 0,
        flags,
        highestSeverity: flags[0]?.severity || null,
        scannedAt: new Date().toISOString(),
    };
};

/**
 * Get the risk categories configuration (for frontend display).
 */
export const getRiskCategories = () => {
    return Object.entries(RISK_CATEGORIES).map(([key, config]) => ({
        category: key,
        label: config.label,
        severity: config.severity,
        color: config.color,
        icon: config.icon,
        patternCount: config.patterns.length,
    }));
};

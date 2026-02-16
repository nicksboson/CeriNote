import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = 'http://localhost:5000/api';

function Security() {
    const [policy, setPolicy] = useState(null);
    const [stats, setStats] = useState(null);
    const [auditSummary, setAuditSummary] = useState(null);

    useEffect(() => {
        // Load privacy policy
        fetch(`${API_BASE}/security/privacy-policy`)
            .then(r => r.json())
            .then(data => { if (data.success) setPolicy(data.policy); })
            .catch(console.error);

        // Load storage stats
        fetch(`${API_BASE}/security/storage`)
            .then(r => r.json())
            .then(data => { if (data.success) setStats(data.stats); })
            .catch(console.error);

        // Load audit summary
        fetch(`${API_BASE}/security/audit`)
            .then(r => r.json())
            .then(data => { if (data.success) setAuditSummary(data.summary); })
            .catch(console.error);
    }, []);

    const securityFeatures = [
        {
            icon: '🔒',
            title: 'AES-256-GCM Encryption',
            description: 'All clinical data is encrypted at rest using military-grade AES-256-GCM encryption. Keys are stored in environment vaults, never hardcoded.',
            status: 'Active',
            color: '#34d399',
        },
        {
            icon: '🗑️',
            title: 'Zero-Retention Default',
            description: 'Audio files are automatically deleted immediately after AI processing. No raw recordings are stored on our servers.',
            status: `${stats?.retentionDays || 0} days retention`,
            color: '#818cf8',
        },
        {
            icon: '📝',
            title: 'Digital Consent Logging',
            description: 'Mandatory patient consent confirmation before every recording session. Each consent is timestamped, hashed, and stored immutably.',
            status: 'Enforced',
            color: '#34d399',
        },
        {
            icon: '📊',
            title: 'Audit Trail',
            description: 'Every action is logged — session creation, report generation, exports, risk detections. Full accountability and compliance tracking.',
            status: `${auditSummary?.totalEvents || 0} events`,
            color: '#fbbf24',
        },
        {
            icon: '🛡️',
            title: 'Security Headers',
            description: 'HSTS, X-Frame-Options, X-XSS-Protection, Content-Type-Options, and Referrer-Policy headers on every response.',
            status: 'Active',
            color: '#34d399',
        },
        {
            icon: '🚫',
            title: 'No Training Usage',
            description: 'Patient data is NEVER used to train AI models. All processing is inference-only through third-party APIs with no-training agreements.',
            status: 'Guaranteed',
            color: '#34d399',
        },
    ];

    return (
        <div className="min-h-screen bg-[#0a0a0f] pt-32 pb-20 px-6">
            {/* Background Effects */}
            <div className="fixed top-[-100px] left-[-80px] w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-60px] right-[-40px] w-[400px] h-[400px] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Security Status: Active
                    </div>

                    <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
                        Security & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Privacy</span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        Transparent documentation of how CeriNote protects your clinical data. Built for risk-sensitive psychiatric practice.
                    </p>
                </div>

                {/* Security Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
                    {securityFeatures.map((feature, i) => (
                        <div
                            key={i}
                            className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{feature.icon}</span>
                                    <h3 className="text-white font-bold">{feature.title}</h3>
                                </div>
                                <span
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                                    style={{ background: `${feature.color}15`, color: feature.color }}
                                >
                                    {feature.status}
                                </span>
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                        </div>
                    ))}
                </div>

                {/* Data Flow Documentation */}
                {policy && (
                    <div className="mb-16">
                        <h2 className="text-2xl font-bold text-white mb-8 text-center">Data Flow & Policies</h2>
                        <div className="space-y-4">
                            {policy.sections.map((section, i) => (
                                <div
                                    key={i}
                                    className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-sm">
                                            {i + 1}
                                        </div>
                                        <h3 className="text-white font-bold">{section.title}</h3>
                                    </div>
                                    <p className="text-gray-400 text-sm leading-relaxed pl-11">{section.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Storage Stats */}
                {stats && (
                    <div className="mb-16">
                        <h2 className="text-2xl font-bold text-white mb-8 text-center">System Status</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Sessions', value: stats.totalSessions, color: '#818cf8' },
                                { label: 'Audio Files', value: stats.audioFiles, color: '#34d399' },
                                { label: 'Encrypted', value: stats.encryptedSessions, color: '#fbbf24' },
                                { label: 'Retention', value: `${stats.retentionDays}d`, color: '#f472b6' },
                            ].map((stat, i) => (
                                <div key={i} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                                    <span className="text-3xl font-extrabold block mb-1" style={{ color: stat.color }}>{stat.value}</span>
                                    <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Architecture Diagram */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold text-white mb-8 text-center">Architecture Overview</h2>
                    <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            {[
                                { icon: '🎙️', label: 'Audio Capture', sub: 'Browser WebRTC' },
                                { icon: '🔒', label: 'TLS 1.3 Transit', sub: 'HTTPS Encrypted' },
                                { icon: '🤖', label: 'AI Processing', sub: 'Groq API (No Training)' },
                                { icon: '🗑️', label: 'Audio Deleted', sub: 'Zero-Retention' },
                                { icon: '📄', label: 'Encrypted Storage', sub: 'AES-256-GCM' },
                            ].map((step, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="text-center">
                                        <span className="text-3xl block mb-2">{step.icon}</span>
                                        <span className="text-white text-sm font-bold block">{step.label}</span>
                                        <span className="text-gray-500 text-[10px] block">{step.sub}</span>
                                    </div>
                                    {i < 4 && <span className="text-gray-600 text-xl hidden md:block">→</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer CTA */}
                <div className="text-center">
                    <p className="text-gray-500 text-sm mb-4">
                        CeriNote v2.0 — Secure Psychiatric Documentation Infrastructure
                    </p>
                    <Link
                        to="/record"
                        className="px-8 py-3 rounded-2xl bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 transition-all no-underline"
                    >
                        Start a Secure Session →
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Security;

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = 'http://localhost:5000/api';

function Sessions() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [stats, setStats] = useState({ total: 0, critical: 0, high: 0 });

    useEffect(() => {
        fetch(`${API_BASE}/recordings`)
            .then(res => res.json())
            .then(data => {
                const list = data.recordings || [];
                setSessions(list.reverse()); // Newest first

                // Summary stats
                const criticalCount = list.filter(s => s.riskFlags?.highestSeverity === 'CRITICAL').length;
                const highCount = list.filter(s => s.riskFlags?.highestSeverity === 'HIGH').length;
                setStats({ total: list.length, critical: criticalCount, high: highCount });
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load sessions:', err);
                setLoading(false);
            });
    }, []);

    const filteredSessions = sessions.filter(s =>
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.medicalReport?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helper: Mini Sparkline for Scale Trends
    const renderSparkline = (key, label, color) => {
        // Get scores for this scale across all sessions (oldest to newest for graph)
        const points = sessions
            .filter(s => s.scaleScores?.scales?.[key])
            .map(s => s.scaleScores.scales[key].score)
            .reverse();

        if (points.length < 2) return null;

        const max = Math.max(...points, 10);
        const width = 100;
        const height = 30;
        const stepX = width / (points.length - 1);

        const pathData = points.map((p, i) => {
            const x = i * stepX;
            const y = height - (p / max) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        return (
            <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label} Trend</span>
                    <span className="text-[10px] font-bold" style={{ color }}>{points[points.length - 1]} (Current)</span>
                </div>
                <svg width={width} height={height} className="overflow-visible">
                    <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((p, i) => (
                        <circle key={i} cx={i * stepX} cy={height - (p / max) * height} r="1.5" fill={color} />
                    ))}
                </svg>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] pt-32 pb-20 px-6">
            {/* Background Blobs */}
            <div className="fixed top-[-100px] left-[-80px] w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-60px] right-[-40px] w-[400px] h-[400px] rounded-full bg-purple-600/5 blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Patient <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Longitudinal</span> Dashboard</h1>
                        <p className="text-gray-500 text-sm">Long-term psychiatric risk progression and session history.</p>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl px-6 py-3 text-center">
                            <span className="block text-2xl font-bold text-white">{stats.total}</span>
                            <span className="text-[10px] font-bold text-gray-600 uppercase">Sessions</span>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl px-6 py-3 text-center">
                            <span className="block text-2xl font-bold text-red-400">{stats.critical + stats.high}</span>
                            <span className="text-[10px] font-bold text-red-400/50 uppercase">Alerts</span>
                        </div>
                    </div>
                </div>

                {/* Search and Trends Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-1">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                            <input
                                type="text"
                                placeholder="Search sessions or clinical notes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:bg-white/[0.04] focus:border-indigo-500/30 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col md:flex-row gap-8 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <div className="flex-1">{renderSparkline('phq9', 'PHQ-9 (Depression)', '#818cf8')}</div>
                        <div className="w-px bg-white/5 hidden md:block" />
                        <div className="flex-1">{renderSparkline('gad7', 'GAD-7 (Anxiety)', '#34d399')}</div>
                    </div>
                </div>

                {/* Sessions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full py-20 text-center text-gray-600">Loading sessions...</div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-gray-600 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
                            No sessions found matching your search.
                        </div>
                    ) : (
                        filteredSessions.map((session) => (
                            <div
                                key={session.id}
                                className="group bg-white/[0.02] border border-white/5 rounded-3xl p-6 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-white font-bold text-lg group-hover:text-indigo-400 transition-colors line-clamp-1">{session.name || 'Untitled Session'}</span>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                                            {new Date(session.timestamp).toLocaleDateString()} · {session.duration}
                                        </span>
                                    </div>
                                    {session.riskFlags?.hasRisks && (
                                        <span
                                            className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest"
                                            style={{
                                                background: session.riskFlags.highestSeverity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                color: session.riskFlags.highestSeverity === 'CRITICAL' ? '#f87171' : '#fbbf24'
                                            }}
                                        >
                                            {session.riskFlags.highestSeverity} RISK
                                        </span>
                                    )}
                                </div>

                                <div className="bg-black/20 rounded-2xl p-4 mb-5">
                                    <p className="text-gray-400 text-xs leading-relaxed line-clamp-3 italic">
                                        {session.medicalReport?.substring(0, 150)}...
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {session.scaleScores?.scales?.phq9 && (
                                        <div className="bg-white/[0.03] rounded-xl p-2.5">
                                            <span className="text-[10px] font-bold text-gray-500 block uppercase">PHQ-9</span>
                                            <span className="text-white font-bold text-base">{session.scaleScores.scales.phq9.score}</span>
                                            <span className="text-[8px] font-bold text-indigo-400 block uppercase">{session.scaleScores.scales.phq9.severity}</span>
                                        </div>
                                    )}
                                    {session.scaleScores?.scales?.gad7 && (
                                        <div className="bg-white/[0.03] rounded-xl p-2.5">
                                            <span className="text-[10px] font-bold text-gray-500 block uppercase">GAD-7</span>
                                            <span className="text-white font-bold text-base">{session.scaleScores.scales.gad7.score}</span>
                                            <span className="text-[8px] font-bold text-emerald-400 block uppercase">{session.scaleScores.scales.gad7.severity}</span>
                                        </div>
                                    )}
                                </div>

                                <Link
                                    to="/record"
                                    className="w-full py-3 rounded-2xl bg-white/[0.04] border border-white/5 text-gray-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all text-center block no-underline"
                                >
                                    View Full Report →
                                </Link>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="mt-20 text-center">
                    <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">
                        CeriNote Healthcare Infrastructure — Longitudinal System Active
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Sessions;

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const API_URL = 'http://localhost:5000/api';

function Report() {
    const [searchParams] = useSearchParams();
    const [inputText, setInputText] = useState('');
    const [reportResult, setReportResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [recordingName, setRecordingName] = useState('');
    const [copied, setCopied] = useState(false);

    // Load dialogue from query params (passed from Record page)
    useEffect(() => {
        const recordingId = searchParams.get('recordingId');
        const name = searchParams.get('name');

        if (name) setRecordingName(decodeURIComponent(name));

        if (recordingId) {
            // Fetch the recording to get its structured dialogue
            fetch(`${API_URL}/recordings/${recordingId}`)
                .then((res) => res.json())
                .then((data) => {
                    const dialogue = data.structuredDialogue || data.transcription || '';
                    setInputText(dialogue);
                })
                .catch((err) => console.error('Failed to load recording:', err));
        }
    }, [searchParams]);

    const handleGenerate = async () => {
        if (!inputText.trim()) return;

        setIsLoading(true);
        setError(null);
        setReportResult('');

        try {
            const res = await fetch(`${API_URL}/reports/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: inputText,
                    recordingId: searchParams.get('recordingId'),
                    recordingName,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || 'Report generation failed');
                return;
            }

            setReportResult(data.report);
        } catch (err) {
            setError(err.message || 'Failed to connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    const copyReport = () => {
        navigator.clipboard.writeText(reportResult);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Parse the markdown-like report into styled JSX
    const formatReport = (text) => {
        if (!text) return null;

        return text.split('\n').map((line, i) => {
            const trimmed = line.trim();

            // Bold headers: **Header**
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                return (
                    <h3 key={i} className="text-indigo-400 font-semibold text-base mt-5 mb-2 pb-1.5 border-b border-indigo-500/20">
                        {trimmed.replace(/\*\*/g, '')}
                    </h3>
                );
            }

            // Bullet points
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                    <div key={i} className="flex items-start gap-2 mb-1.5 pl-2">
                        <span className="text-indigo-400 font-bold mt-0.5 shrink-0">•</span>
                        <span className="text-gray-300 text-sm leading-relaxed">{trimmed.replace(/^[-*]\s/, '')}</span>
                    </div>
                );
            }

            // Bold key-value pairs: **Key:** Value
            if (trimmed.includes('**')) {
                const parts = trimmed.split('**');
                return (
                    <p key={i} className="text-gray-300 text-sm mb-1.5 leading-relaxed">
                        {parts.map((part, j) =>
                            j % 2 === 1 ? (
                                <strong key={j} className="text-gray-100 font-semibold">{part}</strong>
                            ) : (
                                part
                            )
                        )}
                    </p>
                );
            }

            // Empty lines
            if (!trimmed) return <div key={i} className="h-2" />;

            // Normal text
            return <p key={i} className="text-gray-300 text-sm mb-1.5 leading-relaxed">{line}</p>;
        });
    };

    return (
        <div className="relative min-h-screen w-full bg-[#0a0a0f] text-gray-200 font-['Inter',system-ui,sans-serif] overflow-x-hidden">
            {/* Background blobs */}
            <div className="fixed w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,_#10b981,_transparent_70%)] blur-[120px] opacity-15 pointer-events-none top-[-150px] right-[-100px]" />
            <div className="fixed w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,_#6366f1,_transparent_70%)] blur-[120px] opacity-15 pointer-events-none bottom-[-100px] left-[-80px]" />

            {/* Header */}
            <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between pt-7 px-8 max-sm:px-5 max-sm:pt-5 max-sm:flex-col-reverse max-sm:items-start max-sm:gap-3">
                <Link
                    to="/record"
                    className="flex items-center gap-1.5 text-gray-400 no-underline text-sm font-medium px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] transition-all duration-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12] hover:-translate-x-0.5"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5" />
                        <path d="M12 19l-7-7 7-7" />
                    </svg>
                    Back to Recorder
                </Link>
                <h1 className="flex items-center gap-2.5 text-xl font-semibold bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent m-0">
                    <svg className="stroke-emerald-400 shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Medical Report
                </h1>
            </header>

            {/* Main Content — Two-column Grid */}
            <main className="relative z-10 w-full max-w-6xl mx-auto px-8 py-8 max-sm:px-5">
                {recordingName && (
                    <p className="text-sm text-gray-500 mb-4">
                        Generating report for: <span className="text-gray-300 font-medium">{recordingName}</span>
                    </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ── Input Panel ─────────────────── */}
                    <div className="flex flex-col bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm min-h-[500px]">
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/[0.06]">
                            <h3 className="m-0 text-sm font-semibold text-gray-300">Input Dialogue</h3>
                            <span className="bg-white/[0.06] text-gray-500 px-2.5 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wider">
                                Source
                            </span>
                        </div>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Paste doctor-patient dialogue or load from a transcription..."
                            disabled={isLoading}
                            className="flex-1 w-full p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] text-gray-300 text-sm font-[inherit] resize-none outline-none transition-all duration-200 placeholder:text-gray-600 focus:border-indigo-400/30 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)] disabled:opacity-50 mb-4"
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !inputText.trim()}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-none bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold cursor-pointer transition-all duration-300 font-[inherit] hover:from-emerald-400 hover:to-teal-400 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(16,185,129,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                        >
                            {isLoading ? (
                                <>
                                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Generating Report...
                                </>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                    Generate Report
                                </>
                            )}
                        </button>
                    </div>

                    {/* ── Results Panel ─────────────────── */}
                    <div className="flex flex-col bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm min-h-[500px]">
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/[0.06]">
                            <h3 className="m-0 text-sm font-semibold text-gray-300">Clinical Report</h3>
                            {reportResult && (
                                <button
                                    onClick={copyReport}
                                    className="text-xs text-gray-500 hover:text-gray-300 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-lg cursor-pointer transition-colors duration-200 font-[inherit]"
                                >
                                    {copied ? '✓ Copied!' : 'Copy'}
                                </button>
                            )}
                        </div>

                        <div className={`flex-1 overflow-y-auto pr-1 ${isLoading ? 'opacity-40' : ''}`}>
                            {/* Error */}
                            {error && (
                                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                                    <strong>Error:</strong> {error}
                                </div>
                            )}

                            {/* Empty State */}
                            {!reportResult && !isLoading && !error && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                                    <svg className="opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                    <p className="text-sm italic">Clinical report will appear here</p>
                                </div>
                            )}

                            {/* Loading skeleton */}
                            {isLoading && (
                                <div className="space-y-4 animate-pulse">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i}>
                                            <div className="h-4 bg-white/[0.06] rounded-lg w-1/3 mb-2" />
                                            <div className="h-3 bg-white/[0.04] rounded-lg w-full mb-1.5" />
                                            <div className="h-3 bg-white/[0.04] rounded-lg w-4/5 mb-1.5" />
                                            <div className="h-3 bg-white/[0.04] rounded-lg w-2/3" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Formatted Report */}
                            {reportResult && (
                                <div className="report-content">
                                    {formatReport(reportResult)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Report;

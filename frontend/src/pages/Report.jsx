import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';

const API_URL = 'http://localhost:5000/api';

function Report() {
    const [searchParams] = useSearchParams();
    const [inputText, setInputText] = useState('');
    const [reportResult, setReportResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [recordingName, setRecordingName] = useState('');
    const [copied, setCopied] = useState(false);

    // SOAP state
    const [soapNote, setSoapNote] = useState(null); // { subjective, objective, assessment, plan }
    const [isSoapLoading, setIsSoapLoading] = useState(false);
    const [soapError, setSoapError] = useState(null);
    const [showSoap, setShowSoap] = useState(false);
    const [soapSaved, setSoapSaved] = useState(false);

    // Load dialogue from query params (passed from Record page)
    useEffect(() => {
        const recordingId = searchParams.get('recordingId');
        const name = searchParams.get('name');

        if (name) setRecordingName(decodeURIComponent(name));

        if (recordingId) {
            fetch(`${API_URL}/recordings/${recordingId}`)
                .then((res) => res.json())
                .then((data) => {
                    const dialogue = data.structuredDialogue || data.transcription || '';
                    setInputText(dialogue);
                })
                .catch((err) => console.error('Failed to load recording:', err));
        }
    }, [searchParams]);

    // ── Generate Medical Report ─────────────────────
    const handleGenerate = async () => {
        if (!inputText.trim()) return;

        setIsLoading(true);
        setError(null);
        setReportResult('');
        setSoapNote(null);
        setShowSoap(false);

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

    // ── Copy Report ─────────────────────────────────
    const copyReport = () => {
        navigator.clipboard.writeText(reportResult);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ── Download PDF ────────────────────────────────
    const downloadPDF = () => {
        if (!reportResult) return;

        const doc = new jsPDF({ unit: 'mm', format: 'a4' });

        // Colors
        const primaryColor = [99, 102, 241];   // Indigo
        const darkBg = [15, 15, 25];
        const textWhite = [240, 240, 245];
        const textGray = [180, 180, 195];
        const accentGreen = [16, 185, 129];

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 18;
        const contentWidth = pageWidth - margin * 2;
        let y = 0;

        // Background
        doc.setFillColor(...darkBg);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Top accent bar
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 3, 'F');

        y = 18;

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(...textWhite);
        doc.text('Clinical Medical Report', margin, y);
        y += 8;

        // Subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textGray);
        const dateStr = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
        doc.text(`Generated: ${dateStr}`, margin, y);
        if (recordingName) {
            doc.text(`Recording: ${recordingName}`, pageWidth - margin, y, { align: 'right' });
        }
        y += 4;

        // Divider line
        doc.setDrawColor(...accentGreen);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // Content
        const lines = reportResult.split('\n');

        const addNewPage = () => {
            doc.addPage();
            doc.setFillColor(...darkBg);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, pageWidth, 2, 'F');
            y = 14;
        };

        for (const rawLine of lines) {
            const trimmed = rawLine.trim();

            if (y > pageHeight - 20) addNewPage();

            // Bold headers **Header**
            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                y += 3;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(...accentGreen);
                const headerText = trimmed.replace(/\*\*/g, '');
                doc.text(headerText, margin, y);
                y += 2;
                doc.setDrawColor(99, 102, 241);
                doc.setLineWidth(0.15);
                doc.line(margin, y, margin + doc.getTextWidth(headerText), y);
                y += 5;
                continue;
            }

            // Bullet points
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(...textWhite);
                const bulletText = trimmed.replace(/^[-*]\s/, '');
                const wrapped = doc.splitTextToSize(`  •  ${bulletText}`, contentWidth - 4);
                for (const wl of wrapped) {
                    if (y > pageHeight - 20) addNewPage();
                    doc.text(wl, margin + 2, y);
                    y += 4.5;
                }
                continue;
            }

            // Inline bold **key:** value
            if (trimmed.includes('**')) {
                doc.setFontSize(9);
                const plainText = trimmed.replace(/\*\*/g, '');
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...textWhite);
                const wrapped = doc.splitTextToSize(plainText, contentWidth);
                for (const wl of wrapped) {
                    if (y > pageHeight - 20) addNewPage();
                    doc.text(wl, margin, y);
                    y += 4.5;
                }
                continue;
            }

            // Empty line
            if (!trimmed) { y += 3; continue; }

            // Normal text
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...textGray);
            const wrapped = doc.splitTextToSize(trimmed, contentWidth);
            for (const wl of wrapped) {
                if (y > pageHeight - 20) addNewPage();
                doc.text(wl, margin, y);
                y += 4.5;
            }
        }

        // Footer on last page
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 120);
        doc.text('CeriNote — AI-Powered Clinical Documentation', margin, pageHeight - 8);
        doc.text('Confidential', pageWidth - margin, pageHeight - 8, { align: 'right' });

        const fileName = recordingName
            ? `CeriNote_Report_${recordingName.replace(/\s+/g, '_')}.pdf`
            : 'CeriNote_Medical_Report.pdf';
        doc.save(fileName);
    };

    // ── Convert to SOAP ─────────────────────────────
    const handleConvertToSOAP = async () => {
        if (!reportResult) return;

        setIsSoapLoading(true);
        setSoapError(null);
        setSoapNote(null);
        setShowSoap(true);

        try {
            const res = await fetch(`${API_URL}/reports/soap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analyzedText: reportResult }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setSoapError(data.error || 'SOAP conversion failed');
                return;
            }

            // Parse the SOAP response into 4 sections
            const parsed = parseSOAPSections(data.soapNote);
            setSoapNote(parsed);
        } catch (err) {
            setSoapError(err.message || 'Failed to connect to server');
        } finally {
            setIsSoapLoading(false);
        }
    };

    // ── Parse SOAP into editable sections ───────────
    const parseSOAPSections = (rawText) => {
        const sections = {
            header: '',
            subjective: '',
            objective: '',
            assessment: '',
            plan: '',
        };

        // Try to find each section
        const text = rawText || '';

        // Extract header (everything before SUBJECTIVE)
        const subjIdx = text.search(/\bSUBJECTIVE\b/i);
        const objIdx = text.search(/\bOBJECTIVE\b/i);
        const assIdx = text.search(/\bASSESSMENT\b/i);
        const planIdx = text.search(/\bPLAN\b/i);

        if (subjIdx !== -1) {
            sections.header = text.substring(0, subjIdx).trim();
        }

        if (subjIdx !== -1 && objIdx !== -1) {
            sections.subjective = text.substring(subjIdx, objIdx).replace(/^SUBJECTIVE\s*/i, '').trim();
        } else if (subjIdx !== -1) {
            sections.subjective = text.substring(subjIdx).replace(/^SUBJECTIVE\s*/i, '').trim();
        }

        if (objIdx !== -1 && assIdx !== -1) {
            sections.objective = text.substring(objIdx, assIdx).replace(/^OBJECTIVE\s*/i, '').trim();
        } else if (objIdx !== -1) {
            sections.objective = text.substring(objIdx).replace(/^OBJECTIVE\s*/i, '').trim();
        }

        if (assIdx !== -1 && planIdx !== -1) {
            sections.assessment = text.substring(assIdx, planIdx).replace(/^ASSESSMENT\s*/i, '').trim();
        } else if (assIdx !== -1) {
            sections.assessment = text.substring(assIdx).replace(/^ASSESSMENT\s*/i, '').trim();
        }

        if (planIdx !== -1) {
            sections.plan = text.substring(planIdx).replace(/^PLAN\s*/i, '').trim();
        }

        // Fallback: if parsing failed, just dump everything into subjective
        if (!sections.subjective && !sections.objective && !sections.assessment && !sections.plan) {
            sections.subjective = text;
        }

        return sections;
    };

    // ── SOAP field change handler ────────────────────
    const handleSoapChange = (field, value) => {
        setSoapNote((prev) => ({ ...prev, [field]: value }));
        setSoapSaved(false);
    };

    const handleSoapSave = () => {
        setSoapSaved(true);
        setTimeout(() => setSoapSaved(false), 2500);
    };

    // ── Download SOAP as PDF ────────────────────────
    const downloadSOAPPDF = () => {
        if (!soapNote) return;

        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 18;
        const contentWidth = pageWidth - margin * 2;
        let y = 0;

        const darkBg = [15, 15, 25];
        const textWhite = [240, 240, 245];
        const textGray = [180, 180, 195];
        const soapColors = {
            subjective: [99, 102, 241],
            objective: [16, 185, 129],
            assessment: [245, 158, 11],
            plan: [236, 72, 153],
        };

        doc.setFillColor(...darkBg);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Top accent gradient bar
        doc.setFillColor(...soapColors.subjective);
        doc.rect(0, 0, pageWidth / 4, 3, 'F');
        doc.setFillColor(...soapColors.objective);
        doc.rect(pageWidth / 4, 0, pageWidth / 4, 3, 'F');
        doc.setFillColor(...soapColors.assessment);
        doc.rect(pageWidth / 2, 0, pageWidth / 4, 3, 'F');
        doc.setFillColor(...soapColors.plan);
        doc.rect(3 * pageWidth / 4, 0, pageWidth / 4, 3, 'F');

        y = 18;

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(...textWhite);
        doc.text('CLINICAL SOAP NOTE', margin, y);
        y += 8;

        // Date
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textGray);
        const dateStr = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
        doc.text(`Date: ${dateStr}`, margin, y);
        y += 4;

        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // Header section
        if (soapNote.header) {
            doc.setFontSize(9);
            doc.setTextColor(...textWhite);
            const wrappedHeader = doc.splitTextToSize(soapNote.header, contentWidth);
            for (const wl of wrappedHeader) {
                if (y > pageHeight - 20) { doc.addPage(); doc.setFillColor(...darkBg); doc.rect(0, 0, pageWidth, pageHeight, 'F'); y = 14; }
                doc.text(wl, margin, y);
                y += 4.5;
            }
            y += 4;
        }

        const addNewPage = () => {
            doc.addPage();
            doc.setFillColor(...darkBg);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            y = 14;
        };

        // Render each SOAP section
        const soapSections = [
            { key: 'subjective', label: 'SUBJECTIVE', color: soapColors.subjective },
            { key: 'objective', label: 'OBJECTIVE', color: soapColors.objective },
            { key: 'assessment', label: 'ASSESSMENT', color: soapColors.assessment },
            { key: 'plan', label: 'PLAN', color: soapColors.plan },
        ];

        for (const section of soapSections) {
            if (!soapNote[section.key]) continue;

            if (y > pageHeight - 30) addNewPage();

            // Section header
            y += 2;
            doc.setFillColor(...section.color);
            doc.roundedRect(margin, y - 4, contentWidth, 8, 1, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(section.label, margin + 4, y + 1);
            y += 10;

            // Section content
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...textWhite);
            const wrapped = doc.splitTextToSize(soapNote[section.key], contentWidth);
            for (const wl of wrapped) {
                if (y > pageHeight - 20) addNewPage();
                doc.text(wl, margin, y);
                y += 4.5;
            }
            y += 4;
        }

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 120);
        doc.text('CeriNote — AI-Powered Clinical SOAP Documentation', margin, pageHeight - 8);
        doc.text('Confidential', pageWidth - margin, pageHeight - 8, { align: 'right' });

        const fileName = recordingName
            ? `CeriNote_SOAP_${recordingName.replace(/\s+/g, '_')}.pdf`
            : 'CeriNote_SOAP_Note.pdf';
        doc.save(fileName);
    };

    // ── Format report markdown to JSX ───────────────
    const formatReport = (text) => {
        if (!text) return null;

        return text.split('\n').map((line, i) => {
            const trimmed = line.trim();

            if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                return (
                    <h3 key={i} className="text-indigo-400 font-semibold text-base mt-5 mb-2 pb-1.5 border-b border-indigo-500/20">
                        {trimmed.replace(/\*\*/g, '')}
                    </h3>
                );
            }

            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                    <div key={i} className="flex items-start gap-2 mb-1.5 pl-2">
                        <span className="text-indigo-400 font-bold mt-0.5 shrink-0">•</span>
                        <span className="text-gray-300 text-sm leading-relaxed">{trimmed.replace(/^[-*]\s/, '')}</span>
                    </div>
                );
            }

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

            if (!trimmed) return <div key={i} className="h-2" />;

            return <p key={i} className="text-gray-300 text-sm mb-1.5 leading-relaxed">{line}</p>;
        });
    };

    // ── SOAP Section Color Map ──────────────────────
    const soapColorMap = {
        subjective: {
            label: 'S — Subjective',
            accent: 'from-indigo-500 to-blue-500',
            border: 'border-indigo-500/30',
            bg: 'bg-indigo-500/5',
            text: 'text-indigo-400',
            ring: 'focus:ring-indigo-500/20',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            ),
        },
        objective: {
            label: 'O — Objective',
            accent: 'from-emerald-500 to-teal-500',
            border: 'border-emerald-500/30',
            bg: 'bg-emerald-500/5',
            text: 'text-emerald-400',
            ring: 'focus:ring-emerald-500/20',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            ),
        },
        assessment: {
            label: 'A — Assessment',
            accent: 'from-amber-500 to-orange-500',
            border: 'border-amber-500/30',
            bg: 'bg-amber-500/5',
            text: 'text-amber-400',
            ring: 'focus:ring-amber-500/20',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
            ),
        },
        plan: {
            label: 'P — Plan',
            accent: 'from-pink-500 to-rose-500',
            border: 'border-pink-500/30',
            bg: 'bg-pink-500/5',
            text: 'text-pink-400',
            ring: 'focus:ring-pink-500/20',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
            ),
        },
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

            {/* Main Content */}
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={copyReport}
                                        className="text-xs text-gray-500 hover:text-gray-300 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-lg cursor-pointer transition-colors duration-200 font-[inherit]"
                                    >
                                        {copied ? '✓ Copied!' : 'Copy'}
                                    </button>
                                </div>
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

                        {/* ── Action Buttons (Download PDF / Convert to SOAP) ─── */}
                        {reportResult && (
                            <div className="flex gap-3 mt-4 pt-4 border-t border-white/[0.06]">
                                {/* Download PDF Button */}
                                <button
                                    onClick={downloadPDF}
                                    id="btn-download-pdf"
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-semibold cursor-pointer transition-all duration-300 font-[inherit] hover:bg-indigo-500/20 hover:border-indigo-500/50 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(99,102,241,0.15)]"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Download PDF
                                </button>

                                {/* Convert to SOAP Button */}
                                <button
                                    onClick={handleConvertToSOAP}
                                    disabled={isSoapLoading}
                                    id="btn-convert-soap"
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-pink-500/30 bg-pink-500/10 text-pink-300 text-sm font-semibold cursor-pointer transition-all duration-300 font-[inherit] hover:bg-pink-500/20 hover:border-pink-500/50 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(236,72,153,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSoapLoading ? (
                                        <>
                                            <span className="inline-block w-4 h-4 border-2 border-pink-300/30 border-t-pink-300 rounded-full animate-spin" />
                                            Converting...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                <line x1="3" y1="9" x2="21" y2="9" />
                                                <line x1="3" y1="15" x2="21" y2="15" />
                                                <line x1="12" y1="3" x2="12" y2="21" />
                                            </svg>
                                            Convert to SOAP
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── SOAP Note Editor (Full Width Below) ─────────── */}
                {showSoap && (
                    <div className="mt-8 animate-[fadeSlideIn_0.5s_ease-out]">
                        {/* SOAP Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                        <line x1="3" y1="9" x2="21" y2="9" />
                                        <line x1="3" y1="15" x2="21" y2="15" />
                                        <line x1="12" y1="3" x2="12" y2="21" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white m-0">SOAP Note</h2>
                                    <p className="text-xs text-gray-500 m-0 mt-0.5">Editable — Click any section to modify</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {soapNote && (
                                    <>
                                        <button
                                            onClick={handleSoapSave}
                                            className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 font-[inherit] hover:bg-emerald-500/20"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                <polyline points="17 21 17 13 7 13 7 21" />
                                                <polyline points="7 3 7 8 15 8" />
                                            </svg>
                                            {soapSaved ? '✓ Saved!' : 'Save Changes'}
                                        </button>
                                        <button
                                            onClick={downloadSOAPPDF}
                                            className="flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 font-[inherit] hover:bg-indigo-500/20"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="7 10 12 15 17 10" />
                                                <line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                            Download SOAP PDF
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setShowSoap(false)}
                                    className="text-xs text-gray-500 hover:text-gray-300 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors duration-200 font-[inherit]"
                                >
                                    ✕ Close
                                </button>
                            </div>
                        </div>

                        {/* SOAP Error */}
                        {soapError && (
                            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                                <strong>Error:</strong> {soapError}
                            </div>
                        )}

                        {/* SOAP Loading */}
                        {isSoapLoading && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {['S', 'O', 'A', 'P'].map((letter) => (
                                    <div key={letter} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 animate-pulse">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
                                            <div className="h-4 w-24 bg-white/[0.06] rounded" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="h-3 bg-white/[0.04] rounded w-full" />
                                            <div className="h-3 bg-white/[0.04] rounded w-4/5" />
                                            <div className="h-3 bg-white/[0.04] rounded w-3/5" />
                                            <div className="h-3 bg-white/[0.04] rounded w-full" />
                                            <div className="h-3 bg-white/[0.04] rounded w-2/3" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* SOAP Editable Sections */}
                        {soapNote && !isSoapLoading && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {Object.entries(soapColorMap).map(([key, config]) => (
                                    <div
                                        key={key}
                                        className={`bg-white/[0.02] border ${config.border} rounded-2xl p-5 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.03]`}
                                    >
                                        {/* Section Header */}
                                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/[0.06]">
                                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.accent} flex items-center justify-center text-white shadow-lg`}>
                                                {config.icon}
                                            </div>
                                            <h4 className={`m-0 text-sm font-semibold ${config.text}`}>
                                                {config.label}
                                            </h4>
                                        </div>

                                        {/* Editable Textarea */}
                                        <textarea
                                            value={soapNote[key] || ''}
                                            onChange={(e) => handleSoapChange(key, e.target.value)}
                                            className={`w-full min-h-[180px] p-3 rounded-xl border border-white/[0.06] ${config.bg} text-gray-300 text-sm font-[inherit] resize-vertical outline-none transition-all duration-200 focus:border-${key === 'subjective' ? 'indigo' : key === 'objective' ? 'emerald' : key === 'assessment' ? 'amber' : 'pink'}-400/30 focus:ring-2 ${config.ring} placeholder:text-gray-600`}
                                            placeholder={`Enter ${config.label.split(' — ')[1]} findings...`}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Animation keyframes via inline style */}
            <style>{`
                @keyframes fadeSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}

export default Report;

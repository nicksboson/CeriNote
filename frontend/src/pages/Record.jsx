import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import './Record.css';
import './RecordExtra.css';

const API_BASE = 'http://localhost:5000/api';

function Record() {
  // ── Core Recording State ──────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pipelineError, setPipelineError] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('report');
  const [copied, setCopied] = useState(false);

  // ── SOAP State ────────────────────────────────────
  const [soapNote, setSoapNote] = useState(null);
  const [isSoapLoading, setIsSoapLoading] = useState(false);
  const [soapError, setSoapError] = useState(null);

  // ── Consent State ─────────────────────────────────
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // ── Risk Detection State ──────────────────────────
  const [riskFlags, setRiskFlags] = useState(null);

  // ── Clinical Intelligence State ───────────────────
  const [icdCodes, setIcdCodes] = useState(null);
  const [icdLoading, setIcdLoading] = useState(false);
  const [scaleScores, setScaleScores] = useState(null);
  const [scalesLoading, setScalesLoading] = useState(false);

  // ── Input Mode State ──────────────────────────────
  const [inputMode, setInputMode] = useState('record'); // 'record' | 'text'
  const [manualText, setManualText] = useState('');
  const [manualProcessing, setManualProcessing] = useState(false);

  // ── Refs ──────────────────────────────────────────
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const reportRef = useRef(null);

  // ── Consent Logic ─────────────────────────────────
  const generateSessionId = () => `SESSION-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const handleConsentConfirm = async () => {
    const sid = generateSessionId();
    setSessionId(sid);
    setConsentGiven(true);
    setShowConsentModal(false);

    // Log consent to backend
    try {
      await fetch(`${API_BASE}/security/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, doctorId: 'DOCTOR_001' }),
      });
    } catch (err) {
      console.warn('Consent logging failed (non-blocking):', err.message);
    }

    // Start recording after consent
    actuallyStartRecording();
  };

  // ── Recorder Logic ────────────────────────────────
  const startRecording = () => {
    if (!consentGiven) {
      setShowConsentModal(true);
      return;
    }
    actuallyStartRecording();
  };

  const actuallyStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stopAnalyser();
        processRecording(blob, formatTime(duration));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setPipelineError(null);
      startTimer();
      startAnalyser(stream);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setPipelineError('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
    }
  };

  const togglePause = () => {
    if (isPaused) {
      mediaRecorderRef.current.resume();
      startTimer();
    } else {
      mediaRecorderRef.current.pause();
      stopTimer();
    }
    setIsPaused(!isPaused);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Visualizer Logic ──────────────────────────────
  const startAnalyser = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);
    drawVisualizer();
  };

  const stopAnalyser = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / dataArray.length) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] / 2;
        ctx.fillStyle = `rgb(${barHeight + 100}, 50, 200)`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  };

  // ── Processing Logic (Unified Pipeline) ───────────
  const processRecording = useCallback(async (blob, recordingDuration) => {
    setIsProcessing(true);
    setCurrentStep(0);
    setPipelineError(null);
    setShowResult(false);
    setSoapNote(null);
    setRiskFlags(null);
    setIcdCodes(null);
    setScaleScores(null);

    try {
      const formData = new FormData();
      formData.append('audio', blob, `session-${Date.now()}.webm`);
      formData.append('duration', recordingDuration);
      if (sessionId) formData.append('sessionId', sessionId);

      setCurrentStep(0);
      await new Promise(r => setTimeout(r, 600));
      setCurrentStep(1);

      const res = await fetch(`${API_BASE}/recordings/process`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || 'Processing failed');
      }

      setCurrentStep(2);
      await new Promise(r => setTimeout(r, 600));
      setCurrentStep(3);
      await new Promise(r => setTimeout(r, 600));

      const data = await res.json();
      setResult(data);
      setShowResult(true);

      // Set risk flags from backend
      if (data.riskFlags) {
        setRiskFlags(data.riskFlags);
      }

      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err) {
      console.error('Pipeline Error:', err);
      setPipelineError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId]);

  // ── Manual Text Processing ────────────────────────
  const processManualText = async () => {
    if (!manualText.trim()) return;
    setManualProcessing(true);
    setPipelineError(null);
    setShowResult(false);
    setSoapNote(null);
    setRiskFlags(null);
    setIcdCodes(null);
    setScaleScores(null);

    try {
      // Generate report from manual text
      const res = await fetch(`${API_BASE}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: manualText }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Report generation failed');

      setResult({
        transcription: manualText,
        structuredDialogue: manualText,
        medicalReport: data.report,
        recording: { name: 'Manual Input Session' },
      });
      setShowResult(true);

      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setPipelineError(err.message);
    } finally {
      setManualProcessing(false);
    }
  };

  const startNewSession = () => {
    setAudioBlob(null);
    setDuration(0);
    setIsRecording(false);
    setIsPaused(false);
    setShowResult(false);
    setResult(null);
    setSoapNote(null);
    setCurrentStep(0);
    setActiveTab('report');
    setRiskFlags(null);
    setIcdCodes(null);
    setScaleScores(null);
    setConsentGiven(false);
    setSessionId(null);
    setManualText('');
  };

  // ── Actions: Copy, PDF, SOAP ──────────────────────
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export as plain text
  const downloadPlainText = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export as FHIR-compatible JSON
  const downloadFHIRJSON = () => {
    if (!result) return;
    const fhirDoc = {
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '34117-2',
          display: 'History and physical note',
        }],
      },
      date: new Date().toISOString(),
      description: 'CeriNote Clinical Session Report',
      content: [{
        attachment: {
          contentType: 'text/plain',
          data: btoa(result.medicalReport || ''),
        },
      }],
      context: {
        event: [{
          coding: [{
            system: 'http://snomed.info/sct',
            code: '371530004',
            display: 'Clinical consultation',
          }],
        }],
      },
    };
    const blob = new Blob([JSON.stringify(fhirDoc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CeriNote_FHIR_Report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format Markdown Report
  const formatReport = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return <h3 key={i} className="text-indigo-400 font-semibold text-base mt-5 mb-2 pb-1.5 border-b border-indigo-500/20">{trimmed.replace(/\*\*/g, '')}</h3>;
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
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-gray-100 font-semibold">{part}</strong> : part)}
          </p>
        );
      }
      if (!trimmed) return <div key={i} className="h-2" />;
      return <p key={i} className="text-gray-300 text-sm mb-1.5 leading-relaxed">{line}</p>;
    });
  };

  const formatDialogue = (text) => {
    if (!text) return null;
    return (
      <div className="flex flex-col gap-4 mt-2">
        {text.split('\n').map((line, i) => {
          if (line.startsWith('Doctor:')) {
            return (
              <div key={i} className="dialogue-line doctor p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Doctor</span>
                <p className="text-indigo-100 text-sm leading-relaxed">{line.replace('Doctor:', '').replace(/"/g, '').trim()}</p>
              </div>
            );
          }
          if (line.startsWith('Patient:')) {
            return (
              <div key={i} className="dialogue-line patient p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Patient</span>
                <p className="text-gray-300 text-sm leading-relaxed">{line.replace('Patient:', '').replace(/"/g, '').trim()}</p>
              </div>
            );
          }
          if (!line.trim()) return null;
          return <p key={i} className="text-gray-500 italic text-xs pl-4 border-l border-white/10 my-2">{line}</p>;
        })}
      </div>
    );
  };

  // ── PDF Generation ────────────────────────────────
  const downloadPDF = () => {
    if (!result?.medicalReport) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const primaryColor = [99, 102, 241];
    const darkBg = [15, 15, 25];
    const textWhite = [240, 240, 245];
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    let y = 18;

    doc.setFillColor(...darkBg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...textWhite);
    doc.text('Clinical Medical Report', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
    if (result.recording?.name) {
      doc.text(`Recording: ${result.recording.name}`, pageWidth - margin, y, { align: 'right' });
    }
    y += 10;

    doc.setFontSize(10);
    const lines = doc.splitTextToSize(result.medicalReport.replace(/\*\*/g, ''), pageWidth - margin * 2);
    doc.text(lines, margin, y);
    doc.save('Medical_Report.pdf');
  };

  const downloadSOAPPDF = () => {
    if (!soapNote) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const primaryColor = [99, 102, 241];
    const darkBg = [15, 15, 25];
    const textWhite = [240, 240, 245];
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    let y = 18;

    doc.setFillColor(...darkBg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...textWhite);
    doc.text('Psychiatric SOAP Note', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
    if (result.recording?.name) {
      doc.text(`Session: ${result.recording.name}`, pageWidth - margin, y, { align: 'right' });
    }
    y += 12;

    const addSection = (title, content, color) => {
      if (y > pageHeight - 40) {
        doc.addPage();
        doc.setFillColor(...darkBg);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...color);
      doc.text(title, margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(220, 220, 230);
      const lines = doc.splitTextToSize(content || 'N/A', pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += (lines.length * 5) + 8;
    };

    if (soapNote.subjective) addSection('SUBJECTIVE', soapNote.subjective, [129, 140, 248]);
    if (soapNote.objective) addSection('OBJECTIVE', soapNote.objective, [52, 211, 153]);
    if (soapNote.assessment) addSection('ASSESSMENT', soapNote.assessment, [251, 191, 36]);
    if (soapNote.plan) addSection('PLAN', soapNote.plan, [244, 114, 182]);

    doc.save('SOAP_Note.pdf');
  };

  // ── SOAP Generation ───────────────────────────────
  const handleConvertToSOAP = async () => {
    if (!result?.medicalReport) return;
    setIsSoapLoading(true);
    setSoapError(null);
    setSoapNote(null);
    setActiveTab('soap');

    try {
      const res = await fetch(`${API_BASE}/reports/soap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyzedText: result.medicalReport, sessionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'SOAP conversion failed');
      setSoapNote(parseSOAPSections(data.soapNote));
    } catch (err) {
      setSoapError(err.message);
    } finally {
      setIsSoapLoading(false);
    }
  };

  const handleSoapChange = (section, value) => {
    setSoapNote(prev => ({ ...prev, [section]: value }));
  };

  const parseSOAPSections = (rawText) => {
    const sections = { header: '', subjective: '', objective: '', assessment: '', plan: '' };
    const text = rawText || '';
    const subjIdx = text.search(/\bSUBJECTIVE\b/i);
    const objIdx = text.search(/\bOBJECTIVE\b/i);
    const assIdx = text.search(/\bASSESSMENT\b/i);
    const planIdx = text.search(/\bPLAN\b/i);

    if (subjIdx !== -1) sections.header = text.substring(0, subjIdx).trim();
    if (subjIdx !== -1) sections.subjective = text.substring(subjIdx, objIdx === -1 ? undefined : objIdx).replace(/^SUBJECTIVE\s*/i, '').trim();
    if (objIdx !== -1) sections.objective = text.substring(objIdx, assIdx === -1 ? undefined : assIdx).replace(/^OBJECTIVE\s*/i, '').trim();
    if (assIdx !== -1) sections.assessment = text.substring(assIdx, planIdx === -1 ? undefined : planIdx).replace(/^ASSESSMENT\s*/i, '').trim();
    if (planIdx !== -1) sections.plan = text.substring(planIdx).replace(/^PLAN\s*/i, '').trim();

    if (!sections.subjective && !sections.objective && !sections.assessment && !sections.plan) sections.subjective = text;
    return sections;
  };

  // ── ICD-10 / DSM-5 Generation ─────────────────────
  const generateICDCodes = async () => {
    if (!result?.medicalReport) return;
    setIcdLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/icd-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicalText: result.medicalReport, sessionId }),
      });
      const data = await res.json();
      if (data.success) setIcdCodes(data);
    } catch (err) {
      console.error('ICD generation failed:', err);
    } finally {
      setIcdLoading(false);
    }
  };

  // ── Scale Score Estimation ────────────────────────
  const generateScaleScores = async () => {
    if (!result?.medicalReport) return;
    setScalesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/scales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicalText: result.medicalReport, sessionId }),
      });
      const data = await res.json();
      if (data.success) setScaleScores(data);
    } catch (err) {
      console.error('Scale estimation failed:', err);
    } finally {
      setScalesLoading(false);
    }
  };

  // ── Pipeline Steps ────────────────────────────────
  const steps = [
    { id: 'upload', label: 'Uploading', icon: '☁️' },
    { id: 'transcribe', label: 'Speech to Text', icon: '🎙️' },
    { id: 'dialogue', label: 'Structuring', icon: '💬' },
    { id: 'report', label: 'Medical Report', icon: '📋' },
  ];

  // ═══════════════════════════════════════════════════
  // ── RENDER ────────────────────────────────────────
  // ═══════════════════════════════════════════════════
  return (
    <div className="record-page pt-32 px-6 min-h-screen bg-[#0a0a0f]">
      <div className="max-w-4xl mx-auto w-full">
        <div className="fixed top-[-50px] right-[-50px] w-[300px] h-[300px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

        <div className="mb-10 text-center md:text-left">
          <h1 className="text-3xl font-bold text-white tracking-tight">Session Workspace</h1>
          <p className="text-gray-500 text-sm mt-1">Record, transcribe, and generate clinical documentation.</p>
        </div>

        {/* ══ CONSENT MODAL ══ */}
        {showConsentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#111118] border border-white/10 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center text-2xl">🔒</div>
                <div>
                  <h2 className="text-xl font-bold text-white">Patient Consent Required</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Mandatory before session recording</p>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 mb-6 text-sm text-gray-400 leading-relaxed space-y-3">
                <p>By confirming, you certify that:</p>
                <div className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span><span>Patient consent has been obtained for this clinical session recording.</span></div>
                <div className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span><span>The patient has been informed that AI will process the audio for documentation purposes.</span></div>
                <div className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span><span>Audio is deleted immediately after processing (zero-retention default).</span></div>
                <div className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span><span>Patient may request data deletion at any time.</span></div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConsentModal(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-semibold hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConsentConfirm}
                  className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
                >
                  Confirm & Start Recording
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ RISK ALERT BANNER ══ */}
        {riskFlags?.hasRisks && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 animate-fade-slide-up">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🚨</span>
              <div>
                <h3 className="text-red-400 font-bold text-base">Clinical Risk Detected — Review Required</h3>
                <p className="text-red-400/60 text-xs mt-0.5">Severity: {riskFlags.highestSeverity}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {riskFlags.flags.map((flag, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: `${flag.color}15`, color: flag.color, border: `1px solid ${flag.color}30` }}
                >
                  {flag.icon} {flag.label} ({flag.count} match{flag.count > 1 ? 'es' : ''})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ INPUT MODE SELECTOR ══ */}
        {!showResult && !isProcessing && (
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => setInputMode('record')}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${inputMode === 'record' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'}`}
            >
              🎙️ Full Recording
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${inputMode === 'text' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'}`}
            >
              📝 Manual Text Input
            </button>
          </div>
        )}

        {/* ══ RECORDER SECTION ══ */}
        {!showResult && !isProcessing && inputMode === 'record' && (
          <div className="recorder-section animate-fade-slide-up">
            <div className="recorder-card">
              <div className={`timer ${isRecording ? 'timer--active' : ''}`}>
                {formatTime(duration)}
              </div>

              <div className="visualizer-container">
                <canvas ref={canvasRef} width="600" height="120" className="visualizer-canvas" />
              </div>

              <div className="mic-area">
                {!isRecording ? (
                  <button className="mic-btn" onClick={startRecording}>
                    <div className="mic-icon" style={{ fontSize: '2rem' }}>🎙️</div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>START SESSION</span>
                  </button>
                ) : (
                  <div className="recording-controls">
                    <button className={`ctrl-btn ctrl-btn--pause ${isPaused ? 'ctrl-btn--paused' : ''}`} onClick={togglePause}>
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button className="ctrl-btn ctrl-btn--stop" onClick={stopRecording}>
                      Stop & Generate
                    </button>
                  </div>
                )}
                {isRecording && !isPaused && (
                  <>
                    <div className="pulse-ring pulse-ring-1" />
                    <div className="pulse-ring pulse-ring-2" />
                    <div className="pulse-ring pulse-ring-3" />
                  </>
                )}
              </div>
            </div>

            {pipelineError && (
              <div className="pipeline-error" style={{ marginTop: '20px' }}>
                <div className="error-icon">⚠️</div>
                <div>
                  <h4>Connection Error</h4>
                  <p>{pipelineError}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ MANUAL TEXT INPUT ══ */}
        {!showResult && !isProcessing && inputMode === 'text' && (
          <div className="animate-fade-slide-up">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-3">Paste Session Transcript or Clinical Notes</h3>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste your doctor-patient dialogue or clinical notes here..."
                className="w-full h-48 bg-black/30 border border-white/10 rounded-xl p-4 text-gray-300 text-sm resize-y focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30 outline-none transition-all"
              />
              <div className="flex justify-between items-center mt-4">
                <span className="text-gray-600 text-xs">{manualText.length} characters</span>
                <button
                  onClick={processManualText}
                  disabled={!manualText.trim() || manualProcessing}
                  className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  {manualProcessing ? 'Processing...' : 'Generate Report →'}
                </button>
              </div>
            </div>
            {pipelineError && (
              <div className="pipeline-error" style={{ marginTop: '20px' }}>
                <div className="error-icon">⚠️</div>
                <div><h4>Error</h4><p>{pipelineError}</p></div>
              </div>
            )}
          </div>
        )}

        {/* ══ PIPELINE PROGRESS ══ */}
        {isProcessing && (
          <div className="pipeline-section animate-fade-slide-up">
            <div className="pipeline-card">
              <div className="pipeline-header">
                <div className="pipeline-spinner" />
                <div>
                  <h2>Processing Session...</h2>
                  <p>AI is analyzing your recording in real-time</p>
                </div>
              </div>

              <div className="pipeline-steps">
                {steps.map((step, i) => {
                  const isActive = currentStep === i;
                  const isDone = currentStep > i;
                  const isPending = currentStep < i;
                  return (
                    <div key={step.id} className={`pipeline-step ${isActive ? 'step--active' : ''} ${isDone ? 'step--done' : ''} ${isPending ? 'step--pending' : ''}`}>
                      <div className="step-indicator">
                        {isActive ? <div className="step-spinner" /> : isDone ? '✓' : <span className="step-number">{i + 1}</span>}
                      </div>
                      <div className="step-content">
                        <div className="step-icon" style={{ marginRight: '10px' }}>{step.icon}</div>
                        <div>
                          <h4>{step.label}</h4>
                          <p>{isActive ? 'Processing...' : isDone ? 'Completed' : 'Pending'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ RESULT DASHBOARD ══ */}
        {showResult && result && (
          <div className="result-section animate-fade-slide-up" ref={reportRef}>
            <div className="result-header">
              <h2>Session Complete</h2>
              <div className="header-actions">
                <button className="new-session-btn" onClick={startNewSession}>New Session</button>
              </div>
            </div>

            <div className="tabs">
              <button className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>Medical Report</button>
              <button className={`tab-btn ${activeTab === 'soap' ? 'active' : ''}`} onClick={() => setActiveTab('soap')}>SOAP Note</button>
              <button className={`tab-btn ${activeTab === 'clinical' ? 'active' : ''}`} onClick={() => setActiveTab('clinical')}>Clinical Intel</button>
              <button className={`tab-btn ${activeTab === 'dialogue' ? 'active' : ''}`} onClick={() => setActiveTab('dialogue')}>Dialogue</button>
              <button className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`} onClick={() => setActiveTab('transcript')}>Transcript</button>
            </div>

            <div className="result-content-box">
              {/* ── MEDICAL REPORT TAB ── */}
              {activeTab === 'report' && (
                <div className="report-view">
                  <div className="toolbar">
                    <button onClick={downloadPDF} className="tool-btn">Download PDF</button>
                    <button onClick={() => downloadPlainText(result.medicalReport, 'Medical_Report.txt')} className="tool-btn">Plain Text</button>
                    <button onClick={downloadFHIRJSON} className="tool-btn">FHIR JSON</button>
                    <button onClick={handleCopy.bind(null, result.medicalReport)} className="tool-btn">{copied ? 'Copied' : 'Copy Text'}</button>
                    <button onClick={handleConvertToSOAP} className="tool-btn highlight">Generate SOAP Note →</button>
                  </div>
                  <div className="report-body">
                    {formatReport(result.medicalReport)}
                  </div>
                </div>
              )}

              {/* ── SOAP NOTE TAB ── */}
              {activeTab === 'soap' && (
                <div className="soap-view">
                  {!soapNote && !isSoapLoading && !soapError && (
                    <div className="empty-soap">
                      <p>No SOAP note generated yet.</p>
                      <button onClick={handleConvertToSOAP} className="primary-btn">Generate SOAP Note Now</button>
                    </div>
                  )}

                  {isSoapLoading && (
                    <div className="loading-soap">
                      <div className="spinner" />
                      <p>Generating Professional SOAP Note...</p>
                    </div>
                  )}

                  {soapError && <div className="error-msg">{soapError}</div>}

                  {soapNote && (
                    <div className="soap-editor">
                      <div className="toolbar">
                        <span className="label" style={{ marginRight: 'auto' }}>Professional SOAP Note</span>
                        <button className="tool-btn" onClick={downloadSOAPPDF}>Download PDF</button>
                        <button className="tool-btn" onClick={() => handleCopy(JSON.stringify(soapNote, null, 2))}>Copy JSON</button>
                      </div>
                      <div className="soap-sections">
                        <div className="soap-section">
                          <span className="soap-letter s">S</span>
                          <h3>Subjective</h3>
                          <textarea value={soapNote.subjective || ''} onChange={(e) => handleSoapChange('subjective', e.target.value)} />
                        </div>
                        <div className="soap-section">
                          <span className="soap-letter o">O</span>
                          <h3>Objective</h3>
                          <textarea value={soapNote.objective || ''} onChange={(e) => handleSoapChange('objective', e.target.value)} />
                        </div>
                        <div className="soap-section">
                          <span className="soap-letter a">A</span>
                          <h3>Assessment</h3>
                          <textarea value={soapNote.assessment || ''} onChange={(e) => handleSoapChange('assessment', e.target.value)} />
                        </div>
                        <div className="soap-section">
                          <span className="soap-letter p">P</span>
                          <h3>Plan</h3>
                          <textarea value={soapNote.plan || ''} onChange={(e) => handleSoapChange('plan', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── CLINICAL INTELLIGENCE TAB ── */}
              {activeTab === 'clinical' && (
                <div className="clinical-intel-view">
                  {/* ICD-10 / DSM-5 Section */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-white font-bold text-base">ICD-10 / DSM-5 Coding</h3>
                        <p className="text-gray-500 text-xs mt-0.5">AI-suggested diagnostic codes</p>
                      </div>
                      {!icdCodes && (
                        <button onClick={generateICDCodes} disabled={icdLoading} className="tool-btn highlight">
                          {icdLoading ? 'Generating...' : 'Generate Codes'}
                        </button>
                      )}
                    </div>

                    {icdCodes?.codes && (
                      <div className="space-y-3">
                        {icdCodes.codes.map((code, i) => (
                          <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-400 font-mono font-bold text-sm">{code.icd10}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${code.confidence === 'HIGH' ? 'bg-emerald-500/15 text-emerald-400' :
                                  code.confidence === 'MODERATE' ? 'bg-amber-500/15 text-amber-400' :
                                    'bg-gray-500/15 text-gray-400'
                                }`}>{code.confidence}</span>
                            </div>
                            <p className="text-white text-sm font-medium">{code.dsm5}</p>
                            <p className="text-gray-500 text-xs mt-1">{code.description}</p>
                          </div>
                        ))}
                        <p className="text-amber-400/60 text-[10px] uppercase tracking-wider font-bold mt-4 px-1">
                          ⚠️ {icdCodes.disclaimer}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Scale Scores Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-white font-bold text-base">Psychiatric Scale Estimation</h3>
                        <p className="text-gray-500 text-xs mt-0.5">PHQ-9 · GAD-7 · YMRS · HAM-D</p>
                      </div>
                      {!scaleScores && (
                        <button onClick={generateScaleScores} disabled={scalesLoading} className="tool-btn highlight">
                          {scalesLoading ? 'Calculating...' : 'Estimate Scores'}
                        </button>
                      )}
                    </div>

                    {scaleScores?.scales && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { key: 'phq9', label: 'PHQ-9', subtitle: 'Depression', max: 27, color: '#818cf8' },
                            { key: 'gad7', label: 'GAD-7', subtitle: 'Anxiety', max: 21, color: '#34d399' },
                            { key: 'ymrs', label: 'YMRS', subtitle: 'Mania', max: 60, color: '#fbbf24' },
                            { key: 'hamd', label: 'HAM-D', subtitle: 'Depression (Clinician)', max: 52, color: '#f472b6' },
                          ].map(scale => {
                            const data = scaleScores.scales[scale.key];
                            if (!data) return null;
                            const pct = Math.min(100, (data.score / scale.max) * 100);
                            return (
                              <div key={scale.key} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="text-white font-bold text-sm">{scale.label}</span>
                                    <p className="text-gray-500 text-[10px]">{scale.subtitle}</p>
                                  </div>
                                  <span className="text-2xl font-bold" style={{ color: scale.color }}>{data.score}</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mb-2">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: scale.color }} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: scale.color }}>{data.severity}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-amber-400/60 text-[10px] uppercase tracking-wider font-bold mt-4 px-1">
                          ⚠️ {scaleScores.disclaimer}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── DIALOGUE TAB ── */}
              {activeTab === 'dialogue' && (
                <div className="dialogue-body">
                  <div className="toolbar"><button onClick={() => handleCopy(result.structuredDialogue)} className="tool-btn">Copy Dialogue</button></div>
                  {formatDialogue(result.structuredDialogue)}
                </div>
              )}

              {/* ── TRANSCRIPT TAB ── */}
              {activeTab === 'transcript' && (
                <div className="transcript-body">
                  <div className="toolbar"><button onClick={() => handleCopy(result.transcription)} className="tool-btn">Copy Transcript</button></div>
                  <p>{result.transcription}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Record;

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './Record.css';

const API_URL = 'http://localhost:5000/api/recordings';

// Pipeline step definitions
const PIPELINE_STEPS = [
  {
    id: 'upload',
    label: 'Uploading Audio',
    description: 'Sending recording to server',
    icon: '☁️',
  },
  {
    id: 'transcribe',
    label: 'Speech to Text',
    description: 'Transcribing audio with Whisper AI',
    icon: '🎙️',
  },
  {
    id: 'dialogue',
    label: 'Structuring Dialogue',
    description: 'Identifying Doctor & Patient speakers',
    icon: '💬',
  },
  {
    id: 'report',
    label: 'Generating Report',
    description: 'Creating clinical documentation',
    icon: '📋',
  },
];

function Record() {
  // ── Recording state ──────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [analyserData, setAnalyserData] = useState(new Array(32).fill(0));
  const [permissionDenied, setPermissionDenied] = useState(false);

  // ── Processing pipeline state ────────────────
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1); // -1 = not started
  const [pipelineError, setPipelineError] = useState(null);

  // ── Result state ─────────────────────────────
  const [result, setResult] = useState(null); // { transcription, structuredDialogue, medicalReport }
  const [activeTab, setActiveTab] = useState('report'); // 'report' | 'dialogue' | 'transcript'
  const [copied, setCopied] = useState(false);

  // ── Refs ──────────────────────────────────────
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const reportRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Audio Analyser ────────────────────────────
  const startAnalyser = useCallback((stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      setAnalyserData([...dataArray]);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    setAnalyserData(new Array(32).fill(0));
  }, []);

  // ══════════════════════════════════════════════
  // ── CORE: Process recording through pipeline ──
  // ══════════════════════════════════════════════
  const processRecording = useCallback(async (audioBlob, recordingDuration) => {
    setIsProcessing(true);
    setPipelineError(null);
    setResult(null);
    setCurrentStep(0); // uploading

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `session-${Date.now()}.webm`);
      formData.append('name', `Session — ${new Date().toLocaleTimeString()}`);
      formData.append('duration', recordingDuration);

      // Simulate step progression for UX feedback
      // Step 0: Upload (immediate)
      setCurrentStep(0);

      // Small delay to show upload step
      await new Promise(r => setTimeout(r, 400));

      // Step 1: Transcription starts (we can't know exact progress, but show it)
      setCurrentStep(1);

      // Start the actual API call — all 3 steps happen server-side
      const res = await fetch(`${API_URL}/process`, {
        method: 'POST',
        body: formData,
      });

      // Step 2: Dialogue structuring
      setCurrentStep(2);
      await new Promise(r => setTimeout(r, 600));

      // Step 3: Report generation
      setCurrentStep(3);
      await new Promise(r => setTimeout(r, 600));

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.details || 'Processing failed');
      }

      // All done!
      setCurrentStep(4); // completed
      setResult({
        transcription: data.transcription,
        structuredDialogue: data.structuredDialogue,
        medicalReport: data.medicalReport,
        recording: data.recording,
      });
      setActiveTab('report');

      // Scroll to report after a beat
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    } catch (err) {
      console.error('Pipeline error:', err);
      setPipelineError(err.message || 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // ── Recording Controls ────────────────────────
  const startRecording = async () => {
    // Reset previous results
    setResult(null);
    setPipelineError(null);
    setCurrentStep(-1);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionDenied(false);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stopAnalyser();
        // ★ Automatically trigger the pipeline!
        processRecording(blob, formatTime(duration));
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      startAnalyser(stream);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setPermissionDenied(true);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPaused(false);
  };

  const startNewSession = () => {
    setResult(null);
    setPipelineError(null);
    setCurrentStep(-1);
    setDuration(0);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Format report markdown → JSX ─────────────
  const formatReport = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();

      // Bold headers: **Header**
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return (
          <h3 key={i} className="report-section-header">
            {trimmed.replace(/\*\*/g, '')}
          </h3>
        );
      }
      // Bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <div key={i} className="report-bullet">
            <span className="report-bullet-dot">•</span>
            <span>{trimmed.replace(/^[-*]\s/, '')}</span>
          </div>
        );
      }
      // Bold key-value pairs
      if (trimmed.includes('**')) {
        const parts = trimmed.split('**');
        return (
          <p key={i} className="report-text">
            {parts.map((part, j) =>
              j % 2 === 1 ? (
                <strong key={j} className="report-bold">{part}</strong>
              ) : (
                part
              )
            )}
          </p>
        );
      }
      // Empty
      if (!trimmed) return <div key={i} className="report-spacer" />;
      // Normal
      return <p key={i} className="report-text">{line}</p>;
    });
  };

  // ── Format dialogue lines → JSX ──────────────
  const formatDialogue = (text) => {
    if (!text) return null;
    return text.split('\n').filter(l => l.trim()).map((line, i) => {
      const isDoctor = line.trim().startsWith('Doctor:');
      const isPatient = line.trim().startsWith('Patient:');
      return (
        <div
          key={i}
          className={`dialogue-line ${isDoctor ? 'dialogue-doctor' : isPatient ? 'dialogue-patient' : 'dialogue-unknown'}`}
        >
          {isDoctor && <span className="dialogue-icon">👨‍⚕️</span>}
          {isPatient && <span className="dialogue-icon">🧑</span>}
          {line}
        </div>
      );
    });
  };

  // Cleanup
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopAnalyser();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [stopAnalyser]);

  // Determine UI state
  const showRecorder = !isProcessing && !result;
  const showPipeline = isProcessing || (currentStep >= 0 && currentStep < 4 && !result);
  const showResult = !!result;

  return (
    <div className="record-page">
      {/* Background animated blobs */}
      <div className="blob-1 fixed rounded-full blur-[100px] opacity-25 pointer-events-none" />
      <div className="blob-2 fixed rounded-full blur-[100px] opacity-25 pointer-events-none" />
      <div className="blob-3 fixed rounded-full blur-[100px] opacity-25 pointer-events-none" />

      {/* Header */}
      <header className="record-header">
        <Link to="/" className="back-link" aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span>Home</span>
        </Link>
        <h1 className="record-title">
          <svg className="stroke-indigo-400 shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          CeriNote
        </h1>
      </header>

      <main className="record-main">
        {/* ════════════════════════════════════════ */}
        {/* ═══ RECORDER SECTION ═════════════════ */}
        {/* ════════════════════════════════════════ */}
        {showRecorder && (
          <div className="recorder-section animate-fade-slide-up">
            <div className="recorder-card">
              {/* Instruction text */}
              <div className="recorder-instruction">
                <h2>{isRecording ? 'Recording Session...' : 'Start a New Session'}</h2>
                <p>
                  {permissionDenied
                    ? '⚠️ Microphone access denied. Please allow access in your browser settings.'
                    : isRecording
                      ? isPaused
                        ? 'Recording paused. Resume or stop when ready.'
                        : 'Your session is being recorded. Stop when the consultation is complete.'
                      : 'Record your patient consultation. The clinical report will be generated automatically when you stop.'}
                </p>
              </div>

              {/* Waveform Visualizer */}
              <div className="waveform-container">
                {analyserData.slice(0, 28).map((value, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{
                      height: `${Math.max(4, (value / 255) * 80)}px`,
                      opacity: isRecording ? 0.5 + (value / 255) * 0.5 : 0.15,
                    }}
                  />
                ))}
              </div>

              {/* Mic Button + Pulsing */}
              <div className="mic-area">
                {isRecording && !isPaused && (
                  <>
                    <div className="pulse-ring pulse-ring-1" />
                    <div className="pulse-ring pulse-ring-2" />
                    <div className="pulse-ring pulse-ring-3" />
                  </>
                )}

                <button
                  id="mic-button"
                  className={`mic-btn ${isRecording ? (isPaused ? 'mic-btn--paused' : 'mic-btn--active') : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  {isRecording ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Timer */}
              <div className={`timer ${isRecording ? 'timer--active' : ''}`}>
                {formatTime(duration)}
              </div>

              {/* Recording controls */}
              {isRecording && (
                <div className="recording-controls animate-fade-slide-up">
                  <button className="ctrl-btn ctrl-btn--pause" onClick={isPaused ? resumeRecording : pauseRecording}>
                    {isPaused ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    )}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button className="ctrl-btn ctrl-btn--stop" onClick={stopRecording}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop & Generate Report
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* ═══ PROCESSING PIPELINE ══════════════ */}
        {/* ════════════════════════════════════════ */}
        {showPipeline && (
          <div className="pipeline-section animate-fade-slide-up">
            <div className="pipeline-card">
              <div className="pipeline-header">
                <div className="pipeline-spinner" />
                <div>
                  <h2>Processing Your Session</h2>
                  <p>Please wait while we analyze your recording...</p>
                </div>
              </div>

              <div className="pipeline-steps">
                {PIPELINE_STEPS.map((step, i) => {
                  const isDone = currentStep > i;
                  const isActive = currentStep === i;
                  const isPending = currentStep < i;

                  return (
                    <div
                      key={step.id}
                      className={`pipeline-step ${isDone ? 'step--done' : isActive ? 'step--active' : 'step--pending'}`}
                    >
                      <div className="step-indicator">
                        {isDone ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : isActive ? (
                          <div className="step-spinner" />
                        ) : (
                          <span className="step-number">{i + 1}</span>
                        )}
                      </div>
                      <div className="step-content">
                        <div className="step-icon">{step.icon}</div>
                        <div>
                          <h4>{step.label}</h4>
                          <p>{step.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Error state */}
              {pipelineError && (
                <div className="pipeline-error animate-fade-slide-up">
                  <div className="error-icon">❌</div>
                  <div>
                    <h4>Processing Failed</h4>
                    <p>{pipelineError}</p>
                  </div>
                  <button className="retry-btn" onClick={startNewSession}>
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* ═══ RESULTS / REPORT ═════════════════ */}
        {/* ════════════════════════════════════════ */}
        {showResult && (
          <div className="result-section animate-fade-slide-up" ref={reportRef}>
            {/* Success banner */}
            <div className="success-banner">
              <div className="success-icon">✅</div>
              <div>
                <h3>Session Processed Successfully</h3>
                <p>Your clinical report is ready for review.</p>
              </div>
              <button className="new-session-btn" onClick={startNewSession}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                New Session
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="result-tabs">
              <button
                className={`tab-btn ${activeTab === 'report' ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab('report')}
              >
                📋 Clinical Report
              </button>
              <button
                className={`tab-btn ${activeTab === 'dialogue' ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab('dialogue')}
              >
                💬 Dialogue
              </button>
              <button
                className={`tab-btn ${activeTab === 'transcript' ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab('transcript')}
              >
                📝 Raw Transcript
              </button>
            </div>

            {/* Tab Content */}
            <div className="result-content">
              {/* Copy button */}
              <div className="result-toolbar">
                <span className="result-label">
                  {activeTab === 'report' ? 'Clinical Report' : activeTab === 'dialogue' ? 'Structured Dialogue' : 'Raw Transcript'}
                </span>
                <button
                  className="copy-btn"
                  onClick={() => {
                    const text = activeTab === 'report'
                      ? result.medicalReport
                      : activeTab === 'dialogue'
                        ? result.structuredDialogue
                        : result.transcription;
                    copyToClipboard(text);
                  }}
                >
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>

              {/* Report Tab */}
              {activeTab === 'report' && (
                <div className="report-body">
                  {formatReport(result.medicalReport)}
                </div>
              )}

              {/* Dialogue Tab */}
              {activeTab === 'dialogue' && (
                <div className="dialogue-body">
                  {formatDialogue(result.structuredDialogue)}
                </div>
              )}

              {/* Transcript Tab */}
              {activeTab === 'transcript' && (
                <div className="transcript-body">
                  <p>{result.transcription}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Record;

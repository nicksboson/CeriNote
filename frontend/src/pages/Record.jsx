import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './Record.css';

const API_URL = 'http://localhost:5000/api/recordings';

function Record() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [recordingName, setRecordingName] = useState('');
  const [recordings, setRecordings] = useState([]);
  const [analyserData, setAnalyserData] = useState(new Array(32).fill(0));
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcribingId, setTranscribingId] = useState(null);
  const [expandedTranscript, setExpandedTranscript] = useState(null);
  const [dialogueTab, setDialogueTab] = useState('dialogue');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioContextRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Fetch saved recordings from backend ───────────
  const fetchRecordings = useCallback(async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setRecordings(data.recordings || []);
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  // ── Audio Analyser ────────────────────────────────
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

  // ── Recording Controls ────────────────────────────
  const startRecording = async () => {
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
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioURL(url);
        stopAnalyser();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      setAudioURL(null);
      setAudioBlob(null);
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

  // ── Save to Backend ───────────────────────────────
  const saveRecording = async () => {
    if (!audioBlob) return;
    setIsSaving(true);

    try {
      const name = recordingName.trim() || `Recording ${recordings.length + 1}`;
      const formData = new FormData();
      formData.append('audio', audioBlob, `${name}.webm`);
      formData.append('name', name);
      formData.append('duration', formatTime(duration));

      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      setAudioURL(null);
      setAudioBlob(null);
      setRecordingName('');
      setDuration(0);
      await fetchRecordings();
    } catch (err) {
      console.error('Failed to save recording:', err);
      alert('Failed to save recording. Is the backend running?');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete from Backend ───────────────────────────
  const deleteRecording = async (id) => {
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      await fetchRecordings();
    } catch (err) {
      console.error('Failed to delete recording:', err);
    }
  };

  // ── Transcribe via Groq Whisper ────────────────────
  const transcribeRecording = async (id) => {
    setTranscribingId(id);
    try {
      const res = await fetch(`${API_URL}/${id}/transcribe`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Transcription failed');
        return;
      }

      // Refresh recordings to get the transcription
      await fetchRecordings();
      setExpandedTranscript(id);
    } catch (err) {
      console.error('Transcription error:', err);
      alert('Transcription failed. Is the backend running?');
    } finally {
      setTranscribingId(null);
    }
  };

  const downloadRecording = (url, name) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.webm`;
    a.click();
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      stopAnalyser();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [stopAnalyser]);

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0f] text-gray-200 font-['Inter',system-ui,sans-serif] overflow-x-hidden flex flex-col items-center">
      {/* Background animated blobs */}
      <div className="blob-1 fixed rounded-full blur-[100px] opacity-25 pointer-events-none" />
      <div className="blob-2 fixed rounded-full blur-[100px] opacity-25 pointer-events-none" />
      <div className="blob-3 fixed rounded-full blur-[100px] opacity-25 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-3xl flex items-center justify-between pt-7 px-8 box-border max-sm:flex-col-reverse max-sm:items-start max-sm:gap-3.5 max-sm:px-5 max-sm:pt-5">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-gray-400 no-underline text-sm font-medium px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] transition-all duration-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.12] hover:-translate-x-0.5"
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span>Home</span>
        </Link>
        <h1 className="flex items-center gap-2.5 text-xl font-semibold bg-gradient-to-r from-purple-400 via-indigo-400 to-sky-300 bg-clip-text text-transparent m-0">
          <svg className="stroke-indigo-400 shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          CeriNote Recorder
        </h1>
      </header>

      {/* Main Recording Area */}
      <main className="relative z-10 w-full max-w-3xl px-8 pb-16 pt-5 box-border flex flex-col items-center max-sm:px-5 max-sm:pb-12">
        {/* Mic Button Area */}
        <div className="flex flex-col items-center mt-12 relative max-sm:mt-8">
          {/* Waveform Visualizer */}
          <div className="flex items-center justify-center gap-[3px] h-[90px] mb-8">
            {analyserData.slice(0, 24).map((value, i) => (
              <div
                key={i}
                className="w-[5px] rounded-full bg-gradient-to-b from-indigo-400 to-purple-400 transition-[height] duration-[80ms] ease-out"
                style={{
                  height: `${Math.max(4, (value / 255) * 80)}px`,
                  opacity: isRecording ? 0.5 + (value / 255) * 0.5 : 0.2,
                  minHeight: '4px',
                }}
              />
            ))}
          </div>

          {/* Pulsing rings when recording */}
          {isRecording && !isPaused && (
            <>
              <div className="pulse-ring pulse-ring-1" />
              <div className="pulse-ring pulse-ring-2" />
              <div className="pulse-ring pulse-ring-3" />
            </>
          )}

          {/* Mic Button */}
          <button
            id="mic-button"
            className={`mic-btn relative z-[2] w-[110px] h-[110px] rounded-full border-none cursor-pointer flex items-center justify-center transition-all duration-400 max-sm:w-[90px] max-sm:h-[90px] ${isRecording
              ? isPaused
                ? 'mic-btn--paused'
                : 'mic-btn--active'
              : ''
              }`}
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

          {/* Timer */}
          <div className={`mt-6 text-4xl font-light tabular-nums tracking-[4px] transition-colors duration-300 max-sm:text-3xl ${isRecording ? 'text-gray-200' : 'text-gray-600'}`}>
            {formatTime(duration)}
          </div>

          {/* Status Label */}
          <p className="mt-3 text-sm text-gray-500 text-center min-h-[24px]">
            {permissionDenied
              ? '⚠️ Microphone access denied. Please allow access.'
              : isRecording
                ? isPaused
                  ? 'Paused'
                  : 'Recording conversation...'
                : audioURL
                  ? 'Recording complete!'
                  : 'Tap the mic to start recording'}
          </p>

          {/* Recording Controls (Pause / Stop) */}
          {isRecording && (
            <div className="flex gap-4 mt-5 animate-fade-slide-up">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] border border-amber-500/20 bg-amber-500/10 text-amber-500 text-sm font-medium cursor-pointer transition-all duration-250 hover:bg-amber-500/[0.18] hover:border-amber-500/[0.35] font-[inherit]"
                onClick={isPaused ? resumeRecording : pauseRecording}
              >
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
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] border border-red-500/20 bg-red-500/10 text-red-500 text-sm font-medium cursor-pointer transition-all duration-250 hover:bg-red-500/[0.18] hover:border-red-500/[0.35] font-[inherit]"
                onClick={stopRecording}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Stop
              </button>
            </div>
          )}
        </div>

        {/* Post-Recording Actions */}
        {audioURL && !isRecording && (
          <div className="w-full mt-9 animate-fade-slide-up">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-7 backdrop-blur-xl">
              <h3 className="text-lg font-semibold mb-1 text-gray-200">🎙️ Your Recording</h3>
              <p className="text-sm text-gray-500 mb-4">Duration: {formatTime(duration)}</p>
              <audio controls src={audioURL} className="w-full rounded-xl mb-4 outline-none" />
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.04] text-gray-200 text-sm font-[inherit] outline-none transition-[border-color] duration-300 placeholder:text-gray-600 focus:border-indigo-400/40"
                  placeholder="Name your recording..."
                  value={recordingName}
                  onChange={(e) => setRecordingName(e.target.value)}
                />
                <div className="flex gap-2.5">
                  <button
                    className="flex items-center gap-2 px-6 py-3 rounded-xl border-none bg-gradient-to-r from-indigo-400 to-indigo-500 text-white text-sm font-semibold cursor-pointer transition-all duration-250 font-[inherit] hover:from-indigo-300 hover:to-indigo-400 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(99,102,241,0.3)] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none"
                    onClick={saveRecording}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                    )}
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    className="px-5 py-3 rounded-xl border border-white/[0.08] bg-transparent text-gray-500 text-sm font-medium cursor-pointer transition-all duration-250 font-[inherit] hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/[0.06]"
                    onClick={() => {
                      setAudioURL(null);
                      setAudioBlob(null);
                      setDuration(0);
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saved Recordings List */}
        {recordings.length > 0 && (
          <section className="w-full mt-12 animate-fade-slide-up">
            <h2 className="text-lg font-semibold mb-4 text-gray-400">Saved Recordings</h2>
            <div className="flex flex-col gap-3">
              {recordings.map((rec) => (
                <div key={rec.id} className="flex flex-col">
                  {/* Recording Row */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.08] max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-[180px] max-sm:min-w-0">
                      <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-indigo-400/[0.12] to-purple-400/[0.08] flex items-center justify-center text-indigo-400 shrink-0">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      </div>
                      <div>
                        <p className="m-0 text-[0.95rem] font-medium text-gray-200">{rec.name}</p>
                        <p className="mt-0.5 text-xs text-gray-600">
                          {new Date(rec.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          · {rec.duration}
                        </p>
                      </div>
                    </div>
                    <audio controls src={rec.url} className="flex-1 min-w-0 h-9 rounded-lg max-sm:w-full" />
                    <div className="flex gap-1.5 shrink-0 max-sm:justify-end">
                      {/* Transcribe Button */}
                      <button
                        className={`h-9 px-3 rounded-[10px] border text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5 transition-all duration-250 ${rec.transcription
                          ? 'border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/[0.15]'
                          : 'border-violet-500/20 bg-violet-500/[0.08] text-violet-400 hover:bg-violet-500/[0.15]'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        onClick={() => {
                          if (rec.transcription) {
                            setExpandedTranscript(expandedTranscript === rec.id ? null : rec.id);
                          } else {
                            transcribeRecording(rec.id);
                          }
                        }}
                        disabled={transcribingId === rec.id}
                        aria-label={rec.transcription ? 'View transcript' : 'Transcribe'}
                      >
                        {transcribingId === rec.id ? (
                          <span className="inline-block w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                        ) : rec.transcription ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                        )}
                        {transcribingId === rec.id
                          ? 'Transcribing...'
                          : rec.transcription
                            ? expandedTranscript === rec.id ? 'Hide' : 'Transcript'
                            : 'Transcribe'}
                      </button>
                      {/* Download */}
                      <button
                        className="w-9 h-9 rounded-[10px] border border-white/[0.06] bg-white/[0.03] text-gray-500 cursor-pointer flex items-center justify-center transition-all duration-250 p-0 hover:text-indigo-400 hover:bg-indigo-400/[0.08] hover:border-indigo-400/20"
                        onClick={() => downloadRecording(rec.url, rec.name)}
                        aria-label="Download"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                      {/* Delete */}
                      <button
                        className="w-9 h-9 rounded-[10px] border border-white/[0.06] bg-white/[0.03] text-gray-500 cursor-pointer flex items-center justify-center transition-all duration-250 p-0 hover:text-red-500 hover:bg-red-500/[0.08] hover:border-red-500/20"
                        onClick={() => deleteRecording(rec.id)}
                        aria-label="Delete"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Transcript / Dialogue Panel */}
                  {rec.transcription && expandedTranscript === rec.id && (
                    <div className="mt-2 mx-2 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm animate-fade-slide-up">
                      {/* Tab Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04]">
                          <button
                            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 border-none font-[inherit] ${dialogueTab === 'dialogue'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-transparent text-gray-500 hover:text-gray-300'
                              }`}
                            onClick={() => setDialogueTab('dialogue')}
                          >
                            🩺 Dialogue
                          </button>
                          <button
                            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 border-none font-[inherit] ${dialogueTab === 'raw'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-transparent text-gray-500 hover:text-gray-300'
                              }`}
                            onClick={() => setDialogueTab('raw')}
                          >
                            📝 Raw Transcript
                          </button>
                        </div>
                        <button
                          className="text-xs text-gray-500 hover:text-gray-300 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-lg cursor-pointer transition-colors duration-200 font-[inherit]"
                          onClick={() => {
                            const text = dialogueTab === 'dialogue'
                              ? (rec.structuredDialogue || rec.transcription)
                              : rec.transcription;
                            navigator.clipboard.writeText(text);
                          }}
                        >
                          Copy
                        </button>
                      </div>

                      {/* Dialogue Tab */}
                      {dialogueTab === 'dialogue' && (
                        <div className="space-y-2">
                          {rec.structuredDialogue ? (
                            rec.structuredDialogue.split('\n').filter(line => line.trim()).map((line, i) => {
                              const isDoctor = line.trim().startsWith('Doctor:');
                              const isPatient = line.trim().startsWith('Patient:');
                              return (
                                <div
                                  key={i}
                                  className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed ${isDoctor
                                      ? 'bg-sky-500/[0.06] border border-sky-500/[0.12] text-sky-300'
                                      : isPatient
                                        ? 'bg-purple-500/[0.06] border border-purple-500/[0.12] text-purple-300'
                                        : 'bg-white/[0.03] border border-white/[0.06] text-gray-400'
                                    }`}
                                >
                                  {isDoctor && <span className="text-xs font-semibold text-sky-400 mr-1.5">👨‍⚕️</span>}
                                  {isPatient && <span className="text-xs font-semibold text-purple-400 mr-1.5">🧑</span>}
                                  {line}
                                </div>
                              );
                            })
                          ) : (
                            <p className="m-0 text-sm text-gray-500 italic">Dialogue structuring not available for this recording.</p>
                          )}
                        </div>
                      )}

                      {/* Raw Transcript Tab */}
                      {dialogueTab === 'raw' && (
                        <p className="m-0 text-sm leading-relaxed text-gray-400 whitespace-pre-wrap">
                          {rec.transcription}
                        </p>
                      )}

                      {rec.transcribedAt && (
                        <p className="mt-4 mb-0 text-[0.7rem] text-gray-600">
                          Processed {new Date(rec.transcribedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default Record;

import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Record from './pages/Record'
import Report from './pages/Report'

const Navbar = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 backdrop-blur-md bg-[#0a0a0f]/60 border-b border-white/5">
      <Link to="/" className="flex items-center gap-3 no-underline group">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        </div>
        <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
          CeriNote
        </span>
      </Link>

      <div className="flex items-center gap-6">
        <Link to="/" className={`text-sm font-medium transition-colors ${isHome ? 'text-white' : 'text-gray-400 hover:text-white'}`}>Home</Link>
        <Link to="/record" className={`text-sm font-medium transition-colors ${!isHome ? 'text-white' : 'text-gray-400 hover:text-white'}`}>Sessions</Link>
        <Link
          to="/record"
          className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
        >
          New Session
        </Link>
      </div>
    </nav>
  )
}

function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] pt-32 pb-20 px-6 overflow-hidden relative">
      {/* Grid Background */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Dynamic Background Blobs */}
      <div className="fixed top-[-100px] left-[-80px] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-60px] right-[-40px] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center gap-10 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Clinical Documentation v2.0
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight max-w-4xl">
            Smarter Notes for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400">Better Care.</span>
          </h1>

          <p className="text-gray-400 text-xl max-w-2xl leading-relaxed">
            Automate your patient documentation with high-fidelity AI. Record consultations, generate structured clinical reports, and convert to SOAP notes in seconds.
          </p>

          <div className="flex items-center gap-4 mt-4">
            <Link
              to="/record"
              className="px-8 py-4 rounded-2xl bg-indigo-500 text-white font-bold text-lg shadow-2xl shadow-indigo-500/30 hover:bg-indigo-400 hover:scale-105 transition-all duration-300 no-underline flex items-center gap-3"
            >
              Get Started Free
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 animate-slide-up [animation-delay:200ms]">
          {[
            {
              icon: (
                <svg className="w-8 h-8 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                </svg>
              ),
              title: 'Secure Recording',
              desc: 'High-fidelity audio capture designed for clinical environments with deep noise suppression.'
            },
            {
              icon: (
                <svg className="w-8 h-8 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <path d="M8 9h8m-8 4h5" />
                </svg>
              ),
              title: 'AI Structuring',
              desc: 'Automatically separates doctor and patient dialogue while filtering irrelevant small talk.'
            },
            {
              icon: (
                <svg className="w-8 h-8 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              ),
              title: 'Clinical Output',
              desc: 'Generate psychiatric reports and SOAP notes optimized for clinical extraction and accuracy.'
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group p-10 rounded-[2rem] bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-4 tracking-tight">{f.title}</h3>
              <p className="text-gray-500 leading-relaxed text-base">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Basic Footer */}
      <footer className="mt-40 border-t border-white/5 py-12 text-center">
        <p className="text-gray-600 text-sm">© 2026 CeriNote. Precision Medical Informatics.</p>
      </footer>
    </div>
  )
}

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/record" element={<Record />} />
        <Route path="/report" element={<Report />} />
      </Routes>
    </>
  )
}

export default App

import { Routes, Route, Link } from 'react-router-dom'
import Record from './pages/Record'
import Report from './pages/Report'

function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6 font-['Inter',system-ui,sans-serif]">
      {/* Decorative gradient blob */}
      <div className="fixed top-[-100px] left-[-80px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,_#6c63ff,_transparent_70%)] blur-[100px] opacity-20 pointer-events-none" />
      <div className="fixed bottom-[-60px] right-[-40px] w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,_#f857a6,_transparent_70%)] blur-[100px] opacity-20 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <svg className="w-10 h-10 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-sky-400 bg-clip-text text-transparent">
            CeriNote
          </h1>
        </div>

        <p className="text-gray-400 text-center max-w-md text-lg leading-relaxed">
          Record conversations, capture ideas, and save your voice notes — all in one place.
        </p>

        {/* CTA Button */}
        <Link
          to="/record"
          className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-lg shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-300 no-underline"
        >
          <svg className="w-6 h-6 group-hover:animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          Start Recording
        </Link>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 w-full max-w-xl">
          {[
            { icon: '🎙️', title: 'Record', desc: 'Capture voice in high quality' },
            { icon: '💾', title: 'Save', desc: 'Store securely on the server' },
            { icon: '📥', title: 'Download', desc: 'Export anytime as .webm' },
          ].map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="text-white font-medium text-sm">{f.title}</h3>
              <p className="text-gray-500 text-xs text-center">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/record" element={<Record />} />
      <Route path="/report" element={<Report />} />
    </Routes>
  )
}

export default App


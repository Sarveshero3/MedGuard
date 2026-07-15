import { Link } from 'react-router-dom'

export default function ClinicalGuidelines() {
  return (
    <div className="min-h-screen bg-[#f6fafa] font-sans text-[#181c1d] flex flex-col justify-between">
      
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 py-4 px-6 md:px-16 flex justify-between items-center max-w-[1200px] mx-auto w-full">
        <Link to="/" className="font-serif text-2xl font-bold text-slate-900">
          MedGuard
        </Link>
        <Link to="/login" className="text-sm font-semibold text-[#0F766E] hover:text-[#0d645e]">
          Sign In
        </Link>
      </nav>

      {/* Main Content */}
      <main className="max-w-[800px] mx-auto px-6 py-16 flex-grow text-left">
        <h1 className="font-sans text-5xl font-bold text-slate-900 mb-6">Clinical Guidelines</h1>
        <p className="text-xs text-slate-400 mb-10">Last updated: July 15, 2026</p>

        <section className="space-y-8 text-sm text-slate-600 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. Deterministic Drug Interaction Engine</h2>
            <p>
              MedGuard processes drug-drug interactions using a verified clinical knowledge base compiled from peer-reviewed databases (such as DDInter). We do not use probabilistic LLM model decisions to evaluate safety warnings. This ensures warnings are explainable, traceable, and consistent.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. Lab Value Trend Normalization</h2>
            <p>
              Clinical lab results are normalized to standardized units and canonical test names before calculation. We evaluate changes against these canonical profiles to ensure accurate comparison across clinical laboratories.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. Bounded Discussion Guidance</h2>
            <p>
              The Visit-Brief Writer compiles reports strictly within safety parameters: it never recommends treatment modifications, never concludes diagnosis, and only suggests neutral questions addressing significance or cause.
            </p>
          </div>

          <div className="bg-[#f0f7f7] border-l-4 border-[#0f766e] p-5 rounded-r-lg mt-8">
            <h3 className="text-sm font-bold text-[#00504a] mb-2">Core Adherence Rule</h3>
            <p className="text-xs text-slate-600">
              Deterministic calculations run inside the core API (ms1), ensuring strict compliance with clinical data representations.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <span>© 2026 MedGuard AI. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-slate-600">Privacy Policy</Link>
            <Link to="/support" className="hover:text-slate-600">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

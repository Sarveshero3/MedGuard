import { Link } from 'react-router-dom'

export default function ClinicalGuidelines() {
  return (
    <>
      <main className="flex-grow w-full px-6 md:px-16 max-w-[850px] mx-auto py-10 flex-col text-left">
        <div className="bg-white border border-slate-200 rounded-xl p-8 md:p-10 shadow-sm">
          
          {/* Header */}
          <div className="border-b border-slate-100 pb-6 mb-6">
            <h3 className="font-sans text-2xl font-bold text-slate-900 mb-1">Clinical Guidelines</h3>
            <p className="text-[11px] text-slate-400">Last updated: July 15, 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-6 text-xs text-slate-600 leading-relaxed">
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">1. Deterministic Drug Interaction Engine</h4>
              <p>
                MedGuard processes drug-drug interactions using a verified clinical knowledge base compiled from peer-reviewed databases (such as DDInter). We do not use probabilistic LLM model decisions to evaluate safety warnings. This ensures warnings are explainable, traceable, and consistent.
              </p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">2. Lab Value Trend Normalization</h4>
              <p>
                Clinical lab results are normalized to standardized units and canonical test names before calculation. We evaluate changes against these canonical profiles to ensure accurate comparison across clinical laboratories.
              </p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">3. Bounded Discussion Guidance</h4>
              <p>
                The Visit-Brief Writer compiles reports strictly within safety parameters: it never recommends treatment modifications, never concludes diagnosis, and only suggests neutral questions addressing significance or cause.
              </p>
            </div>

            <div className="bg-[#f0f7f7] border-l-4 border-[#0f766e] p-4 rounded-r-lg mt-6">
              <h5 className="text-xs font-bold text-[#00504a] mb-1">Core Adherence Rule</h5>
              <p className="text-[11px] text-slate-600">
                Deterministic calculations run inside the core API (ms1), ensuring strict compliance with clinical data representations.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200 mt-auto">
        <div className="w-full py-12 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center gap-4 max-w-[1200px] mx-auto text-sm text-slate-500">
          <div className="font-serif text-lg font-bold text-slate-900 mb-4 md:mb-0">
            MedGuard
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/privacy-policy" className="hover:text-[#0F766E] transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-[#0F766E] transition-colors">Terms of Service</Link>
            <Link to="/clinical-guidelines" className="hover:text-[#0F766E] transition-colors">Clinical Guidelines</Link>
            <Link to="/support" className="hover:text-[#0F766E] transition-colors">Contact Support</Link>
          </div>
          <div className="text-xs text-slate-400 mt-4 md:mt-0">
            © 2026 MedGuard AI. Clinical Excellence in Medication Safety.
          </div>
        </div>
      </footer>
    </>
  )
}

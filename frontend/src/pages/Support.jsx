import { Link } from 'react-router-dom'

export default function Support() {
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
        <h1 className="font-sans text-5xl font-bold text-slate-900 mb-6">Contact Support</h1>
        <p className="text-sm text-slate-500 mb-12">
          We are here to assist you with any clinical workflow integration, caregiver linking, or DPDP Act privacy questions.
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-8 md:p-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0F766E]">support_agent</span>
            Get in touch with us
          </h2>
          <p className="text-sm text-slate-600 mb-8 leading-relaxed">
            For support inquiries, system suggestions, or issues regarding data access, email our support team directly. We strive to reply within 24 hours.
          </p>

          {/* Prominent Support Email */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-col sm:flex-row gap-4">
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Direct Support Email</span>
              <a href="mailto:sarveshero7@gmail.com" className="font-mono text-lg font-bold text-[#0F766E] hover:underline">
                sarveshero7@gmail.com
              </a>
            </div>
            <a 
              href="mailto:sarveshero7@gmail.com"
              className="bg-[#0F766E] hover:bg-[#0d645e] text-white px-6 py-3 rounded-lg font-semibold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              Send Email
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <span>© 2026 MedGuard AI. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-slate-600">Terms of Service</Link>
            <Link to="/privacy-policy" className="hover:text-slate-600">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

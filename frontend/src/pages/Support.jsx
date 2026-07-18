import { Link } from 'react-router-dom'

export default function Support() {
  return (
    <>
      <main className="flex-grow w-full px-6 md:px-16 max-w-[800px] mx-auto py-10 flex-col text-left">
        
        {/* Header Section */}
        <div className="mb-8">
          <h3 className="font-sans text-2xl font-bold text-slate-900 mb-1">Contact Support</h3>
          <p className="text-xs text-slate-500">
            We are here to assist you with any clinical workflow integration, caregiver linking, or DPDP Act privacy questions.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0F766E] text-lg">support_agent</span>
            Get in touch with us
          </h4>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            For support inquiries, system suggestions, or issues regarding data access, email our support team directly. We strive to reply within 24 hours.
          </p>

          {/* Prominent Support Email */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-col sm:flex-row gap-4">
            <div className="text-left">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Direct Support Email</span>
              <a href="mailto:sarveshero7@gmail.com" className="font-mono text-base font-bold text-[#0F766E] hover:underline">
                sarveshero7@gmail.com
              </a>
            </div>
            <a 
              href="mailto:sarveshero7@gmail.com"
              className="bg-[#0F766E] hover:bg-[#0d645e] text-white px-5 py-2.5 rounded-lg font-semibold text-xs transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              Send Email
            </a>
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

import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <>
      <main className="flex-grow w-full px-6 md:px-16 max-w-[850px] mx-auto py-10 flex-col text-left">
        <div className="bg-white border border-slate-200 rounded-xl p-8 md:p-10 shadow-sm">
          
          {/* Header */}
          <div className="border-b border-slate-100 pb-6 mb-6">
            <h3 className="font-sans text-2xl font-bold text-slate-900 mb-1">Privacy Policy</h3>
            <p className="text-[11px] text-slate-400">Last updated: July 15, 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-6 text-xs text-slate-600 leading-relaxed">
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">1. DPDP Compliance Framework</h4>
              <p>
                Under the Digital Personal Data Protection (DPDP) Act of India, we strictly obtain explicit, unambiguous consent before collecting, storing, or analyzing any clinical or clinical-adjacent digital records. Consent is recorded at registration and can be revoked at any time by deleting your account.
              </p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">2. Data Security &amp; Encryption</h4>
              <p>
                All uploaded prescription and lab reports are encrypted during transit (TLS 1.3) and storage. Medical data is processed on isolated networks with zero third-party leakage.
              </p>
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">3. Caregiver Delegation</h4>
              <p>
                When a patient links a caregiver, specific prescription regimens, safety interaction logs, and lab trends are shared dynamically. The patient retains complete control to revoke, block, or delete this connection instantly.
              </p>
            </div>

            <div className="bg-[#f0f7f7] border-l-4 border-[#0f766e] p-4 rounded-r-lg mt-6">
              <h5 className="text-xs font-bold text-[#00504a] mb-1">Right to Erasure</h5>
              <p className="text-[11px] text-slate-600">
                You retain the absolute right to have your clinical record purged. Accessing the Privacy page and confirming account deletion completely and permanently deletes all data from our active databases.
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

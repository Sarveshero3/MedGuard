import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
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
        <h1 className="font-sans text-5xl font-bold text-slate-900 mb-6">Privacy Policy</h1>
        <p className="text-xs text-slate-400 mb-10">Last updated: July 15, 2026</p>

        <section className="space-y-8 text-sm text-slate-600 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. DPDP Compliance Framework</h2>
            <p>
              Under the Digital Personal Data Protection (DPDP) Act of India, we strictly obtain explicit, unambiguous consent before collecting, storing, or analyzing any clinical or clinical-adjacent digital records. Consent is recorded at registration and can be revoked at any time by deleting your account.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. Data Security &amp; Encryption</h2>
            <p>
              All uploaded prescription and lab reports are encrypted during transit (TLS 1.3) and storage. Medical data is processed on isolated networks with zero third-party leakage.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. Caregiver Delegation</h2>
            <p>
              When a patient links a caregiver, specific prescription regimens, safety interaction logs, and lab trends are shared dynamically. The patient retains complete control to revoke, block, or delete this connection instantly.
            </p>
          </div>

          <div className="bg-[#f0f7f7] border-l-4 border-[#0f766e] p-5 rounded-r-lg mt-8">
            <h3 className="text-sm font-bold text-[#00504a] mb-2">Right to Erasure</h3>
            <p className="text-xs text-slate-600">
              You retain the absolute right to have your clinical record purged. Accessing the Privacy page and confirming account deletion completely and permanently deletes all data from our active databases.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <span>© 2026 MedGuard AI. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-slate-600">Terms of Service</Link>
            <Link to="/support" className="hover:text-slate-600">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

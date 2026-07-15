import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'

export default function PrivacySettings() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [consentGranted, setConsentGranted] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Deletion Modal / Confirm State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    fetchConsent()
  }, [user])

  const fetchConsent = async () => {
    try {
      const res = await api.get('/consent')
      setConsentGranted(res.data.data.consentGranted)
    } catch {
      setError('Failed to fetch consent settings')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    if (deleteInput !== 'DELETE') return
    
    setDeleting(true)
    setError('')
    try {
      await api.delete('/auth/delete-account')
      logout()
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to delete account')
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Main Content Area */}
      <main className="max-w-[1200px] mx-auto px-6 md:px-16 py-16 flex-grow flex flex-col gap-12 w-full animate-fade-in text-left">
        
        {/* Page Title */}
        <section className="max-w-2xl">
          <h1 className="font-sans text-5xl font-bold text-slate-900 mb-4">Privacy &amp; Data Management</h1>
          <p className="text-sm text-slate-500">
            Manage your consents and control your personal health information with clinical precision.
          </p>
        </section>

        {error && (
          <div className="error-banner p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="success-banner p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Bento Grid Layout */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 bg-white border border-slate-200 rounded-xl p-8 md:p-10 shadow-sm">
              <Skeleton className="h-10 w-48 mb-6" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="md:col-span-4 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
              <Skeleton className="h-full w-full min-h-[200px]" />
            </div>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* DPDP Consent Card */}
            <div className="md:col-span-8 bg-white border border-slate-200 rounded-xl p-8 md:p-10 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Clinical Data Consent</h2>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-md uppercase tracking-wider">
                    DPDP Compliant
                  </span>
                </div>
                
                {/* Read-only status badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Consent Active
                </div>
              </div>

              <div className="prose max-w-none text-sm text-slate-500 space-y-4 leading-relaxed">
                <p>
                  We collect your prescription data to analyze for safety interactions. Your data is encrypted and never shared with third parties without explicit clinician involvement.
                </p>
                <div className="bg-[#f4f8f8] border-l-4 border-[#0f766e] p-4 mt-6 rounded-r-lg">
                  <h3 className="text-sm font-semibold text-[#00504a] mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">shield</span>
                    What this means for you
                  </h3>
                  <ul className="list-disc pl-5 space-y-2 text-xs text-slate-600">
                    <li>Continuous drug-drug interaction monitoring.</li>
                    <li>Personalized risk assessments based on your medical history.</li>
                    <li>Consent is recorded at signup and remains active to protect your treatment profiles. To withdraw consent, you must delete your account.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Informational Sidebar Card */}
            <div className="md:col-span-4 bg-[#f0f4f4]/40 border border-slate-200 rounded-xl p-8 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500">policy</span>
                  Data Principles
                </h3>
                <ul className="space-y-6 text-xs text-slate-500">
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#0F766E] text-lg mt-0.5">lock</span>
                    <span>
                      <strong className="text-slate-800">End-to-End Encryption</strong>
                      <br/>Your data is secured both in transit and at rest.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[#0F766E] text-lg mt-0.5">visibility_off</span>
                    <span>
                      <strong className="text-slate-800">Zero-Knowledge Architecture</strong>
                      <br/>We cannot read your raw medical records.
                    </span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => window.open('https://gdpr-info.eu/')}
                className="mt-8 text-[#0f766e] font-semibold text-xs flex items-center gap-1 hover:text-accent-hover transition-colors cursor-pointer"
              >
                Read Full Policy <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            {/* Account Deletion Card (Full Width) */}
            <div className="md:col-span-12 bg-white border border-slate-200 rounded-xl p-8 md:p-10 shadow-sm mt-4">
              <div className="max-w-3xl">
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ba1a1a]">warning</span>
                  Account Management
                </h2>
                <p className="text-sm text-slate-500 mb-8">
                  Deleting your account will permanently erase all your medical records, prescription history, and active monitoring alerts from our servers. This action cannot be undone.
                </p>
                
                {!showDeleteConfirm ? (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="bg-transparent border border-[#ba1a1a] text-[#ba1a1a] font-semibold text-xs px-6 py-3 rounded-lg hover:bg-red-50 transition-colors duration-200 cursor-pointer"
                  >
                    Delete my account
                  </button>
                ) : (
                  <form onSubmit={handleDeleteAccount} className="p-6 border border-red-200 bg-red-50/20 rounded-xl max-w-md animate-[fade_0.2s]">
                    <h3 className="text-sm font-bold text-slate-900 mb-2">Are you absolutely sure?</h3>
                    <p className="text-xs text-slate-600 mb-4 leading-normal">
                      Please type <strong className="text-red-700">DELETE</strong> below to confirm permanent deletion of all your record history.
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        required
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder="Type DELETE"
                        className="bg-white border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors flex-grow"
                      />
                      <button
                        type="submit"
                        disabled={deleteInput !== 'DELETE' || deleting}
                        className="bg-[#ba1a1a] hover:bg-red-700 text-white font-semibold text-xs px-6 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deleting ? 'Deleting...' : 'Confirm'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200">
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

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="font-sans text-[#181c1d] antialiased min-h-screen flex items-center justify-center bg-[#f6fafa] mg-grid-bg p-6">
      <main className="w-full max-w-[440px] bg-white/72 backdrop-blur-[20px] rounded-2xl border border-white/50 p-8 md:p-12 text-center shadow-2xl flex flex-col items-center gap-6 animate-[fade_0.3s]">
        
        {/* Wordmark logo centered */}
        <div className="text-center">
          <span className="font-serif text-4xl font-bold medguard-logo-text">
            MedGuard
          </span>
        </div>
        
        {/* Error Icon */}
        <div className="w-20 h-20 rounded-full border border-slate-200 flex items-center justify-center bg-white shadow-sm mt-2">
          <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '40px' }}>
            error
          </span>
        </div>

        {/* Typography */}
        <div className="flex flex-col gap-2">
          <h1 className="font-sans text-3xl font-bold text-slate-900">
            404 Error
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The resource you are looking for might have been moved or is no longer available.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-4 w-full">
          <button 
            onClick={() => navigate(user ? '/dashboard' : '/')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0F766E] hover:bg-accent-hover text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer shadow-sm w-full"
          >
            <span className="material-symbols-outlined text-[18px]">
              {user ? 'dashboard' : 'home'}
            </span>
            {user ? 'Return to Dashboard' : 'Return Home'}
          </button>
        </div>

      </main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'
import { MgNavbar } from '../components/MgNavbar'

const SEVERITY_CONFIG = {
  avoid_combination: {
    label: 'Avoid Combination',
    borderClass: 'border-l-4 border-red-600',
    badgeClass: 'bg-red-50 border border-red-200 text-red-800',
    icon: 'warning',
    iconClass: 'text-red-600',
  },
  monitor_closely: {
    label: 'Monitor Closely',
    borderClass: 'border-l-4 border-amber-500',
    badgeClass: 'bg-amber-50 border border-amber-200 text-amber-800',
    icon: 'visibility',
    iconClass: 'text-amber-500',
  },
  minor: {
    label: 'Minor',
    borderClass: 'border-l-4 border-slate-400',
    badgeClass: 'bg-slate-50 border border-slate-200 text-slate-600',
    icon: 'info',
    iconClass: 'text-slate-400',
  },
  no_action: {
    label: 'No Action',
    borderClass: 'border-l-4 border-slate-200',
    badgeClass: 'bg-slate-50 border border-slate-100 text-slate-500',
    icon: 'info',
    iconClass: 'text-slate-400',
  },
}

export default function Alerts() {
  const { user, loading: authLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    fetchAlerts()
  }, [user])

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const res = await api.get('/alerts', { params: { patient_id: user.id } })
      setAlerts(res.data.data)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch alerts')
    } finally {
      setLoading(false)
    }
  }

  const acknowledgeAlert = async (id) => {
    try {
      await api.put(`/alerts/${id}/acknowledge`)
      fetchAlerts()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to acknowledge alert')
    }
  }

  const getSeverityConfig = (severity) => {
    return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.no_action
  }

  const renderExplanation = (text) => {
    if (!text) return null;
    
    // Split into paragraphs/lines
    const paragraphs = text.split('\n').filter(p => p.trim());
    
    return (
      <div className="space-y-4 my-6 text-slate-600">
        {paragraphs.map((p, idx) => {
          // Replace markdown double-asterisks with styled bold tags
          const parts = p.split('**');
          if (parts.length > 1) {
            return (
              <p key={idx} className="text-sm leading-relaxed">
                {parts.map((part, i) => {
                  if (i % 2 === 1) {
                    return <strong key={i} className="text-slate-800 font-bold block mt-4 mb-1.5 first:mt-0">{part}</strong>;
                  }
                  return part;
                })}
              </p>
            );
          }
          return (
            <p key={idx} className="text-sm leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100/50">
              {p}
            </p>
          );
        })}
      </div>
    );
  };

  // Filter out acknowledged alerts to match active list, showing only unacknowledged ones
  const activeAlerts = alerts.filter(a => a.status === 'shown')

  return (
    <>
      {/* Main Content */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 md:px-16 py-12 md:py-16 animate-fade-in">
        
        {/* Header Section */}
        <div className="mb-12 text-left">
          <h1 className="font-sans text-5xl font-bold text-slate-900 mb-4">Interaction Alerts</h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Review potential conflicts in your medication schedule. High severity alerts require immediate attention.
          </p>
        </div>

        {error && (
          <div className="error-banner mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-left">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : activeAlerts.length === 0 ? (
          <div className="text-left py-12 border border-slate-200 border-dashed rounded-xl bg-white p-8">
            <p className="text-sm text-slate-500">All clear! No pending interaction alerts.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 text-left">
            {activeAlerts.map((alert) => {
              const config = getSeverityConfig(alert.severity)
              return (
                <div 
                  key={alert.id}
                  className={`bg-white border border-slate-200 rounded-xl p-8 relative overflow-hidden group shadow-sm ${config.borderClass}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1">
                      
                      {/* Badge and Severity Label */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`material-symbols-outlined text-xl ${config.iconClass}`}>
                          {config.icon}
                        </span>
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${config.badgeClass}`}>
                          {config.label}
                        </span>
                      </div>

                      {/* Drugs Combo */}
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        {alert.drug_name_a} + {alert.drug_name_b}
                      </h2>

                      {/* Explanation */}
                      {renderExplanation(alert.explanation)}

                      {/* Side-by-Side Split Drugs Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="border border-slate-100 rounded-lg p-4 flex items-center gap-3 bg-slate-50/50">
                          <span className="material-symbols-outlined text-slate-400 text-2xl">medication</span>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{alert.drug_name_a}</div>
                            <div className="text-xs text-slate-500">Adhering prescription active</div>
                          </div>
                        </div>
                        <div className="border border-slate-100 rounded-lg p-4 flex items-center gap-3 bg-slate-50/50">
                          <span className="material-symbols-outlined text-slate-400 text-2xl">pill</span>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{alert.drug_name_b}</div>
                            <div className="text-xs text-slate-500">Newly analyzed medication</div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Actions Side Container */}
                    <div className="flex md:flex-col gap-3 md:w-48 shrink-0">
                      {alert.severity === 'avoid_combination' && (
                        <button 
                          onClick={() => window.open('tel:100')} // Mock hotline/doctor dialer
                          className="flex-grow md:flex-none bg-[#0f766e] hover:bg-accent-hover text-white font-semibold text-xs py-3 px-4 rounded-lg transition-colors text-center cursor-pointer"
                        >
                          Contact Doctor
                        </button>
                      )}
                      <button 
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="flex-grow md:flex-none bg-transparent border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs py-3 px-4 rounded-lg transition-colors text-center cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#f6fafa] border-t border-slate-200 mt-auto">
        <div className="w-full py-12 px-6 md:px-16 flex flex-col md:flex-row justify-between items-center gap-4 max-w-[1200px] mx-auto text-sm text-slate-500">
          <div className="font-serif text-lg font-bold text-slate-900 mb-4 md:mb-0">
            MedGuard
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/privacy" className="hover:text-[#0F766E] transition-colors">Privacy Policy</Link>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Clinical Guidelines</a>
            <a className="hover:text-[#0F766E] transition-colors" href="#" onClick={(e) => e.preventDefault()}>Contact Support</a>
          </div>
          <div className="text-xs text-slate-400 mt-4 md:mt-0">
            © 2026 MedGuard AI. Clinical Excellence in Medication Safety.
          </div>
        </div>
      </footer>
    </>
  )
}

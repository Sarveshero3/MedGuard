import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Skeleton } from '../components/ui/skeleton'
import { MgNavbar } from '../components/MgNavbar'
import { unescapeHTML } from '../lib/utils'

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
  const { user, loading: authLoading, logout, activePatientId } = useAuth()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [safetyChecking, setSafetyChecking] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [expandedAlerts, setExpandedAlerts] = useState({})
  
  const toggleExpand = (id) => {
    setExpandedAlerts(prev => ({ ...prev, [id]: !prev[id] }))
  }

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    if (user.role === 'caregiver' && !activePatientId) {
      setLoading(false)
      return
    }
    fetchAlerts()
  }, [user, activePatientId])

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const res = await api.get('/alerts', { params: { patient_id: activePatientId } })
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

  const handleTriggerSafetyCheck = async () => {
    setSafetyChecking(true)
    setError('')
    setSuccessMsg('')
    setInfoMsg('')
    
    try {
      const res = await api.post('/alerts/safety-check', { patient_id: activePatientId })
      if (res.data.success) {
        setSuccessMsg(`✔ ${res.data.message}`)
        fetchAlerts() // refresh the alerts list
      } else if (res.data.code === 'UP_TO_DATE') {
        setInfoMsg(`ℹ ${res.data.message}`)
      } else {
        setError(res.data.message || 'Safety check completed, but with errors.')
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to trigger safety check.')
    } finally {
      setSafetyChecking(false)
    }
  }

  const getSeverityConfig = (severity) => {
    return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.no_action
  }

  const parseAlertExplanation = (explanation) => {
    if (!explanation) return { summary: '', details: '' };
    
    // Look for "Patient Summary:" (case-insensitive) or "Introduction" headers
    const summaryMatch = explanation.match(/(?:Patient Summary:|Introduction)\s*([\s\S]*?)(?=\n\s*(?:---\n|Detailed Warning:|Mechanism of Interaction:|\*\*Mechanism of Interaction\*\*|\*\*Clinically Significant Interactions\*\*|Mechanism of Interaction|$))/i);
    
    if (summaryMatch && summaryMatch[1].trim()) {
      const summary = summaryMatch[1].trim();
      const details = explanation.replace(summaryMatch[0], '').trim();
      return { summary, details };
    }
    
    // Fallback: Use the first paragraph as summary, rest as details
    const paragraphs = explanation.split('\n').map(p => p.trim()).filter(Boolean);
    if (paragraphs.length > 0) {
      const summary = paragraphs[0];
      const details = paragraphs.slice(1).join('\n');
      return { summary, details };
    }
    
    return { summary: explanation, details: '' };
  };

  const renderExplanation = (text) => {
    if (!text) return null;
    
    // Split into paragraphs/lines
    const paragraphs = text.split('\n').filter(p => p.trim());
    
    return (
      <div className="space-y-3 text-slate-650">
        {paragraphs.map((p, idx) => {
          // Replace markdown double-asterisks with styled bold tags
          const parts = p.split('**');
          if (parts.length > 1) {
            return (
              <p key={idx} className="text-xs leading-relaxed">
                {parts.map((part, i) => {
                  if (i % 2 === 1) {
                    return <strong key={i} className="text-slate-800 font-bold block mt-3 mb-1 first:mt-0">{unescapeHTML(part)}</strong>;
                  }
                  return unescapeHTML(part);
                })}
              </p>
            );
          }
          return (
            <p key={idx} className="text-xs leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/50">
              {unescapeHTML(p)}
            </p>
          );
        })}
      </div>
    );
  };

  // Filter out acknowledged alerts to match active list, showing only unacknowledged ones
  const activeAlerts = alerts.filter(a => a.status === 'shown')
  const archivedAlerts = alerts.filter(a => a.status === 'acknowledged_by_patient' || a.status === 'acknowledged_by_caregiver')

  return (
    <>
      {/* Main Content */}
      <main className="flex-grow w-full max-w-[1200px] mx-auto px-6 md:px-16 py-12 md:py-16 animate-fade-in">
        
        {/* Header Section */}
        <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 text-left">
          <div>
            <h1 className="font-sans text-5xl font-bold text-slate-900 mb-4">Interaction Alerts</h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Review potential conflicts in your medication schedule. High severity alerts require immediate attention.
            </p>
          </div>
          <div>
            <button
              onClick={handleTriggerSafetyCheck}
              disabled={safetyChecking}
              className="bg-[#0F766E] hover:bg-[#0d645c] text-white font-semibold text-xs px-5 py-3 rounded-xl transition-all flex items-center shadow-sm cursor-pointer shadow-teal-700/10 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              title="Verify active medications for interaction alerts"
            >
              {safetyChecking ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running Check...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined mr-1.5 text-[18px]">health_and_safety</span>
                  Run Safety Check
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs text-left font-semibold animate-fade-in flex items-center gap-2">
            <span className="material-symbols-outlined text-sm font-bold">error</span>
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs text-left font-semibold animate-fade-in flex items-center gap-2">
            <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
            {successMsg}
          </div>
        )}

        {infoMsg && (
          <div className="mb-6 p-4 rounded-xl bg-sky-50 border border-sky-100 text-sky-800 text-xs text-left font-semibold animate-fade-in flex items-center gap-2">
            <span className="material-symbols-outlined text-sm font-bold">info</span>
            {infoMsg}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : activeAlerts.length === 0 ? (
          <div className="text-left py-12 border border-slate-200 border-dashed rounded-xl bg-white p-8">
            <p className="text-sm text-slate-500 font-medium">All clear! No pending interaction alerts.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 text-left">
            {activeAlerts.map((alert) => {
              const config = getSeverityConfig(alert.severity)
              const { summary, details } = parseAlertExplanation(alert.explanation)
              const hasDetails = details && details.trim().length > 0
              const canExpand = hasDetails && (alert.severity === 'avoid_combination' || alert.severity === 'monitor_closely')
              const isExpanded = !!expandedAlerts[alert.id]

              return (
                <div 
                  key={alert.id}
                  className={`bg-white border border-slate-200 rounded-xl p-6 relative overflow-hidden group shadow-sm ${config.borderClass}`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-grow min-w-0">
                      
                      {/* Badge and Severity Label */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`material-symbols-outlined text-lg ${config.iconClass}`}>
                          {config.icon}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${config.badgeClass}`}>
                          {config.label}
                        </span>
                      </div>

                      {/* Drugs Combo */}
                      <h2 className="text-xl font-bold text-slate-900 mb-1">
                        {alert.drug_name_a} + {alert.drug_name_b}
                      </h2>
                      {alert.alert_type === 'drug_drug' && (
                        <p className="text-[11px] text-slate-450 font-semibold mb-3">
                          ({unescapeHTML(alert.new_medicine_generic || 'Unknown')} &amp; {unescapeHTML(alert.existing_medicine_generic || 'Unknown')})
                        </p>
                      )}

                      {/* Explanation Summary */}
                      <p className="text-sm text-slate-650 leading-relaxed font-medium mb-3">
                        {unescapeHTML(summary)}
                      </p>

                      {/* Show/Hide details expander button */}
                      {canExpand && (
                        <div className="mb-4">
                          <button
                            type="button"
                            onClick={() => toggleExpand(alert.id)}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer select-none"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                            </span>
                            {isExpanded ? 'Hide medical details' : 'View medical details'}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 border-t border-slate-100 pt-3 animate-fade-in">
                              {renderExplanation(details)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Side-by-Side Split Drugs Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div className="border border-slate-100 rounded-lg p-3 flex items-center gap-2.5 bg-slate-50/50">
                          <span className="material-symbols-outlined text-slate-400 text-xl">medication</span>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{alert.drug_name_a}</div>
                            <div className="text-[10px] text-slate-500 font-medium">Adhering prescription active</div>
                          </div>
                        </div>
                        <div className="border border-slate-100 rounded-lg p-3 flex items-center gap-2.5 bg-slate-50/50">
                          <span className="material-symbols-outlined text-slate-400 text-xl">pill</span>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{alert.drug_name_b}</div>
                            <div className="text-[10px] text-slate-500 font-medium">Newly analyzed medication</div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Actions Side Container */}
                    <div className="flex md:flex-col gap-2 md:w-44 shrink-0 mt-3 md:mt-0">
                      {alert.severity === 'avoid_combination' && (
                        <button 
                          onClick={() => window.open('tel:100')} // Mock hotline/doctor dialer
                          className="flex-grow md:flex-none bg-[#0f766e] hover:bg-teal-800 text-white font-semibold text-xs py-2.5 px-3 rounded-lg transition-colors text-center cursor-pointer"
                        >
                          Contact Doctor
                        </button>
                      )}
                      <button 
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="flex-grow md:flex-none bg-transparent border border-slate-200 text-slate-605 hover:bg-slate-50 font-semibold text-xs py-2.5 px-3 rounded-lg transition-colors text-center cursor-pointer"
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

        {/* Collapsible Archived/Acknowledged Alerts Section */}
        {archivedAlerts.length > 0 && (
          <div className="mt-12 text-left border-t border-slate-200 pt-8">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-bold text-sm cursor-pointer select-none"
            >
              <span className={`material-symbols-outlined transition-transform duration-200 ${showArchived ? 'rotate-90' : ''}`}>
                chevron_right
              </span>
              Archived Alerts ({archivedAlerts.length})
            </button>
            
            {showArchived && (
              <div className="mt-6 flex flex-col gap-6 opacity-80">
                {archivedAlerts.map((alert) => {
                  const config = getSeverityConfig(alert.severity)
                  const { summary, details } = parseAlertExplanation(alert.explanation)
                  const hasDetails = details && details.trim().length > 0
                  const canExpand = hasDetails && (alert.severity === 'avoid_combination' || alert.severity === 'monitor_closely')
                  const isExpanded = !!expandedAlerts[alert.id]

                  return (
                    <div 
                      key={alert.id}
                      className={`bg-slate-50/50 border border-slate-200 rounded-xl p-5 relative overflow-hidden group shadow-sm ${config.borderClass}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          
                          {/* Badge and Severity Label */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`material-symbols-outlined text-lg ${config.iconClass}`}>
                              {config.icon}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${config.badgeClass}`}>
                              {config.label}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase ml-2 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              Archived
                            </span>
                          </div>

                          {/* Drugs Combo */}
                          <h2 className="text-lg font-bold text-slate-700 mb-1">
                            {alert.drug_name_a} + {alert.drug_name_b}
                          </h2>
                          {alert.alert_type === 'drug_drug' && (
                            <p className="text-[11px] text-slate-450 font-semibold mb-3">
                              ({unescapeHTML(alert.new_medicine_generic || 'Unknown')} &amp; {unescapeHTML(alert.existing_medicine_generic || 'Unknown')})
                            </p>
                          )}

                          {/* Summary explanation */}
                          <p className="text-sm text-slate-600 leading-relaxed font-medium mb-3">
                            {unescapeHTML(summary)}
                          </p>

                          {/* Show/Hide details expander button */}
                          {canExpand && (
                            <div className="mb-2">
                              <button
                                type="button"
                                onClick={() => toggleExpand(alert.id)}
                                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer select-none"
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {isExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                                </span>
                                {isExpanded ? 'Hide medical details' : 'View medical details'}
                              </button>

                              {isExpanded && (
                                <div className="mt-3 border-t border-slate-200 pt-3 animate-fade-in">
                                  {renderExplanation(details)}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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

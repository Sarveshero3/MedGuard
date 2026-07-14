import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const SEVERITY_CONFIG = {
  avoid_combination: { label: 'Avoid Combination', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🔴' },
  monitor_closely: { label: 'Monitor Closely', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🟠' },
  minor: { label: 'Minor', color: '#eab308', bg: 'rgba(234,179,8,0.1)', icon: '🟡' },
  no_action: { label: 'No Action', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '🟢' },
}

export default function CaregiverDashboard() {
  const { user } = useAuth()
  const [links, setLinks] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    fetchLinks()
  }, [user])

  const fetchLinks = async () => {
    setLoading(true)
    try {
      const res = await api.get('/caregivers/links')
      setLinks(res.data.data.filter(l => l.status === 'active'))
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load patient links')
    }
    setLoading(false)
  }

  const selectPatient = async (link) => {
    setSelectedPatient(link)
    setLoading(true)
    setError('')
    try {
      // Always fetch alerts (available for both tiers)
      const alertsRes = await api.get('/alerts', { params: { patient_id: link.patient_id } })
      setAlerts(alertsRes.data.data)

      // Full view: also fetch medicines
      if (link.permission_level === 'full_view') {
        const medsRes = await api.get('/medicines', { params: { patient_id: link.patient_id } })
        setMedicines(medsRes.data.data)
      } else {
        setMedicines([])
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load patient data')
    }
    setLoading(false)
  }

  const handleAcknowledge = async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/acknowledge`)
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'acknowledged_by_caregiver' } : a
      ))
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to acknowledge')
    }
  }

  const permissionBadge = (level) => {
    if (level === 'full_view') return <span className="badge badge-active">Full View</span>
    return <span className="badge badge-warn">Alerts Only</span>
  }

  const sevConfig = (sev) => SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.no_action

  return (
    <div className="page-container">
      <h1>👨‍👩‍👧 Caregiver Dashboard</h1>
      <p className="subtitle">Monitor your linked patient's medication safety</p>

      {error && <div className="error-banner">{error}</div>}

      {!selectedPatient ? (
        <>
          {loading ? (
            <p className="loading-text">Loading linked patients…</p>
          ) : links.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔗</span>
              <h3>No linked patients</h3>
              <p>Ask a patient to send you a caregiver invitation to get started</p>
            </div>
          ) : (
            <div className="patient-links-grid" id="patient-links">
              {links.map(link => (
                <div key={link.id} className="patient-link-card" onClick={() => selectPatient(link)}>
                  <div className="patient-name">{link.name || link.email}</div>
                  <div className="patient-email">{link.email}</div>
                  <div className="patient-permission">{permissionBadge(link.permission_level)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button className="btn-back" onClick={() => setSelectedPatient(null)}>
            ← Back to Patient List
          </button>

          <div className="selected-patient-header">
            <h2>{selectedPatient.name || selectedPatient.email}</h2>
            {permissionBadge(selectedPatient.permission_level)}
          </div>

          {loading ? (
            <p className="loading-text">Loading patient data…</p>
          ) : (
            <>
              {/* Medicines — only visible for full_view */}
              {selectedPatient.permission_level === 'full_view' && (
                <div className="section">
                  <h3>💊 Active Medicines ({medicines.filter(m => m.status === 'active').length})</h3>
                  {medicines.filter(m => m.status === 'active').length === 0 ? (
                    <p className="empty-text">No active medicines</p>
                  ) : (
                    <div className="medicine-table-wrapper">
                      <table className="medicine-table">
                        <thead>
                          <tr><th>Brand</th><th>Generic</th><th>Dosage</th><th>Frequency</th></tr>
                        </thead>
                        <tbody>
                          {medicines.filter(m => m.status === 'active').map(m => (
                            <tr key={m.id}>
                              <td>{m.brand_name}</td>
                              <td>{m.generic_name || '—'}</td>
                              <td>{m.dosage}</td>
                              <td>{m.frequency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Alerts — visible for all tiers */}
              <div className="section">
                <h3>⚠️ Interaction Alerts ({alerts.filter(a => a.status === 'shown').length} unacknowledged)</h3>
                {alerts.length === 0 ? (
                  <p className="empty-text">No interaction alerts — medicines look safe</p>
                ) : (
                  <div className="alerts-grid">
                    {alerts.map(alert => {
                      const cfg = sevConfig(alert.severity)
                      const isAcknowledged = alert.status !== 'shown'

                      return (
                        <div key={alert.id}
                          className={`alert-card ${isAcknowledged ? 'acknowledged' : ''}`}
                          style={{ borderLeftColor: cfg.color, backgroundColor: cfg.bg }}
                        >
                          <div className="alert-header">
                            <span>{cfg.icon}</span>
                            <span style={{ color: cfg.color }}>{cfg.label}</span>
                            {isAcknowledged && <span className="alert-ack-badge">✓ {alert.status.replace(/_/g, ' ')}</span>}
                          </div>
                          <div className="alert-drugs">
                            <span className="drug-pill">{alert.new_medicine_brand} ({alert.new_medicine_generic})</span>
                            <span className="alert-x">✕</span>
                            <span className="drug-pill">{alert.existing_medicine_brand} ({alert.existing_medicine_generic})</span>
                          </div>
                          <p className="alert-explanation">{alert.explanation}</p>
                          <div className="alert-footer">
                            <span className="alert-date">{new Date(alert.created_at).toLocaleDateString()}</span>
                            {!isAcknowledged && (
                              <button className="btn-sm btn-ack" onClick={() => handleAcknowledge(alert.id)}>
                                Acknowledge
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

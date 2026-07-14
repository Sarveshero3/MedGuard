import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const SEVERITY_CONFIG = {
  avoid_combination: { label: 'Avoid Combination', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🔴' },
  monitor_closely: { label: 'Monitor Closely', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🟠' },
  minor: { label: 'Minor', color: '#eab308', bg: 'rgba(234,179,8,0.1)', icon: '🟡' },
  no_action: { label: 'No Action', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: '🟢' },
}

export default function Alerts() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      setError(err.response?.data?.error?.message || 'Failed to load alerts')
    }
    setLoading(false)
  }

  const handleAcknowledge = async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/acknowledge`)
      setAlerts(prev => prev.map(a =>
        a.id === alertId
          ? { ...a, status: user.role === 'caregiver' ? 'acknowledged_by_caregiver' : 'acknowledged_by_patient' }
          : a
      ))
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to acknowledge alert')
    }
  }

  const sevConfig = (sev) => SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.no_action

  return (
    <div className="page-container">
      <h1>⚠️ Interaction Alerts</h1>
      <p className="subtitle">Drug interaction warnings and safety flags</p>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p className="loading-text">Loading alerts…</p>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">✅</span>
          <h3>No alerts</h3>
          <p>No drug interactions detected — your medicines look safe</p>
        </div>
      ) : (
        <div className="alerts-grid" id="alerts-grid">
          {alerts.map(alert => {
            const cfg = sevConfig(alert.severity)
            const isAcknowledged = alert.status !== 'shown'

            return (
              <div
                key={alert.id}
                className={`alert-card ${isAcknowledged ? 'acknowledged' : ''}`}
                style={{ borderLeftColor: cfg.color, backgroundColor: cfg.bg }}
              >
                <div className="alert-header">
                  <span className="alert-severity-icon">{cfg.icon}</span>
                  <span className="alert-severity-label" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  {isAcknowledged && (
                    <span className="alert-ack-badge">
                      ✓ {alert.status.replace(/_/g, ' ')}
                    </span>
                  )}
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
                    <button
                      className="btn-sm btn-ack"
                      onClick={() => handleAcknowledge(alert.id)}
                    >
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
  )
}

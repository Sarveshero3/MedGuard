import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ medicines: 0, alerts: 0, visits: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchStats = async () => {
      try {
        const [medsRes, alertsRes, visitsRes] = await Promise.allSettled([
          api.get('/medicines', { params: { patient_id: user.id } }),
          api.get('/alerts', { params: { patient_id: user.id } }),
          api.get('/calendar', { params: { patient_id: user.id } }),
        ])

        const meds = medsRes.status === 'fulfilled' ? medsRes.value.data.data : []
        const alerts = alertsRes.status === 'fulfilled' ? alertsRes.value.data.data : []
        const visits = visitsRes.status === 'fulfilled' ? visitsRes.value.data.data?.visits || [] : []

        setStats({
          medicines: meds.filter(m => m.status === 'active').length,
          alerts: alerts.filter(a => a.status === 'shown').length,
          visits: visits.slice(0, 3),
        })
      } catch { /* graceful fallback */ }
      setLoading(false)
    }
    fetchStats()
  }, [user])

  const alertSeverityColor = (count) => {
    if (count === 0) return 'var(--accent)'
    if (count <= 2) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="page-container">
      <nav className="top-nav">
        <div className="nav-brand">🛡️ MedGuard</div>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload">Upload</Link>
          <Link to="/medicines">Medicines</Link>
          <Link to="/alerts">Alerts</Link>
          <Link to="/calendar">Calendar</Link>
          {user?.role === 'caregiver' && <Link to="/caregiver">Patients</Link>}
          <Link to="/privacy">Privacy</Link>
          <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </nav>

      <main className="dashboard-content">
        <h1>Welcome{user?.name ? `, ${user.name}` : ''}</h1>
        <p className="subtitle">Your medication safety overview</p>

        <div className="dashboard-grid">
          <div className="card" id="card-medicines" onClick={() => navigate('/medicines')}>
            <div className="card-icon">💊</div>
            <h3>Active Medicines</h3>
            <p className="card-stat" style={{ color: 'var(--accent)' }}>
              {loading ? '…' : stats.medicines}
            </p>
            <p className="card-desc">View your current prescriptions</p>
          </div>

          <div className="card" id="card-alerts" onClick={() => navigate('/alerts')}>
            <div className="card-icon">⚠️</div>
            <h3>Interaction Alerts</h3>
            <p className="card-stat" style={{ color: alertSeverityColor(stats.alerts) }}>
              {loading ? '…' : stats.alerts}
            </p>
            <p className="card-desc">Check flagged drug interactions</p>
          </div>

          <div className="card" id="card-upload" onClick={() => navigate('/upload')}>
            <div className="card-icon">📷</div>
            <h3>Upload Prescription</h3>
            <p className="card-desc">Scan a new prescription photo</p>
          </div>

          <div className="card" id="card-calendar" onClick={() => navigate('/calendar')}>
            <div className="card-icon">📅</div>
            <h3>Upcoming Visits</h3>
            <p className="card-stat" style={{ color: 'var(--accent)' }}>
              {loading ? '…' : stats.visits.length}
            </p>
            <p className="card-desc">Medicine schedule & appointments</p>
          </div>
        </div>

        {stats.visits.length > 0 && (
          <div className="visits-preview">
            <h2>Upcoming Visits</h2>
            <ul className="visits-list">
              {stats.visits.map((v, i) => (
                <li key={i} className="visit-item">
                  <span className="visit-date">{new Date(v.scheduled_date).toLocaleDateString()}</span>
                  {v.doctor_name && <span className="visit-doctor">{v.doctor_name}</span>}
                  {v.specialty && <span className="visit-specialty">{v.specialty}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}

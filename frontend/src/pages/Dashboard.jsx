import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="page-container">
      <nav className="top-nav">
        <div className="nav-brand">🛡️ MedGuard</div>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload">Upload</Link>
          <Link to="/medicines">Medicines</Link>
          <Link to="/alerts">Alerts</Link>
          <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </nav>

      <main className="dashboard-content">
        <h1>Welcome{user?.name ? `, ${user.name}` : ''}</h1>
        <p className="subtitle">Your medication safety overview</p>

        <div className="dashboard-grid">
          <div className="card" onClick={() => navigate('/medicines')}>
            <div className="card-icon">💊</div>
            <h3>Active Medicines</h3>
            <p className="card-stat">—</p>
            <p className="card-desc">View your current prescriptions</p>
          </div>

          <div className="card" onClick={() => navigate('/alerts')}>
            <div className="card-icon">⚠️</div>
            <h3>Interaction Alerts</h3>
            <p className="card-stat">—</p>
            <p className="card-desc">Check flagged drug interactions</p>
          </div>

          <div className="card" onClick={() => navigate('/upload')}>
            <div className="card-icon">📷</div>
            <h3>Upload Prescription</h3>
            <p className="card-desc">Scan a new prescription photo</p>
          </div>

          <div className="card">
            <div className="card-icon">📅</div>
            <h3>Upcoming Visits</h3>
            <p className="card-stat">—</p>
            <p className="card-desc">Scheduled doctor appointments</p>
          </div>
        </div>
      </main>
    </div>
  )
}

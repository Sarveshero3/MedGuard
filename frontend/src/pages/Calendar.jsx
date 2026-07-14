import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Calendar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Add Appointment Form State
  const [doctorName, setDoctorName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const fetchCalendarData = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const res = await api.get(`/calendar?patient_id=${user.id}`)
      setTimeline(res.data.data.timeline || [])
      setError('')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch calendar timeline.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarData()
  }, [user?.id])

  const handleAddVisit = async (e) => {
    e.preventDefault()
    if (!scheduledDate) return

    setSubmitting(true)
    setError('')
    setSuccessMsg('')

    try {
      await api.post('/calendar/visits', {
        patient_id: user.id,
        doctor_name: doctorName,
        specialty,
        scheduled_date: new Date(scheduledDate).toISOString(),
      })

      setSuccessMsg('Appointment added successfully!')
      setDoctorName('')
      setSpecialty('')
      setScheduledDate('')
      fetchCalendarData() // Refresh timeline
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to add appointment.')
    } finally {
      setSubmitting(false)
    }
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
          <button onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </nav>

      <main className="dashboard-content">
        <h1>📅 My Calendar & Visits</h1>
        <p className="subtitle">Medicine course end dates and doctor appointments</p>

        {error && <div className="error-banner" style={{ margin: '16px 0', padding: '12px', background: '#ffebeb', color: '#c30000', borderRadius: '6px' }}>{error}</div>}
        {successMsg && <div className="success-banner" style={{ margin: '16px 0', padding: '12px', background: '#e6f7ed', color: '#137333', borderRadius: '6px' }}>{successMsg}</div>}

        <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px', marginTop: '24px' }}>
          
          {/* Merged Timeline Section */}
          <div className="timeline-section">
            <h2>Chronological Schedule</h2>
            {loading ? (
              <p>Loading timeline...</p>
            ) : timeline.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '24px' }}>
                <span className="empty-icon">📅</span>
                <h3>No upcoming calendar items</h3>
                <p>Add an appointment or upload a prescription to view your schedule</p>
              </div>
            ) : (
              <div className="timeline-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                {timeline.map((item, idx) => {
                  const itemDate = new Date(item.date).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                  
                  const isVisit = item.type === 'doctor_visit'

                  return (
                    <div 
                      key={item.id || idx} 
                      className="card timeline-card" 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '8px', 
                        borderLeft: `6px solid ${isVisit ? '#0f766e' : '#f59e0b'}`,
                        padding: '16px',
                        cursor: 'default'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          color: isVisit ? '#0f766e' : '#b45309', 
                          background: isVisit ? '#ccfbf1' : '#fef3c7', 
                          padding: '2px 8px', 
                          borderRadius: '12px',
                          textTransform: 'uppercase'
                        }}>
                          {isVisit ? 'Doctor Appointment' : 'Medication End'}
                        </span>
                        <span style={{ fontSize: '13px', color: '#666' }}>{itemDate}</span>
                      </div>
                      <h4 style={{ margin: '4px 0', fontSize: '18px' }}>{item.title}</h4>
                      {isVisit ? (
                        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                          Doctor: {item.details.doctor_name || 'Unspecified'} | Specialty: {item.details.specialty || 'General'}
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                          Dosage: {item.details.dosage} | Frequency: {item.details.frequency}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Add Appointment Form */}
          <div className="add-visit-section">
            <h2>Add Appointment</h2>
            <form onSubmit={handleAddVisit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', marginTop: '20px', cursor: 'default' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '500', fontSize: '14px' }}>Doctor Name</label>
                <input 
                  type="text" 
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="e.g. Dr. Sharma" 
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '500', fontSize: '14px' }}>Specialty</label>
                <input 
                  type="text" 
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Cardiology" 
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontWeight: '500', fontSize: '14px' }}>Date & Time *</label>
                <input 
                  type="datetime-local" 
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px' }}
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                disabled={submitting}
                style={{ width: '100%', padding: '10px', marginTop: '8px', cursor: 'pointer' }}
              >
                {submitting ? 'Adding...' : 'Add to Calendar'}
              </button>
            </form>
          </div>

        </div>
      </main>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function PrivacySettings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [consents, setConsents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Account deletion state
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchConsentData()
  }, [user])

  const fetchConsentData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/consent')
      setConsents(res.data.data || [])
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to fetch consent records.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleConsent = async (type, currentlyGranted) => {
    setError('')
    setSuccessMsg('')
    const action = currentlyGranted ? 'revoke' : 'grant'
    try {
      await api.post('/consent', {
        consent_type: type,
        action: action
      })
      setSuccessMsg(`Consent for ${type === 'health_data_processing' ? 'Health Data Processing' : type} successfully ${action}ed.`)
      fetchConsentData()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update consent settings.')
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    if (deleteInput !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion.')
      return
    }

    setDeleting(true)
    setError('')
    try {
      await api.delete('/auth/delete-account')
      // Logout and redirect to login page
      logout()
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to delete account.')
      setDeleting(false)
    }
  }

  const isHealthDataGranted = consents.some(
    (c) => c.consent_type === 'health_data_processing' && c.granted_at && !c.revoked_at
  )

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
        <h1>🔒 Privacy & Consent Settings</h1>
        <p className="subtitle">Manage your personal data processing preferences in compliance with the DPDP Act</p>

        {error && (
          <div className="error-banner" style={{ margin: '16px 0', padding: '12px', background: '#ffebeb', color: '#c30000', borderRadius: '6px' }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div className="success-banner" style={{ margin: '16px 0', padding: '12px', background: '#e6f7ed', color: '#137333', borderRadius: '6px' }}>
            {successMsg}
          </div>
        )}

        <div className="privacy-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginTop: '24px' }}>
          
          {/* DPDP Consent Toggles */}
          <div className="card" style={{ padding: '24px', cursor: 'default' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '20px' }}>Digital Personal Data Protection (DPDP) Consent</h3>
            <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              We require your explicit consent to process your health-related information. Under the DPDP Act, you have the right to withdraw this consent at any time. Revoking consent will block the system from processing your prescriptions or identifying drug interactions.
            </p>

            {loading ? (
              <p>Loading consent options...</p>
            ) : (
              <div 
                className="consent-item-row" 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px',
                  background: '#f8fafc'
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Health Data Processing</h4>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px', maxWidth: '600px' }}>
                    Permission to extract medicine details from prescriptions, resolve brand names to generic components, and run drug interaction safety checks.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span 
                    style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: isHealthDataGranted ? '#137333' : '#b45309', 
                      background: isHealthDataGranted ? '#e6f7ed' : '#fef3c7', 
                      padding: '4px 10px', 
                      borderRadius: '12px' 
                    }}
                  >
                    {isHealthDataGranted ? 'Consent Granted' : 'Consent Revoked'}
                  </span>
                  <button 
                    onClick={() => handleToggleConsent('health_data_processing', isHealthDataGranted)}
                    className="btn-primary"
                    style={{ 
                      padding: '6px 16px', 
                      fontSize: '13px', 
                      backgroundColor: isHealthDataGranted ? '#dc2626' : '#0f766e', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '6px', 
                      cursor: 'pointer' 
                    }}
                  >
                    {isHealthDataGranted ? 'Revoke Consent' : 'Grant Consent'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right to Erasure / Account Deletion */}
          <div className="card" style={{ padding: '24px', borderLeft: '6px solid #dc2626', cursor: 'default' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#dc2626' }}>Right to Erasure (Delete Account)</h3>
            <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              You have the right to request the deletion of all your personal data held by MedGuard. Deleting your account will immediately and permanently erase your account credentials, prescription records, uploaded images, interaction alerts, caregiver relationships, and consent logs. **This action is irreversible.**
            </p>

            {!deleteConfirm ? (
              <button 
                onClick={() => setDeleteConfirm(true)}
                className="btn-primary"
                style={{ 
                  backgroundColor: '#dc2626', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Permanently Delete My Account
              </button>
            ) : (
              <form onSubmit={handleDeleteAccount} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
                <p style={{ color: '#b91c1c', fontWeight: '600', fontSize: '13px', margin: '0' }}>
                  Warning: To proceed, please type <span style={{ fontFamily: 'monospace', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>DELETE</span> below to confirm your request.
                </p>
                <input 
                  type="text" 
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE" 
                  style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px' }}
                  required
                />
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={deleting}
                    style={{ 
                      backgroundColor: '#dc2626', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: '6px', 
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    {deleting ? 'Deleting Account...' : 'Confirm Deletion'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }}
                    style={{ 
                      backgroundColor: '#e2e8f0', 
                      color: '#334155', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: '6px', 
                      cursor: 'pointer' 
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

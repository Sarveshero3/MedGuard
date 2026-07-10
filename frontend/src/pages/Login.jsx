import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Login() {
  const [isSignup, setIsSignup] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    consentGranted: false,
  })
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const endpoint = isSignup ? '/auth/register' : '/auth/login'
      const res = await api.post(endpoint, formData)
      login(res.data.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong')
    }
  }

  return (
    <div className="page-container auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🛡️ MedGuard</h1>
          <p>AI-Powered Medication Safety</p>
        </div>

        <div className="auth-tabs">
          <button
            className={!isSignup ? 'active' : ''}
            onClick={() => setIsSignup(false)}
          >
            Login
          </button>
          <button
            className={isSignup ? 'active' : ''}
            onClick={() => setIsSignup(true)}
          >
            Sign Up
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          {isSignup && (
            <>
              <div className="form-group">
                <label htmlFor="role">I am a</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="patient">Patient</option>
                  <option value="caregiver">Caregiver</option>
                </select>
              </div>

              <div className="form-group consent-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    required
                    checked={formData.consentGranted}
                    onChange={(e) =>
                      setFormData({ ...formData, consentGranted: e.target.checked })
                    }
                  />
                  <span>
                    I consent to the processing of my health data in accordance with
                    the Digital Personal Data Protection Act (DPDP). I understand I
                    can request deletion of my data at any time.
                  </span>
                </label>
              </div>
            </>
          )}

          <button type="submit" className="btn-primary">
            {isSignup ? 'Create Account' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

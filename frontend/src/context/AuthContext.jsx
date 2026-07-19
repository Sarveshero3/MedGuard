import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('medguard_token'))
  const [loading, setLoading] = useState(true)
  const [linkedPatients, setLinkedPatients] = useState([])
  const [activePatient, setActivePatient] = useState(null)

  useEffect(() => {
    if (token) {
      // Decode JWT payload (without verification — server validates)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUser({
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          name: payload.name,
        })
      } catch {
        // Invalid token
        localStorage.removeItem('medguard_token')
        localStorage.removeItem('medguard_refresh_token')
        setToken(null)
      }
    } else {
      setUser(null)
    }
    setLoading(false)
  }, [token])

  // Fetch linked patients for caregivers
  useEffect(() => {
    if (!user) {
      setLinkedPatients([])
      setActivePatient(null)
      return
    }

    if (user.role === 'caregiver') {
      const fetchLinks = async () => {
        try {
          const res = await api.get('/caregivers/links')
          const patients = res.data.data || []
          setLinkedPatients(patients)
          if (patients.length > 0) {
            const savedId = localStorage.getItem('medguard_active_patient_id')
            const matched = patients.find(p => p.patient_id === savedId)
            if (matched) {
              setActivePatient(matched)
            } else {
              setActivePatient(patients[0])
            }
          } else {
            setActivePatient(null)
          }
        } catch {
          // Gracefully ignore link errors
        }
      }
      fetchLinks()
    } else {
      setLinkedPatients([])
      setActivePatient(null)
    }
  }, [user])

  const selectPatient = (patient) => {
    setActivePatient(patient)
    if (patient) {
      localStorage.setItem('medguard_active_patient_id', patient.patient_id)
    } else {
      localStorage.removeItem('medguard_active_patient_id')
    }
  }

  const login = (accessToken, refreshToken) => {
    localStorage.setItem('medguard_token', accessToken)
    if (refreshToken) {
      localStorage.setItem('medguard_refresh_token', refreshToken)
    }
    setToken(accessToken)
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem('medguard_refresh_token')
    // Revoke refresh token on server (best-effort, don't block logout on failure)
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken })
      } catch {
        // Ignore errors — local cleanup proceeds regardless
      }
    }
    localStorage.removeItem('medguard_token')
    localStorage.removeItem('medguard_refresh_token')
    localStorage.removeItem('medguard_active_patient_id')
    setToken(null)
    setUser(null)
    setLinkedPatients([])
    setActivePatient(null)
  }

  const activePatientId = user?.role === 'caregiver' ? activePatient?.patient_id : user?.id

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout,
      linkedPatients,
      activePatient,
      activePatientId,
      selectPatient
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

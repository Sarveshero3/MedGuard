import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('medguard_token'))
  const [loading, setLoading] = useState(true)

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
    }
    setLoading(false)
  }, [token])

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
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
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

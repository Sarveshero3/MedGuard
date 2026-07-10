import { createContext, useContext, useState, useEffect } from 'react'

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
        setToken(null)
      }
    }
    setLoading(false)
  }, [token])

  const login = (jwt) => {
    localStorage.setItem('medguard_token', jwt)
    setToken(jwt)
  }

  const logout = () => {
    localStorage.removeItem('medguard_token')
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

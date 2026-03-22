import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

const ROLE_LEVELS = {
  operator: 0, lead: 1, trainer: 2, supervisor: 3, manager: 4, admin: 5,
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('skill-matrix-token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.setToken(token)
      api.getMe()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('skill-matrix-token')
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password)
    localStorage.setItem('skill-matrix-token', res.token)
    api.setToken(res.token)
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('skill-matrix-token')
    api.setToken(null)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function hasRole(userRole, ...requiredRoles) {
  return requiredRoles.includes(userRole)
}

export function canAccess(userRole, section) {
  const level = ROLE_LEVELS[userRole] ?? -1
  switch (section) {
    case 'admin': return level >= ROLE_LEVELS.manager
    case 'logs': return level >= ROLE_LEVELS.supervisor
    case 'confirm': return level >= ROLE_LEVELS.supervisor
    case 'create_users': return level >= ROLE_LEVELS.manager
    default: return true
  }
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, canAccess } from './lib/auth'
import NavBar from './components/NavBar'
import MatrixView from './pages/MatrixView'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/admin/Users'
import Assignments from './pages/admin/Assignments'
import Skills from './pages/admin/Skills'
import ActivityLog from './pages/ActivityLog'
import EmployeeProfile from './pages/EmployeeProfile'
import TalentFinder from './pages/TalentFinder'
import Demo from './pages/Demo'
import Register from './pages/Register'

function ProtectedRoute({ children, requiredAccess }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (requiredAccess && !canAccess(user.role, requiredAccess)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: "'Inter', -apple-system, sans-serif" }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: '#f5f5f4', minHeight: '100vh' }}>
      {user && <NavBar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/" element={<ProtectedRoute><MatrixView /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute requiredAccess="admin"><Users /></ProtectedRoute>} />
        <Route path="/admin/assignments" element={<ProtectedRoute requiredAccess="admin"><Assignments /></ProtectedRoute>} />
        <Route path="/admin/skills" element={<ProtectedRoute requiredAccess="admin"><Skills /></ProtectedRoute>} />
        <Route path="/employee/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
        <Route path="/talent-finder" element={<ProtectedRoute><TalentFinder /></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute requiredAccess="logs"><ActivityLog /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

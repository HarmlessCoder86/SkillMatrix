import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth, canAccess } from '../lib/auth'

export default function NavBar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [showAdmin, setShowAdmin] = useState(false)

  if (!user) return null

  const isActive = (path) => location.pathname === path
  const isAdminActive = location.pathname.startsWith('/admin')

  const linkStyle = (active) => ({
    color: active ? 'white' : '#94a3b8',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    padding: '6px 12px',
    borderRadius: 6,
    background: active ? '#333333' : 'transparent',
    transition: 'all 0.15s',
  })

  return (
    <div style={{
      background: '#1a1a1a', color: 'white', padding: '0 24px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      height: 48, position: 'relative', zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to="/" style={{ textDecoration: 'none', marginRight: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#F26522', letterSpacing: '-0.02em' }}>
            Simpson Strong-Tie
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>Skill Matrix</span>
        </Link>

        <Link to="/" style={linkStyle(isActive('/'))}>Matrix</Link>
        <Link to="/dashboard" style={linkStyle(isActive('/dashboard'))}>Dashboard</Link>
        <Link to="/talent-finder" style={linkStyle(isActive('/talent-finder'))}>Talent Finder</Link>

        {canAccess(user.role, 'admin') && (
          <div style={{ position: 'relative' }}
            onMouseEnter={() => setShowAdmin(true)}
            onMouseLeave={() => setShowAdmin(false)}>
            <span style={{ ...linkStyle(isAdminActive), cursor: 'pointer' }}>
              Admin &#9662;
            </span>
            {showAdmin && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, background: '#333333',
                borderRadius: 6, padding: '4px 0', minWidth: 160, marginTop: 4,
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              }}>
                <Link to="/admin/users" style={{
                  display: 'block', padding: '8px 16px', color: '#e2e8f0', textDecoration: 'none',
                  fontSize: 13, background: isActive('/admin/users') ? '#444444' : 'transparent',
                }}>Users</Link>
                <Link to="/admin/assignments" style={{
                  display: 'block', padding: '8px 16px', color: '#e2e8f0', textDecoration: 'none',
                  fontSize: 13, background: isActive('/admin/assignments') ? '#444444' : 'transparent',
                }}>Assignments</Link>
                <Link to="/admin/skills" style={{
                  display: 'block', padding: '8px 16px', color: '#e2e8f0', textDecoration: 'none',
                  fontSize: 13, background: isActive('/admin/skills') ? '#444444' : 'transparent',
                }}>Skills</Link>
              </div>
            )}
          </div>
        )}

        {canAccess(user.role, 'logs') && (
          <Link to="/logs" style={linkStyle(isActive('/logs'))}>Activity Log</Link>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{user.first_name} {user.last_name}</span>
          <span style={{
            marginLeft: 8, padding: '2px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
            background: '#333333', color: '#94a3b8', textTransform: 'uppercase',
          }}>{user.role}</span>
        </div>
        <button onClick={logout} style={{
          padding: '4px 10px', fontSize: 12, background: 'transparent', color: '#94a3b8',
          border: '1px solid #444444', borderRadius: 4, cursor: 'pointer',
        }}>Logout</button>
      </div>
    </div>
  )
}

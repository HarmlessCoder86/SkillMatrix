import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#111111',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a1a', borderRadius: 12, padding: 40, width: 380,
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <h1 style={{ color: '#F26522', fontSize: 22, fontWeight: 700, margin: '0 0 4px', textAlign: 'center', letterSpacing: '-0.02em' }}>
          Simpson Strong-Tie
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 32px', textAlign: 'center' }}>
          Skill Matrix — <em style={{ color: '#F26522' }}>No Equal</em>
        </p>

        {error && (
          <div style={{
            background: '#450a0a', color: '#fca5a5', padding: '8px 12px',
            borderRadius: 6, fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
            Username
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your username"
            style={{
              width: '100%', padding: '10px 12px', background: '#111111', border: '1px solid #333333',
              borderRadius: 6, color: 'white', fontSize: 14, marginBottom: 16, boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
            style={{
              width: '100%', padding: '10px 12px', background: '#111111', border: '1px solid #333333',
              borderRadius: 6, color: 'white', fontSize: 14, marginBottom: 24, boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px 0', background: '#F26522', color: 'white',
              border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ color: '#333333', fontSize: 11, marginTop: 24, textAlign: 'center' }}>
          Simpson Strong-Tie Company Inc.
        </p>
        <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <Link to="/register" style={{
            color: '#475569', fontSize: 12, textDecoration: 'none',
            transition: 'color 0.2s',
          }}
            onMouseEnter={(e) => { e.target.style.color = '#F26522'; e.target.style.textDecoration = 'underline' }}
            onMouseLeave={(e) => { e.target.style.color = '#475569'; e.target.style.textDecoration = 'none' }}
          >
            Create Account
          </Link>
          <Link to="/demo" style={{
            color: '#475569', fontSize: 12, textDecoration: 'none',
            transition: 'color 0.2s',
          }}
            onMouseEnter={(e) => { e.target.style.color = '#F26522'; e.target.style.textDecoration = 'underline' }}
            onMouseLeave={(e) => { e.target.style.color = '#475569'; e.target.style.textDecoration = 'none' }}
          >
            See Demo
          </Link>
        </div>
      </div>
    </div>
  )
}

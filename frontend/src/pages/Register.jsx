import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function Register() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [department, setDepartment] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Dropdown options
  const [departments, setDepartments] = useState([])
  const [employeeRoles, setEmployeeRoles] = useState([])

  useEffect(() => {
    api.getRegistrationOptions().then((data) => {
      setDepartments(data.departments || [])
      setEmployeeRoles(data.employee_roles || [])
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.register({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        department: department || null,
        job_title: jobTitle || null,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', background: '#111111', border: '1px solid #333333',
    borderRadius: 6, color: 'white', fontSize: 14, boxSizing: 'border-box', outline: 'none',
  }

  const labelStyle = { display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 500, marginBottom: 6 }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh', background: '#111111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: '#1a1a1a', borderRadius: 12, padding: 40, width: 380,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>&#x2713;</div>
          <h2 style={{ color: '#F26522', fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>
            Account Created
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, margin: '0 0 24px' }}>
            An administrator will review and activate your account. You&apos;ll be able to sign in once approved.
          </p>
          <Link to="/login" style={{
            display: 'inline-block', padding: '10px 24px', background: '#F26522', color: 'white',
            borderRadius: 6, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            Back to Login
          </Link>
        </div>
      </div>
    )
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
        <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 24px', textAlign: 'center' }}>
          Create an Account
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
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>First Name</label>
              <input
                value={firstName} onChange={(e) => setFirstName(e.target.value)}
                required placeholder="First name" style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Last Name</label>
              <input
                value={lastName} onChange={(e) => setLastName(e.target.value)}
                required placeholder="Last name" style={inputStyle}
              />
            </div>
          </div>

          <label style={labelStyle}>Email</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required placeholder="your.email@company.com"
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required placeholder="Minimum 6 characters" minLength={6}
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <label style={labelStyle}>Department</label>
          <select
            value={department} onChange={(e) => setDepartment(e.target.value)}
            style={{ ...inputStyle, marginBottom: 16 }}
          >
            <option value="">Select department...</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <label style={labelStyle}>Job Title</label>
          <select
            value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
            style={{ ...inputStyle, marginBottom: 24 }}
          >
            <option value="">Select job title...</option>
            {employeeRoles.map((r) => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '10px 0', background: '#F26522', color: 'white',
              border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/login" style={{
            color: '#475569', fontSize: 12, textDecoration: 'none',
            transition: 'color 0.2s',
          }}
            onMouseEnter={(e) => { e.target.style.color = '#F26522'; e.target.style.textDecoration = 'underline' }}
            onMouseLeave={(e) => { e.target.style.color = '#475569'; e.target.style.textDecoration = 'none' }}
          >
            Back to Login
          </Link>
        </div>

        <p style={{ color: '#333333', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
          Simpson Strong-Tie Company Inc.
        </p>
      </div>
    </div>
  )
}

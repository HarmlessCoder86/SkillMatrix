import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import HarveyBall from '../components/HarveyBall'

export default function TalentFinder() {
  const [skills, setSkills] = useState([])
  const [selectedSkill, setSelectedSkill] = useState('')
  const [minLevel, setMinLevel] = useState(1)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getSkills().then(setSkills).catch(() => {})
  }, [])

  const handleSearch = async () => {
    if (!selectedSkill) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.talentSearch(Number(selectedSkill), minLevel)
      setResults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const skillName = skills.find((s) => s.id === Number(selectedSkill))?.name || ''

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Talent Finder</h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>
        Search for employees with specific skills and proficiency levels.
      </p>

      {/* Search Controls */}
      <div style={{
        background: 'white', borderRadius: 8, border: '1px solid #e2e8f0',
        padding: 20, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
      }}>
        <div style={{ flex: 2, minWidth: 200 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Skill</label>
          <select
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
              border: '1px solid #d1d5db', background: 'white',
            }}
          >
            <option value="">Select a skill...</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.category_name} — {s.name}</option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 120 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Min Level</label>
          <select
            value={minLevel}
            onChange={(e) => setMinLevel(Number(e.target.value))}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
              border: '1px solid #d1d5db', background: 'white',
            }}
          >
            <option value={1}>Level 1+</option>
            <option value={2}>Level 2+</option>
            <option value={3}>Level 3+</option>
            <option value={4}>Level 4 only</option>
          </select>
        </div>

        <button
          onClick={handleSearch}
          disabled={!selectedSkill || loading}
          style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600,
            background: selectedSkill ? '#F26522' : '#d1d5db',
            color: 'white', border: 'none', borderRadius: 6,
            cursor: selectedSkill ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 16px', background: '#fef2f2', color: '#991b1b', fontSize: 13, borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div style={{
          background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#334155',
            borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Results for "{skillName}"</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
              {results.length} employee{results.length !== 1 ? 's' : ''} found
            </span>
          </div>

          {results.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No employees found with {skillName} at Level {minLevel} or above.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>Employee</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>Department</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>Role</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', width: 80 }}>Level</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', width: 80 }}>Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.employee_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 16px', fontSize: 13 }}>
                      <Link to={`/employee/${r.employee_id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                        {r.first_name} {r.last_name}
                      </Link>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: '#64748b' }}>{r.department || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, color: '#64748b' }}>{r.role || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <HarveyBall level={r.level} size={20} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>L{r.level}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>
                      {r.is_confirmed ? (
                        <span style={{ color: '#16a34a' }}>Yes</span>
                      ) : (
                        <span style={{ color: '#d97706' }}>Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

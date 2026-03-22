import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import HarveyBall from '../components/HarveyBall'
import DetailPanel from '../components/DetailPanel'

export default function EmployeeProfile() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedSkill, setSelectedSkill] = useState(null)

  const loadProfile = () => {
    api.getEmployeeProfile(id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    setSelectedSkill(null)
    loadProfile()
  }, [id])

  const handleUpdateLevel = async (empId, skillId, level) => {
    await api.updateAssessment(empId, skillId, { level })
    loadProfile()
    setSelectedSkill(null)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading profile...</div>
  if (error) return <div style={{ padding: 40, color: '#ef4444' }}>{error}</div>
  if (!data) return null

  const { employee, assessments, summary } = data

  // Group by category
  const categories = {}
  assessments.forEach((a) => {
    if (!categories[a.category_name]) categories[a.category_name] = []
    categories[a.category_name].push(a)
  })

  // Build props for DetailPanel from profile assessment data
  const detailEmployee = employee
  const detailSkill = selectedSkill
    ? { id: selectedSkill.skill_id, name: selectedSkill.skill_name, retrain_days: selectedSkill.retrain_days }
    : null
  const detailAssessment = selectedSkill
    ? {
        level: selectedSkill.level,
        is_confirmed: selectedSkill.is_confirmed,
        last_trained_date: selectedSkill.last_trained_date,
        retrain_due_date: selectedSkill.retrain_due_date,
        is_overdue: selectedSkill.retrain_due_date && new Date(selectedSkill.retrain_due_date) < new Date(),
      }
    : null
  const detailRequirement = selectedSkill?.required_level || null

  const statCard = (label, value, color) => (
    <div style={{
      flex: 1, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0',
      padding: '16px 20px', textAlign: 'center', minWidth: 120,
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link to="/" style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}>
          ← Back to Matrix
        </Link>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: '8px 0 4px' }}>
          {employee.first_name} {employee.last_name}
        </h2>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          {employee.role && <span style={{
            padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 10,
            background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', marginRight: 8,
          }}>{employee.role}</span>}
          {employee.department && <span>{employee.department}</span>}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {statCard('Total Skills', summary.total_skills, '#334155')}
        {statCard('Assessed', summary.assessed_count, '#2563eb')}
        {statCard('Avg Level', summary.avg_level, '#16a34a')}
        {statCard('Gaps', summary.gaps_count, summary.gaps_count > 0 ? '#dc2626' : '#16a34a')}
        {statCard('Overdue Certs', summary.overdue_count, summary.overdue_count > 0 ? '#dc2626' : '#16a34a')}
      </div>

      {/* Skills by Category */}
      {Object.entries(categories).map(([catName, skills]) => (
        <div key={catName} style={{
          background: 'white', borderRadius: 8, border: '1px solid #e2e8f0',
          marginBottom: 16, overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#334155',
            borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
          }}>
            {catName}
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>
              ({skills.filter((s) => s.level > 0).length}/{skills.length} assessed)
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>Skill</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', width: 70 }}>Level</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', width: 70 }}>Required</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', width: 80 }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', width: 110 }}>Retrain Due</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((s) => {
                const hasGap = s.required_level && s.level < s.required_level
                const isOverdue = s.retrain_due_date && new Date(s.retrain_due_date) < new Date()
                const isSelected = selectedSkill?.skill_id === s.skill_id
                return (
                  <tr
                    key={s.skill_id}
                    onClick={() => setSelectedSkill(s)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isSelected ? '#FFF3EB' : 'inherit',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#FFF8F3' }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'inherit' }}
                  >
                    <td style={{ padding: '8px 16px', fontSize: 13, color: '#1a1a1a' }}>
                      {s.skill_name}
                      {s.requires_cert && (
                        <span style={{
                          fontSize: 9, background: '#fef3c7', color: '#92400e',
                          padding: '1px 5px', borderRadius: 4, marginLeft: 6, fontWeight: 600,
                        }}>CERT</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <HarveyBall level={s.level} size={22} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>L{s.level}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                      {s.required_level ? `L${s.required_level}` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {hasGap ? (
                        <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Gap</span>
                      ) : !s.is_confirmed ? (
                        <span style={{ fontSize: 11, color: '#d97706', fontWeight: 500 }}>Pending</span>
                      ) : s.level > 0 ? (
                        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>OK</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>
                      {s.retrain_due_date ? (
                        <span style={{ color: isOverdue ? '#dc2626' : '#64748b', fontWeight: isOverdue ? 600 : 400 }}>
                          {new Date(s.retrain_due_date).toLocaleDateString()}
                          {isOverdue && ' ⚠'}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* DetailPanel for editing */}
      {selectedSkill && (
        <DetailPanel
          employee={detailEmployee}
          skill={detailSkill}
          assessment={detailAssessment}
          requirement={detailRequirement}
          onClose={() => setSelectedSkill(null)}
          onUpdate={handleUpdateLevel}
        />
      )}
    </div>
  )
}

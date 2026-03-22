import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth, canAccess } from '../lib/auth'

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleConfirm = async (id) => {
    try {
      await api.confirmAssessment(id)
      const fresh = await api.getDashboard()
      setData(fresh)
    } catch (e) { setError(e.message) }
  }

  const handleReject = async (id) => {
    try {
      await api.rejectAssessment(id)
      const fresh = await api.getDashboard()
      setData(fresh)
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading dashboard...</div>
  if (error) return <div style={{ padding: 40, color: '#ef4444' }}>{error}</div>
  if (!data) return null

  const sectionStyle = {
    background: 'white', borderRadius: 8, border: '1px solid #e2e8f0',
    marginBottom: 20, overflow: 'hidden',
  }
  const headerStyle = (color) => ({
    padding: '12px 16px', fontSize: 14, fontWeight: 600, color,
    borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  })
  const itemStyle = {
    padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 13,
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>Dashboard</h2>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>
        {user.first_name} {user.last_name} — {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        {user.department && ` | ${user.department}`}
      </p>

      {/* Overdue Retraining */}
      <div style={sectionStyle}>
        <div style={headerStyle('#dc2626')}>
          <span>Overdue Retraining</span>
          <span style={{ fontSize: 12, background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 10 }}>
            {data.overdue.length}
          </span>
        </div>
        {data.overdue.length === 0 ? (
          <div style={{ ...itemStyle, color: '#94a3b8' }}>No overdue certifications</div>
        ) : data.overdue.map((item) => (
          <div key={item.id} style={itemStyle}>
            <div style={{ fontWeight: 500, color: '#1a1a1a' }}>{item.employee_name}</div>
            <div style={{ color: '#64748b', marginTop: 2 }}>
              {item.skill_name} — <span style={{ color: '#dc2626' }}>{item.days_overdue} days overdue</span>
            </div>
          </div>
        ))}
      </div>

      {/* Expiring Soon */}
      {data.expiring_soon && data.expiring_soon.length > 0 && (
        <div style={sectionStyle}>
          <div style={headerStyle('#d97706')}>
            <span>Expiring Soon (30 days)</span>
            <span style={{ fontSize: 12, background: '#fffbeb', color: '#d97706', padding: '2px 8px', borderRadius: 10 }}>
              {data.expiring_soon.length}
            </span>
          </div>
          {data.expiring_soon.map((item) => (
            <div key={item.id} style={itemStyle}>
              <div style={{ fontWeight: 500, color: '#1a1a1a' }}>{item.employee_name}</div>
              <div style={{ color: '#64748b', marginTop: 2 }}>
                {item.skill_name} — <span style={{ color: '#d97706' }}>expires in {item.days_remaining} day{item.days_remaining !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Confirmations */}
      <div style={sectionStyle}>
        <div style={headerStyle('#d97706')}>
          <span>{data.can_confirm ? 'Pending Confirmations' : 'Your Pending Submissions'}</span>
          <span style={{ fontSize: 12, background: '#fffbeb', color: '#d97706', padding: '2px 8px', borderRadius: 10 }}>
            {data.pending.length}
          </span>
        </div>
        {data.pending.length === 0 ? (
          <div style={{ ...itemStyle, color: '#94a3b8' }}>No pending items</div>
        ) : data.pending.map((item) => (
          <div key={item.id} style={{ ...itemStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, color: '#1a1a1a' }}>{item.employee_name}</div>
              <div style={{ color: '#64748b', marginTop: 2 }}>
                {item.skill_name}
                {item.previous_level != null && ` — L${item.previous_level} → L${item.level}`}
                {item.assessed_by_name && ` by ${item.assessed_by_name}`}
              </div>
            </div>
            {data.can_confirm && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleConfirm(item.id)} style={{
                  padding: '4px 10px', fontSize: 12, background: '#16a34a', color: 'white',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                }}>Confirm</button>
                <button onClick={() => handleReject(item.id)} style={{
                  padding: '4px 10px', fontSize: 12, background: '#fef2f2', color: '#991b1b',
                  border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer',
                }}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Staffing Gaps */}
      {user.role !== 'operator' && (
        <div style={sectionStyle}>
          <div style={headerStyle('#dc2626')}>
            <span>Staffing Gaps</span>
            <span style={{ fontSize: 12, background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 10 }}>
              {data.staffing_gaps.length}
            </span>
          </div>
          {data.staffing_gaps.length === 0 ? (
            <div style={{ ...itemStyle, color: '#94a3b8' }}>All staffing targets met</div>
          ) : data.staffing_gaps.map((item) => (
            <div key={item.skill_id} style={itemStyle}>
              <div style={{ fontWeight: 500, color: '#1a1a1a' }}>{item.skill_name}</div>
              <div style={{ color: '#64748b', marginTop: 2, fontSize: 12 }}>
                L3+: {item.level_3_actual}/{item.level_3_required} required
                {' | '}
                L4: {item.level_4_actual}/{item.level_4_required} required
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Training Priorities */}
      <div style={sectionStyle}>
        <div style={headerStyle('#2563eb')}>
          <span>Training Priorities</span>
          <span style={{ fontSize: 12, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 10 }}>
            {data.training_priorities.length}
          </span>
        </div>
        {data.training_priorities.length === 0 ? (
          <div style={{ ...itemStyle, color: '#94a3b8' }}>No training gaps</div>
        ) : data.training_priorities.slice(0, 15).map((item) => (
          <div key={`${item.employee_id}_${item.skill_id}`} style={itemStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500, color: '#1a1a1a' }}>
                {item.employee_id === user?.employee_id ? 'You' : item.employee_name}
              </span>
              <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>Gap: {item.gap_size}</span>
            </div>
            <div style={{ color: '#64748b', marginTop: 2, fontSize: 12 }}>
              {item.skill_name} — L{item.current_level} → L{item.required_level} required
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div style={sectionStyle}>
        <div style={headerStyle('#64748b')}>
          <span>Recent Activity</span>
        </div>
        {data.recent_activity.length === 0 ? (
          <div style={{ ...itemStyle, color: '#94a3b8' }}>No recent activity</div>
        ) : data.recent_activity.map((item) => (
          <div key={item.id} style={itemStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#1a1a1a' }}>{item.description}</span>
              <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, marginLeft: 12 }}>
                {new Date(item.created_at).toLocaleDateString()}
              </span>
            </div>
            {item.actor_name && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>by {item.actor_name}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

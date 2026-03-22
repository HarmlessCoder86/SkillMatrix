import { useState, useEffect, Fragment } from 'react'
import { api } from '../lib/api'

const ACTION_LABELS = {
  'user.login': 'User Login',
  'user.created': 'User Created',
  'user.updated': 'User Updated',
  'user.deactivated': 'User Deactivated',
  'assignment.created': 'Assignment Created',
  'assignment.deleted': 'Assignment Removed',
  'assessment.updated': 'Assessment Updated',
  'assessment.created': 'Assessment Created',
  'assessment.confirmed': 'Assessment Confirmed',
  'assessment.rejected': 'Assessment Rejected',
  'skill.created': 'Skill Created',
  'skill.deactivated': 'Skill Removed',
  'employee.created': 'Employee Created',
  'employee.deactivated': 'Employee Deactivated',
}

export default function ActivityLog() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    action_type: '', date_from: '', date_to: '', search: '', page: 1,
  })
  const [expanded, setExpanded] = useState(null)

  const load = async (params = filters) => {
    setLoading(true)
    try {
      const res = await api.getActivityLog(params)
      setData(res)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const handleFilter = () => {
    const f = { ...filters, page: 1 }
    setFilters(f)
    load(f)
  }

  const handlePage = (p) => {
    const f = { ...filters, page: p }
    setFilters(f)
    load(f)
  }

  const handleExport = async () => {
    try {
      const blob = await api.exportActivityLog(filters)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'activity_log.csv'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e.message) }
  }

  const inputStyle = {
    padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 13, boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Activity Log</h2>
        <button onClick={handleExport} style={{
          padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0',
          borderRadius: 6, fontSize: 13, cursor: 'pointer',
        }}>Export CSV</button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {error} <button onClick={() => setError(null)} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filters.action_type} onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
          style={{ ...inputStyle, minWidth: 160 }}>
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input type="date" value={filters.date_from}
          onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          style={inputStyle} placeholder="From" />
        <input type="date" value={filters.date_to}
          onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          style={inputStyle} placeholder="To" />
        <input placeholder="Search description..." value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={{ ...inputStyle, minWidth: 200 }} />
        <button onClick={handleFilter} style={{
          padding: '8px 16px', background: '#F26522', color: 'white', border: 'none',
          borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Filter</button>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Timestamp</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Actor</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Action</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Description</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#475569', width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <Fragment key={item.id}>
                <tr style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                  <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{item.actor_name || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11,
                      background: item.action_type.includes('deactivat') ? '#fef2f2' :
                        item.action_type.includes('creat') ? '#f0fdf4' : '#f8fafc',
                      color: item.action_type.includes('deactivat') ? '#dc2626' :
                        item.action_type.includes('creat') ? '#16a34a' : '#64748b',
                    }}>
                      {ACTION_LABELS[item.action_type] || item.action_type}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#1a1a1a' }}>{item.description}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>
                    {(item.old_value || item.new_value) ? (expanded === item.id ? '\u25B2' : '\u25BC') : ''}
                  </td>
                </tr>
                {expanded === item.id && (item.old_value || item.new_value) && (
                  <tr key={`${item.id}-detail`}>
                    <td colSpan={5} style={{ padding: '8px 12px 12px 40px', background: '#f8fafc', fontSize: 12 }}>
                      {item.old_value && (
                        <div style={{ marginBottom: 4 }}>
                          <span style={{ color: '#dc2626', fontWeight: 500 }}>Old:</span>{' '}
                          <code style={{ color: '#64748b' }}>{JSON.stringify(item.old_value)}</code>
                        </div>
                      )}
                      {item.new_value && (
                        <div>
                          <span style={{ color: '#16a34a', fontWeight: 500 }}>New:</span>{' '}
                          <code style={{ color: '#64748b' }}>{JSON.stringify(item.new_value)}</code>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {loading && <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}
        {!loading && data.items.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No activity found</div>
        )}
      </div>

      {/* Pagination */}
      {data.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 16 }}>
          {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => handlePage(p)} style={{
              padding: '6px 12px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 4,
              background: p === data.page ? '#F26522' : 'white',
              color: p === data.page ? 'white' : '#64748b',
              cursor: 'pointer',
            }}>{p}</button>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
        {data.total} total entries
      </div>
    </div>
  )
}

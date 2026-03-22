import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import ConfirmDialog from '../../components/ConfirmDialog'

const ROLES = ['admin', 'manager', 'supervisor', 'trainer', 'lead', 'operator']

// What roles each role can create (mirrors backend CREATION_PERMISSIONS)
const CREATION_PERMISSIONS = {
  admin: ['admin', 'manager', 'supervisor', 'trainer', 'lead', 'operator'],
  manager: ['supervisor', 'trainer', 'lead', 'operator'],
  supervisor: ['trainer', 'lead', 'operator'],
}

const ROLE_COLORS = {
  admin: { bg: '#FFF3EB', color: '#C85413' },
  manager: { bg: '#f0fdf4', color: '#16a34a' },
  supervisor: { bg: '#faf5ff', color: '#7c3aed' },
  trainer: { bg: '#fffbeb', color: '#d97706' },
  lead: { bg: '#f0fdfa', color: '#0d9488' },
  operator: { bg: '#f8fafc', color: '#64748b' },
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  let pass = ''
  for (let i = 0; i < 14; i++) pass += chars[Math.floor(Math.random() * chars.length)]
  return pass
}

export default function Users() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [archivedUsers, setArchivedUsers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [filter, setFilter] = useState({ role: '', department: '', team: '', search: '' })
  const [sort, setSort] = useState({ field: 'name', dir: 'asc' })
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '',
    role: 'operator', department: '', team_id: '', job_title: '',
  })
  const [newPassword, setNewPassword] = useState('')
  const [copiedPass, setCopiedPass] = useState(false)

  const isAdmin = user?.role === 'admin'
  const canSeeArchived = user?.role === 'admin' || user?.role === 'manager'
  const allowedRoles = CREATION_PERMISSIONS[user?.role] || []

  const [employeeRoles, setEmployeeRoles] = useState([])

  const load = async () => {
    try {
      const [u, t, er] = await Promise.all([api.getUsers(), api.getTeams(), api.getEmployeeRoles()])
      setUsers(u)
      setTeams(t)
      setEmployeeRoles(er)
      if (canSeeArchived) {
        try { setArchivedUsers(await api.getArchivedUsers()) } catch {}
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Auto-suggest email
  useEffect(() => {
    if (showCreate && form.first_name && form.last_name && !editUser) {
      const suggested = `${form.first_name.toLowerCase().trim()}.${form.last_name.toLowerCase().trim()}@company.com`
      if (!form.email || form.email.endsWith('@company.com')) {
        setForm(f => ({ ...f, email: suggested }))
      }
    }
  }, [form.first_name, form.last_name, showCreate, editUser])

  const resetForm = () => {
    setForm({ first_name: '', last_name: '', email: '', password: '',
      role: 'operator', department: '', team_id: '', job_title: '' })
    setShowCreate(false)
    setEditUser(null)
    setNewPassword('')
    setCopiedPass(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.createUser({ ...form, team_id: form.team_id ? Number(form.team_id) : null })
      resetForm()
      await load()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.updateUser(editUser.id, {
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
        role: form.role || undefined,
        department: form.department || undefined,
        team_id: form.team_id ? Number(form.team_id) : undefined,
        job_title: form.job_title || undefined,
      })
      if (newPassword && isAdmin) {
        await api.changePassword(editUser.id, newPassword)
      }
      resetForm()
      await load()
    } catch (e) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleDeactivate = (u) => {
    setDialog({
      title: 'Deactivate User',
      message: (
        <div>
          <p style={{ margin: '0 0 8px' }}>
            Are you sure you want to deactivate <strong>{u.first_name} {u.last_name}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
            They will lose access immediately. Their assessment history and activity log will be preserved.
            You can reactivate them later from the Archived tab.
          </p>
        </div>
      ),
      confirmText: 'Deactivate',
      variant: 'danger',
      onConfirm: async () => {
        setDialog(null)
        try { await api.deactivateUser(u.id); await load(); setSelectedUser(null) }
        catch (e) { setError(e.message) }
      },
    })
  }

  const handleReactivate = (u) => {
    setDialog({
      title: 'Reactivate User',
      message: `Reactivate ${u.first_name} ${u.last_name}? They will regain access with their previous role (${u.role}).`,
      confirmText: 'Reactivate',
      variant: 'success',
      onConfirm: async () => {
        setDialog(null)
        try { await api.reactivateUser(u.id); await load() }
        catch (e) { setError(e.message) }
      },
    })
  }

  const startEdit = (u) => {
    setEditUser(u)
    setForm({
      first_name: u.first_name, last_name: u.last_name, email: u.email,
      password: '', role: u.role, department: u.department || '',
      team_id: u.team_id || '', job_title: u.job_title || '',
    })
    setNewPassword('')
    setShowCreate(false)
    setCopiedPass(false)
  }

  const handleGeneratePassword = () => {
    const pass = generatePassword()
    if (editUser) {
      setNewPassword(pass)
    } else {
      setForm(f => ({ ...f, password: pass }))
    }
    setCopiedPass(false)
  }

  const handleCopyPassword = () => {
    const pass = editUser ? newPassword : form.password
    navigator.clipboard.writeText(pass)
    setCopiedPass(true)
    setTimeout(() => setCopiedPass(false), 2000)
  }

  // Sorting
  const handleSort = (field) => {
    setSort(s => ({ field, dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc' }))
  }

  const displayUsers = showArchived ? archivedUsers : users
  const departments = [...new Set(users.map(u => u.department).filter(Boolean))]
  const teamNames = [...new Set(users.map(u => u.team_name).filter(Boolean))]

  const filtered = useMemo(() => {
    let list = displayUsers.filter(u => {
      if (filter.role && u.role !== filter.role) return false
      if (filter.department && u.department !== filter.department) return false
      if (filter.team && u.team_name !== filter.team) return false
      if (filter.search) {
        const s = filter.search.toLowerCase()
        if (!`${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(s)) return false
      }
      return true
    })

    list.sort((a, b) => {
      let va, vb
      switch (sort.field) {
        case 'name': va = `${a.last_name} ${a.first_name}`; vb = `${b.last_name} ${b.first_name}`; break
        case 'email': va = a.email; vb = b.email; break
        case 'role': va = ROLES.indexOf(a.role); vb = ROLES.indexOf(b.role); return sort.dir === 'asc' ? va - vb : vb - va
        case 'department': va = a.department || ''; vb = b.department || ''; break
        case 'team': va = a.team_name || ''; vb = b.team_name || ''; break
        case 'last_login': va = a.last_login || ''; vb = b.last_login || ''; break
        default: va = ''; vb = ''
      }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase() }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1
      if (va > vb) return sort.dir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [displayUsers, filter, sort])

  // Stats
  const stats = useMemo(() => {
    const roleCounts = {}
    users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1 })
    const neverLoggedIn = users.filter(u => !u.last_login).length
    const recentlyCreated = users.filter(u => {
      if (!u.created_at) return false
      return (Date.now() - new Date(u.created_at)) < 7 * 86400000
    }).length
    return { total: users.length, roleCounts, neverLoggedIn, recentlyCreated, archived: archivedUsers.length }
  }, [users, archivedUsers])

  const hasFilters = filter.role || filter.department || filter.team || filter.search

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 13, boxSizing: 'border-box', outline: 'none',
  }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }

  const SortHeader = ({ field, children }) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569',
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      {children}
      <span style={{ marginLeft: 4, color: sort.field === field ? '#F26522' : '#cbd5e1', fontSize: 11 }}>
        {sort.field === field ? (sort.dir === 'asc' ? '\u2191' : '\u2193') : '\u2195'}
      </span>
    </th>
  )

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Active', value: stats.total, color: '#F26522' },
          { label: 'Roles', value: Object.entries(stats.roleCounts).map(([r, c]) => `${c} ${r}${c > 1 ? 's' : ''}`).join(', '), color: '#64748b', small: true },
          { label: 'Never Logged In', value: stats.neverLoggedIn, color: stats.neverLoggedIn > 0 ? '#d97706' : '#16a34a', warn: stats.neverLoggedIn > 0 },
          { label: 'Archived', value: stats.archived, color: '#94a3b8' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'white', borderRadius: 8, padding: '14px 16px',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            <div style={{ fontSize: s.small ? 12 : 22, fontWeight: s.small ? 400 : 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>User Management</h2>
          {canSeeArchived && (
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
              <button onClick={() => { setShowArchived(false); setSelectedUser(null) }} style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: !showArchived ? '#F26522' : 'transparent',
                color: !showArchived ? 'white' : '#64748b',
              }}>Active ({stats.total})</button>
              <button onClick={() => { setShowArchived(true); setSelectedUser(null) }} style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: showArchived ? '#F26522' : 'transparent',
                color: showArchived ? 'white' : stats.archived > 0 ? '#d97706' : '#64748b',
              }}>Archived / Pending ({stats.archived})</button>
            </div>
          )}
        </div>
        {!showArchived && (
          <button onClick={() => { resetForm(); setShowCreate(true) }} style={{
            padding: '8px 16px', background: '#F26522', color: 'white', border: 'none',
            borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>+ Create User</button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
          {error} <button onClick={() => setError(null)} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>Dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <input placeholder="Search name or email..." value={filter.search}
          onChange={e => setFilter({ ...filter, search: e.target.value })}
          style={{ ...inputStyle, maxWidth: 220 }} />
        <select value={filter.role} onChange={e => setFilter({ ...filter, role: e.target.value })}
          style={{ ...inputStyle, maxWidth: 140 }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <select value={filter.department} onChange={e => setFilter({ ...filter, department: e.target.value })}
          style={{ ...inputStyle, maxWidth: 140 }}>
          <option value="">All Depts</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filter.team} onChange={e => setFilter({ ...filter, team: e.target.value })}
          style={{ ...inputStyle, maxWidth: 160 }}>
          <option value="">All Teams</option>
          {teamNames.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => setFilter({ role: '', department: '', team: '', search: '' })} style={{
            padding: '6px 12px', fontSize: 12, background: 'none', border: '1px solid #d1d5db',
            borderRadius: 6, cursor: 'pointer', color: '#64748b', whiteSpace: 'nowrap',
          }}>Clear</button>
        )}
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          Showing {filtered.length} of {displayUsers.length}
        </span>
      </div>

      {/* Main content: table + detail panel */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* User Table */}
        <div style={{ flex: 1, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: showArchived ? '#fef2f2' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <SortHeader field="name">Name</SortHeader>
                <SortHeader field="email">Email</SortHeader>
                <SortHeader field="role">Role</SortHeader>
                <SortHeader field="department">Department</SortHeader>
                <SortHeader field="team">Team</SortHeader>
                <SortHeader field="last_login">Last Login</SortHeader>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.operator
                const isSelected = selectedUser?.id === u.id
                const isAdminTarget = u.role === 'admin'
                const canEdit = isAdmin || !isAdminTarget
                return (
                  <tr key={u.id}
                    onClick={() => !showArchived && setSelectedUser(isSelected ? null : u)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: showArchived ? 'default' : 'pointer',
                      background: isSelected ? '#FFF3EB' : 'transparent',
                      opacity: showArchived ? 0.7 : 1,
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{u.first_name} {u.last_name}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        background: rc.bg, color: rc.color,
                      }}>
                        {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.department || '\u2014'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{u.team_name || '\u2014'}</td>
                    <td style={{ padding: '10px 12px', color: u.last_login ? '#64748b' : '#d97706', fontSize: 12 }}>
                      {timeAgo(u.last_login)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      {showArchived ? (
                        canSeeArchived && (
                          <button onClick={() => handleReactivate(u)} style={{
                            padding: '4px 10px', fontSize: 12, background: '#f0fdf4', color: '#16a34a',
                            border: '1px solid #bbf7d0', borderRadius: 4, cursor: 'pointer',
                          }}>Reactivate</button>
                        )
                      ) : (
                        <>
                          {canEdit && (
                            <button onClick={() => startEdit(u)} style={{
                              padding: '4px 8px', fontSize: 12, background: 'none', border: '1px solid #d1d5db',
                              borderRadius: 4, cursor: 'pointer', marginRight: 4,
                            }}>Edit</button>
                          )}
                          {isAdmin && u.employee_id !== user.employee_id && (
                            <button onClick={() => handleDeactivate(u)} style={{
                              padding: '4px 8px', fontSize: 12, background: '#fef2f2', color: '#dc2626',
                              border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer',
                            }}>Deactivate</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              {showArchived ? 'No archived users' : 'No users found'}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedUser && !showArchived && (
          <div style={{
            width: 300, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0',
            padding: 20, flexShrink: 0, alignSelf: 'flex-start',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
                  {selectedUser.first_name} {selectedUser.last_name}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{selectedUser.email}</div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{
                background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#94a3b8', padding: 0,
              }}>{'\u2715'}</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div>
                <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</span>
                <div style={{ marginTop: 2 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    ...(ROLE_COLORS[selectedUser.role] || {}),
                  }}>
                    {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</span>
                <div style={{ marginTop: 2, color: '#1a1a1a' }}>{selectedUser.department || '\u2014'}</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Team</span>
                <div style={{ marginTop: 2, color: '#1a1a1a' }}>{selectedUser.team_name || '\u2014'}</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Job Title</span>
                <div style={{ marginTop: 2, color: '#1a1a1a' }}>{selectedUser.job_title || '\u2014'}</div>
              </div>
              <div>
                <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Login</span>
                <div style={{ marginTop: 2, color: selectedUser.last_login ? '#1a1a1a' : '#d97706' }}>
                  {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString() : 'Never'}
                </div>
              </div>
              {selectedUser.created_at && (
                <div>
                  <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</span>
                  <div style={{ marginTop: 2, color: '#1a1a1a' }}>{new Date(selectedUser.created_at).toLocaleDateString()}</div>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 16, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(isAdmin || selectedUser.role !== 'admin') && (
                <button onClick={() => startEdit(selectedUser)} style={{
                  width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 500,
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#1a1a1a',
                }}>Edit User</button>
              )}
              <button onClick={() => navigate(`/logs?actor_id=${selectedUser.employee_id}`)} style={{
                width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 500,
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#1a1a1a',
              }}>View Activity Log</button>
              {isAdmin && selectedUser.employee_id !== user.employee_id && (
                <button onClick={() => handleDeactivate(selectedUser)} style={{
                  width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 500,
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#dc2626',
                }}>Deactivate User</button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {(showCreate || editUser) && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 480, maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              {editUser ? 'Edit User' : 'Create User'}
            </h3>
            <form onSubmit={editUser ? handleUpdate : handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input required={!editUser} value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input required={!editUser} value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Email</label>
                <input type="email" required={!editUser} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              </div>
              {!editUser && (
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Enter password" style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={handleGeneratePassword} style={{
                      padding: '0 10px', fontSize: 11, background: '#f1f5f9', border: '1px solid #d1d5db',
                      borderRadius: 6, cursor: 'pointer', color: '#475569', whiteSpace: 'nowrap',
                    }}>Generate</button>
                    {form.password && (
                      <button type="button" onClick={handleCopyPassword} style={{
                        padding: '0 10px', fontSize: 11, background: copiedPass ? '#f0fdf4' : '#f1f5f9',
                        border: `1px solid ${copiedPass ? '#bbf7d0' : '#d1d5db'}`,
                        borderRadius: 6, cursor: 'pointer', color: copiedPass ? '#16a34a' : '#475569', whiteSpace: 'nowrap',
                      }}>{copiedPass ? 'Copied!' : 'Copy'}</button>
                    )}
                  </div>
                </div>
              )}
              {editUser && isAdmin && (
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Change Password</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={handleGeneratePassword} style={{
                      padding: '0 10px', fontSize: 11, background: '#f1f5f9', border: '1px solid #d1d5db',
                      borderRadius: 6, cursor: 'pointer', color: '#475569', whiteSpace: 'nowrap',
                    }}>Generate</button>
                    {newPassword && (
                      <button type="button" onClick={handleCopyPassword} style={{
                        padding: '0 10px', fontSize: 11, background: copiedPass ? '#f0fdf4' : '#f1f5f9',
                        border: `1px solid ${copiedPass ? '#bbf7d0' : '#d1d5db'}`,
                        borderRadius: 6, cursor: 'pointer', color: copiedPass ? '#16a34a' : '#475569', whiteSpace: 'nowrap',
                      }}>{copiedPass ? 'Copied!' : 'Copy'}</button>
                    )}
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={inputStyle}>
                    {allowedRoles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={inputStyle}
                    list="dept-list" />
                  <datalist id="dept-list">{departments.map(d => <option key={d} value={d} />)}</datalist>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Team</label>
                  <select value={form.team_id} onChange={e => setForm({ ...form, team_id: e.target.value })} style={inputStyle}>
                    <option value="">No team</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Job Title</label>
                  <select value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} style={inputStyle}>
                    <option value="">No job title</option>
                    {employeeRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={resetForm} style={{
                  padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0',
                  borderRadius: 6, fontSize: 13, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{
                  padding: '8px 16px', background: '#F26522', color: 'white', border: 'none',
                  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}>{submitting ? 'Saving...' : (editUser ? 'Save Changes' : 'Create User')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {dialog && (
        <ConfirmDialog
          isOpen={true}
          title={dialog.title}
          message={dialog.message}
          confirmText={dialog.confirmText}
          variant={dialog.variant}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}

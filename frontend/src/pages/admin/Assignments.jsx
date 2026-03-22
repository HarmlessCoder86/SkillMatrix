import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function Assignments() {
  const [assignments, setAssignments] = useState([])
  const [employees, setEmployees] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({ employee_id: '', supervisor_id: '', is_primary: false })

  const load = async () => {
    try {
      const [a, e, s] = await Promise.all([api.getAssignments(), api.getEmployees(), api.getEmployees(null, true)])
      setAssignments(a)
      setEmployees(e)
      setSupervisors(s)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createAssignment({
        employee_id: Number(form.employee_id),
        supervisor_id: Number(form.supervisor_id),
        is_primary: form.is_primary,
      })
      setShowCreate(false)
      setForm({ employee_id: '', supervisor_id: '', is_primary: false })
      setError(null)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.deleteAssignment(deleteTarget.id)
      setDeleteTarget(null)
      setError(null)
      await load()
    } catch (e) { setError(e.message) }
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 13, boxSizing: 'border-box',
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>

  // Group by employee
  const byEmployee = {}
  assignments.forEach((a) => {
    if (!byEmployee[a.employee_id]) byEmployee[a.employee_id] = { name: a.employee_name, role: a.employee_role, dept: a.department, supervisors: [] }
    byEmployee[a.employee_id].supervisors.push(a)
  })

  // Find unassigned employees
  const assignedIds = new Set(assignments.map((a) => a.employee_id))
  const unassigned = employees.filter((e) => !assignedIds.has(e.id))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Reporting Assignments</h2>
        <button onClick={() => setShowCreate(true)} style={{
          padding: '8px 16px', background: '#F26522', color: 'white', border: 'none',
          borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Add Assignment</button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {error} <button onClick={() => setError(null)} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>Dismiss</button>
        </div>
      )}

      {/* Warning: unassigned employees */}
      {unassigned.length > 0 && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20, fontSize: 13,
        }}>
          <strong style={{ color: '#92400e' }}>{unassigned.length} employees have no supervisor assigned:</strong>
          <div style={{ color: '#78350f', marginTop: 4 }}>
            {unassigned.map((e) => `${e.first_name} ${e.last_name}`).join(', ')}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 400 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Add Reporting Assignment</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Employee</label>
                <select required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} style={inputStyle}>
                  <option value="">Select employee...</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.role || 'No role'})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Reports To</label>
                <select required value={form.supervisor_id} onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })} style={inputStyle}>
                  <option value="">Select supervisor...</option>
                  {supervisors.filter((e) => String(e.id) !== form.employee_id).map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.role || 'No role'})</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} />
                Primary supervisor
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCreate(false)} disabled={saving} style={{
                  padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0',
                  borderRadius: 6, fontSize: 13, cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" disabled={saving} style={{
                  padding: '8px 16px', background: saving ? '#94a3b8' : '#F26522', color: 'white', border: 'none',
                  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
                }}>{saving ? 'Saving...' : 'Add Assignment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remove Assignment"
        message={deleteTarget ? `Remove ${deleteTarget.empName} from ${deleteTarget.supName}'s reporting chain?` : ''}
        confirmText="Remove"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Assignment Table */}
      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Employee</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Role</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Reports To</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Type</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{a.employee_name}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{a.employee_role || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{a.supervisor_name}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11,
                    background: a.is_primary ? '#FFF3EB' : '#f8fafc',
                    color: a.is_primary ? '#C85413' : '#64748b',
                  }}>
                    {a.is_primary ? 'Primary' : 'Secondary'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <button onClick={() => setDeleteTarget({ id: a.id, empName: a.employee_name, supName: a.supervisor_name })} style={{
                    padding: '4px 8px', fontSize: 12, background: '#fef2f2', color: '#dc2626',
                    border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer',
                  }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assignments.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No assignments found</div>
        )}
      </div>
    </div>
  )
}

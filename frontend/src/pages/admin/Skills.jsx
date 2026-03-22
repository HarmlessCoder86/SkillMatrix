import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function Skills() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [skills, setSkills] = useState([])
  const [skillReqs, setSkillReqs] = useState({})
  const [roleReqs, setRoleReqs] = useState([])
  const [employeeRoles, setEmployeeRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editSkill, setEditSkill] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', category_id: '', job_role_id: '', retrain_days: '', sort_order: 0, requires_cert: false })

  // Role modal state
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editRole, setEditRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', department: '', description: '' })

  // Expanded skill for requirements
  const [expanded, setExpanded] = useState(null)

  // Delete dialog
  const [dialog, setDialog] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [cats, sk, sr, rr, er, depts] = await Promise.all([
        api.getCategories(),
        api.getSkills(),
        api.getSkillRequirements(),
        api.getRoleRequirements(),
        api.getEmployeeRoles(),
        api.getDepartments(),
      ])
      setCategories(cats)
      setSkills(sk)
      // Index skill requirements by skill_id
      const srMap = {}
      sr.forEach((r) => { srMap[r.skill_id] = r })
      setSkillReqs(srMap)
      setRoleReqs(rr)
      setEmployeeRoles(er)
      setDepartments(depts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const flash = (msg) => {
    setSuccess(msg)
    setError(null)
    setTimeout(() => setSuccess(null), 3000)
  }

  // ── Skill CRUD ──────────────────────────────────────────────

  const openCreate = (categoryId) => {
    setEditSkill(null)
    setForm({ name: '', description: '', category_id: categoryId || '', job_role_id: '', retrain_days: '', sort_order: 0, requires_cert: false })
    setShowModal(true)
  }

  const openEdit = (skill) => {
    setEditSkill(skill)
    // Reverse-lookup: if skill has a parent, find matching employee role by name
    let jobRoleId = ''
    if (skill.parent_skill_id) {
      const parentSkill = skills.find((s) => s.id === skill.parent_skill_id)
      if (parentSkill) {
        const matchingRole = employeeRoles.find((r) => r.name === parentSkill.name)
        if (matchingRole) jobRoleId = matchingRole.id
      }
    }
    setForm({
      name: skill.name,
      description: skill.description || '',
      category_id: skill.category_id,
      job_role_id: jobRoleId,
      retrain_days: skill.retrain_days || '',
      sort_order: skill.sort_order || 0,
      requires_cert: skill.requires_cert || false,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    try {
      setError(null)
      const categoryId = Number(form.category_id)

      // Resolve job role → parent_skill_id
      let parentSkillId = null
      if (form.job_role_id) {
        const role = employeeRoles.find((r) => r.id === Number(form.job_role_id))
        if (role) {
          // Check if a parent skill with this role name already exists in the category
          const existing = skills.find((s) => s.name === role.name && s.category_id === categoryId && s.parent_skill_id == null)
          if (existing) {
            parentSkillId = existing.id
          } else {
            // Auto-create a parent skill group with the role name
            const created = await api.createSkill({ name: role.name, category_id: categoryId, parent_skill_id: null, sort_order: 0 })
            parentSkillId = created.id
          }
        }
      }

      const data = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: categoryId,
        parent_skill_id: parentSkillId,
        retrain_days: form.retrain_days ? Number(form.retrain_days) : null,
        sort_order: Number(form.sort_order) || 0,
        requires_cert: form.requires_cert,
      }
      if (editSkill) {
        await api.updateSkill(editSkill.id, data)
        flash(`Skill "${data.name}" updated`)
      } else {
        await api.createSkill(data)
        flash(`Skill "${data.name}" created`)
      }
      setShowModal(false)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = (skill) => {
    setDialog({
      title: 'Delete Skill',
      message: `Are you sure you want to delete "${skill.name}"? This will remove all associated assessments.`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.deleteSkill(skill.id)
          setDialog(null)
          flash(`Skill "${skill.name}" deleted`)
          await loadData()
        } catch (err) {
          setDialog(null)
          setError(err.message)
        }
      },
    })
  }

  // ── Role CRUD ───────────────────────────────────────────────

  const openCreateRole = () => {
    setEditRole(null)
    setRoleForm({ name: '', department: '', description: '' })
    setShowRoleModal(true)
  }

  const openEditRole = (role) => {
    setEditRole(role)
    setRoleForm({ name: role.name, department: role.department || '', description: role.description || '' })
    setShowRoleModal(true)
  }

  const handleSaveRole = async () => {
    try {
      setError(null)
      const data = { name: roleForm.name.trim(), department: roleForm.department || null, description: roleForm.description.trim() || null }
      if (editRole) {
        await api.updateEmployeeRole(editRole.id, data)
        flash(`Role "${data.name}" updated`)
      } else {
        await api.createEmployeeRole(data)
        flash(`Role "${data.name}" created`)
      }
      setShowRoleModal(false)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDeleteRole = (role) => {
    setDialog({
      title: 'Delete Role',
      message: `Delete role "${role.name}"? ${role.employee_count > 0 ? `${role.employee_count} employee(s) currently have this role.` : ''}`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await api.deleteEmployeeRole(role.id)
          setDialog(null)
          flash(`Role "${role.name}" deleted`)
          await loadData()
        } catch (err) {
          setDialog(null)
          setError(err.message)
        }
      },
    })
  }

  // ── Staffing requirements ───────────────────────────────────

  const handleStaffingChange = async (skillId, field, value) => {
    try {
      const current = skillReqs[skillId] || {}
      const data = {
        level_3_required: current.level_3_required || 0,
        level_4_required: current.level_4_required || 0,
        [field]: Number(value) || 0,
      }
      await api.updateSkillRequirements(skillId, data)
      setSkillReqs((prev) => ({ ...prev, [skillId]: { ...prev[skillId], skill_id: skillId, ...data } }))
    } catch (err) {
      setError(err.message)
    }
  }

  // ── Role requirements ───────────────────────────────────────

  const getRoleReq = (skillId, role) => {
    return roleReqs.find((r) => r.skill_id === skillId && r.role_name === role)
  }

  const handleRoleReqChange = async (skillId, role, level) => {
    try {
      if (level === 0 || level === '') {
        const existing = getRoleReq(skillId, role)
        if (existing) {
          await api.deleteRoleRequirement(existing.id)
        }
      } else {
        await api.updateRoleRequirement({ skill_id: skillId, role_name: role, required_level: Number(level) })
      }
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  // Group skills by category
  const grouped = categories.map((cat) => ({
    ...cat,
    skills: skills.filter((s) => s.category_id === cat.id),
  }))

  const inputStyle = {
    width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 6,
    border: '1px solid #d1d5db', boxSizing: 'border-box',
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Skills Management</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {skills.length} skills across {categories.length} categories
          </p>
        </div>
        <button
          onClick={() => openCreate(categories[0]?.id)}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            background: '#C85413', color: 'white', border: 'none',
            borderRadius: 8, cursor: 'pointer',
          }}
        >
          + Add Skill
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', color: '#991b1b', fontSize: 13, borderRadius: 8, marginBottom: 16, border: '1px solid #fecaca' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', textDecoration: 'underline' }}>Dismiss</button>
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 16px', background: '#f0fdf4', color: '#166534', fontSize: 13, borderRadius: 8, marginBottom: 16, border: '1px solid #bbf7d0' }}>
          {success}
        </div>
      )}

      {/* ═══ Employee Roles Section ═══ */}
      <div style={{ marginBottom: 24, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px', background: '#1a1a1a', borderBottom: '1px solid #333',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'white' }}>Employee Roles</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
              Job titles used for skill requirements mapping
            </p>
          </div>
          <button
            onClick={openCreateRole}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 600,
              background: '#F26522', color: 'white', border: 'none',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            + Add Role
          </button>
        </div>

        {employeeRoles.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No employee roles defined yet. Add roles like "CNC Operator", "Bender", etc.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
            {employeeRoles.map((role) => (
              <div key={role.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 20px', borderBottom: '1px solid #f1f5f9', width: '100%',
                boxSizing: 'border-box',
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{role.name}</span>
                  {role.department && (
                    <span style={{
                      padding: '1px 8px', fontSize: 11, fontWeight: 500, borderRadius: 10,
                      background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                      marginLeft: 8,
                    }}>
                      {role.department}
                    </span>
                  )}
                  {role.description && (
                    <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 12 }}>{role.description}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    padding: '2px 8px', fontSize: 11, fontWeight: 500, borderRadius: 10,
                    background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0',
                  }}>
                    {role.employee_count} {role.employee_count === 1 ? 'employee' : 'employees'}
                  </span>
                  <button onClick={() => openEditRole(role)} style={{
                    padding: '4px 10px', fontSize: 12, background: 'white', color: '#475569',
                    border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer',
                  }}>Edit</button>
                  <button onClick={() => handleDeleteRole(role)} style={{
                    padding: '4px 10px', fontSize: 12, background: '#fef2f2', color: '#991b1b',
                    border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer',
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Skills grouped by category ═══ */}
      {grouped.map((cat) => (
        <div key={cat.id} style={{ marginBottom: 24, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Category header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#334155' }}>{cat.name}</h2>
            <button
              onClick={() => openCreate(cat.id)}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 500,
                background: 'white', color: '#475569', border: '1px solid #d1d5db',
                borderRadius: 6, cursor: 'pointer',
              }}
            >
              + Add
            </button>
          </div>

          {/* Skills list */}
          {cat.skills.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No skills in this category
            </div>
          ) : (
            cat.skills.map((skill) => (
              <div key={skill.id}>
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '10px 20px',
                  borderBottom: '1px solid #f1f5f9', gap: 12,
                }}>
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(expanded === skill.id ? null : skill.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94a3b8',
                      width: 20, textAlign: 'center',
                    }}
                  >
                    {expanded === skill.id ? '▼' : '▶'}
                  </button>

                  {/* Skill info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{skill.name}</div>
                    {skill.description && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{skill.description}</div>
                    )}
                  </div>

                  {/* CERT badge */}
                  {skill.requires_cert && (
                    <span style={{
                      padding: '2px 8px', fontSize: 11, fontWeight: 600, borderRadius: 10,
                      background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
                    }}>
                      CERT
                    </span>
                  )}

                  {/* Retrain badge */}
                  {skill.retrain_days && (
                    <span style={{
                      padding: '2px 8px', fontSize: 11, fontWeight: 500, borderRadius: 10,
                      background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                    }}>
                      {skill.retrain_days}d retrain
                    </span>
                  )}

                  {/* Staffing badges */}
                  {skillReqs[skill.id] && (skillReqs[skill.id].level_3_required > 0 || skillReqs[skill.id].level_4_required > 0) && (
                    <span style={{
                      padding: '2px 8px', fontSize: 11, fontWeight: 500, borderRadius: 10,
                      background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0',
                    }}>
                      L3: {skillReqs[skill.id].level_3_required || 0} / L4: {skillReqs[skill.id].level_4_required || 0}
                    </span>
                  )}

                  {/* Actions */}
                  <button onClick={() => openEdit(skill)} style={{
                    padding: '4px 10px', fontSize: 12, background: 'white', color: '#475569',
                    border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer',
                  }}>Edit</button>
                  <button onClick={() => handleDelete(skill)} style={{
                    padding: '4px 10px', fontSize: 12, background: '#fef2f2', color: '#991b1b',
                    border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer',
                  }}>Delete</button>
                </div>

                {/* Expanded requirements */}
                {expanded === skill.id && (
                  <div style={{ padding: '12px 20px 16px 52px', background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
                    {/* Staffing requirements */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                        Staffing Requirements
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
                          Level 3+ needed:
                          <input
                            type="number" min="0" max="99"
                            value={skillReqs[skill.id]?.level_3_required || 0}
                            onChange={(e) => handleStaffingChange(skill.id, 'level_3_required', e.target.value)}
                            style={{
                              width: 50, padding: '4px 8px', fontSize: 13, borderRadius: 4,
                              border: '1px solid #d1d5db', textAlign: 'center',
                            }}
                          />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
                          Level 4 needed:
                          <input
                            type="number" min="0" max="99"
                            value={skillReqs[skill.id]?.level_4_required || 0}
                            onChange={(e) => handleStaffingChange(skill.id, 'level_4_required', e.target.value)}
                            style={{
                              width: 50, padding: '4px 8px', fontSize: 13, borderRadius: 4,
                              border: '1px solid #d1d5db', textAlign: 'center',
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Role requirements */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                        Role Requirements (minimum level per role)
                      </div>
                      {(() => {
                        const categoryDept = categories.find(c => c.id === skill.category_id)?.department
                        const relevantRoles = categoryDept
                          ? employeeRoles.filter(r => r.department === categoryDept || !r.department)
                          : employeeRoles
                        return relevantRoles.length === 0 ? (
                        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                          {employeeRoles.length === 0
                            ? 'No employee roles defined. Add roles above to set requirements.'
                            : `No roles assigned to ${categoryDept || 'this'} department.`}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {relevantRoles.map((role) => {
                            const req = getRoleReq(skill.id, role.name)
                            return (
                              <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
                                <span style={{ minWidth: 90 }}>{role.name}:</span>
                                <select
                                  value={req?.required_level || 0}
                                  onChange={(e) => handleRoleReqChange(skill.id, role.name, e.target.value)}
                                  style={{
                                    padding: '4px 8px', fontSize: 13, borderRadius: 4,
                                    border: '1px solid #d1d5db',
                                  }}
                                >
                                  <option value={0}>None</option>
                                  <option value={1}>L1</option>
                                  <option value={2}>L2</option>
                                  <option value={3}>L3</option>
                                  <option value={4}>L4</option>
                                </select>
                              </label>
                            )
                          })}
                        </div>
                      )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ))}

      {/* ═══ Create/Edit Skill Modal ═══ */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{
            background: 'white', borderRadius: 12, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            maxWidth: 480, width: '100%', margin: '0 16px', padding: 24,
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
              {editSkill ? 'Edit Skill' : 'Add Skill'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Category *</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Job (optional)</label>
                <select
                  value={form.job_role_id}
                  onChange={(e) => setForm({ ...form, job_role_id: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">None (top-level)</option>
                  {(() => {
                    const categoryDept = categories.find(c => c.id === Number(form.category_id))?.department
                    const relevantRoles = categoryDept
                      ? employeeRoles.filter(r => r.department === categoryDept || !r.department)
                      : employeeRoles
                    return relevantRoles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))
                  })()}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Retrain Interval (days)
                  </label>
                  <input
                    type="number" min="0"
                    value={form.retrain_days}
                    onChange={(e) => setForm({ ...form, retrain_days: e.target.value })}
                    placeholder="e.g. 90"
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    Leave empty for no retrain requirement
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.requires_cert}
                  onChange={(e) => setForm({ ...form, requires_cert: e.target.checked })}
                />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Requires Certification</span>
                <span style={{
                  fontSize: 9, background: '#fef3c7', color: '#92400e',
                  padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                }}>
                  CERT
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px', fontSize: 13, borderRadius: 6,
                  border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.category_id}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                  border: 'none', background: form.name.trim() && form.category_id ? '#C85413' : '#94a3b8',
                  color: 'white', cursor: form.name.trim() && form.category_id ? 'pointer' : 'default',
                }}
              >{editSkill ? 'Save Changes' : 'Create Skill'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Create/Edit Role Modal ═══ */}
      {showRoleModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{
            background: 'white', borderRadius: 12, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            maxWidth: 420, width: '100%', margin: '0 16px', padding: 24,
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>
              {editRole ? 'Edit Role' : 'Add Employee Role'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Role Name *</label>
                <input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g. CNC Operator"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Department *</label>
                <select
                  value={roleForm.department}
                  onChange={(e) => setRoleForm({ ...roleForm, department: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#475569', display: 'block', marginBottom: 4 }}>Description</label>
                <input
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="Optional description"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setShowRoleModal(false)}
                style={{
                  padding: '8px 16px', fontSize: 13, borderRadius: 6,
                  border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleSaveRole}
                disabled={!roleForm.name.trim()}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                  border: 'none', background: roleForm.name.trim() ? '#C85413' : '#94a3b8',
                  color: 'white', cursor: roleForm.name.trim() ? 'pointer' : 'default',
                }}
              >{editRole ? 'Save Changes' : 'Create Role'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {dialog && (
        <ConfirmDialog
          isOpen={true}
          title={dialog.title}
          message={dialog.message}
          confirmText={dialog.confirmText}
          variant="danger"
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}

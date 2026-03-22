import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth, canAccess } from '../lib/auth'
import MatrixGrid from '../components/MatrixGrid'
import Legend from '../components/Legend'
import DetailPanel from '../components/DetailPanel'
import ConfirmDialog from '../components/ConfirmDialog'

export default function MatrixView() {
  const { user } = useAuth()

  // Data state
  const [categories, setCategories] = useState([])
  const [skills, setSkills] = useState([])
  const [employees, setEmployees] = useState([])
  const [assessments, setAssessments] = useState({})
  const [requirements, setRequirements] = useState({})
  const [staffing, setStaffing] = useState({})

  // UI state
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [selectedRole, setSelectedRole] = useState(null)
  const [employeeRoles, setEmployeeRoles] = useState([])
  const [showGaps, setShowGaps] = useState(true)
  const [selectedCell, setSelectedCell] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmQueue, setConfirmQueue] = useState([])
  const [showQueue, setShowQueue] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [dataVersion, setDataVersion] = useState(0)

  // Auto-scope department for non-admin roles
  const isScoped = user && ['operator', 'lead', 'trainer', 'supervisor', 'manager'].includes(user.role)
  const showStaffing = canAccess(user?.role, 'confirm') // supervisor+

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const deptFilter = isScoped ? user.department : selectedDepartment
      const [cats, matrix, roles] = await Promise.all([
        api.getCategories(),
        api.getMatrix({ category_id: selectedCategory, department: deptFilter }),
        api.getEmployeeRoles(),
      ])
      setCategories(cats)
      setEmployeeRoles(roles)
      setSkills(matrix.skills)
      setEmployees(matrix.employees)
      setAssessments(matrix.assessments)
      setRequirements(matrix.requirements)
      setStaffing(matrix.staffing || {})
      setDataVersion((v) => v + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, selectedDepartment, isScoped, user])

  useEffect(() => { loadData() }, [loadData])

  // Load all departments for the filter dropdown (only for admin)
  useEffect(() => {
    if (user?.role !== 'admin') return
    api.getMatrix({}).then((m) => {
      const depts = [...new Set(m.employees.map((e) => e.department).filter(Boolean))].sort()
      setAllDepartments(depts)
    }).catch(() => {})
  }, [user])

  // Load confirmation queue
  const loadQueue = useCallback(async () => {
    if (!canAccess(user?.role, 'confirm')) return
    try {
      const queue = await api.getConfirmationQueue()
      setConfirmQueue(queue)
    } catch { /* silently fail */ }
  }, [user])

  useEffect(() => { loadQueue() }, [loadQueue])

  // Handlers
  const handleUpdateLevel = async (employeeId, skillId, level) => {
    try {
      await api.updateAssessment(employeeId, skillId, { level })
      await loadData()
      await loadQueue()
      setSelectedCell(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleConfirm = async (assessmentId) => {
    try {
      await api.confirmAssessment(assessmentId)
      await loadData()
      await loadQueue()
    } catch (err) { setError(err.message) }
  }

  const handleReject = async (assessmentId) => {
    try {
      await api.rejectAssessment(assessmentId)
      await loadData()
      await loadQueue()
    } catch (err) { setError(err.message) }
  }

  // Find objects for detail panel
  const selectedEmployee = selectedCell ? employees.find((e) => e.id === selectedCell.emp) : null
  const selectedSkill = selectedCell ? skills.find((s) => s.id === selectedCell.skill) : null
  const selectedAssessment = selectedCell ? assessments[`${selectedCell.emp}_${selectedCell.skill}`] : null
  const selectedRequirement = selectedCell && selectedEmployee
    ? requirements[`${selectedEmployee.role}_${selectedCell.skill}`] ?? null
    : null

  const [allDepartments, setAllDepartments] = useState([])

  const catName = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)?.name
    : null

  return (
    <>
      {/* Toolbar */}
      <div style={{
        background: '#1a1a1a', color: 'white', padding: '8px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        borderTop: '1px solid #333333',
      }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          Training Matrix{catName ? ` — ${catName}` : ''}
        </span>

        <select
          value={selectedCategory ?? ''}
          onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
          style={{
            background: '#333333', color: 'white', border: '1px solid #444444',
            borderRadius: 6, padding: '5px 10px', fontSize: 13,
          }}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {user?.role === 'admin' && (
          <select
            value={selectedDepartment ?? ''}
            onChange={(e) => setSelectedDepartment(e.target.value || null)}
            style={{
              background: '#333333', color: 'white', border: '1px solid #444444',
              borderRadius: 6, padding: '5px 10px', fontSize: 13,
            }}
          >
            <option value="">All Departments</option>
            {allDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        )}

        {isScoped && user.department && (
          <span style={{ fontSize: 12, color: '#94a3b8', padding: '5px 10px', background: '#333333', borderRadius: 6 }}>
            Dept: {user.department}
          </span>
        )}

        <select
          value={selectedRole ?? ''}
          onChange={(e) => setSelectedRole(e.target.value || null)}
          style={{
            background: '#333333', color: 'white', border: '1px solid #444444',
            borderRadius: 6, padding: '5px 10px', fontSize: 13,
          }}
        >
          <option value="">All Roles</option>
          {employeeRoles
            .filter((r) => !selectedDepartment || r.department === selectedDepartment || !r.department)
            .map((r) => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
        </select>

        <label style={{ fontSize: 13, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showGaps} onChange={(e) => setShowGaps(e.target.checked)} />
          Show gap indicators
        </label>

        {confirmQueue.length > 0 && (
          <button
            onClick={() => setShowQueue(!showQueue)}
            style={{
              padding: '5px 12px', fontSize: 13,
              background: '#f59e0b', color: '#1a1a1a', border: 'none',
              borderRadius: 6, cursor: 'pointer', fontWeight: 600,
            }}
          >
            Pending ({confirmQueue.length})
          </button>
        )}

        <button
          onClick={async () => {
            try {
              const blob = await api.exportMatrix({
                department: isScoped ? user.department : selectedDepartment,
                category_id: selectedCategory,
              })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'skill-matrix-export.csv'
              a.click()
              URL.revokeObjectURL(url)
            } catch (err) { setError(err.message) }
          }}
          style={{
            padding: '5px 12px', fontSize: 13,
            background: '#333333', color: '#e2e8f0', border: '1px solid #444444',
            borderRadius: 6, cursor: 'pointer', marginLeft: 'auto',
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Legend */}
      <Legend />

      {/* Error banner */}
      {error && (
        <div style={{ padding: '8px 24px', background: '#fef2f2', color: '#991b1b', fontSize: 13, borderBottom: '1px solid #fecaca' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Matrix */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: '#94a3b8' }}>
          Loading...
        </div>
      ) : (
        <MatrixGrid
          key={dataVersion}
          skills={skills}
          employees={selectedRole ? employees.filter((e) => e.role === selectedRole) : employees}
          assessments={assessments}
          requirements={requirements}
          staffing={staffing}
          categories={categories}
          showGaps={showGaps}
          showStaffing={showStaffing}
          selectedCell={selectedCell}
          onCellClick={setSelectedCell}
        />
      )}

      {/* Detail panel */}
      {selectedCell && selectedEmployee && selectedSkill && (
        <DetailPanel
          employee={selectedEmployee}
          skill={selectedSkill}
          assessment={selectedAssessment}
          requirement={selectedRequirement}
          onClose={() => setSelectedCell(null)}
          onUpdate={handleUpdateLevel}
        />
      )}

      {/* Confirmation queue panel */}
      {showQueue && (
        <div style={{
          position: 'fixed', inset: '0 0 0 auto', width: 384,
          background: 'white', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          zIndex: 50, borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#92400e' }}>Pending Confirmations</h3>
            <button onClick={() => setShowQueue(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#92400e' }}>&#x2715;</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {confirmQueue.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No pending confirmations.
              </div>
            ) : (
              confirmQueue.map((item) => (
                <div key={item.id} style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{item.employee_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.skill_name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    {item.previous_level != null ? `Level ${item.previous_level} \u2192 Level ${item.level}` : `Set to Level ${item.level}`}
                    {item.assessed_by_name && ` by ${item.assessed_by_name}`}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => handleConfirm(item.id)} style={{ padding: '4px 12px', fontSize: 12, background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                      Confirm
                    </button>
                    <button onClick={() => handleReject(item.id)} style={{ padding: '4px 12px', fontSize: 12, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {dialog && (
        <ConfirmDialog
          isOpen={true}
          title={dialog.title}
          message={dialog.message}
          confirmText={dialog.confirmText}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </>
  )
}

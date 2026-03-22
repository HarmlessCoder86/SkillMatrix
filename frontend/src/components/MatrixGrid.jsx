import { useState, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import HarveyBall from './HarveyBall'

// Role → avatar color
const ROLE_COLORS = {
  Lead: '#C85413', Manager: '#C85413',
  'Sales Manager': '#C85413', 'CS Manager': '#C85413',
  'Engineering Manager': '#C85413', 'HR Director': '#C85413',
  'Finance Director': '#C85413', 'Operations Manager': '#C85413',
  Technician: '#E07020', 'Design Engineer': '#E07020',
}
const DEFAULT_COLOR = '#475569'

function getInitials(emp) {
  return (emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')
}

function getRoleColor(role) {
  if (!role) return DEFAULT_COLOR
  for (const [k, v] of Object.entries(ROLE_COLORS)) {
    if (role.includes(k)) return v
  }
  return DEFAULT_COLOR
}

// Build tree from flat skills list
function buildTree(skills, categories) {
  if (!skills?.length || !categories?.length) return []

  const byId = {}
  skills.forEach((s) => (byId[s.id] = { ...s, children: [] }))

  const roots = {}
  skills.forEach((s) => {
    if (s.parent_skill_id && byId[s.parent_skill_id]) {
      byId[s.parent_skill_id].children.push(byId[s.id])
    } else {
      if (!roots[s.category_id]) roots[s.category_id] = []
      roots[s.category_id].push(byId[s.id])
    }
  })

  Object.values(byId).forEach((n) => n.children.sort((a, b) => a.sort_order - b.sort_order))

  return categories
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cat) => ({
      ...cat,
      skills: (roots[cat.id] || []).sort((a, b) => a.sort_order - b.sort_order),
    }))
}

// Flatten tree respecting collapsed state
function flattenSkills(nodes, depth = 0) {
  const rows = []
  for (const s of nodes) {
    rows.push({ ...s, depth, hasChildren: s.children?.length > 0 })
    if (s.children?.length) {
      rows.push(...flattenSkills(s.children, depth + 1))
    }
  }
  return rows
}

// Check if a skill node is a leaf (no children)
function isLeaf(node) {
  return !node.children || node.children.length === 0
}

// Count leaves under a node
function countLeaves(node) {
  if (isLeaf(node)) return 1
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0)
}

export default function MatrixGrid({
  skills,
  employees,
  assessments,
  requirements,
  staffing,
  categories,
  showGaps,
  showStaffing = true,
  selectedCell,
  onCellClick,
}) {
  const [collapsed, setCollapsed] = useState({})

  const toggle = (id) => setCollapsed((p) => ({ ...p, [id]: !p[id] }))

  const tree = useMemo(() => buildTree(skills, categories), [skills, categories])

  const getAssessment = (empId, skillId) => assessments?.[`${empId}_${skillId}`] || null

  const getRequired = (role, skillId) => {
    if (!requirements || !role) return null
    return requirements[`${role}_${skillId}`] ?? null
  }

  // Compute employee score (sum of levels across all visible leaf skills)
  const empScores = useMemo(() => {
    const scores = {}
    if (!employees || !assessments) return scores
    employees.forEach((emp) => {
      let score = 0
      skills?.forEach((s) => {
        const a = assessments[`${emp.id}_${s.id}`]
        if (a) score += a.level
      })
      scores[emp.id] = score
    })
    return scores
  }, [employees, assessments, skills])

  if (!categories?.length) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
        Loading skills...
      </div>
    )
  }

  const emps = employees || []

  return (
    <div style={{ padding: 16, overflowX: 'auto' }}>
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 280 + emps.length * 80 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{
                  position: 'sticky', left: 0, zIndex: 20, background: '#f8fafc',
                  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderRight: '1px solid #e2e8f0', minWidth: 260,
                }}>
                  Operations / Skills
                </th>
                {emps.map((emp) => (
                  <th key={emp.id} style={{
                    padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #e2e8f0',
                    minWidth: 76, verticalAlign: 'top',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <Link to={`/employee/${emp.id}`} style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: getRoleColor(emp.role), color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, textDecoration: 'none', cursor: 'pointer',
                      }} title={`${emp.first_name} ${emp.last_name} — View Profile`}>
                        {getInitials(emp)}
                      </Link>
                      <Link to={`/employee/${emp.id}`} style={{ fontSize: 11, fontWeight: 600, color: '#334155', lineHeight: 1.2, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
                        title={`${emp.first_name} ${emp.last_name} — View Profile`}>
                        {emp.first_name}
                      </Link>
                      <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 70, lineHeight: '14px' }}>{emp.role}</span>
                      <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                        Score: {empScores[emp.id] || 0}
                      </span>
                    </div>
                  </th>
                ))}
                {showStaffing && (
                  <th style={{ padding: '8px 12px', textAlign: 'center', minWidth: 140, fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                    Staffing Coverage
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {tree.map((cat) => {
                const catCollapsed = collapsed[`cat-${cat.id}`]
                const flatSkills = flattenSkills(cat.skills)

                return (
                  <Fragment key={cat.id}>
                    {/* Category header */}
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <td
                        onClick={() => toggle(`cat-${cat.id}`)}
                        style={{
                          position: 'sticky', left: 0, zIndex: 10, background: '#f1f5f9',
                          padding: '8px 16px', cursor: 'pointer', userSelect: 'none',
                          borderRight: '1px solid #e2e8f0',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#334155' }}>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{catCollapsed ? '▶' : '▼'}</span>
                          {cat.name}
                        </span>
                      </td>
                      {emps.map((emp) => (
                        <td key={emp.id} style={{ padding: '8px 4px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>—</span>
                        </td>
                      ))}
                      {showStaffing && <td style={{ padding: '8px 12px', textAlign: 'center' }} />}
                    </tr>

                    {/* Skill rows */}
                    {!catCollapsed && flatSkills.map((skill) => {
                      // If parent is collapsed, hide children
                      if (skill.depth > 0) {
                        // Check if any ancestor is collapsed
                        let parent = flatSkills.find((s) => s.id === skill.parent_skill_id)
                        while (parent) {
                          if (collapsed[parent.id]) return null
                          parent = flatSkills.find((s) => s.id === parent.parent_skill_id)
                        }
                      }

                      const leaf = isLeaf(skill)
                      const staffReq = staffing?.[String(skill.id)]

                      // Compute staffing actuals
                      let l3actual = 0, l4actual = 0
                      if (staffReq && emps.length) {
                        emps.forEach((emp) => {
                          const a = getAssessment(emp.id, skill.id)
                          const lvl = a?.level || 0
                          if (lvl >= 3) l3actual++
                          if (lvl >= 4) l4actual++
                        })
                      }

                      return (
                        <tr
                          key={skill.id}
                          style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF8F3')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                        >
                          <td style={{
                            position: 'sticky', left: 0, zIndex: 10, background: 'inherit',
                            padding: '6px 16px', borderRight: '1px solid #e2e8f0',
                          }}>
                            <div style={{
                              paddingLeft: skill.depth * 20 + (skill.hasChildren ? 0 : 20),
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              {skill.hasChildren && (
                                <span
                                  onClick={() => toggle(skill.id)}
                                  style={{ cursor: 'pointer', fontSize: 9, color: '#94a3b8', width: 16 }}
                                >
                                  {collapsed[skill.id] ? '▶' : '▼'}
                                </span>
                              )}
                              <span style={{
                                fontSize: 13,
                                color: skill.hasChildren ? '#334155' : '#475569',
                                fontWeight: skill.hasChildren ? 600 : 400,
                              }}>
                                {skill.name}
                              </span>
                              {skill.requires_cert && (
                                <span style={{
                                  fontSize: 9, background: '#fef3c7', color: '#92400e',
                                  padding: '1px 5px', borderRadius: 4, marginLeft: 6, fontWeight: 600,
                                }}>
                                  CERT
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Employee cells */}
                          {emps.map((emp) => {
                            if (!leaf) {
                              return (
                                <td key={emp.id} style={{ padding: '6px 4px', textAlign: 'center', borderRight: '1px solid #f1f5f9' }}>
                                  <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
                                </td>
                              )
                            }
                            const assessment = getAssessment(emp.id, skill.id)
                            const level = assessment?.level ?? 0
                            const req = showGaps ? getRequired(emp.role, skill.id) : undefined
                            const isSel = selectedCell?.emp === emp.id && selectedCell?.skill === skill.id

                            return (
                              <td
                                key={emp.id}
                                onClick={() => onCellClick?.({ emp: emp.id, skill: skill.id })}
                                style={{
                                  padding: '6px 4px', textAlign: 'center',
                                  borderRight: '1px solid #f1f5f9', cursor: 'pointer',
                                  background: isSel ? '#FFF3EB' : 'inherit',
                                  transition: 'background 0.1s',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <HarveyBall
                                    level={level}
                                    required={req}
                                    isOverdue={assessment?.is_overdue}
                                    isUnconfirmed={assessment?.is_confirmed === false && level > 0}
                                    isSelected={isSel}
                                    size={26}
                                  />
                                </div>
                              </td>
                            )
                          })}

                          {/* Staffing coverage */}
                          {showStaffing && (
                            <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11 }}>
                              {staffReq ? (
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                  <span style={{ color: l3actual >= staffReq.level_3_required ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                                    L3+: {l3actual}/{staffReq.level_3_required}
                                  </span>
                                  <span style={{ color: l4actual >= staffReq.level_4_required ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                                    L4: {l4actual}/{staffReq.level_4_required}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}

                    {/* Level distribution summary row */}
                    {!catCollapsed && emps.length > 0 && (
                      <tr style={{ background: '#fafbfc', borderBottom: '2px solid #e2e8f0' }}>
                        <td style={{
                          position: 'sticky', left: 0, zIndex: 10, background: '#fafbfc',
                          padding: '4px 16px', borderRight: '1px solid #e2e8f0',
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 20 }}>
                            Level Distribution
                          </span>
                        </td>
                        {emps.map((emp) => {
                          // Count leaves and sum levels for this category
                          let leafCount = 0
                          let levelSum = 0
                          const countCatLeaves = (nodes) => {
                            for (const n of nodes) {
                              if (isLeaf(n)) {
                                leafCount++
                                const a = getAssessment(emp.id, n.id)
                                levelSum += a?.level || 0
                              } else if (n.children) {
                                countCatLeaves(n.children)
                              }
                            }
                          }
                          countCatLeaves(cat.skills)
                          const pct = leafCount > 0 ? Math.round((levelSum / (leafCount * 4)) * 100) : 0

                          return (
                            <td key={emp.id} style={{
                              padding: '4px 4px', textAlign: 'center', borderRight: '1px solid #f1f5f9',
                              fontSize: 10, color: '#64748b', fontWeight: 600,
                            }}>
                              {pct}%
                            </td>
                          )
                        })}
                        {showStaffing && <td />}
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty state */}
      {emps.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No employees yet</div>
          <div style={{ fontSize: 13 }}>Add employees to start tracking proficiency.</div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import HarveyBall from './HarveyBall'
import { api } from '../lib/api'
import { useAuth, canAccess } from '../lib/auth'

export default function DetailPanel({ employee, skill, assessment, requirement, onClose, onUpdate }) {
  if (!employee || !skill) return null

  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [selectedLevel, setSelectedLevel] = useState(assessment?.level ?? 0)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [overrideDate, setOverrideDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelectedLevel(assessment?.level ?? 0)
    // Fetch full detail with submissions + audit
    api.getAssessmentDetail(employee.id, skill.id)
      .then(setDetail)
      .catch(() => setDetail(null))
  }, [employee.id, skill.id, assessment?.level])

  const level = assessment?.level ?? 0
  const req = requirement
  const hasGap = req != null && level < req
  const isOverdue = assessment?.is_overdue

  const handleSave = async () => {
    if (selectedLevel !== level) {
      setSaving(true)
      try {
        await onUpdate(employee.id, skill.id, selectedLevel)
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
      background: 'white', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      zIndex: 50, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
            {employee.first_name} {employee.last_name}
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{skill.name}</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
        {/* Level picker */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
            Current Level
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2, 3, 4].map((l) => (
              <div
                key={l}
                onClick={() => setSelectedLevel(l)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  border: l === selectedLevel ? '2px solid #F26522' : '1px solid #e2e8f0',
                  background: l === selectedLevel ? '#FFF3EB' : 'white',
                }}
              >
                <HarveyBall level={l} size={28} />
                <span style={{ fontSize: 10, color: l === selectedLevel ? '#C85413' : '#94a3b8', fontWeight: 600 }}>
                  L{l}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Gap status */}
        {req != null && (
          <div style={{
            marginBottom: 20, padding: 12, borderRadius: 8,
            background: hasGap ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${hasGap ? '#fecaca' : '#bbf7d0'}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: hasGap ? '#991b1b' : '#166534' }}>
              {hasGap
                ? `⚠ Gap: Requires Level ${req}, currently Level ${level}`
                : '✓ Meets requirement'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Role: {employee.role} — Required: L{req}
            </div>
          </div>
        )}

        {/* Retrain info */}
        {skill.retrain_days && level > 0 && (
          <div style={{
            marginBottom: 20, padding: 12, borderRadius: 8,
            background: isOverdue ? '#fef2f2' : '#f8fafc',
            border: `1px solid ${isOverdue ? '#fecaca' : '#e2e8f0'}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? '#991b1b' : '#334155' }}>
              {isOverdue ? 'Retraining Overdue' : 'Retrain Schedule'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Interval: {skill.retrain_days} days</span>
              {assessment?.last_trained_date && (
                <span>Last trained: {new Date(assessment.last_trained_date).toLocaleDateString()}</span>
              )}
              {assessment?.retrain_due_date && (
                <span style={{ color: isOverdue ? '#991b1b' : '#475569', fontWeight: isOverdue ? 600 : 400 }}>
                  Due: {new Date(assessment.retrain_due_date).toLocaleDateString()}
                </span>
              )}
            </div>
            {canAccess(user?.role, 'confirm') && (
              <div style={{ marginTop: 8 }}>
                {!showDatePicker ? (
                  <button
                    onClick={() => {
                      setOverrideDate(assessment?.retrain_due_date || '')
                      setShowDatePicker(true)
                    }}
                    style={{
                      padding: '4px 10px', fontSize: 11, background: 'white',
                      border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', color: '#475569',
                    }}
                  >Override due date</button>
                ) : (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="date"
                      value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #d1d5db' }}
                    />
                    <button
                      onClick={async () => {
                        try {
                          await api.setRetrainDate(employee.id, skill.id, overrideDate)
                          setShowDatePicker(false)
                          onUpdate(employee.id, skill.id, level)
                        } catch (err) { alert(err.message || 'Failed to save date') }
                      }}
                      style={{
                        padding: '4px 10px', fontSize: 11, background: '#C85413',
                        color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer',
                      }}
                    >Save</button>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      style={{
                        padding: '4px 10px', fontSize: 11, background: 'white',
                        border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', color: '#475569',
                      }}
                    >Cancel</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Overdue status (for skills without retrain_days showing but still overdue) */}
        {isOverdue && !skill.retrain_days && (
          <div style={{ marginBottom: 20, padding: 12, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#991b1b' }}>Retraining Overdue</div>
            {assessment?.retrain_due_date && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Due: {new Date(assessment.retrain_due_date).toLocaleDateString()}
              </div>
            )}
          </div>
        )}

        {/* Unconfirmed status */}
        {assessment?.is_confirmed === false && level > 0 && (
          <div style={{ marginBottom: 20, padding: 12, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>
              ⏳ Unconfirmed — awaiting manager sign-off
            </div>
          </div>
        )}

        {/* Submissions */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
            Assessment Submissions
          </div>
          {detail?.submissions?.length > 0 ? (
            detail.submissions.map((sub, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#475569',
              }}>
                <span>{sub.submitted_by_name} ({sub.submission_type})</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  L{sub.level}
                </span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>
              No submissions yet
            </div>
          )}
        </div>

        {/* Audit history */}
        {detail?.audit?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
              Change History
            </div>
            {detail.audit.map((entry, i) => (
              <div key={i} style={{
                padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11, color: '#64748b',
              }}>
                <div>
                  {entry.changed_by_name}: L{entry.old_level ?? '—'} → L{entry.new_level}
                  <span style={{ marginLeft: 8, color: '#94a3b8' }}>
                    ({entry.change_type})
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  {new Date(entry.changed_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
        <button
          onClick={handleSave}
          disabled={selectedLevel === level || saving}
          style={{
            width: '100%', padding: '10px 16px',
            background: saving ? '#94a3b8' : selectedLevel !== level ? '#C85413' : '#94a3b8',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: (selectedLevel !== level && !saving) ? 'pointer' : 'default',
          }}
        >
          {saving ? 'Saving...' : selectedLevel !== level ? 'Save Assessment' : 'No Changes'}
        </button>
      </div>
    </div>
  )
}

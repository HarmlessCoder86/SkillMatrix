import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import HarveyBall from '../components/HarveyBall'

// -- Mock data ----------------------------------------------------------

const EMPLOYEES = [
  { name: 'Maria S.', role: 'CNC Operator', dept: 'Operations' },
  { name: 'James T.', role: 'Bender', dept: 'Operations' },
  { name: 'Anika R.', role: 'Welder', dept: 'Operations' },
  { name: 'Carlos M.', role: 'Design Engineer', dept: 'Engineering' },
  { name: 'Priya K.', role: 'Quality Tech', dept: 'Quality' },
]

const SKILLS = [
  { name: 'Lockout/Tagout', category: 'Site Safety', required: 3 },
  { name: 'Fall Protection', category: 'Site Safety', required: 2 },
  { name: 'CNC Lathe Setup', category: 'Machining', required: 3 },
  { name: 'Blueprint Reading', category: 'Core Skills', required: 2 },
  { name: 'GD&T', category: 'Core Skills', required: 3 },
  { name: 'Forklift Operation', category: 'Site Safety', required: 1 },
]

const MATRIX_DATA = [
  [4, 3, 4, 2, 3, 2],
  [3, 2, 1, 3, 2, 4],
  [2, 4, 0, 2, 1, 3],
  [3, 1, 0, 4, 4, 0],
  [4, 3, 2, 3, 2, 1],
]

const UNCONFIRMED = [[1, 3], [2, 4], [4, 1]]
const OVERDUE = [[0, 5], [3, 1]]

const ROLES = [
  { name: 'Operator', level: 0, desc: 'Self-assessment only', color: '#64748b' },
  { name: 'Lead', level: 1, desc: 'Assess assigned employees', color: '#475569' },
  { name: 'Trainer', level: 2, desc: 'Certify skills & training', color: '#3b82f6' },
  { name: 'Supervisor', level: 3, desc: 'Approve assessments, manage team', color: '#8b5cf6' },
  { name: 'Manager', level: 4, desc: 'Full department access, admin tools', color: '#C85413' },
  { name: 'Admin', level: 5, desc: 'System-wide access, all settings', color: '#F26522' },
]

const WORKFLOW_STEPS = [
  { label: 'Self Assessment', icon: '1', desc: 'Employee rates their own proficiency' },
  { label: 'Peer Review', icon: '2', desc: 'Colleagues provide input on performance' },
  { label: 'Manager Review', icon: '3', desc: 'Supervisor evaluates and confirms level' },
  { label: 'Confirmed', icon: '\u2713', desc: 'Assessment finalized and recorded' },
]

// -- Intersection Observer hook -----------------------------------------

function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

// -- Section wrapper with animation -------------------------------------

function Section({ children, dark, id }) {
  const [ref, visible] = useInView(0.1)
  return (
    <section
      ref={ref}
      id={id}
      style={{
        padding: '80px 24px',
        background: dark ? '#111111' : '#ffffff',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto' }}>{children}</div>
    </section>
  )
}

function SectionTitle({ children, sub, light }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 48 }}>
      <h2 style={{ fontSize: 32, fontWeight: 800, color: light ? '#ffffff' : '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }}>
        {children}
      </h2>
      {sub && <p style={{ fontSize: 15, color: light ? '#94a3b8' : '#64748b', marginTop: 8, maxWidth: 560, margin: '8px auto 0' }}>{sub}</p>}
    </div>
  )
}

// -- Main Demo component ------------------------------------------------

export default function Demo() {
  const [selectedCell, setSelectedCell] = useState(null)
  const [heroLevel, setHeroLevel] = useState(0)
  const [workflowStep, setWorkflowStep] = useState(0)

  // Animate hero Harvey Ball
  useEffect(() => {
    const t = setInterval(() => setHeroLevel((p) => (p + 1) % 5), 1200)
    return () => clearInterval(t)
  }, [])

  // Animate workflow steps
  useEffect(() => {
    const t = setInterval(() => setWorkflowStep((p) => (p + 1) % 4), 2000)
    return () => clearInterval(t)
  }, [])

  const isUnconfirmed = (r, c) => UNCONFIRMED.some(([a, b]) => a === r && b === c)
  const isOverdue = (r, c) => OVERDUE.some(([a, b]) => a === r && b === c)

  return (
    <div style={{ background: '#111111', minHeight: '100vh', scrollBehavior: 'smooth' }}>
      {/* Sticky top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(17,17,17,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #222', padding: '10px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: '#F26522', fontWeight: 700, fontSize: 15 }}>
          Simpson Strong-Tie <span style={{ color: '#64748b', fontWeight: 400 }}>Skill Matrix</span>
        </span>
        <Link to="/login" style={{
          color: '#94a3b8', fontSize: 13, textDecoration: 'none',
          padding: '6px 16px', border: '1px solid #333', borderRadius: 6,
          transition: 'all 0.2s',
        }}
          onMouseEnter={(e) => { e.target.style.borderColor = '#F26522'; e.target.style.color = '#F26522' }}
          onMouseLeave={(e) => { e.target.style.borderColor = '#333'; e.target.style.color = '#94a3b8' }}
        >
          Sign In
        </Link>
      </div>

      {/* ============================================================= */}
      {/* 1. HERO                                                        */}
      {/* ============================================================= */}
      <section style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, #1a1a1a 0%, #111111 70%)',
        padding: '80px 24px', textAlign: 'center',
      }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 40 }}>
            {[0, 1, 2, 3, 4].map((l) => (
              <div key={l} style={{
                opacity: l === heroLevel ? 1 : 0.25,
                transform: l === heroLevel ? 'scale(1.3)' : 'scale(1)',
                transition: 'all 0.5s ease',
              }}>
                <HarveyBall level={l} size={40} />
              </div>
            ))}
          </div>
          <h1 style={{
            fontSize: 52, fontWeight: 800, color: '#ffffff', margin: '0 0 12px',
            letterSpacing: '-0.03em', lineHeight: 1.1,
          }}>
            Skills Matrix
          </h1>
          <p style={{ fontSize: 18, color: '#94a3b8', margin: '0 0 8px' }}>
            Track. Develop. <span style={{ color: '#F26522' }}>Excel.</span>
          </p>
          <p style={{ fontSize: 14, color: '#475569', margin: '0 0 40px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            A complete employee proficiency management system — from frontline training gaps
            to organizational readiness, all in one view.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="#matrix" style={{
              padding: '12px 28px', background: '#F26522', color: 'white',
              borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
              transition: 'background 0.2s',
            }}
              onMouseEnter={(e) => e.target.style.background = '#C85413'}
              onMouseLeave={(e) => e.target.style.background = '#F26522'}
            >
              Explore Features
            </a>
            <Link to="/login" style={{
              padding: '12px 28px', background: 'transparent', color: '#94a3b8',
              borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
              border: '1px solid #333', transition: 'all 0.2s',
            }}
              onMouseEnter={(e) => { e.target.style.borderColor = '#F26522'; e.target.style.color = '#F26522' }}
              onMouseLeave={(e) => { e.target.style.borderColor = '#333'; e.target.style.color = '#94a3b8' }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* 2. THE MATRIX                                                  */}
      {/* ============================================================= */}
      <Section id="matrix">
        <SectionTitle sub="See every employee's proficiency at a glance. Click any cell to drill into details.">
          The Skills Matrix
        </SectionTitle>
        <div style={{
          background: '#fafbfc', borderRadius: 12, border: '1px solid #e2e8f0',
          overflow: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 2 }}>
                  Skill
                </th>
                {EMPLOYEES.map((emp, i) => (
                  <th key={i} style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: 70 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: '#C85413',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, margin: '0 auto 4px',
                    }}>
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>{emp.name}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>{emp.role}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SKILLS.map((skill, si) => (
                <tr key={si} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{
                    padding: '8px 14px', fontWeight: 500, color: '#334155', whiteSpace: 'nowrap',
                    position: 'sticky', left: 0, background: '#ffffff', zIndex: 1,
                    borderRight: '1px solid #f1f5f9',
                  }}>
                    {skill.name}
                    <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 6 }}>{skill.category}</span>
                  </td>
                  {EMPLOYEES.map((_, ei) => {
                    const level = MATRIX_DATA[ei][si]
                    const sel = selectedCell?.[0] === ei && selectedCell?.[1] === si
                    return (
                      <td key={ei} style={{
                        padding: '6px 8px', textAlign: 'center',
                        background: sel ? '#FFF3EB' : 'inherit',
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                        onClick={() => setSelectedCell(sel ? null : [ei, si])}
                        onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = '#FFF8F3' }}
                        onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'inherit' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <HarveyBall
                            level={level}
                            size={24}
                            required={skill.required}
                            isUnconfirmed={isUnconfirmed(ei, si)}
                            isOverdue={isOverdue(ei, si)}
                            isSelected={sel}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedCell && (
          <div style={{
            marginTop: 16, padding: '16px 20px', background: '#FFF3EB', borderRadius: 8,
            border: '1px solid #fed7aa', fontSize: 13, color: '#92400e',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div>
              <strong>{EMPLOYEES[selectedCell[0]].name}</strong> &mdash; {SKILLS[selectedCell[1]].name}
              <span style={{ marginLeft: 12, color: '#C85413' }}>
                Level {MATRIX_DATA[selectedCell[0]][selectedCell[1]]} of 4
                {MATRIX_DATA[selectedCell[0]][selectedCell[1]] < SKILLS[selectedCell[1]].required && (
                  <span style={{ color: '#dc2626', marginLeft: 8 }}>
                    Gap: requires L{SKILLS[selectedCell[1]].required}
                  </span>
                )}
              </span>
            </div>
            <button onClick={() => setSelectedCell(null)} style={{
              background: 'none', border: 'none', color: '#C85413', cursor: 'pointer', fontSize: 16,
            }}>
              &times;
            </button>
          </div>
        )}
        <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
          Click any cell above to see the detail preview
        </p>
      </Section>

      {/* ============================================================= */}
      {/* 3. HARVEY BALL SYSTEM                                          */}
      {/* ============================================================= */}
      <Section dark id="levels">
        <SectionTitle light sub="A simple, visual system for tracking proficiency across your workforce.">
          Five Levels of Proficiency
        </SectionTitle>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16,
          marginBottom: 48,
        }}>
          {['Untrained', 'Training Received', 'Min. Supervision', 'Independent', 'Mastery'].map((label, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '24px 12px',
              background: '#1a1a1a', borderRadius: 12, border: '1px solid #2a2a2a',
              transition: 'border-color 0.3s, transform 0.3s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F26522'; e.currentTarget.style.transform = 'translateY(-4px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <HarveyBall level={i} size={44} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>L{i}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Below Requirement', el: <HarveyBall level={1} size={28} required={3} /> },
            { label: 'Unconfirmed', el: <HarveyBall level={2} size={28} isUnconfirmed /> },
            { label: 'Overdue Retrain', el: <HarveyBall level={3} size={28} isOverdue /> },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
              background: '#1a1a1a', borderRadius: 8, border: '1px solid #2a2a2a',
            }}>
              {item.el}
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================= */}
      {/* 4. GAP ANALYSIS                                                */}
      {/* ============================================================= */}
      <Section id="gaps">
        <SectionTitle sub="Automatically identifies when employees fall below the required proficiency for their role.">
          Intelligent Gap Analysis
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Gap example */}
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <HarveyBall level={1} size={36} required={3} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>Training Gap Detected</div>
                <div style={{ fontSize: 12, color: '#b91c1c' }}>James T. &mdash; GD&T</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fecaca' }}>
                <span>Current Level</span><strong>L1 &mdash; Training Received</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fecaca' }}>
                <span>Required for Bender</span><strong>L3 &mdash; Independent</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Gap</span><strong style={{ color: '#dc2626' }}>2 levels below requirement</strong>
              </div>
            </div>
          </div>

          {/* OK example */}
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <HarveyBall level={4} size={36} required={3} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>Meets Requirement</div>
                <div style={{ fontSize: 12, color: '#15803d' }}>Maria S. &mdash; Lockout/Tagout</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#14532d', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #bbf7d0' }}>
                <span>Current Level</span><strong>L4 &mdash; Mastery</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #bbf7d0' }}>
                <span>Required for CNC Operator</span><strong>L3 &mdash; Independent</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Status</span><strong style={{ color: '#16a34a' }}>Exceeds by 1 level</strong>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ============================================================= */}
      {/* 5. ASSESSMENT WORKFLOW                                         */}
      {/* ============================================================= */}
      <Section dark id="workflow">
        <SectionTitle light sub="A structured process ensures every assessment is accurate, reviewed, and confirmed.">
          Assessment Workflow
        </SectionTitle>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0 }}>
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                textAlign: 'center', width: 160, padding: 16,
                opacity: i <= workflowStep ? 1 : 0.3,
                transform: i <= workflowStep ? 'scale(1)' : 'scale(0.95)',
                transition: 'all 0.5s ease',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: i === 3 ? 20 : 18, fontWeight: 700,
                  background: i <= workflowStep
                    ? (i === 3 ? '#16a34a' : '#F26522')
                    : '#2a2a2a',
                  color: 'white',
                  transition: 'background 0.5s ease',
                  boxShadow: i === workflowStep ? '0 0 20px rgba(242,101,34,0.4)' : 'none',
                }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>{step.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{step.desc}</div>
              </div>
              {i < 3 && (
                <div style={{
                  width: 40, height: 2, marginTop: 40,
                  background: i < workflowStep ? '#F26522' : '#2a2a2a',
                  transition: 'background 0.5s ease',
                }} />
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================= */}
      {/* 6. EMPLOYEE PROFILES                                           */}
      {/* ============================================================= */}
      <Section id="profiles">
        <SectionTitle sub="Drill into any employee to see their full skill breakdown, training status, and development gaps.">
          Employee Profiles
        </SectionTitle>
        <div style={{
          background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
          overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          maxWidth: 640, margin: '0 auto',
        }}>
          {/* Profile header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#C85413',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700,
              }}>MS</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>Maria Santos</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  <span style={{
                    padding: '1px 8px', fontSize: 11, fontWeight: 600, borderRadius: 10,
                    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', marginRight: 6,
                  }}>CNC Operator</span>
                  Operations
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #e2e8f0' }}>
            {[
              { label: 'Total Skills', value: '24', color: '#334155' },
              { label: 'Assessed', value: '21', color: '#2563eb' },
              { label: 'Gaps', value: '2', color: '#dc2626' },
              { label: 'Overdue', value: '1', color: '#dc2626' },
            ].map((stat, i) => (
              <div key={i} style={{ padding: '16px 12px', textAlign: 'center', borderRight: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Mini skill list */}
          <div style={{ padding: '12px 0' }}>
            {[
              { name: 'Lockout/Tagout', level: 4, req: 3, status: 'ok' },
              { name: 'CNC Lathe Setup', level: 3, req: 3, status: 'ok' },
              { name: 'GD&T', level: 1, req: 3, status: 'gap' },
              { name: 'Fall Protection', level: 3, req: 2, status: 'overdue' },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 24px', borderBottom: i < 3 ? '1px solid #f8fafc' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <HarveyBall
                    level={s.level} size={22}
                    required={s.req}
                    isOverdue={s.status === 'overdue'}
                  />
                  <span style={{ fontSize: 13, color: '#334155' }}>{s.name}</span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: s.status === 'gap' ? '#dc2626' : s.status === 'overdue' ? '#dc2626' : '#16a34a',
                }}>
                  {s.status === 'gap' ? 'Gap' : s.status === 'overdue' ? 'Overdue' : 'OK'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ============================================================= */}
      {/* 7. DASHBOARD & ALERTS                                          */}
      {/* ============================================================= */}
      <Section dark id="dashboard">
        <SectionTitle light sub="Actionable insights at a glance. Know exactly where to focus training efforts.">
          Dashboard & Alerts
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Overdue Retraining', value: '7', color: '#dc2626', bg: '#1a1a1a' },
            { label: 'Expiring in 30 Days', value: '12', color: '#f59e0b', bg: '#1a1a1a' },
            { label: 'Pending Confirmation', value: '18', color: '#3b82f6', bg: '#1a1a1a' },
            { label: 'Staffing Coverage', value: '84%', color: '#16a34a', bg: '#1a1a1a' },
          ].map((card, i) => (
            <div key={i} style={{
              background: card.bg, borderRadius: 12, padding: '24px 16px', textAlign: 'center',
              border: '1px solid #2a2a2a', transition: 'border-color 0.3s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = card.color}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
            >
              <div style={{ fontSize: 36, fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Staffing gap bars */}
        <div style={{
          background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginBottom: 16 }}>Staffing Coverage by Skill</div>
          {[
            { skill: 'Lockout/Tagout', pct: 95 },
            { skill: 'Fall Protection', pct: 88 },
            { skill: 'CNC Lathe Setup', pct: 62 },
            { skill: 'Blueprint Reading', pct: 78 },
            { skill: 'GD&T', pct: 45 },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                <span>{item.skill}</span>
                <span style={{ color: item.pct < 60 ? '#dc2626' : item.pct < 80 ? '#f59e0b' : '#16a34a', fontWeight: 600 }}>
                  {item.pct}%
                </span>
              </div>
              <div style={{ background: '#111111', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${item.pct}%`, height: '100%', borderRadius: 4,
                  background: item.pct < 60 ? '#dc2626' : item.pct < 80 ? '#f59e0b' : '#16a34a',
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================= */}
      {/* 8. ROLE-BASED ACCESS                                           */}
      {/* ============================================================= */}
      <Section id="roles">
        <SectionTitle sub="Six levels of access ensure the right people see and do the right things.">
          Role-Based Access Control
        </SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 600, margin: '0 auto' }}>
          {ROLES.map((role, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
              background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(8px)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: role.color,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {role.level}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{role.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{role.desc}</div>
              </div>
              <div style={{
                width: `${((role.level + 1) / 6) * 100}%`, height: 4, background: role.color,
                borderRadius: 2, minWidth: 20, maxWidth: 100,
              }} />
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================= */}
      {/* 9. ADMIN TOOLS                                                 */}
      {/* ============================================================= */}
      <Section dark id="admin">
        <SectionTitle light sub="Powerful management tools for supervisors, managers, and administrators.">
          Administration
        </SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[
            { title: 'Skill Tree Management', desc: 'Organize skills into categories with hierarchical sub-skills. Set retrain intervals, certification requirements, and proficiency targets.', icon: '\uD83C\uDF33' },
            { title: 'User Management', desc: 'Create accounts, assign auth roles, manage passwords, and deactivate users. Full lifecycle control with archive and reactivation.', icon: '\uD83D\uDC65' },
            { title: 'Reporting Assignments', desc: 'Define supervisor-employee relationships, primary and secondary reporting chains, and peer assessment permissions.', icon: '\uD83D\uDD17' },
            { title: 'Activity Audit Log', desc: 'Immutable record of every change — who did what, when, and why. Filter by action type, actor, date range. Export to CSV.', icon: '\uD83D\uDCCB' },
          ].map((tool, i) => (
            <div key={i} style={{
              background: '#1a1a1a', borderRadius: 12, padding: 24, border: '1px solid #2a2a2a',
              transition: 'border-color 0.3s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#F26522'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{tool.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>{tool.title}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{tool.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================= */}
      {/* 10. FOOTER CTA                                                 */}
      {/* ============================================================= */}
      <section style={{
        padding: '100px 24px', textAlign: 'center',
        background: 'linear-gradient(180deg, #111111 0%, #1a1a1a 100%)',
      }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#ffffff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Ready to get started?
        </h2>
        <p style={{ fontSize: 15, color: '#64748b', margin: '0 0 32px' }}>
          Track your team's skills. Close training gaps. Build a stronger workforce.
        </p>
        <Link to="/login" style={{
          display: 'inline-block', padding: '14px 36px', background: '#F26522', color: 'white',
          borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none',
          transition: 'background 0.2s',
        }}
          onMouseEnter={(e) => e.target.style.background = '#C85413'}
          onMouseLeave={(e) => e.target.style.background = '#F26522'}
        >
          Sign In
        </Link>
        <div style={{ marginTop: 48, color: '#333', fontSize: 11 }}>
          Simpson Strong-Tie Company Inc.
        </div>
      </section>
    </div>
  )
}

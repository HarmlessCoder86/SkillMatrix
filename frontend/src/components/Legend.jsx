import HarveyBall, { LEVEL_LABELS } from './HarveyBall'

export default function Legend() {
  return (
    <div style={{
      background: 'white', borderBottom: '1px solid #e2e8f0', padding: '10px 24px',
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Proficiency:
      </span>
      {[0, 1, 2, 3, 4].map((l) => (
        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569' }}>
          <HarveyBall level={l} size={20} /> {LEVEL_LABELS[l]}
        </span>
      ))}
      <span style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#ef4444' }}>
        <HarveyBall level={1} required={3} size={20} /> Below req.
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#f59e0b' }}>
        <HarveyBall level={2} isUnconfirmed size={20} /> Unconfirmed
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#ef4444' }}>
        <HarveyBall level={2} isOverdue size={20} /> Overdue
      </span>
    </div>
  )
}

const FILL_COLOR = '#1a1a1a'
const STROKE_COLOR = '#64748b'
const GAP_COLOR = '#ef4444'

function wedgePath(cx, cy, r, fraction) {
  if (fraction <= 0) return ''
  if (fraction >= 1)
    return `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0`
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + 2 * Math.PI * fraction
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const largeArc = fraction > 0.5 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

export default function HarveyBall({
  level = 0,
  size = 26,
  required,
  isUnconfirmed = false,
  isOverdue = false,
  isSelected = false,
  onClick,
}) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 2
  const fraction = level / 4
  const hasGap = required != null && level < required

  let stroke = STROKE_COLOR
  let strokeWidth = 1.5
  let strokeDash = 'none'

  if (isSelected) {
    stroke = '#F26522'
    strokeWidth = 2.5
  } else if (isUnconfirmed && hasGap) {
    stroke = '#f59e0b'
    strokeWidth = 2
    strokeDash = '3 2'
  } else if (isUnconfirmed) {
    stroke = '#f59e0b'
    strokeWidth = 2
  } else if (hasGap) {
    stroke = GAP_COLOR
    strokeWidth = 2
    strokeDash = '3 2'
  }

  const animClass = isUnconfirmed && !isSelected ? 'harvey-ball-unconfirmed' : ''

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      className={animClass}
    >
      <circle cx={cx} cy={cy} r={r} fill="white"
        stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />
      {level > 0 && <path d={wedgePath(cx, cy, r, fraction)} fill={FILL_COLOR} />}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDash} />
      {isOverdue && (
        <circle cx={size - 4} cy={4} r={3.5} fill="#ef4444" stroke="white" strokeWidth={1.2} />
      )}
    </svg>
  )
}

export const LEVEL_LABELS = [
  'Untrained',
  'L1 — Training Received',
  'L2 — Min. Supervision',
  'L3 — Independent',
  'L4 — Mastery',
]

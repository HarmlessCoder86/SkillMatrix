/**
 * Reusable confirmation modal with inline styles.
 *
 * Props:
 *   isOpen      boolean
 *   title       dialog title
 *   message     body text (string or JSX)
 *   confirmText button label (default "Confirm")
 *   cancelText  button label (default "Cancel")
 *   onConfirm   () => void
 *   onCancel    () => void
 *   variant     'default' | 'danger' | 'success' | 'warning'
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}) {
  if (!isOpen) return null

  const colors = {
    default: { bg: '#F26522', hover: '#C85413' },
    danger: { bg: '#dc2626', hover: '#b91c1c' },
    success: { bg: '#16a34a', hover: '#15803d' },
    warning: { bg: '#d97706', hover: '#b45309' },
  }
  const c = colors[variant] || colors.default

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        maxWidth: 420, width: '100%', margin: '0 16px', padding: 24,
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>{title}</h3>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', fontSize: 13, borderRadius: 6,
              border: '1px solid #d1d5db', background: 'white', color: '#374151', cursor: 'pointer',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px', fontSize: 13, borderRadius: 6,
              border: 'none', background: c.bg, color: 'white', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

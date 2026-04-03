// src/components/Toaster.jsx
export default function Toaster({ toasts, onRemove }) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container" role="region" aria-label="Notificaciones">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => onRemove(t.id)}
          role="alert"
        >
          <span className="toast-icon">
            {t.type === 'success' && '✓'}
            {t.type === 'error'   && '✕'}
            {t.type === 'info'    && 'ℹ'}
          </span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" onClick={(e) => { e.stopPropagation(); onRemove(t.id); }} aria-label="Cerrar">×</button>
        </div>
      ))}
    </div>
  )
}

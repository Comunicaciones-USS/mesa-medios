// src/components/ConfirmDialog.jsx
import { useEffect, useRef } from 'react'

export default function ConfirmDialog({ nombre, onConfirm, onCancel }) {
  const cancelRef = useRef(null)

  // Focus on "Cancelar" on open to prevent accidental deletion with Enter
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // Escape cancels
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="confirm-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="12" stroke="#dc2626" strokeWidth="1.8" fill="#fef2f2" />
            <path d="M14 9v6M14 18v1.5" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="confirm-title">¿Eliminar contenido?</h3>
        <p className="confirm-body">
          Se eliminará <strong>"{nombre}"</strong> y todos sus datos de medios asignados.
          <br />Esta acción no se puede deshacer.
        </p>
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn-ghost-cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn-danger-confirm" onClick={onConfirm}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect } from 'react'

export default function BottomSheet({ isOpen, onClose, title, children, onApply, applyLabel }) {
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="bs-overlay" onClick={onClose}>
      <div className="bs-sheet" onClick={e => e.stopPropagation()}>
        <div className="bs-handle" />
        <div className="bs-header">
          <span className="bs-title">{title}</span>
          <button className="bs-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="bs-body">
          {children}
        </div>
        {onApply && (
          <div className="bs-footer">
            <button className="bs-apply-btn" onClick={onApply}>
              {applyLabel || 'Aplicar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

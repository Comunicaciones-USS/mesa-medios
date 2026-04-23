import { useEffect, useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

export default function BottomSheet({ isOpen, onClose, title, children, onApply, applyLabel }) {
  const sheetRef = useRef(null)

  // Capture trigger element synchronously at render time
  const triggerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)

  // Focus trap while open
  useFocusTrap(sheetRef, isOpen)

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'

    // Auto-focus first focusable element when opened
    const focusable = sheetRef.current?.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    focusable?.focus()

    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Restore focus to trigger on close
  useEffect(() => {
    if (!isOpen) {
      triggerRef.current?.focus()
    }
  }, [isOpen])

  // Escape closes the sheet
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="bs-overlay" onClick={onClose}>
      <div ref={sheetRef} className="bs-sheet" onClick={e => e.stopPropagation()}>
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

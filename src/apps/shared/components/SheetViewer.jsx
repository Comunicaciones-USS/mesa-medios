import { useEffect, useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

/**
 * Modal con iframe para visualizar un Excel Online (SharePoint).
 *
 * Props:
 *   isOpen  {boolean}  — controla visibilidad
 *   onClose {function} — callback para cerrar
 *   title   {string}   — título mostrado en el header del modal
 *   url     {string}   — URL embed de Excel Online
 *
 * Nota: el iframe no lleva atributo sandbox porque Microsoft 365 SSO
 * requiere acceso normal a cookies/storage del dominio sharepoint.
 */
export default function SheetViewer({ isOpen, onClose, title, url }) {
  const containerRef = useRef(null)
  const titleId = 'sheet-viewer-title'

  useFocusTrap(containerRef, isOpen)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="sheet-viewer-overlay"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        ref={containerRef}
        className="sheet-viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-viewer-header">
          <h2 id={titleId} className="sheet-viewer-title">{title}</h2>
          <button
            className="sheet-viewer-close"
            onClick={onClose}
            aria-label="Cerrar visor"
          >
            &#x2715;
          </button>
        </div>
        <div className="sheet-viewer-body">
          <iframe
            src={url}
            title={title}
            loading="lazy"
            frameBorder="0"
          />
        </div>
      </div>
    </div>
  )
}

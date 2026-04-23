import { useState, useEffect, useRef } from 'react'
import { useFocusTrap } from '../../shared/hooks/useFocusTrap'

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

// Modo "nuevo tema" (temas + onConfirm)
// Modo "agregar fecha" (prefillTema + existingDates + onConfirm)
export default function AddRowModal({ onConfirm, onClose, temas = [], prefillTema = null, existingDates = [] }) {
  const [nombre, setNombre] = useState(prefillTema?.nombre || '')
  const [semana, setSemana] = useState('')
  const inputRef = useRef(null)
  const modalRef = useRef(null)
  const isMobile = useIsMobile()

  // Capture trigger element synchronously at render time for focus return on close
  const triggerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)

  // Focus trap for desktop modal
  useFocusTrap(modalRef, !isMobile)

  // Restore focus to trigger element when modal unmounts
  useEffect(() => {
    return () => { triggerRef.current?.focus() }
  }, [])

  // Escape closes the modal
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const isAddDate = !!prefillTema   // true = agregar fecha a tema existente

  // Fecha ya existe en este tema
  const dateConflict = semana && existingDates.includes(semana)

  // Si el nombre escrito coincide con un tema existente, reutilizarlo
  const matchedTema = !isAddDate
    ? temas.find(t => t.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
    : null

  useEffect(() => {
    inputRef.current?.focus()
    if (isMobile) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isMobile])

  function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim() || dateConflict) return
    onConfirm({
      nombre:  nombre.trim(),
      semana:  semana || null,
      temaId:  isAddDate ? prefillTema.id : (matchedTema?.id || null),
    })
  }

  const formContent = (
    <>
      {/* Campo tema */}
      <div className="form-group">
        <label htmlFor="nombre">
          {isAddDate ? 'Tema' : 'Nombre del tema *'}
        </label>
        {isAddDate ? (
          <input
            id="nombre"
            type="text"
            value={nombre}
            readOnly
            className="input-readonly"
          />
        ) : (
          <>
            <input
              ref={inputRef}
              id="nombre"
              type="text"
              list="nombre-suggestions"
              placeholder="Ej: Nuevo Rector, Feria del Libro..."
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />
            <datalist id="nombre-suggestions">
              {temas.map(t => <option key={t.id} value={t.nombre} />)}
            </datalist>
            {matchedTema && (
              <p className="modal-hint modal-hint-info">
                Se añadirá una nueva fecha al tema existente "{matchedTema.nombre}".
              </p>
            )}
          </>
        )}
      </div>

      {/* Campo fecha */}
      <div className="form-group">
        <label htmlFor="semana">Fecha</label>
        <input
          ref={isAddDate ? inputRef : undefined}
          id="semana"
          type="date"
          value={semana}
          onChange={e => setSemana(e.target.value)}
        />
        {dateConflict && (
          <p className="modal-hint modal-hint-warn">
            Ya existe una planificación para esta fecha en "{nombre}".
          </p>
        )}
      </div>

      {!isAddDate && (
        <p className="modal-hint">
          Podrás asignar el estado de cada medio después de crearlo.
        </p>
      )}
    </>
  )

  const submitLabel = isAddDate ? 'Agregar fecha' : (matchedTema ? 'Agregar al tema' : 'Crear tema')
  const titleLabel  = isAddDate ? 'Agregar fecha al tema' : 'Agregar tema'

  // ── Mobile: bottom sheet ──────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div className="mobile-overlay" onClick={onClose} />
        <div className="mobile-sheet mobile-sheet-form">
          <div className="sheet-handle" />
          <div className="sheet-title">{titleLabel}</div>
          <form onSubmit={handleSubmit}>
            {formContent}
            <button
              type="submit"
              className="sheet-confirm-btn"
              disabled={!nombre.trim() || !!dateConflict}
              style={{ marginTop: 8 }}
            >
              {submitLabel}
            </button>
            <button type="button" className="sheet-back-btn" onClick={onClose}>
              Cancelar
            </button>
          </form>
        </div>
      </>
    )
  }

  // ── Desktop: centered modal ───────────────────────────────────
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="add-row-modal-title">
        <div className="modal-header">
          <h2 id="add-row-modal-title">{titleLabel}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar modal">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {formContent}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={!nombre.trim() || !!dateConflict}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

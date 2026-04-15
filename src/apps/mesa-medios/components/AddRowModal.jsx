import { useState, useEffect, useRef } from 'react'

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
}

export default function AddRowModal({ onConfirm, onClose, existingNames = [] }) {
  const [nombre, setNombre] = useState('')
  const [semana, setSemana] = useState('')
  const inputRef = useRef(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    inputRef.current?.focus()
    if (isMobile) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isMobile])

  function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    onConfirm({ nombre: nombre.trim(), semana: semana || null })
  }

  const formContent = (
    <>
      <div className="form-group">
        <label htmlFor="nombre">Nombre del tema *</label>
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
          {existingNames.map(n => <option key={n} value={n} />)}
        </datalist>
      </div>

      <div className="form-group">
        <label htmlFor="semana">Fecha</label>
        <input
          id="semana"
          type="date"
          value={semana}
          onChange={e => setSemana(e.target.value)}
        />
      </div>

      <p className="modal-hint">
        Podrás asignar el estado y descripción de cada medio después de crearlo.
      </p>
    </>
  )

  // ── Mobile: bottom sheet ──────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div className="mobile-overlay" onClick={onClose} />
        <div className="mobile-sheet mobile-sheet-form">
          <div className="sheet-handle" />
          <div className="sheet-title">Agregar tema</div>
          <form onSubmit={handleSubmit}>
            {formContent}
            <button
              type="submit"
              className="sheet-confirm-btn"
              disabled={!nombre.trim()}
              style={{ marginTop: 8 }}
            >
              Crear tema
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
      <div className="modal">
        <div className="modal-header">
          <h2>Agregar tema</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
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
            <button type="submit" className="btn-primary" disabled={!nombre.trim()}>
              Crear tema
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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

/**
 * AddRowModal — cuatro modos:
 *
 * 1. Nueva campaña (modo default):
 *    Props: temas[], onConfirm({ nombre, semana, temaId })
 *
 * 2. Agregar fecha a campaña existente (modo legacy):
 *    Props: prefillTema={ id, nombre }, existingDates[], onConfirm({ nombre, semana, temaId })
 *
 * 3. Nuevo subtema:
 *    Props: mode="add-subtema", parentId, parentNombre, onConfirmSubtema(parentId, nombre, fechaInicio, fechaTermino)
 *
 * 4. Editar subtema (nombre + fechas):
 *    Props: mode="edit-subtema", subtemaId, subtemaNombre, fechaInicioInit, fechaTerminoInit, parentNombre,
 *           onConfirmEditSubtema(subtemaId, { nombre, fechaInicio, fechaTermino })
 */
export default function AddRowModal({
  // Modo 1 & 2
  onConfirm,
  temas = [],
  prefillTema = null,
  existingDates = [],
  // Modo 3
  mode = null,
  parentId = null,
  parentNombre = null,
  onConfirmSubtema = null,
  // Modo 4 — editar subtema
  subtemaId = null,
  subtemaNombre = null,
  fechaInicioInit = '',
  fechaTerminoInit = '',
  onConfirmEditSubtema = null,
  // Común
  onClose,
}) {
  // ── Determinar modo ──────────────────────────────────────────────
  const isEditSubtema = mode === 'edit-subtema'
  const isAddSubtema  = mode === 'add-subtema'
  const isAddDate     = !!prefillTema && !isAddSubtema && !isEditSubtema

  // ── Estado de campos ─────────────────────────────────────────────
  const [nombre,      setNombre]      = useState(
    isEditSubtema ? (subtemaNombre || '') : (prefillTema?.nombre || '')
  )
  const [semana,      setSemana]      = useState('')
  const [fechaInicio, setFechaInicio] = useState(
    isEditSubtema ? (fechaInicioInit || '') : ''
  )
  const [fechaTermino, setFechaTermino] = useState(
    isEditSubtema ? (fechaTerminoInit || '') : ''
  )

  const inputRef = useRef(null)
  const modalRef = useRef(null)
  const isMobile = useIsMobile()
  const triggerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)

  useFocusTrap(modalRef, !isMobile)

  useEffect(() => {
    return () => { triggerRef.current?.focus() }
  }, [])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    inputRef.current?.focus()
    if (isMobile) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [isMobile])

  // ── Validaciones ─────────────────────────────────────────────────
  const dateConflict = semana && existingDates.includes(semana)
  const rangeError   = (isAddSubtema || isEditSubtema) && fechaInicio && fechaTermino && fechaInicio > fechaTermino

  // Sugerencia de tema existente (solo modo nueva campaña)
  const matchedTema = (!isAddDate && !isAddSubtema && !isEditSubtema)
    ? temas.find(t => t.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
    : null

  // ── Submit ────────────────────────────────────────────────────────
  function handleSubmit(e) {
    e.preventDefault()
    if (dateConflict || rangeError) return

    if (isEditSubtema) {
      if (!nombre.trim()) return
      onConfirmEditSubtema(subtemaId, {
        nombre:        nombre.trim(),
        fecha_inicio:  fechaInicio  || null,
        fecha_termino: fechaTermino || null,
      })
      return
    }

    if (isAddSubtema) {
      if (!nombre.trim()) return
      onConfirmSubtema(parentId, nombre.trim(), fechaInicio || null, fechaTermino || null)
      return
    }

    // Modo nueva campaña o agregar fecha a campaña
    if (!nombre.trim()) return
    onConfirm({
      nombre: nombre.trim(),
      semana:  semana || null,
      temaId:  isAddDate ? prefillTema.id : (matchedTema?.id || null),
    })
  }

  // ── Contenido del formulario según modo ─────────────────────────
  function renderFormContent() {
    // Modo 4: editar subtema (nombre + fechas)
    if (isEditSubtema) {
      return (
        <>
          {parentNombre && (
            <div className="form-group">
              <label>Campaña padre</label>
              <input type="text" value={parentNombre} readOnly className="input-readonly" />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="edit-subtema-nombre">Nombre del subtema *</label>
            <input
              ref={inputRef}
              id="edit-subtema-nombre"
              type="text"
              placeholder="Ej: Semana 1, Etapa Lanzamiento..."
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group-row">
            <div className="form-group-half">
              <label htmlFor="edit-fecha-inicio">Fecha inicio</label>
              <input
                id="edit-fecha-inicio"
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="form-group-half">
              <label htmlFor="edit-fecha-termino">Fecha término</label>
              <input
                id="edit-fecha-termino"
                type="date"
                value={fechaTermino}
                onChange={e => setFechaTermino(e.target.value)}
              />
            </div>
          </div>
          {rangeError && (
            <p className="modal-hint modal-hint-warn">
              La fecha de inicio no puede ser posterior a la fecha de término.
            </p>
          )}
          <p className="modal-hint">
            Las fechas son opcionales y sirven para filtrar por período.
          </p>
        </>
      )
    }

    // Modo 3: nuevo subtema
    if (isAddSubtema) {
      return (
        <>
          <div className="form-group">
            <label>Campaña padre</label>
            <input type="text" value={parentNombre || ''} readOnly className="input-readonly" />
          </div>
          <div className="form-group">
            <label htmlFor="subtema-nombre">Nombre del subtema *</label>
            <input
              ref={inputRef}
              id="subtema-nombre"
              type="text"
              placeholder="Ej: Semana 1, Etapa Lanzamiento..."
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group-row">
            <div className="form-group-half">
              <label htmlFor="fecha-inicio">Fecha inicio</label>
              <input
                id="fecha-inicio"
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="form-group-half">
              <label htmlFor="fecha-termino">Fecha término</label>
              <input
                id="fecha-termino"
                type="date"
                value={fechaTermino}
                onChange={e => setFechaTermino(e.target.value)}
              />
            </div>
          </div>
          {rangeError && (
            <p className="modal-hint modal-hint-warn">
              La fecha de inicio no puede ser posterior a la fecha de término.
            </p>
          )}
          <p className="modal-hint">
            Las fechas son opcionales y sirven para filtrar por período.
          </p>
        </>
      )
    }

    // Modo 2: agregar fecha a campaña existente (legacy)
    if (isAddDate) {
      return (
        <>
          <div className="form-group">
            <label htmlFor="nombre">Tema</label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              readOnly
              className="input-readonly"
            />
          </div>
          <div className="form-group">
            <label htmlFor="semana">Fecha</label>
            <input
              ref={inputRef}
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
        </>
      )
    }

    // Modo 1: nueva campaña
    return (
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
            {temas.map(t => <option key={t.id} value={t.nombre} />)}
          </datalist>
          {matchedTema && (
            <p className="modal-hint modal-hint-info">
              Se añadirá una nueva fecha al tema existente "{matchedTema.nombre}".
            </p>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="semana">Fecha</label>
          <input
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
        <p className="modal-hint">
          Podrás asignar el estado de cada medio después de crearlo.
        </p>
      </>
    )
  }

  // ── Labels ────────────────────────────────────────────────────────
  const titleLabel = isEditSubtema
    ? 'Editar subtema'
    : isAddSubtema
    ? 'Nuevo subtema'
    : isAddDate
    ? 'Agregar fecha al tema'
    : 'Agregar tema'

  const submitLabel = isEditSubtema
    ? 'Guardar cambios'
    : isAddSubtema
    ? 'Crear subtema'
    : isAddDate
    ? 'Agregar fecha'
    : matchedTema
    ? 'Agregar al tema'
    : 'Crear tema'

  const isSubmitDisabled = dateConflict || rangeError || !nombre.trim()

  const formContent = renderFormContent()

  // ── Mobile: bottom sheet ─────────────────────────────────────────
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
              disabled={isSubmitDisabled}
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

  // ── Desktop: centered modal ──────────────────────────────────────
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
            <button type="submit" className="btn-primary" disabled={isSubmitDisabled}>
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

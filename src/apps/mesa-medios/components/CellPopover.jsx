import { useState, useEffect, useRef } from 'react'

const STATUS_OPTIONS = [
  { value: '',   label: 'Vacío',             color: '' },
  { value: 'si', label: 'Confirmado (si)',   color: 'green' },
  { value: 'pd', label: 'Por definir (pd)',  color: 'yellow' },
  { value: 'no', label: 'No aplica (no)',    color: 'red' },
]

const STATUS_VIEW = {
  si: { label: 'Confirmado',  bg: 'var(--green-bg)',  color: 'var(--green-text)', border: 'var(--green-bdr)' },
  pd: { label: 'Por definir', bg: 'var(--yellow-bg)', color: 'var(--yellow-text)', border: 'var(--yellow-bdr)' },
  no: { label: 'No aplica',   bg: 'var(--red-bg)',    color: 'var(--red-text)',    border: 'var(--red-bdr)' },
}

function parseValue(raw) {
  if (!raw) return { status: '', name: '' }
  const lower = raw.toLowerCase().trim()
  if (lower === 'pd') return { status: 'pd', name: '' }
  if (lower === 'no') return { status: 'no', name: '' }
  if (lower.startsWith('pd')) {
    const parts = raw.split('/')
    return { status: 'pd', name: parts[1]?.trim() || '' }
  }
  if (lower.startsWith('si')) {
    const parts = raw.split('/')
    return { status: 'si', name: parts[1]?.trim() || '' }
  }
  return { status: '', name: '' }
}

function buildValue(status, name) {
  if (status === 'si') return name ? `si / ${name}` : 'si'
  if (status === 'pd') return name ? `pd / ${name}` : 'pd'
  if (status === 'no') return 'no'
  return ''
}

export default function CellPopover({ value, notas: initialNotas, position, onSave, onClose }) {
  const { status: initStatus, name: initName } = parseValue(value)
  const isEmpty = !value  // cell has no state at all → go straight to edit

  const [mode,      setMode]      = useState(isEmpty ? 'edit' : 'view')
  const [status,    setStatus]    = useState(initStatus)   // '' = Vacío; no forzar 'si'
  const [name,      setName]      = useState(initName)
  const [notas,     setNotas]     = useState(initialNotas || '')
  const [showNotas, setShowNotas] = useState(!!initialNotas)

  const ref      = useRef(null)
  const nameRef  = useRef(null)
  const notasRef = useRef(null)

  // Auto-focus description input when entering edit mode for si/pd
  useEffect(() => {
    if (mode === 'edit' && (status === 'si' || status === 'pd') && nameRef.current) {
      nameRef.current.focus()
    }
  }, [mode, status])

  // Click outside: always close without saving
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !showNotas) {
      // Enter cierra sin guardar — solo "Guardar" escribe en DB
      onClose()
    }
    if (e.key === 'Escape') {
      if (mode === 'edit' && !isEmpty) setMode('view')
      else onClose()
    }
  }

  // "Agregar detalles" from view mode — switch to edit and focus notas
  function handleAddDetalles() {
    setShowNotas(true)
    setMode('edit')
    setTimeout(() => notasRef.current?.focus(), 50)
  }

  // Cancel in edit mode: back to view if cell had a value, otherwise close
  function handleCancel() {
    if (isEmpty) {
      onClose()
    } else {
      setStatus(initStatus)
      setName(initName)
      setNotas(initialNotas || '')
      setShowNotas(!!initialNotas)
      setMode('view')
    }
  }

  // Position: keep popover within viewport
  const popW  = 252
  const editH = showNotas ? 340 : (status === 'si' || status === 'pd') ? 260 : 220
  const viewH = 140 + (initName ? 36 : 0) + (initialNotas ? 80 : 0)
  const popH  = mode === 'edit' ? editH : viewH
  let left = position.x
  let top  = position.y + 4
  if (left + popW > window.innerWidth  - 8) left = window.innerWidth  - popW - 8
  if (top  + popH > window.innerHeight - 8) top  = position.y - popH - 4

  const statusInfo = STATUS_VIEW[initStatus]

  return (
    <div
      ref={ref}
      className="cell-popover"
      style={{ left, top, width: popW }}
      onKeyDown={handleKeyDown}
    >
      {mode === 'view' ? (
        /* ── VIEW MODE — descripción/notas arriba, badge estado abajo ── */
        <>
          {initName && (
            <p className="popover-view-desc">{initName}</p>
          )}

          {initialNotas && (
            <div className="popover-view-notas-wrap">
              <span className="popover-notas-label">Detalles</span>
              <p className="popover-view-notas-text">{initialNotas}</p>
            </div>
          )}

          <div className="popover-view-header">
            {statusInfo && (
              <span
                className="popover-status-badge"
                style={{ background: statusInfo.bg, color: statusInfo.color, borderColor: statusInfo.border }}
              >
                {statusInfo.label}
              </span>
            )}
          </div>

          <div className="popover-view-actions">
            {!initialNotas && (
              <button className="popover-btn-add-notas" onClick={handleAddDetalles}>
                + Agregar detalles
              </button>
            )}
            <button className="popover-btn-edit" onClick={() => setMode('edit')}>
              Editar
            </button>
          </div>
        </>
      ) : (
        /* ── EDIT MODE — descripción/notas arriba, estados abajo ── */
        <>
          {(status === 'si' || status === 'pd') && (
            <div className="popover-name-input">
              <input
                ref={nameRef}
                type="text"
                placeholder="¿De qué se trata?"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}

          {!showNotas ? (
            <button className="popover-notas-toggle" onClick={() => setShowNotas(true)}>
              {notas ? '✎ Ver/editar detalles' : '+ Agregar detalles'}
            </button>
          ) : (
            <div className="popover-notas">
              <div className="popover-notas-header">
                <span className="popover-notas-label">Detalles</span>
              </div>
              <textarea
                ref={notasRef}
                className="popover-notas-input"
                placeholder="Escribe los detalles aquí..."
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <p className="popover-title">Estado de la celda</p>

          {STATUS_OPTIONS.map(opt => (
            <label key={opt.value} className={`popover-option ${opt.color}`}>
              <input
                type="radio"
                name="cell-status"
                value={opt.value}
                checked={status === opt.value}
                onChange={() => setStatus(opt.value)}
              />
              <span className={`status-dot ${opt.color}`} />
              {opt.label}
            </label>
          ))}

          <div className="popover-actions">
            <button className="popover-btn-cancel" onClick={handleCancel}>Cancelar</button>
            <button className="popover-btn-save" onClick={() => onSave(buildValue(status, name), notas)}>
              Guardar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

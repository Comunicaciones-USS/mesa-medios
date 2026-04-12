import { useState, useEffect, useRef } from 'react'
import { getCellData } from '../utils'

const STATUS_OPTIONS = [
  { value: '',   label: 'Vacío',             color: '' },
  { value: 'si', label: 'Confirmado (si)',   color: 'green' },
  { value: 'pd', label: 'Por definir (pd)',  color: 'yellow' },
  { value: 'no', label: 'No aplica (no)',    color: 'red' },
]

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
  const [status, setStatus] = useState(initStatus || 'si')
  const [name,   setName]   = useState(initName)
  const [showNotas, setShowNotas] = useState(false)
  const [notas, setNotas] = useState(initialNotas || '')
  const ref     = useRef(null)
  const nameRef = useRef(null)

  useEffect(() => {
    if ((status === 'si' || status === 'pd') && nameRef.current) nameRef.current.focus()
  }, [status])

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onSave(buildValue(status, name), notas)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [status, name, notas, onSave])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !showNotas) onSave(buildValue(status, name), notas)
    if (e.key === 'Escape') onClose()
  }

  const popW = 240
  const popH = showNotas ? 340 : (status === 'si' || status === 'pd') ? 260 : 220
  let left = position.x
  let top  = position.y + 4
  if (left + popW > window.innerWidth  - 8) left = window.innerWidth  - popW - 8
  if (top  + popH > window.innerHeight - 8) top  = position.y - popH - 4

  return (
    <div
      ref={ref}
      className="cell-popover"
      style={{ left, top, width: popW }}
      onKeyDown={handleKeyDown}
    >
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

      {/* ── Notes toggle ── */}
      {!showNotas ? (
        <button className="popover-notas-toggle" onClick={() => setShowNotas(true)}>
          Ver detalles
        </button>
      ) : (
        <div className="popover-notas">
          <div className="popover-notas-header">
            <span className="popover-notas-label">Detalles</span>
            <button
              className="popover-notas-edit-btn"
              onClick={() => document.querySelector('.popover-notas-input')?.focus()}
              title="Editar detalles"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M0.5 10.5h2.5l6-6a1.5 1.5 0 00-2-2l-6 6v2z" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M6 3l2 2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <textarea
            className="popover-notas-input"
            placeholder="Escribe los detalles aquí..."
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
          />
        </div>
      )}

      <div className="popover-actions">
        <button className="popover-btn-cancel" onClick={onClose}>Cancelar</button>
        <button className="popover-btn-save" onClick={() => onSave(buildValue(status, name), notas)}>
          Guardar
        </button>
      </div>
    </div>
  )
}

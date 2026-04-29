import { useState, useEffect, useRef } from 'react'

// Extrae status ('si'|'pd'|'') y nota del valor raw (legacy string o nuevo formato)
function parseValue(raw) {
  if (!raw) return { status: '', note: '' }
  const lower = raw.toLowerCase().trim()
  if (lower === 'si') return { status: 'si', note: '' }
  if (lower === 'pd') return { status: 'pd', note: '' }
  if (lower.startsWith('si/')) {
    const note = raw.slice(raw.indexOf('/') + 1).trim()
    return { status: 'si', note }
  }
  if (lower.startsWith('pd/')) {
    const note = raw.slice(raw.indexOf('/') + 1).trim()
    return { status: 'pd', note }
  }
  return { status: '', note: '' }
}

export default function CellPopover({ value, notas: initialNotas, position, onSave, onClose }) {
  const { note: legacyNote } = parseValue(value)
  // Prefer JSONB notas; fallback to name embedded in legacy format string
  const initNote = initialNotas || legacyNote

  const [inputText, setInputText] = useState(initNote)
  const inputRef = useRef(null)
  const ref = useRef(null)

  // La celda ya tiene texto guardado si initNote es no-vacío
  const hasExistingDetail = initNote.trim() !== ''

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Click outside → close without saving
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Fix 2: Enter guarda el texto escrito si hay algo, o "sí" vacío si está vacío
  function handleInputKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = inputText.trim()
      // Si hay texto → guardar como nota con status 'si'
      // Si vacío → guardar como 'si' sin nota
      onSave('si', trimmed)
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  function handleContainerKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }

  // Keep popover within viewport — width ajustado a 340 (Fix 1)
  const popW = 340
  const popH = hasExistingDetail ? 210 : 130
  let left = position.x
  let top  = position.y + 4
  if (left + popW > window.innerWidth  - 8) left = window.innerWidth  - popW - 8
  if (top  + popH > window.innerHeight - 8) top  = position.y - popH - 4

  return (
    <div
      ref={ref}
      className="cell-popover cell-popover-v2"
      style={{ left, top, width: popW }}
      onKeyDown={handleContainerKeyDown}
    >
      {/* Fix 3: sección "Detalle actual" — solo si ya hay texto guardado */}
      {hasExistingDetail && (
        <div className="cpv2-detail-section">
          <p className="cpv2-detail-label">Detalle actual</p>
          <p className="cpv2-detail-text">{initNote}</p>
        </div>
      )}
      <div className="cpv2-input-wrap">
        <input
          ref={inputRef}
          type="text"
          className="cpv2-input"
          placeholder="Escribe una nota o presiona Enter..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      </div>
      <div className="cpv2-actions">
        <button
          className="cpv2-btn-pd"
          onClick={() => onSave('pd', inputText.trim())}
          type="button"
        >
          Por definir
        </button>
        <button
          className="cpv2-btn-vaciar"
          onClick={() => onSave('', '')}
          type="button"
        >
          Vaciar
        </button>
        <button
          className="cpv2-btn-confirm"
          onClick={() => onSave('si', inputText.trim())}
          type="button"
        >
          Confirmar ✓
        </button>
      </div>
    </div>
  )
}

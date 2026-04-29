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

  function handleInputKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave('si', inputText.trim())
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

  // Keep popover within viewport
  const popW = 260
  const popH = 120
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

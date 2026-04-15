import { useState, useEffect, useRef } from 'react'
import { MEDIA_COLS } from '../config'
import { getCellData, getRowProgress } from '../utils'

// ── Helpers ─────────────────────────────────────────────────────
function getCellMeta(raw) {
  if (!raw) return { status: 'empty', display: '', name: '' }
  const lower = raw.toLowerCase().trim()
  if (lower === 'no') return { status: 'no', display: 'No', name: '' }
  if (lower.startsWith('pd')) {
    const parts = raw.split('/')
    const name = parts[1]?.trim() || ''
    return { status: 'pd', display: name || 'PD', name }
  }
  if (lower.startsWith('si')) {
    const parts = raw.split('/')
    const name = parts[1]?.trim() || ''
    return { status: 'si', display: name || 'Sí', name }
  }
  return { status: 'empty', display: raw, name: '' }
}

function buildValue(status, name) {
  if (status === 'si') return name ? `si / ${name}` : 'si'
  if (status === 'pd') return name ? `pd / ${name}` : 'pd'
  if (status === 'no') return 'no'
  return ''
}

// ── Bottom sheet component ──────────────────────────────────────
function BottomSheet({ medio, currentValue, currentNotas, onSave, onClose }) {
  const [step, setStep] = useState('options') // 'options' | 'name' | 'notas'
  const [pendingStatus, setPendingStatus] = useState('si')
  const [name, setName] = useState('')
  const [notas, setNotas] = useState(currentNotas || '')
  const nameRef = useRef(null)
  const meta = getCellMeta(currentValue)

  useEffect(() => {
    if (step === 'name' && nameRef.current) nameRef.current.focus()
  }, [step])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleSelect(status) {
    if (status === 'si' || status === 'pd') {
      setPendingStatus(status)
      setName(meta.name || '')
      setStep('name')
    } else if (status === 'clear') {
      onSave('', '')
    } else {
      onSave(buildValue(status, ''), notas)
    }
  }

  function handleConfirmName() {
    onSave(buildValue(pendingStatus, name), notas)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && name.trim()) handleConfirmName()
  }

  return (
    <>
      <div className="mobile-overlay" onClick={onClose} />
      <div className="mobile-sheet">
        <div className="sheet-handle" />
        <div className="sheet-title">{medio.label}{medio.sub ? ` · ${medio.sub}` : ''}</div>
        <div className="sheet-sub">
          {meta.status === 'empty' ? 'Sin asignar' : `Estado actual: ${currentValue}`}
        </div>

        {step === 'options' ? (
          <>
            <div className="sheet-options">
              <button className="sheet-opt" onClick={() => handleSelect('si')}>
                <span className="sheet-dot dot-si" />
                <div>
                  <div className="sheet-opt-label">Sí</div>
                  <div className="sheet-opt-hint">Asignar responsable</div>
                </div>
              </button>
              <button className="sheet-opt" onClick={() => handleSelect('pd')}>
                <span className="sheet-dot dot-pd" />
                <div>
                  <div className="sheet-opt-label">Por definir</div>
                  <div className="sheet-opt-hint">Asignar responsable (opcional)</div>
                </div>
              </button>
              <button className="sheet-opt" onClick={() => handleSelect('no')}>
                <span className="sheet-dot dot-no" />
                <div>
                  <div className="sheet-opt-label">No</div>
                  <div className="sheet-opt-hint">No se utilizará este medio</div>
                </div>
              </button>
              {meta.status !== 'empty' && (
                <button className="sheet-opt" onClick={() => handleSelect('clear')}>
                  <span className="sheet-dot dot-clear" />
                  <div>
                    <div className="sheet-opt-label">Limpiar</div>
                    <div className="sheet-opt-hint">Quitar asignación</div>
                  </div>
                </button>
              )}
            </div>
            {/* Notes toggle */}
            <button className="sheet-notas-toggle" onClick={() => setStep('notas')}>
              Ver detalles
            </button>
          </>
        ) : step === 'name' ? (
          <div className="sheet-name-step">
            <input
              ref={nameRef}
              className="sheet-name-input"
              type="text"
              placeholder="Nombre del responsable"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="sheet-confirm-btn"
              onClick={handleConfirmName}
              disabled={!name.trim()}
            >
              Confirmar
            </button>
            <button className="sheet-back-btn" onClick={() => setStep('options')}>
              Volver
            </button>
          </div>
        ) : (
          <div className="sheet-name-step">
            <div className="sheet-notas-header">
              <span className="sheet-notas-label">Detalles</span>
              <button
                className="sheet-notas-edit-btn"
                onClick={() => document.querySelector('.sheet-notas-textarea')?.focus()}
                title="Editar detalles"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1 12h3l7-7a1.8 1.8 0 00-2.5-2.5l-7 7v2.5z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M7.5 4l2.5 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <textarea
              className="sheet-notas-textarea"
              placeholder="Escribe los detalles aquí..."
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={4}
            />
            <button
              className="sheet-confirm-btn"
              onClick={() => { onSave(currentValue, notas); }}
            >
              Guardar detalles
            </button>
            <button className="sheet-back-btn" onClick={() => setStep('options')}>
              Volver
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Single card ─────────────────────────────────────────────────
function ContentCard({ row, onCellChange, onFieldChange, onDeleteRow }) {
  const [expanded, setExpanded] = useState(false)
  const [sheet, setSheet] = useState(null) // { colId, medio, value, notas }
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(row.nombre)

  // Count assigned medios
  const assignedMedias = MEDIA_COLS.filter(col => {
    const { valor } = getCellData(row.medios, col.id)
    return valor && valor.trim() !== ''
  })

  const propios = MEDIA_COLS.filter(c => c.group === 'ORGANICOS')
  const pagados = MEDIA_COLS.filter(c => c.group === 'ALIANZAS' || c.group === 'PUB_PAGADA')

  function handleSheetSave(newValue, newNotas) {
    if (sheet) onCellChange(row.id, sheet.colId, newValue, newNotas)
    setSheet(null)
  }

  function handleNameBlur() {
    if (nameValue !== row.nombre) onFieldChange(row.id, 'nombre', nameValue)
    setEditingName(false)
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') handleNameBlur()
    if (e.key === 'Escape') { setNameValue(row.nombre); setEditingName(false) }
  }

  function renderMedioSlot(col) {
    const { valor, notas } = getCellData(row.medios, col.id)
    const meta = getCellMeta(valor)
    const statusClass = meta.status === 'empty' ? 'empty-slot' : `val-${meta.status}`

    return (
      <div
        key={col.id}
        className={`mobile-medio-slot ${statusClass}`}
        onClick={(e) => {
          e.stopPropagation()
          setSheet({ colId: col.id, medio: col, value: valor, notas })
        }}
      >
        <div className="mobile-medio-name">{col.label}{col.sub ? ` · ${col.sub}` : ''}</div>
        <div className="mobile-medio-value">
          {meta.status === 'empty' ? 'Tocar para asignar' : meta.display}
        </div>
        {notas && (
          <div className="mobile-medio-has-notes">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1" y="1" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="0.8" />
              <path d="M3 3.5h4M3 5.5h2.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={`mobile-card ${expanded ? 'expanded' : ''}`}>
        {/* ── Header ── */}
        <div className="mobile-card-header" onClick={() => setExpanded(!expanded)}>
          <div className="mobile-card-title-area">
            {editingName ? (
              <input
                className="mobile-card-name-input"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span
                className="mobile-card-title"
                onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true) }}
              >
                {row.nombre || 'Sin nombre'}
              </span>
            )}
            <div className="mobile-card-meta">
              {(() => {
                const { filled, total, pct } = getRowProgress(row.medios)
                const color = pct >= 60 ? '#22c55e' : pct >= 30 ? '#f59e0b' : '#ef4444'
                return (
                  <>
                    <div className="mobile-progress-track">
                      <div className="mobile-progress-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="mobile-card-counter">{filled}/{total} medios</span>
                  </>
                )
              })()}
            </div>
          </div>
          <div className="mobile-card-right">
            <span className="mobile-card-date">
              {row.semana
                ? new Date(row.semana + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
                : '--/--'
              }
            </span>
            <svg className={`mobile-card-arrow ${expanded ? 'rotated' : ''}`} width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* ── Chips (collapsed view) ── */}
        {!expanded && assignedMedias.length > 0 && (
          <div className="mobile-card-chips">
            {assignedMedias.map(col => {
              const { valor } = getCellData(row.medios, col.id)
              const meta = getCellMeta(valor)
              return (
                <span key={col.id} className={`mobile-chip chip-${meta.status}`}>
                  {col.label}{col.sub ? ` · ${col.sub}` : ''}{meta.name ? ` · ${meta.name}` : ''}
                </span>
              )
            })}
          </div>
        )}

        {/* ── Expanded view ── */}
        {expanded && (
          <div className="mobile-card-expand">
            <div className="mobile-section-label">Medios Orgánicos</div>
            <div className="mobile-medio-grid">
              {propios.map(renderMedioSlot)}
            </div>

            <div className="mobile-section-label">Alianzas + Publicidad Pagada</div>
            <div className="mobile-medio-grid">
              {pagados.map(renderMedioSlot)}
            </div>

            {/* ── Card actions ── */}
            <div className="mobile-card-actions">
              <button className="mobile-btn-delete" onClick={() => onDeleteRow(row.id)}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5.833 6v4M8.167 6v4M3 3.5l.5 8a1 1 0 001 .917h5a1 1 0 001-.917l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Eliminar tema
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom sheet ── */}
      {sheet && (
        <BottomSheet
          medio={sheet.medio}
          currentValue={sheet.value}
          currentNotas={sheet.notas}
          onSave={handleSheetSave}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

// ── Main component ──────────────────────────────────────────────
export default function MobileCardView({ rows, onCellChange, onFieldChange, onDeleteRow, totalRows, filterQuery, onClearFilter, onAdd }) {
  return (
    <div className="mobile-card-view">
      {rows.length === 0 ? (
        <div className="mobile-empty">
          {totalRows === 0 ? (
            <>
              <span className="empty-state-icon">📋</span>
              <p className="empty-state-title">Sin temas aún</p>
              <span className="empty-state-sub">Agrega el primero para comenzar</span>
              <button className="empty-state-cta" onClick={onAdd}>+ Agregar tema</button>
            </>
          ) : (
            <>
              <span className="empty-state-icon">🔍</span>
              <p className="empty-state-title">Sin resultados para "{filterQuery}"</p>
              <span className="empty-state-sub">Prueba con otro término</span>
              <button className="empty-state-ghost" onClick={onClearFilter}>✕ Limpiar búsqueda</button>
            </>
          )}
        </div>
      ) : (
        rows.map(row => (
          <ContentCard
            key={row.id}
            row={row}
            onCellChange={onCellChange}
            onFieldChange={onFieldChange}
            onDeleteRow={onDeleteRow}
          />
        ))
      )}
    </div>
  )
}

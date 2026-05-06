import { useState, useEffect, useRef } from 'react'
import { MEDIA_COLS } from '../config'
import { getCellData } from '../utils'
import KebabMenu from '../../shared/components/KebabMenu'

// ── Helpers ─────────────────────────────────────────────────────
function getCellMeta(raw, notas) {
  if (!raw) return { status: 'empty', display: '' }
  const lower = raw.toLowerCase().trim()
  if (lower.startsWith('pd')) {
    const parts = raw.split('/')
    const legacyName = parts[1]?.trim() || ''
    const display = notas?.trim() || legacyName || 'PD'
    return { status: 'pd', display }
  }
  if (lower.startsWith('si')) {
    const parts = raw.split('/')
    const legacyName = parts[1]?.trim() || ''
    const display = notas?.trim() || legacyName || 'Sí'
    return { status: 'si', display }
  }
  return { status: 'empty', display: '' }
}

function buildValue(status, name) {
  if (status === 'si') return name ? `si / ${name}` : 'si'
  if (status === 'pd') return name ? `pd / ${name}` : 'pd'
  return ''
}

function formatDate(dateStr) {
  if (!dateStr) return '--/--'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
}

function formatDateFull(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Bottom sheet de edición de celda (interno) ──────────────────
function CellBottomSheet({ medio, currentValue, currentNotas, onSave, onClose }) {
  const [step,          setStep]          = useState('options')
  const [pendingStatus, setPendingStatus] = useState('si')
  const [name,          setName]          = useState('')
  const [notas,         setNotas]         = useState(currentNotas || '')
  const nameRef = useRef(null)
  const meta    = getCellMeta(currentValue)

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
      const defaultLabels = ['PD', 'Sí']
      setName(defaultLabels.includes(meta.display) ? '' : (meta.display || ''))
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
                <div><div className="sheet-opt-label">Sí</div><div className="sheet-opt-hint">Asignar responsable</div></div>
              </button>
              <button className="sheet-opt" onClick={() => handleSelect('pd')}>
                <span className="sheet-dot dot-pd" />
                <div><div className="sheet-opt-label">Por definir</div><div className="sheet-opt-hint">Responsable opcional</div></div>
              </button>
              {meta.status !== 'empty' && (
                <button className="sheet-opt" onClick={() => handleSelect('clear')}>
                  <span className="sheet-dot dot-clear" />
                  <div><div className="sheet-opt-label">Limpiar</div><div className="sheet-opt-hint">Quitar asignación</div></div>
                </button>
              )}
            </div>
            <button className="sheet-notas-toggle" onClick={() => setStep('notas')}>Ver detalles</button>
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
              onKeyDown={e => e.key === 'Enter' && name.trim() && handleConfirmName()}
            />
            <button className="sheet-confirm-btn" onClick={handleConfirmName} disabled={!name.trim()}>
              Confirmar
            </button>
            <button className="sheet-back-btn" onClick={() => setStep('options')}>Volver</button>
          </div>
        ) : (
          <div className="sheet-name-step">
            <div className="sheet-notas-header">
              <span className="sheet-notas-label">Detalles</span>
            </div>
            <textarea
              className="sheet-notas-textarea"
              placeholder="Escribe los detalles aquí..."
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={4}
            />
            <button className="sheet-confirm-btn" onClick={() => onSave(currentValue, notas)}>
              Guardar detalles
            </button>
            <button className="sheet-back-btn" onClick={() => setStep('options')}>Volver</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Planificación card (reutilizable en padre y subtema) ─────────
function PlanifCard({ planif, temaNombre, onCellChange, onDeleteRow, isReadOnly, isSubtema = false }) {
  const [expanded, setExpanded] = useState(false)
  const [sheet,    setSheet]    = useState(null)

  const assigned = MEDIA_COLS.filter(col => {
    const { valor } = getCellData(planif.medios, col.id)
    return valor && valor.trim() !== ''
  })

  function handleSheetSave(newValue, newNotas) {
    if (sheet) onCellChange(planif.id, sheet.colId, newValue, newNotas)
    setSheet(null)
  }

  function renderSlot(col) {
    const { valor, notas } = getCellData(planif.medios, col.id)
    const meta = getCellMeta(valor, notas)
    return (
      <div
        key={col.id}
        className={`mobile-medio-slot ${meta.status === 'empty' ? 'empty-slot' : `val-${meta.status}`}${isReadOnly ? ' slot-readonly' : ''}`}
        onClick={isReadOnly ? undefined : e => { e.stopPropagation(); setSheet({ colId: col.id, medio: col, value: valor, notas }) }}
      >
        <div className="mobile-medio-name">{col.label}{col.sub ? ` · ${col.sub}` : ''}</div>
        <div className="mobile-medio-value">
          {meta.status === 'empty' ? (isReadOnly ? '—' : 'Tocar para asignar') : meta.display}
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

  const cardClass = [
    'mobile-planif-card',
    expanded ? 'expanded' : '',
    isSubtema ? 'mobile-planif-card-subtema' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <div className={cardClass}>
        <div className="mobile-planif-header" onClick={() => setExpanded(!expanded)}>
          <span className="mobile-planif-date">{formatDate(planif.semana)}</span>
          {!expanded && assigned.length > 0 && (
            <div className="mobile-card-chips">
              {assigned.slice(0, 4).map(col => {
                const { valor, notas } = getCellData(planif.medios, col.id)
                const meta = getCellMeta(valor, notas)
                return (
                  <span key={col.id} className={`mobile-chip chip-${meta.status}`}>
                    {col.label}{meta.display && meta.display !== col.label ? ` · ${meta.display}` : ''}
                  </span>
                )
              })}
              {assigned.length > 4 && <span className="mobile-chip chip-more">+{assigned.length - 4}</span>}
            </div>
          )}
          <svg className={`mobile-card-arrow ${expanded ? 'rotated' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {expanded && (
          <div className="mobile-card-expand">
            <div className="mobile-section-label">Medios Orgánicos</div>
            <div className="mobile-medio-grid">
              {MEDIA_COLS.filter(c => c.group === 'ORGANICOS').map(renderSlot)}
            </div>
            <div className="mobile-section-label">Alianzas + Publicidad Pagada</div>
            <div className="mobile-medio-grid">
              {MEDIA_COLS.filter(c => c.group === 'ALIANZAS' || c.group === 'PUB_PAGADA').map(renderSlot)}
            </div>
            {!isReadOnly && (
              <div className="mobile-card-actions">
                <button className="mobile-btn-delete" onClick={() => onDeleteRow(planif.id)}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5.833 6v4M8.167 6v4M3 3.5l.5 8a1 1 0 001 .917h5a1 1 0 001-.917l.5-8"
                      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Eliminar planificación
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {sheet && !isReadOnly && (
        <CellBottomSheet
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

// ── Subtema card — modelo single-row (1 planif por subtema) ──────
function SubtemaCard({ subtema, onCellChange, onDeleteRow, onEditSubtema, onDeleteSubtema, isReadOnly }) {
  const planif = subtema.planificaciones?.[0] || null

  const kebabItems = isReadOnly ? [] : [
    {
      label: 'Editar subtema',
      icon: '✎',
      onClick: () => onEditSubtema?.(subtema),
    },
    {
      label: 'Eliminar subtema',
      icon: '✕',
      variant: 'danger',
      onClick: () => onDeleteSubtema?.(subtema.id),
    },
  ]

  return (
    <div className="mobile-subtema-card mobile-subtema-card-single">
      {/* Header del subtema */}
      <div className="mobile-subtema-header">
        <div className="mobile-subtema-title-area">
          <span className="mobile-subtema-title">{subtema.nombre || 'Sin nombre'}</span>
          {(subtema.fecha_inicio || subtema.fecha_termino) && (
            <span className="mobile-subtema-fechas">
              {subtema.fecha_inicio ? formatDate(subtema.fecha_inicio) : '---'}
              {' — '}
              {subtema.fecha_termino ? formatDate(subtema.fecha_termino) : '---'}
            </span>
          )}
          {planif?.semana && (
            <span className="mobile-subtema-semana">{formatDate(planif.semana)}</span>
          )}
        </div>
        {!isReadOnly && kebabItems.length > 0 && (
          <KebabMenu
            items={kebabItems}
            ariaLabel={`Acciones para subtema ${subtema.nombre || ''}`}
          />
        )}
      </div>

      {/* Planificación única del subtema */}
      {planif && (
        <PlanifCard
          planif={planif}
          temaNombre={subtema.nombre}
          onCellChange={onCellChange}
          onDeleteRow={onDeleteRow}
          isReadOnly={isReadOnly}
          isSubtema
        />
      )}
    </div>
  )
}

// ── Tema card ────────────────────────────────────────────────────
function TemaCard({
  tema,
  onCellChange,
  onFieldChange,
  onDeleteRow,
  onAddPlanificacion,
  onAddSubtema,
  onEditSubtema,
  onDeleteSubtema,
  onArchiveTema,
  onReactivateTema,
  isArchived,
}) {
  const directPlanifs = tema.planificaciones || []
  const subtemas      = tema.subtemas || []
  const allPlanifs    = [...directPlanifs, ...subtemas.flatMap(s => s.planificaciones || [])]
  const n             = allPlanifs.length
  const nSubtemas     = subtemas.length

  const [expanded, setExpanded] = useState(n <= 1)

  const temaKebabItems = isArchived ? [] : [
    {
      label: 'Editar nombre',
      icon: '✎',
      onClick: () => {
        const newName = window.prompt('Nuevo nombre del tema:', tema.nombre || '')
        if (newName && newName.trim() && newName.trim() !== tema.nombre) {
          onFieldChange?.('renameTema', tema.id, newName.trim())
        }
      },
    },
    ...(nSubtemas === 0 ? [{
      label: 'Agregar fecha al tema',
      icon: '+',
      onClick: () => onAddPlanificacion?.(tema.id),
    }] : []),
    {
      label: 'Agregar subtema',
      icon: '+',
      onClick: () => onAddSubtema?.(tema.id),
    },
  ]

  return (
    <div className={`mobile-tema-card${expanded ? ' expanded' : ''}${isArchived ? ' mobile-tema-archived' : ''} tema-card-padre`}>
      {/* Header del tema */}
      <div className="mobile-tema-header">
        <div className="mobile-tema-title-area" onClick={() => setExpanded(!expanded)}>
          <span className="mobile-tema-title">{tema.nombre || 'Sin nombre'}</span>
          <span className="planif-count">
            {n} {n === 1 ? 'fecha' : 'fechas'}
            {nSubtemas > 0 && (
              <span className="subtema-counter"> · {nSubtemas} subtema{nSubtemas !== 1 ? 's' : ''}</span>
            )}
          </span>
          {tema.origen === 'editorial' && (
            <span className="sync-badge" style={{ fontSize: '0.6rem' }}>Editorial</span>
          )}
          {isArchived && tema.archived_at && (
            <span className="mobile-archived-at">{formatDateFull(tema.archived_at)}</span>
          )}
        </div>
        {/* KebabMenu del tema (solo activos) */}
        {!isArchived && temaKebabItems.length > 0 && (
          <KebabMenu
            items={temaKebabItems}
            ariaLabel={`Acciones para tema ${tema.nombre || ''}`}
          />
        )}
        {/* Botones de acción */}
        <div className="mobile-tema-actions">
          {!isArchived && (
            <button
              className="btn-add-subtema"
              onClick={e => { e.stopPropagation(); onAddSubtema?.(tema.id) }}
              title="Agregar subtema"
            >
              + Subtema
            </button>
          )}
          {!isArchived ? (
            <button
              className="mobile-tema-archive-btn"
              onClick={e => { e.stopPropagation(); onArchiveTema(tema.id) }}
              title="Archivar tema"
              aria-label={`Archivar tema ${tema.nombre}`}
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1.5" y="5.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M1 3.5h12v2H1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <button
              className="mobile-tema-reactivate-btn"
              onClick={e => { e.stopPropagation(); onReactivateTema(tema.id) }}
              title="Reactivar tema"
              aria-label={`Reactivar tema ${tema.nombre}`}
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7A4.5 4.5 0 1 0 7 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M7 2.5L4.5 2.5 4.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        <svg className={`mobile-card-arrow ${expanded ? 'rotated' : ''}`} width="18" height="18" viewBox="0 0 16 16" fill="none" onClick={() => setExpanded(!expanded)}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Contenido expandido */}
      {expanded && (
        <div className="mobile-tema-planifs">
          {/* Planificaciones directas del padre */}
          {directPlanifs.map(planif => (
            <PlanifCard
              key={planif.id}
              planif={planif}
              temaNombre={tema.nombre}
              onCellChange={onCellChange}
              onDeleteRow={onDeleteRow}
              isReadOnly={isArchived}
            />
          ))}

          {/* Subtemas — single-row model */}
          {subtemas.map(sub => (
            <SubtemaCard
              key={sub.id}
              subtema={sub}
              onCellChange={onCellChange}
              onDeleteRow={onDeleteRow}
              onEditSubtema={onEditSubtema}
              onDeleteSubtema={onDeleteSubtema}
              isReadOnly={isArchived}
            />
          ))}

          {/* Empty state: sin directas ni subtemas */}
          {directPlanifs.length === 0 && subtemas.length === 0 && !isArchived && (
            <div className="mobile-planif-empty">
              <button className="btn-add-primera-fecha" onClick={() => onAddPlanificacion(tema.id)}>
                + Agregar primera fecha
              </button>
            </div>
          )}

          {/* Footer: agregar fecha directa */}
          {!isArchived && (directPlanifs.length > 0 || subtemas.length > 0) && (
            <div className="mobile-planif-add">
              <button className="btn-add-otra-fecha" onClick={() => onAddPlanificacion(tema.id)}>
                {directPlanifs.length > 0 ? '+ Agregar otra fecha' : '+ Agregar fecha directa'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────
export default function MobileCardView({
  temas,
  onCellChange,
  onFieldChange,
  onDeleteRow,
  onAddPlanificacion,
  onAddSubtema,
  onEditSubtema,
  onDeleteSubtema,
  onArchiveTema,
  onReactivateTema,
  onStatusChange,
  isArchived = false,
  totalTemas,
  filterQuery,
  onClearFilter,
  onAdd,
}) {
  return (
    <div className={`mobile-card-view${isArchived ? ' mobile-card-view-archived' : ''}`}>
      {temas.length === 0 ? (
        <div className="mobile-empty">
          {totalTemas === 0 ? (
            <>
              <span className="empty-state-icon">{isArchived ? '📦' : '📋'}</span>
              <p className="empty-state-title">{isArchived ? 'Sin temas archivados' : 'Sin temas aún'}</p>
              <span className="empty-state-sub">
                {isArchived ? 'Los temas archivados aparecerán aquí' : 'Agrega el primero para comenzar'}
              </span>
              {!isArchived && <button className="empty-state-cta" onClick={onAdd}>+ Agregar tema</button>}
            </>
          ) : (
            <>
              <span className="empty-state-icon">B</span>
              <p className="empty-state-title">Sin resultados para "{filterQuery}"</p>
              <span className="empty-state-sub">Prueba con otro término</span>
              <button className="empty-state-ghost" onClick={onClearFilter}>Limpiar búsqueda</button>
            </>
          )}
        </div>
      ) : (
        temas.map(tema => (
          <TemaCard
            key={tema.id}
            tema={tema}
            onCellChange={onCellChange}
            onFieldChange={onFieldChange}
            onDeleteRow={onDeleteRow}
            onAddPlanificacion={onAddPlanificacion}
            onAddSubtema={onAddSubtema}
            onEditSubtema={onEditSubtema}
            onDeleteSubtema={onDeleteSubtema}
            onArchiveTema={onArchiveTema}
            onReactivateTema={onReactivateTema}
            isArchived={isArchived}
          />
        ))
      )}
    </div>
  )
}

import { useState, Fragment, memo, useMemo, useCallback } from 'react'
import { MEDIA_COLS, GROUPS, STALE_THRESHOLD_DAYS } from '../config'
import { getCellData } from '../utils'
import CellPopover from './CellPopover'

// ── Constants ──────────────────────────────────────────────────────
const EMPTY_SET = new Set()

// ── Helpers ───────────────────────────────────────────────────────

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

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatDateShort(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// Stats agregando directas + subtemas
function getTemaStats(tema) {
  const today = new Date().toISOString().split('T')[0]
  const allPlanifs = [
    ...(tema.planificaciones || []),
    ...(tema.subtemas || []).flatMap(s => s.planificaciones || []),
  ]
  const sorted = allPlanifs.filter(p => p.semana).map(p => p.semana).sort()
  const future = sorted.filter(d => d >= today)
  const past   = sorted.filter(d => d < today).reverse()
  const targetDate = future[0] || past[0] || null
  const isNext     = future.length > 0
  const activeChannels = MEDIA_COLS.filter(col =>
    allPlanifs.some(p => getCellData(p.medios, col.id).valor?.toLowerCase().startsWith('si'))
  ).length
  return { targetDate, isNext, activeChannels }
}

// ── PlanRow — fila de planificación individual ────────────────────

const PlanRow = memo(function PlanRow({
  planif,
  indent,
  idx,
  activeCols,
  activeGroups,
  collapsedGroups,
  onToggleGroup,
  onOpenPopover,
  onFieldChange,
  onDeleteRow,
  isArchived,
  activePopoverKey,
}) {
  const [hover,        setHover]        = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [editValue,    setEditValue]    = useState('')

  const startEditField = useCallback((field, currentValue) => {
    if (isArchived) return
    setEditingField(field)
    setEditValue(currentValue || '')
  }, [isArchived])

  const commitEditField = useCallback(() => {
    if (editingField) onFieldChange(planif.id, editingField, editValue)
    setEditingField(null)
  }, [editingField, editValue, onFieldChange, planif.id])

  const handleFieldKeyDown = useCallback((e) => {
    if (e.key === 'Enter')  commitEditField()
    if (e.key === 'Escape') setEditingField(null)
  }, [commitEditField])

  const isEditingDate = editingField === 'semana'

  // Prefijo de indentación
  const connector = indent === 2 ? (
    <><span className="planif-connector planif-connector-deep">  </span><span className="planif-connector">└</span></>
  ) : (
    <span className="planif-connector">└</span>
  )

  function renderMediaCells() {
    return activeGroups.flatMap(g => {
      if (collapsedGroups.has(g.id)) {
        return [
          <td
            key={`col-${g.id}`}
            className="group-collapsed-cell"
            onClick={() => onToggleGroup?.(g.id)}
            title="Expandir grupo"
          />,
        ]
      }
      const groupCols = activeCols.filter(c => c.group === g.id)
      return groupCols.map((col, i) => {
        const { valor, notas } = getCellData(planif.medios, col.id)
        const meta    = getCellMeta(valor, notas)
        const cellKey = `${planif.id}:${col.id}`
        const isOpen  = activePopoverKey === cellKey
        const isLast  = i === groupCols.length - 1
        return (
          <td
            key={col.id}
            className={`media-cell status-${meta.status}${isLast ? ' border-group-right' : ''}${isOpen ? ' cell-active' : ''}${isArchived ? ' cell-readonly' : ''}`}
            onClick={isArchived ? undefined : e => {
              const rect = e.currentTarget.getBoundingClientRect()
              onOpenPopover(planif.id, col.id, planif.medios, { x: rect.left, y: rect.bottom })
            }}
            title={isArchived ? (valor || '') : (valor || 'Clic para asignar estado')}
          >
            {meta.display && <span className="cell-text">{meta.display}</span>}
            {notas && <span className="cell-notes-icon" title="Tiene detalles" />}
          </td>
        )
      })
    })
  }

  const rowClass = [
    'planificacion-row',
    idx % 2 === 0 ? 'row-odd' : 'row-even',
    hover ? 'row-hover' : '',
    isArchived ? 'planif-row-archived' : '',
    indent === 2 ? 'planif-under-subtema' : '',
  ].filter(Boolean).join(' ')

  return (
    <tr
      className={rowClass}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td className="sticky-col col-contenidos td-contenidos planif-indent-cell">
        {connector}
      </td>
      <td className="sticky-col col-semana td-semana">
        {!isArchived && isEditingDate ? (
          <input
            className="inline-edit date-edit"
            type="date"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEditField}
            onKeyDown={handleFieldKeyDown}
            autoFocus
          />
        ) : (
          <span
            className={`semana-text${isArchived ? '' : ' semana-editable'}`}
            onClick={isArchived ? undefined : () => startEditField('semana', planif.semana)}
            title={isArchived ? undefined : 'Clic para editar fecha'}
          >
            {planif.semana
              ? formatDate(planif.semana)
              : <em className="placeholder">--/--/----</em>}
          </span>
        )}
      </td>
      {renderMediaCells()}
      <td className="col-actions td-actions">
        {!isArchived && (
          <button
            className="btn-delete"
            onClick={() => onDeleteRow(planif.id)}
            title="Eliminar planificación"
            aria-label="Eliminar planificación"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5.833 6v4M8.167 6v4M3 3.5l.5 8a1 1 0 001 .917h5a1 1 0 001-.917l.5-8"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  )
}, (prev, next) =>
  prev.planif === next.planif &&
  prev.indent === next.indent &&
  prev.idx === next.idx &&
  prev.isArchived === next.isArchived &&
  prev.activePopoverKey === next.activePopoverKey &&
  prev.collapsedGroups === next.collapsedGroups &&
  prev.activeCols === next.activeCols &&
  prev.activeGroups === next.activeGroups &&
  prev.onToggleGroup === next.onToggleGroup &&
  prev.onOpenPopover === next.onOpenPopover &&
  prev.onFieldChange === next.onFieldChange &&
  prev.onDeleteRow === next.onDeleteRow
)

// ── SubtemaRow — header de subtema ────────────────────────────────

const SubtemaRow = memo(function SubtemaRow({
  subtema,
  parentId,
  isExpanded,
  totalColSpan,
  onToggleSubtema,
  onAddPlanificacion,
  onUpdateSubtema,
  isArchived,
}) {
  const [isEditing,  setIsEditing]  = useState(false)
  const [editNombre, setEditNombre] = useState('')

  const startEdit = useCallback(() => {
    if (isArchived) return
    setIsEditing(true)
    setEditNombre(subtema.nombre || '')
  }, [isArchived, subtema.nombre])

  const commitEdit = useCallback(() => {
    if (editNombre.trim()) onUpdateSubtema(subtema.id, { nombre: editNombre.trim() })
    setIsEditing(false)
    setEditNombre('')
  }, [editNombre, onUpdateSubtema, subtema.id])

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter')  commitEdit()
    if (e.key === 'Escape') { setIsEditing(false); setEditNombre('') }
    e.stopPropagation()
  }, [commitEdit])

  const n = subtema.planificaciones?.length || 0

  return (
    <tr className={`subtema-header-row${isExpanded ? ' expanded' : ''}${isArchived ? ' tema-row-archived' : ''}`}>
      <td className="sticky-col col-contenidos subtema-header-sticky-col">
        <div className="subtema-header-name">
          <span className="subtema-indent-spacer" aria-hidden="true" />
          <button
            className={`tema-expand-btn${isExpanded ? ' expanded' : ''}`}
            onClick={() => onToggleSubtema(subtema.id)}
            title={isExpanded ? 'Colapsar fechas' : 'Expandir fechas'}
            aria-label={isExpanded ? `Colapsar fechas de ${subtema.nombre}` : `Expandir fechas de ${subtema.nombre}`}
            aria-expanded={isExpanded}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
              <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isEditing ? (
            <input
              className="subtema-name-edit"
              value={editNombre}
              onChange={e => setEditNombre(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKey}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className="subtema-name-display"
              onDoubleClick={isArchived ? undefined : e => { e.stopPropagation(); startEdit() }}
              title={isArchived ? subtema.nombre : 'Doble clic para editar nombre'}
            >
              {subtema.nombre || <em className="placeholder">Sin nombre</em>}
            </span>
          )}
        </div>
      </td>
      <td colSpan={totalColSpan - 1} className="subtema-info-cell">
        <div className="subtema-info-inner">
          <span className="subtema-planif-count">
            {n} {n === 1 ? 'fecha' : 'fechas'}
          </span>
          {(subtema.fecha_inicio || subtema.fecha_termino) && (
            <span className="subtema-fechas">
              {subtema.fecha_inicio ? formatDate(subtema.fecha_inicio) : '---'}
              {' — '}
              {subtema.fecha_termino ? formatDate(subtema.fecha_termino) : '---'}
            </span>
          )}
          <div className="tema-header-spacer" />
          {!isArchived && (
            <button
              className="btn-add-fecha-subtema"
              onClick={e => { e.stopPropagation(); onAddPlanificacion(subtema.id) }}
              title="Agregar fecha a este subtema"
            >
              + Fecha
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}, (prev, next) =>
  prev.subtema === next.subtema &&
  prev.isExpanded === next.isExpanded &&
  prev.isArchived === next.isArchived &&
  prev.totalColSpan === next.totalColSpan &&
  prev.onToggleSubtema === next.onToggleSubtema &&
  prev.onAddPlanificacion === next.onAddPlanificacion &&
  prev.onUpdateSubtema === next.onUpdateSubtema
)

// ── TemaRow — header del padre (solo header) ──────────────────────

const TemaRow = memo(function TemaRow({
  tema,
  isExpanded,
  totalColSpan,
  onToggleTema,
  onDeleteTema,
  onRenameTema,
  onAddPlanificacion,
  onAddSubtema,
  onArchiveTema,
  onReactivateTema,
  onStatusChange,
  isArchived,
}) {
  const [editingTemaName, setEditingTemaName] = useState('')
  const [isEditingTema,   setIsEditingTema]   = useState(false)

  const { targetDate, isNext, activeChannels } = useMemo(
    () => getTemaStats(tema),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tema.planificaciones, tema.subtemas]
  )

  const allPlanifs = useMemo(() => [
    ...(tema.planificaciones || []),
    ...(tema.subtemas || []).flatMap(s => s.planificaciones || []),
  ], [tema.planificaciones, tema.subtemas])

  const maxSemana = useMemo(() => {
    if (allPlanifs.length === 0) return null
    const dates = allPlanifs.map(p => p.semana).filter(Boolean).sort()
    return dates[dates.length - 1] || null
  }, [allPlanifs])

  const inactiveDays = useMemo(() => {
    if (isArchived || !maxSemana) return 0
    const today = new Date()
    const last  = new Date(maxSemana + 'T12:00:00')
    const days  = Math.floor((today - last) / (1000 * 60 * 60 * 24))
    return days > 30 ? days : 0
  }, [maxSemana, isArchived])

  const isStale = useMemo(() => {
    if (isArchived || tema.status !== 'En desarrollo') return false
    if (allPlanifs.length === 0) return false
    const today = new Date()
    return allPlanifs.every(p => {
      if (!p.semana) return true
      const planDate = new Date(p.semana + 'T12:00:00')
      const diffDays = Math.floor((today - planDate) / (1000 * 60 * 60 * 24))
      return diffDays > STALE_THRESHOLD_DAYS
    })
  }, [allPlanifs, tema.status, isArchived])

  const nDirect   = tema.planificaciones?.length || 0
  const nSubtemas = tema.subtemas?.length || 0
  const nTotal    = allPlanifs.length

  const startEditTema = useCallback((nombre) => {
    if (isArchived) return
    setIsEditingTema(true)
    setEditingTemaName(nombre || '')
  }, [isArchived])

  const commitTemaName = useCallback(() => {
    if (editingTemaName.trim()) onRenameTema(tema.id, editingTemaName.trim())
    setIsEditingTema(false)
    setEditingTemaName('')
  }, [editingTemaName, onRenameTema, tema.id])

  const handleTemaNameKey = useCallback((e) => {
    if (e.key === 'Enter')  commitTemaName()
    if (e.key === 'Escape') { setIsEditingTema(false); setEditingTemaName('') }
    e.stopPropagation()
  }, [commitTemaName])

  return (
    <tr className={`tema-header-row${isExpanded ? ' expanded' : ''}${isArchived ? ' tema-row-archived' : ''}`}>
      {/* Celda sticky: nombre del tema */}
      <td className="sticky-col col-contenidos tema-header-sticky-col">
        <div className="tema-header-name">
          <button
            className={`tema-expand-btn${isExpanded ? ' expanded' : ''}`}
            onClick={() => onToggleTema(tema.id)}
            title={isExpanded ? 'Colapsar' : 'Expandir'}
            aria-label={isExpanded ? `Colapsar ${tema.nombre}` : `Expandir ${tema.nombre}`}
            aria-expanded={isExpanded}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
              <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {isEditingTema ? (
            <input
              className="tema-name-edit"
              value={editingTemaName}
              onChange={e => setEditingTemaName(e.target.value)}
              onBlur={commitTemaName}
              onKeyDown={handleTemaNameKey}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className="tema-nombre"
              onDoubleClick={isArchived ? undefined : e => { e.stopPropagation(); startEditTema(tema.nombre) }}
              title={isArchived ? tema.nombre : 'Doble clic para editar nombre'}
            >
              {tema.nombre || <em className="placeholder">Sin nombre</em>}
            </span>
          )}
          {inactiveDays > 0 && (
            <span
              className="tema-inactive-badge"
              title={`Última planificación: ${formatDate(maxSemana)}. Considera archivar este tema.`}
            >
              Inactivo · {inactiveDays}d
            </span>
          )}
        </div>
      </td>

      {/* Celda info */}
      <td colSpan={totalColSpan - 1} className="tema-header-info-cell">
        <div className="tema-header-info">
          <span className="planif-count">
            {nTotal} {nTotal === 1 ? 'fecha' : 'fechas'}
            {nSubtemas > 0 && (
              <span className="subtema-counter"> · {nSubtemas} subtema{nSubtemas !== 1 ? 's' : ''}</span>
            )}
          </span>
          {tema.origen === 'editorial' && (
            <span className="sync-badge" title="Sincronizado desde Mesa Editorial">Desde Editorial</span>
          )}
          {tema.hito && (
            <span
              className={`tema-hito-badge tema-hito-${tema.hito === 'Ancla' ? 'ancla' : tema.hito === 'Soporte' ? 'soporte' : 'always-on'}`}
              title="Hito sincronizado desde Mesa Editorial"
            >
              {tema.hito}
            </span>
          )}
          {targetDate && (
            <>
              <span className="tema-info-sep">·</span>
              <span className="tema-proxima">
                {isNext ? 'Próxima' : 'Última'}: {formatDate(targetDate)}
              </span>
            </>
          )}
          {activeChannels > 0 && (
            <>
              <span className="tema-info-sep">·</span>
              <span className="tema-canales">
                {activeChannels} canal{activeChannels !== 1 ? 'es' : ''} activo{activeChannels !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {isArchived && tema.archived_at && (
            <>
              <span className="tema-info-sep">·</span>
              <span className="tema-archived-at-label">Archivado el {formatDateShort(tema.archived_at)}</span>
            </>
          )}
          {!isArchived && tema.status && (
            <span
              className={`tema-status-badge tema-status-${tema.status === 'En desarrollo' ? 'en-desarrollo' : tema.status.toLowerCase()}`}
              title={`Status: ${tema.status}`}
            >
              {tema.status === 'Nuevo' && '✦ '}
              {tema.status}
            </span>
          )}
          {!isArchived && tema.status && tema.status !== 'Nuevo' && (
            <select
              className="tema-status-select"
              value={tema.status}
              onChange={e => onStatusChange?.(tema.id, e.target.value)}
              onClick={e => e.stopPropagation()}
              aria-label="Cambiar status del tema"
              title="Cambiar status"
            >
              <option value="En desarrollo">En desarrollo</option>
              <option value="Completado">Completado</option>
            </select>
          )}
          {isStale && (
            <button
              className="tema-stale-badge"
              onClick={e => { e.stopPropagation(); onStatusChange?.(tema.id, 'Completado') }}
              title={`Este tema tiene planificaciones con fecha pasada hace más de ${STALE_THRESHOLD_DAYS} días. Considera marcarlo como completado.`}
              aria-label="Cerrar tema — tiene fechas desfasadas"
            >
              Cerrar tema
            </button>
          )}
          <div className="tema-header-spacer" />
          {!isArchived ? (
            <div className="tema-action-btns">
              <button
                className="btn-add-subtema"
                onClick={e => { e.stopPropagation(); onAddSubtema(tema.id) }}
                title="Agregar subtema"
                aria-label={`Agregar subtema a ${tema.nombre}`}
              >
                + Subtema
              </button>
              <button
                className="tema-archive-btn"
                onClick={e => { e.stopPropagation(); onArchiveTema(tema.id) }}
                title="Archivar tema"
                aria-label={`Archivar tema ${tema.nombre}`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1.5" y="5.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1 3.5h12v2H1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5.5 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                className="tema-trash-btn"
                onClick={e => { e.stopPropagation(); onDeleteTema(tema.id) }}
                title="Eliminar tema"
                aria-label={`Eliminar tema ${tema.nombre}`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5.833 6v4M8.167 6v4M3 3.5l.5 8a1 1 0 001 .917h5a1 1 0 001-.917l.5-8"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              className="tema-reactivate-btn"
              onClick={e => { e.stopPropagation(); onReactivateTema(tema.id) }}
              title="Reactivar tema"
              aria-label={`Reactivar tema ${tema.nombre}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2.5 7A4.5 4.5 0 1 0 7 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M7 2.5L4.5 2.5 4.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Reactivar</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}, (prevProps, nextProps) => {
  const pt = prevProps.tema
  const nt = nextProps.tema
  const samePlanifs =
    pt.planificaciones.length === nt.planificaciones.length &&
    pt.planificaciones.every((p, i) => p === nt.planificaciones[i])
  const sameSubtemas = pt.subtemas === nt.subtemas
  return (
    pt.id === nt.id &&
    pt.nombre === nt.nombre &&
    pt.origen === nt.origen &&
    pt.hito === nt.hito &&
    pt.archived === nt.archived &&
    pt.archived_at === nt.archived_at &&
    pt.status === nt.status &&
    samePlanifs &&
    sameSubtemas &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isArchived === nextProps.isArchived &&
    prevProps.totalColSpan === nextProps.totalColSpan &&
    prevProps.onToggleTema === nextProps.onToggleTema &&
    prevProps.onDeleteTema === nextProps.onDeleteTema &&
    prevProps.onRenameTema === nextProps.onRenameTema &&
    prevProps.onAddPlanificacion === nextProps.onAddPlanificacion &&
    prevProps.onAddSubtema === nextProps.onAddSubtema &&
    prevProps.onArchiveTema === nextProps.onArchiveTema &&
    prevProps.onReactivateTema === nextProps.onReactivateTema &&
    prevProps.onStatusChange === nextProps.onStatusChange
  )
})

// ── Component ─────────────────────────────────────────────────────

export default function MediaTable({
  temas,
  onCellChange,
  onFieldChange,
  onDeleteRow,
  onDeleteTema,
  onRenameTema,
  onAddPlanificacion,
  onAddPlanificacionSubtema,
  onAddSubtema,
  onUpdateSubtema,
  onArchiveTema,
  onReactivateTema,
  onStatusChange,
  isArchived = false,
  totalTemas,
  filterQuery,
  onClearFilter,
  onAdd,
  visibleCols,
  collapsedGroups = new Set(),
  onToggleGroup,
  expandedTemas    = new Set(),
  onToggleTema,
  expandedSubtemas = new Set(),
  onToggleSubtema,
  activeColumnFilters = EMPTY_SET,
  onToggleColumnFilter,
  onClearColumnFilters,
}) {
  const [popover, setPopover] = useState(null)

  const activeCols   = visibleCols || MEDIA_COLS
  const activeGroups = useMemo(
    () => GROUPS.filter(g => activeCols.some(c => c.group === g.id)),
    [activeCols]
  )
  const expandedCols        = activeCols.filter(c => !collapsedGroups.has(c.group))
  const collapsedGroupCount = activeGroups.filter(g => collapsedGroups.has(g.id)).length
  const totalColSpan        = expandedCols.length + collapsedGroupCount + 3

  // Badge de edición activa — busca en directas Y en subtemas
  let editBadgeTema = null, editBadgePlanif = null, editBadgeCol = null
  if (popover) {
    outer: for (const t of temas) {
      const allPlanifs = [
        ...(t.planificaciones || []),
        ...(t.subtemas || []).flatMap(s => s.planificaciones || []),
      ]
      for (const p of allPlanifs) {
        if (p.id === popover.rowId) {
          editBadgeTema   = t
          editBadgePlanif = p
          editBadgeCol    = activeCols.find(c => c.id === popover.colId) || null
          break outer
        }
      }
    }
  }

  const openPopover = useCallback((planifId, colId, medios, position) => {
    if (isArchived) return
    const { valor, notas } = getCellData(medios, colId)
    setPopover({ rowId: planifId, colId, value: valor, notas, position })
  }, [isArchived])

  function handlePopoverSave(newValue, newNotas) {
    if (popover) onCellChange(popover.rowId, popover.colId, newValue, newNotas)
    setPopover(null)
  }

  const activePopoverKey = popover ? `${popover.rowId}:${popover.colId}` : null

  return (
    <div className={`table-wrapper${isArchived ? ' table-wrapper-archived' : ''}`}>
      <div className="table-scroll">
        <table className="media-table">
          <colgroup>
            <col style={{ width: 200, minWidth: 200, maxWidth: 200 }} />
            <col style={{ width: 100, minWidth: 100, maxWidth: 100 }} />
            {activeGroups.flatMap(g => {
              if (collapsedGroups.has(g.id)) return [<col key={g.id} style={{ width: 32 }} />]
              return activeCols.filter(c => c.group === g.id).map(col => (
                <col key={col.id} style={{ width: 90, minWidth: 90 }} />
              ))
            })}
            <col style={{ width: 42, minWidth: 42 }} />
          </colgroup>

          <thead>
            {/* ROW 1: Grupos */}
            <tr className="group-header-row">
              <th scope="col" className="sticky-col col-contenidos group-dark" rowSpan={3}>TEMAS</th>
              <th scope="col" className="sticky-col col-semana group-dark" rowSpan={3}>FECHA</th>
              {activeGroups.map(g => {
                const isCollapsed   = collapsedGroups.has(g.id)
                const groupColCount = activeCols.filter(c => c.group === g.id).length
                const groupSubs     = [...new Set(activeCols.filter(c => c.group === g.id).map(c => c.subgroup).filter(Boolean))]
                const hasSubgroups  = groupSubs.length > 0
                const rowSpan       = (!isCollapsed && !hasSubgroups) ? 2 : 1
                return (
                  <th
                    key={g.id}
                    scope="colgroup"
                    colSpan={isCollapsed ? 1 : groupColCount}
                    rowSpan={rowSpan}
                    className={`group-header ${g.className}${isCollapsed ? ' group-collapsed' : ''}`}
                    onClick={() => onToggleGroup?.(g.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleGroup?.(g.id) } }}
                    tabIndex={0}
                    aria-expanded={!isCollapsed}
                    aria-label={`${g.label} — ${isCollapsed ? 'expandir grupo' : 'colapsar grupo'}`}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span className="group-toggle-icon" aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
                    {isCollapsed ? '' : g.label}
                  </th>
                )
              })}
              <th scope="col" className="col-actions group-dark" rowSpan={3}><span className="sr-only">Acciones</span></th>
            </tr>

            {/* ROW 2: Subgrupos */}
            <tr className="subgroup-header-row">
              {activeGroups.map(g => {
                const isCollapsed  = collapsedGroups.has(g.id)
                const cols         = activeCols.filter(c => c.group === g.id)
                const subs         = [...new Set(cols.map(c => c.subgroup).filter(Boolean))]
                const hasSubgroups = subs.length > 0
                if (isCollapsed)   return <th key={g.id} scope="col" className="subgroup-cell subgroup-collapsed" />
                if (!hasSubgroups) return null
                return subs.map(sg => (
                  <th key={sg} scope="colgroup" colSpan={cols.filter(c => c.subgroup === sg).length} className="subgroup-cell">{sg}</th>
                ))
              })}
            </tr>

            {/* ROW 3: Columnas individuales */}
            <tr className="sub-header-row">
              {activeGroups.map(g => {
                if (collapsedGroups.has(g.id)) return <th key={g.id} scope="col" className="sub-header sub-header-placeholder" />
                return activeCols.filter(c => c.group === g.id).map(col => {
                  const isFiltered = activeColumnFilters.has(col.id)
                  return (
                    <th key={col.id} scope="col" className={`sub-header${isFiltered ? ' sub-header-filtered' : ''}`}>
                      <span className="sub-label">{col.label}</span>
                      {col.sub && <span className="sub-sublabel">{col.sub}</span>}
                      <button
                        className={`col-filter-btn${isFiltered ? ' active' : ''}`}
                        onClick={e => { e.stopPropagation(); onToggleColumnFilter?.(col.id) }}
                        title={isFiltered ? `Quitar filtro de ${col.label}` : `Filtrar por ${col.label}`}
                        aria-label={isFiltered ? `Quitar filtro de ${col.label}` : `Filtrar por ${col.label}`}
                      >
                        {isFiltered ? (
                          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
                            <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path d="M1 2h8L6 5.5V8.5L4 7.5V5.5L1 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    </th>
                  )
                })
              })}
            </tr>
          </thead>

          <tbody>
            {temas.length === 0 ? (
              <tr>
                <td colSpan={totalColSpan} className="empty-state-cell">
                  {totalTemas === 0 ? (
                    <div className="empty-state">
                      <span className="empty-state-icon">{isArchived ? '📦' : '📋'}</span>
                      <p className="empty-state-title">{isArchived ? 'Sin temas archivados' : 'Sin temas aún'}</p>
                      <span className="empty-state-sub">
                        {isArchived ? 'Los temas que archives aparecerán aquí' : 'Agrega el primero para comenzar la planificación'}
                      </span>
                      {!isArchived && <button className="empty-state-cta" onClick={onAdd}>+ Agregar tema</button>}
                    </div>
                  ) : activeColumnFilters.size > 0 ? (
                    <div className="empty-state">
                      <span className="empty-state-icon">Fil</span>
                      <p className="empty-state-title">Sin temas con datos en las columnas filtradas</p>
                      <span className="empty-state-sub">
                        Ningún tema tiene contenido en {activeColumnFilters.size === 1 ? 'la columna seleccionada' : 'las columnas seleccionadas'}
                      </span>
                      <button className="empty-state-ghost" onClick={onClearColumnFilters}>
                        Limpiar filtros de columna
                      </button>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-icon">B</span>
                      <p className="empty-state-title">Sin resultados para "{filterQuery}"</p>
                      <span className="empty-state-sub">Prueba con otro término de búsqueda</span>
                      <button className="empty-state-ghost" onClick={onClearFilter}>Limpiar búsqueda</button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              temas.map(tema => {
                const isTemaExpanded = expandedTemas.has(tema.id)
                const directPlanifs  = tema.planificaciones || []
                const subtemas       = tema.subtemas || []

                // activePopoverKey para planifs directas
                const directPopoverKey = popover && directPlanifs.some(p => p.id === popover.rowId)
                  ? activePopoverKey : null

                return (
                  <Fragment key={tema.id}>
                    {/* Header del padre */}
                    <TemaRow
                      tema={tema}
                      isExpanded={isTemaExpanded}
                      totalColSpan={totalColSpan}
                      onToggleTema={onToggleTema}
                      onDeleteTema={onDeleteTema}
                      onRenameTema={onRenameTema}
                      onAddPlanificacion={onAddPlanificacion}
                      onAddSubtema={onAddSubtema}
                      onArchiveTema={onArchiveTema}
                      onReactivateTema={onReactivateTema}
                      onStatusChange={onStatusChange}
                      isArchived={isArchived}
                    />

                    {/* Planificaciones directas del padre */}
                    {isTemaExpanded && directPlanifs.map((planif, idx) => (
                      <PlanRow
                        key={planif.id}
                        planif={planif}
                        indent={1}
                        idx={idx}
                        activeCols={activeCols}
                        activeGroups={activeGroups}
                        collapsedGroups={collapsedGroups}
                        onToggleGroup={onToggleGroup}
                        onOpenPopover={openPopover}
                        onFieldChange={onFieldChange}
                        onDeleteRow={onDeleteRow}
                        isArchived={isArchived}
                        activePopoverKey={directPopoverKey}
                      />
                    ))}

                    {/* Subtemas y sus planificaciones */}
                    {isTemaExpanded && subtemas.map(sub => {
                      const isSubExpanded = expandedSubtemas.has(sub.id)
                      const subPlanifs    = sub.planificaciones || []
                      const subPopoverKey = popover && subPlanifs.some(p => p.id === popover.rowId)
                        ? activePopoverKey : null

                      return (
                        <Fragment key={sub.id}>
                          <SubtemaRow
                            subtema={sub}
                            parentId={tema.id}
                            isExpanded={isSubExpanded}
                            totalColSpan={totalColSpan}
                            onToggleSubtema={onToggleSubtema}
                            onAddPlanificacion={onAddPlanificacionSubtema || onAddPlanificacion}
                            onUpdateSubtema={onUpdateSubtema}
                            isArchived={isArchived}
                          />
                          {isSubExpanded && subPlanifs.map((planif, idx) => (
                            <PlanRow
                              key={planif.id}
                              planif={planif}
                              indent={2}
                              idx={idx}
                              activeCols={activeCols}
                              activeGroups={activeGroups}
                              collapsedGroups={collapsedGroups}
                              onToggleGroup={onToggleGroup}
                              onOpenPopover={openPopover}
                              onFieldChange={onFieldChange}
                              onDeleteRow={onDeleteRow}
                              isArchived={isArchived}
                              activePopoverKey={subPopoverKey}
                            />
                          ))}
                          {/* Sin planifs en subtema */}
                          {isSubExpanded && subPlanifs.length === 0 && !isArchived && (
                            <tr className="planif-empty-row">
                              <td colSpan={totalColSpan} className="planif-empty-cell">
                                <button
                                  className="btn-add-primera-fecha"
                                  onClick={() => (onAddPlanificacionSubtema || onAddPlanificacion)(sub.id)}
                                >
                                  + Agregar primera fecha al subtema
                                </button>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}

                    {/* Footer del padre: botones agregar fecha / agregar otra fecha */}
                    {isTemaExpanded && !isArchived && directPlanifs.length === 0 && subtemas.length === 0 && (
                      <tr className="planif-empty-row">
                        <td colSpan={totalColSpan} className="planif-empty-cell">
                          <button
                            className="btn-add-primera-fecha"
                            onClick={() => onAddPlanificacion(tema.id)}
                          >
                            + Agregar primera fecha
                          </button>
                        </td>
                      </tr>
                    )}
                    {isTemaExpanded && !isArchived && (directPlanifs.length > 0 || subtemas.length > 0) && (
                      <tr className="planif-add-row">
                        <td colSpan={totalColSpan} className="planif-add-cell">
                          {directPlanifs.length > 0 && (
                            <button
                              className="btn-add-otra-fecha"
                              onClick={() => onAddPlanificacion(tema.id)}
                            >
                              + Agregar otra fecha
                            </button>
                          )}
                          {directPlanifs.length === 0 && subtemas.length > 0 && (
                            <button
                              className="btn-add-otra-fecha"
                              onClick={() => onAddPlanificacion(tema.id)}
                            >
                              + Agregar fecha directa
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Badge de edición activa */}
      {popover && editBadgeTema && (
        <div className="cell-edit-badge">
          Editando: <strong>{editBadgeTema.nombre}</strong>
          {editBadgePlanif?.semana && <> · {formatDate(editBadgePlanif.semana)}</>}
          {editBadgeCol && (
            <> · {editBadgeCol.label}{editBadgeCol.sub ? ` ${editBadgeCol.sub}` : ''}</>
          )}
        </div>
      )}

      {/* Popover de celda */}
      {popover && !isArchived && (
        <CellPopover
          value={popover.value}
          notas={popover.notas}
          position={popover.position}
          onSave={handlePopoverSave}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  )
}

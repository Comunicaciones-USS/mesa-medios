import { useState, Fragment, memo, useMemo, useCallback } from 'react'
import { MEDIA_COLS, GROUPS, STALE_THRESHOLD_DAYS } from '../config'
import { getCellData } from '../utils'
import CellPopover from './CellPopover'

// ── Helpers ───────────────────────────────────────────────────────

function getCellMeta(raw) {
  if (!raw) return { status: 'empty', display: '', name: '' }
  const lower = raw.toLowerCase().trim()
  if (lower === 'no') return { status: 'no', display: 'No', name: '' }
  if (lower.startsWith('pd')) {
    const parts = raw.split('/')
    const name  = parts[1]?.trim() || ''
    return { status: 'pd', display: name || 'PD', name }
  }
  if (lower.startsWith('si')) {
    const parts = raw.split('/')
    const name  = parts[1]?.trim() || 'Sí'
    return { status: 'si', display: name, name }
  }
  return { status: 'empty', display: raw, name: '' }
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

// Estadísticas para la barra del tema (próxima fecha, canales activos)
function getTemaStats(tema) {
  const today  = new Date().toISOString().split('T')[0]
  const sorted = tema.planificaciones
    .filter(p => p.semana)
    .map(p => p.semana)
    .sort()
  const future = sorted.filter(d => d >= today)
  const past   = sorted.filter(d => d < today).reverse()

  const targetDate = future[0] || past[0] || null
  const isNext     = future.length > 0

  const activeChannels = MEDIA_COLS.filter(col =>
    tema.planificaciones.some(p =>
      getCellData(p.medios, col.id).valor?.toLowerCase().startsWith('si')
    )
  ).length

  return { targetDate, isNext, activeChannels }
}

// ── TemaRow — componente memoizado por tema ───────────────────────

const TemaRow = memo(function TemaRow({
  tema,
  isExpanded,
  activeCols,
  activeGroups,
  collapsedGroups,
  totalColSpan,
  onToggleTema,
  onToggleGroup,
  onOpenPopover,
  onCellChange,
  onFieldChange,
  onDeleteRow,
  onDeleteTema,
  onRenameTema,
  onAddPlanificacion,
  onArchiveTema,
  onReactivateTema,
  onStatusChange,
  isArchived,
  activePopoverKey,
}) {
  const [hoverPlanif,     setHoverPlanif]     = useState(null)
  const [editingField,    setEditingField]    = useState(null)
  const [editValue,       setEditValue]       = useState('')
  const [editingTemaName, setEditingTemaName] = useState('')
  const [isEditingTema,   setIsEditingTema]   = useState(false)

  const { targetDate, isNext, activeChannels } = useMemo(
    () => getTemaStats(tema),
    [tema.planificaciones] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Badge de inactividad: solo en tab activos, temas con última planif > 30 días
  const maxSemana = useMemo(() => {
    if (tema.planificaciones.length === 0) return null
    const dates = tema.planificaciones.map(p => p.semana).filter(Boolean).sort()
    return dates[dates.length - 1] || null
  }, [tema.planificaciones])

  const inactiveDays = useMemo(() => {
    if (isArchived || !maxSemana) return 0
    const today = new Date()
    const last  = new Date(maxSemana + 'T12:00:00')
    const days  = Math.floor((today - last) / (1000 * 60 * 60 * 24))
    return days > 30 ? days : 0
  }, [maxSemana, isArchived])

  const n = tema.planificaciones.length

  // ── Edición inline de fecha ──────────────────────────────────
  const startEditField = useCallback((planifId, field, currentValue) => {
    if (isArchived) return
    setEditingField({ rowId: planifId, field })
    setEditValue(currentValue || '')
  }, [isArchived])

  const commitEditField = useCallback(() => {
    if (editingField) onFieldChange(editingField.rowId, editingField.field, editValue)
    setEditingField(null)
  }, [editingField, editValue, onFieldChange])

  const handleFieldKeyDown = useCallback((e) => {
    if (e.key === 'Enter')  commitEditField()
    if (e.key === 'Escape') setEditingField(null)
  }, [commitEditField])

  // ── Edición inline de nombre del tema ───────────────────────
  const startEditTema = useCallback((nombre) => {
    if (isArchived) return
    setIsEditingTema(true)
    setEditingTemaName(nombre || '')
  }, [isArchived])

  const commitTemaName = useCallback(() => {
    if (editingTemaName.trim()) {
      onRenameTema(tema.id, editingTemaName.trim())
    }
    setIsEditingTema(false)
    setEditingTemaName('')
  }, [editingTemaName, onRenameTema, tema.id])

  const handleTemaNameKey = useCallback((e) => {
    if (e.key === 'Enter')  commitTemaName()
    if (e.key === 'Escape') { setIsEditingTema(false); setEditingTemaName('') }
    e.stopPropagation()
  }, [commitTemaName])

  // ── Celdas de medios de una planificación ───────────────────
  function renderMediaCells(planif) {
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
        const meta   = getCellMeta(valor)
        const cellKey = `${planif.id}:${col.id}`
        const isOpen = activePopoverKey === cellKey
        const isLast = i === groupCols.length - 1
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

  return (
    <Fragment>
      {/* ────── HEADER DEL TEMA ────────────────────────── */}
      <tr className={`tema-header-row${isExpanded ? ' expanded' : ''}${isArchived ? ' tema-row-archived' : ''}`}>
        {/* Celda sticky: nombre del tema */}
        <td className="sticky-col col-contenidos tema-header-sticky-col">
          <div className="tema-header-name">
            <button
              className={`tema-expand-btn${isExpanded ? ' expanded' : ''}`}
              onClick={() => onToggleTema(tema.id)}
              title={isExpanded ? 'Colapsar fechas' : 'Expandir fechas'}
              aria-label={isExpanded ? `Colapsar fechas de ${tema.nombre}` : `Expandir fechas de ${tema.nombre}`}
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
                title={isArchived ? tema.nombre : 'Doble clic para editar el nombre'}
              >
                {tema.nombre || <em className="placeholder">Sin nombre</em>}
              </span>
            )}
            {/* Badge inactividad (solo tab activos) */}
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

        {/* Celda info: badges + datos + acciones */}
        <td colSpan={totalColSpan - 1} className="tema-header-info-cell">
          <div className="tema-header-info">
            <span className="planif-count">
              {n} {n === 1 ? 'fecha' : 'fechas'}
            </span>
            {tema.origen === 'editorial' && (
              <span className="sync-badge" title="Sincronizado desde Mesa Editorial">
                Desde Editorial
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
            {/* Archivado el — solo en tab archivados */}
            {isArchived && tema.archived_at && (
              <>
                <span className="tema-info-sep">·</span>
                <span className="tema-archived-at-label">
                  Archivado el {formatDateShort(tema.archived_at)}
                </span>
              </>
            )}
            {/* Badge de status del tema */}
            {!isArchived && tema.status && (
              <span
                className={`tema-status-badge tema-status-${tema.status === 'En desarrollo' ? 'en-desarrollo' : tema.status.toLowerCase()}`}
                title={`Status: ${tema.status}`}
              >
                {tema.status === 'Nuevo' && '✦ '}
                {tema.status}
              </span>
            )}

            {/* Select para cambiar status manualmente (solo tab activos) */}
            {!isArchived && (
              <select
                className="tema-status-select"
                value={tema.status || 'Nuevo'}
                onChange={e => { e.stopPropagation(); onStatusChange?.(tema.id, e.target.value) }}
                onClick={e => e.stopPropagation()}
                aria-label="Cambiar status del tema"
                title="Cambiar status"
              >
                <option value="Nuevo">Nuevo</option>
                <option value="En desarrollo">En desarrollo</option>
                <option value="Completado">Completado</option>
              </select>
            )}
            <div className="tema-header-spacer" />
            {/* Botones de acción: distintos según tab */}
            {!isArchived ? (
              <div className="tema-action-btns">
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

      {/* ────── FILAS DE PLANIFICACIONES (expandido) ────── */}
      {isExpanded && tema.planificaciones.map((planif, idx) => {
        const isEditingDate = editingField?.rowId === planif.id && editingField?.field === 'semana'
        return (
          <tr
            key={planif.id}
            className={`planificacion-row ${idx % 2 === 0 ? 'row-odd' : 'row-even'}${hoverPlanif === planif.id ? ' row-hover' : ''}${isArchived ? ' planif-row-archived' : ''}`}
            onMouseEnter={() => setHoverPlanif(planif.id)}
            onMouseLeave={() => setHoverPlanif(null)}
          >
            {/* TEMAS col: indentación */}
            <td className="sticky-col col-contenidos td-contenidos planif-indent-cell">
              <span className="planif-connector">└</span>
            </td>

            {/* FECHA col: edición inline */}
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
                  onClick={isArchived ? undefined : () => startEditField(planif.id, 'semana', planif.semana)}
                  title={isArchived ? undefined : 'Clic para editar fecha'}
                >
                  {planif.semana
                    ? formatDate(planif.semana)
                    : <em className="placeholder">--/--/----</em>}
                </span>
              )}
            </td>

            {/* Celdas de medios */}
            {renderMediaCells(planif)}

            {/* Acción: eliminar planificación (solo tab activos) */}
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
      })}

      {/* ────── SIN PLANIFICACIONES ──────────────────────── */}
      {isExpanded && n === 0 && !isArchived && (
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

      {/* ────── FOOTER: agregar otra fecha (solo tab activos) ─── */}
      {isExpanded && n > 0 && !isArchived && (
        <tr className="planif-add-row">
          <td colSpan={totalColSpan} className="planif-add-cell">
            <button
              className="btn-add-otra-fecha"
              onClick={() => onAddPlanificacion(tema.id)}
            >
              + Agregar otra fecha
            </button>
          </td>
        </tr>
      )}
    </Fragment>
  )
}, (prevProps, nextProps) => {
  const pt = prevProps.tema
  const nt = nextProps.tema
  const samePlanifs =
    pt.planificaciones.length === nt.planificaciones.length &&
    pt.planificaciones.every((p, i) => p === nt.planificaciones[i])
  return (
    pt.id === nt.id &&
    pt.nombre === nt.nombre &&
    pt.origen === nt.origen &&
    pt.archived === nt.archived &&
    pt.archived_at === nt.archived_at &&
    pt.status === nt.status &&
    samePlanifs &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isArchived === nextProps.isArchived &&
    prevProps.collapsedGroups === nextProps.collapsedGroups &&
    prevProps.activeCols === nextProps.activeCols &&
    prevProps.activeGroups === nextProps.activeGroups &&
    prevProps.totalColSpan === nextProps.totalColSpan &&
    prevProps.activePopoverKey === nextProps.activePopoverKey &&
    prevProps.onToggleTema === nextProps.onToggleTema &&
    prevProps.onToggleGroup === nextProps.onToggleGroup &&
    prevProps.onOpenPopover === nextProps.onOpenPopover &&
    prevProps.onCellChange === nextProps.onCellChange &&
    prevProps.onFieldChange === nextProps.onFieldChange &&
    prevProps.onDeleteRow === nextProps.onDeleteRow &&
    prevProps.onDeleteTema === nextProps.onDeleteTema &&
    prevProps.onRenameTema === nextProps.onRenameTema &&
    prevProps.onAddPlanificacion === nextProps.onAddPlanificacion &&
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
  expandedTemas   = new Set(),
  onToggleTema,
}) {
  const [popover, setPopover] = useState(null)

  // ── Cols ──────────────────────────────────────────────────────
  const activeCols    = visibleCols || MEDIA_COLS
  const activeGroups  = useMemo(
    () => GROUPS.filter(g => activeCols.some(c => c.group === g.id)),
    [activeCols]
  )
  const expandedCols        = activeCols.filter(c => !collapsedGroups.has(c.group))
  const collapsedGroupCount = activeGroups.filter(g => collapsedGroups.has(g.id)).length
  const totalColSpan = expandedCols.length + collapsedGroupCount + 3

  // Badge de edición activa
  let editBadgeTema = null, editBadgePlanif = null, editBadgeCol = null
  if (popover) {
    outer: for (const t of temas) {
      for (const p of t.planificaciones) {
        if (p.id === popover.rowId) {
          editBadgeTema   = t
          editBadgePlanif = p
          editBadgeCol    = activeCols.find(c => c.id === popover.colId) || null
          break outer
        }
      }
    }
  }

  // ── Popover ────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────
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
                return activeCols.filter(c => c.group === g.id).map(col => (
                  <th key={col.id} scope="col" className="sub-header">
                    <span className="sub-label">{col.label}</span>
                    {col.sub && <span className="sub-sublabel">{col.sub}</span>}
                  </th>
                ))
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
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-icon">🔍</span>
                      <p className="empty-state-title">Sin resultados para "{filterQuery}"</p>
                      <span className="empty-state-sub">Prueba con otro término de búsqueda</span>
                      <button className="empty-state-ghost" onClick={onClearFilter}>✕ Limpiar búsqueda</button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              temas.map(tema => {
                const isExpanded = expandedTemas.has(tema.id)
                const temaActivePopoverKey = popover &&
                  tema.planificaciones.some(p => p.id === popover.rowId)
                  ? activePopoverKey
                  : null

                return (
                  <TemaRow
                    key={tema.id}
                    tema={tema}
                    isExpanded={isExpanded}
                    activeCols={activeCols}
                    activeGroups={activeGroups}
                    collapsedGroups={collapsedGroups}
                    totalColSpan={totalColSpan}
                    onToggleTema={onToggleTema}
                    onToggleGroup={onToggleGroup}
                    onOpenPopover={openPopover}
                    onCellChange={onCellChange}
                    onFieldChange={onFieldChange}
                    onDeleteRow={onDeleteRow}
                    onDeleteTema={onDeleteTema}
                    onRenameTema={onRenameTema}
                    onAddPlanificacion={onAddPlanificacion}
                    onArchiveTema={onArchiveTema}
                    onReactivateTema={onReactivateTema}
                    onStatusChange={onStatusChange}
                    isArchived={isArchived}
                    activePopoverKey={temaActivePopoverKey}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── BADGE de edición activa ─────────────────────────────── */}
      {popover && editBadgeTema && (
        <div className="cell-edit-badge">
          Editando: <strong>{editBadgeTema.nombre}</strong>
          {editBadgePlanif?.semana && <> · {formatDate(editBadgePlanif.semana)}</>}
          {editBadgeCol && (
            <> · {editBadgeCol.label}{editBadgeCol.sub ? ` ${editBadgeCol.sub}` : ''}</>
          )}
        </div>
      )}

      {/* ── POPOVER de celda ─────────────────────────────────────── */}
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

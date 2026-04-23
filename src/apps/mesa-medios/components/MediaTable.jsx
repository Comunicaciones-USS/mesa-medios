import { useState, Fragment, memo, useMemo, useCallback } from 'react'
import { MEDIA_COLS, GROUPS } from '../config'
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
  // Props de popover activo: pasadas desde MediaTable para que
  // la celda activa pueda mostrarse como active sin re-renderizar
  // toda la tabla (solo este TemaRow se re-renderiza).
  activePopoverKey,  // `${planifId}:${colId}` | null
}) {
  // Estado per-row: hover, edición de fecha y nombre de tema
  const [hoverPlanif,     setHoverPlanif]     = useState(null)
  const [editingField,    setEditingField]    = useState(null) // { rowId, field }
  const [editValue,       setEditValue]       = useState('')
  const [editingTemaName, setEditingTemaName] = useState('')
  const [isEditingTema,   setIsEditingTema]   = useState(false)

  // Estadísticas del tema memoizadas
  const { targetDate, isNext, activeChannels } = useMemo(
    () => getTemaStats(tema),
    [tema.planificaciones] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const n = tema.planificaciones.length

  // ── Edición inline de fecha ──────────────────────────────────
  const startEditField = useCallback((planifId, field, currentValue) => {
    setEditingField({ rowId: planifId, field })
    setEditValue(currentValue || '')
  }, [])

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
    setIsEditingTema(true)
    setEditingTemaName(nombre || '')
  }, [])

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
            className={`media-cell status-${meta.status}${isLast ? ' border-group-right' : ''}${isOpen ? ' cell-active' : ''}`}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              onOpenPopover(planif.id, col.id, planif.medios, { x: rect.left, y: rect.bottom })
            }}
            title={valor || 'Clic para asignar estado'}
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
      <tr className={`tema-header-row${isExpanded ? ' expanded' : ''}`}>
        {/* Celda sticky: nombre del tema (siempre visible) */}
        <td className="sticky-col col-contenidos tema-header-sticky-col">
          <div className="tema-header-name">
            <button
              className={`tema-expand-btn${isExpanded ? ' expanded' : ''}`}
              onClick={() => onToggleTema(tema.id)}
              title={isExpanded ? 'Colapsar' : 'Expandir fechas'}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
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
                onDoubleClick={e => { e.stopPropagation(); startEditTema(tema.nombre) }}
                title="Doble clic para editar el nombre"
              >
                {tema.nombre || <em className="placeholder">Sin nombre</em>}
              </span>
            )}
          </div>
        </td>

        {/* Celda info: badges + datos + trash */}
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
            <div className="tema-header-spacer" />
            <button
              className="tema-trash-btn"
              onClick={e => { e.stopPropagation(); onDeleteTema(tema.id) }}
              title="Eliminar tema"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5.833 6v4M8.167 6v4M3 3.5l.5 8a1 1 0 001 .917h5a1 1 0 001-.917l.5-8"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {/* ────── FILAS DE PLANIFICACIONES (expandido) ────── */}
      {isExpanded && tema.planificaciones.map((planif, idx) => {
        const isEditingDate = editingField?.rowId === planif.id && editingField?.field === 'semana'
        return (
          <tr
            key={planif.id}
            className={`planificacion-row ${idx % 2 === 0 ? 'row-odd' : 'row-even'}${hoverPlanif === planif.id ? ' row-hover' : ''}`}
            onMouseEnter={() => setHoverPlanif(planif.id)}
            onMouseLeave={() => setHoverPlanif(null)}
          >
            {/* TEMAS col: indentación */}
            <td className="sticky-col col-contenidos td-contenidos planif-indent-cell">
              <span className="planif-connector">└</span>
            </td>

            {/* FECHA col: edición inline */}
            <td className="sticky-col col-semana td-semana">
              {isEditingDate ? (
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
                  className="semana-text"
                  onClick={() => startEditField(planif.id, 'semana', planif.semana)}
                  title="Clic para editar fecha"
                >
                  {planif.semana
                    ? formatDate(planif.semana)
                    : <em className="placeholder">--/--/----</em>}
                </span>
              )}
            </td>

            {/* Celdas de medios */}
            {renderMediaCells(planif)}

            {/* Acción: eliminar planificación */}
            <td className="col-actions td-actions">
              <button
                className="btn-delete"
                onClick={() => onDeleteRow(planif.id)}
                title="Eliminar planificación"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5.833 6v4M8.167 6v4M3 3.5l.5 8a1 1 0 001 .917h5a1 1 0 001-.917l.5-8"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </td>
          </tr>
        )
      })}

      {/* ────── SIN PLANIFICACIONES ──────────────────────── */}
      {isExpanded && n === 0 && (
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

      {/* ────── FOOTER: agregar otra fecha ───────────────── */}
      {isExpanded && n > 0 && (
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
  // Comparación por contenido: displayTemas crea nuevos wrappers { ...tema } en cada render,
  // por lo que la comparación por referencia (===) siempre falla. Comparamos campos escalares
  // y verificamos identidad de cada planificacion individualmente.
  const pt = prevProps.tema
  const nt = nextProps.tema
  const samePlanifs =
    pt.planificaciones.length === nt.planificaciones.length &&
    pt.planificaciones.every((p, i) => p === nt.planificaciones[i])
  return (
    pt.id === nt.id &&
    pt.nombre === nt.nombre &&
    pt.origen === nt.origen &&
    samePlanifs &&
    prevProps.isExpanded === nextProps.isExpanded &&
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
    prevProps.onAddPlanificacion === nextProps.onAddPlanificacion
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

  const activeCols    = visibleCols || MEDIA_COLS
  const activeGroups  = useMemo(
    () => GROUPS.filter(g => activeCols.some(c => c.group === g.id)),
    [activeCols]
  )
  const expandedCols        = activeCols.filter(c => !collapsedGroups.has(c.group))
  const collapsedGroupCount = activeGroups.filter(g => collapsedGroups.has(g.id)).length
  // 1 TEMAS col + 1 FECHA col + media cols + 1 per collapsed group + 1 actions
  const totalColSpan = expandedCols.length + collapsedGroupCount + 3

  // Contexto para el badge de edición activa
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
    const { valor, notas } = getCellData(medios, colId)
    setPopover({ rowId: planifId, colId, value: valor, notas, position })
  }, [])

  function handlePopoverSave(newValue, newNotas) {
    if (popover) onCellChange(popover.rowId, popover.colId, newValue, newNotas)
    setPopover(null)
  }

  const activePopoverKey = popover ? `${popover.rowId}:${popover.colId}` : null

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table className="media-table">
          {/* colgroup fija anchos de columnas sticky para evitar estiramientos al colapsar grupos */}
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
              <th className="sticky-col col-contenidos group-dark" rowSpan={3}>TEMAS</th>
              <th className="sticky-col col-semana group-dark" rowSpan={3}>FECHA</th>
              {activeGroups.map(g => {
                const isCollapsed   = collapsedGroups.has(g.id)
                const groupColCount = activeCols.filter(c => c.group === g.id).length
                const groupSubs     = [...new Set(activeCols.filter(c => c.group === g.id).map(c => c.subgroup).filter(Boolean))]
                const hasSubgroups  = groupSubs.length > 0
                const rowSpan       = (!isCollapsed && !hasSubgroups) ? 2 : 1
                return (
                  <th
                    key={g.id}
                    colSpan={isCollapsed ? 1 : groupColCount}
                    rowSpan={rowSpan}
                    className={`group-header ${g.className}${isCollapsed ? ' group-collapsed' : ''}`}
                    onClick={() => onToggleGroup?.(g.id)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    <span className="group-toggle-icon">{isCollapsed ? '▸' : '▾'}</span>
                    {isCollapsed ? '' : g.label}
                  </th>
                )
              })}
              <th className="col-actions group-dark" rowSpan={3} />
            </tr>

            {/* ROW 2: Subgrupos */}
            <tr className="subgroup-header-row">
              {activeGroups.map(g => {
                const isCollapsed  = collapsedGroups.has(g.id)
                const cols         = activeCols.filter(c => c.group === g.id)
                const subs         = [...new Set(cols.map(c => c.subgroup).filter(Boolean))]
                const hasSubgroups = subs.length > 0
                if (isCollapsed)   return <th key={g.id} className="subgroup-cell subgroup-collapsed" />
                if (!hasSubgroups) return null
                return subs.map(sg => (
                  <th key={sg} colSpan={cols.filter(c => c.subgroup === sg).length} className="subgroup-cell">{sg}</th>
                ))
              })}
            </tr>

            {/* ROW 3: Columnas individuales */}
            <tr className="sub-header-row">
              {activeGroups.map(g => {
                if (collapsedGroups.has(g.id)) return <th key={g.id} className="sub-header sub-header-placeholder" />
                return activeCols.filter(c => c.group === g.id).map(col => (
                  <th key={col.id} className="sub-header">
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
                      <span className="empty-state-icon">📋</span>
                      <p className="empty-state-title">Sin temas aún</p>
                      <span className="empty-state-sub">Agrega el primero para comenzar la planificación</span>
                      <button className="empty-state-cta" onClick={onAdd}>+ Agregar tema</button>
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
                // Calcular si el popover activo es para una planif de este tema,
                // para pasar solo la clave escalar y no el objeto entero.
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
                    activePopoverKey={temaActivePopoverKey}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── BADGE de edición activa (sticky) ─────────────────────────── */}
      {popover && editBadgeTema && (
        <div className="cell-edit-badge">
          Editando: <strong>{editBadgeTema.nombre}</strong>
          {editBadgePlanif?.semana && <> · {formatDate(editBadgePlanif.semana)}</>}
          {editBadgeCol && (
            <> · {editBadgeCol.label}{editBadgeCol.sub ? ` ${editBadgeCol.sub}` : ''}</>
          )}
        </div>
      )}

      {/* ── POPOVER de celda ─────────────────────────────────────────── */}
      {popover && (
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

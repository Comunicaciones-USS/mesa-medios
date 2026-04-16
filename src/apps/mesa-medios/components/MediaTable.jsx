import { useState } from 'react'
import { MEDIA_COLS, GROUPS } from '../config'
import { getCellData } from '../utils'
import CellPopover from './CellPopover'

// Devuelve el estado agregado de una lista de valores (prioridad: si > pd > no > empty)
function getAggregatedStatus(valores) {
  if (valores.some(v => v && v.toLowerCase().startsWith('si'))) return 'si'
  if (valores.some(v => v && v.toLowerCase().startsWith('pd'))) return 'pd'
  if (valores.some(v => v && v.toLowerCase() === 'no'))         return 'no'
  return 'empty'
}

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
    const name = parts[1]?.trim() || 'Sí'
    return { status: 'si', display: name, name }
  }
  return { status: 'empty', display: raw, name: '' }
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function MediaTable({
  temas,
  onCellChange,
  onFieldChange,
  onDeleteRow,
  onAddPlanificacion,
  totalTemas,
  filterQuery,
  onClearFilter,
  onAdd,
  visibleCols,
  collapsedGroups = new Set(),
  onToggleGroup,
  expandedTemas = new Set(),
  onToggleTema,
}) {
  const [popover,      setPopover]      = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editValue,    setEditValue]    = useState('')
  const [hoverPlanif,  setHoverPlanif]  = useState(null)

  const activeCols   = visibleCols || MEDIA_COLS
  const activeGroups = GROUPS.filter(g => activeCols.some(c => c.group === g.id))
  const expandedCols = activeCols.filter(c => !collapsedGroups.has(c.group))

  const collapsedGroupCount = activeGroups.filter(g => collapsedGroups.has(g.id)).length
  const emptyColSpan = expandedCols.length + collapsedGroupCount + 3

  function openPopover(e, planifId, colId, medios) {
    const { valor, notas } = getCellData(medios, colId)
    const rect = e.currentTarget.getBoundingClientRect()
    setPopover({ rowId: planifId, colId, value: valor, notas, position: { x: rect.left, y: rect.bottom } })
  }

  function handlePopoverSave(newValue, newNotas) {
    if (popover) onCellChange(popover.rowId, popover.colId, newValue, newNotas)
    setPopover(null)
  }

  function startEditField(planifId, field, currentValue) {
    setEditingField({ rowId: planifId, field })
    setEditValue(currentValue || '')
  }

  function commitEditField() {
    if (editingField) onFieldChange(editingField.rowId, editingField.field, editValue)
    setEditingField(null)
  }

  function handleFieldKeyDown(e) {
    if (e.key === 'Enter') commitEditField()
    if (e.key === 'Escape') setEditingField(null)
  }

  // Celdas de medios individuales de una planificación
  function renderMediaCells(planif) {
    return activeGroups.flatMap(g => {
      const isCollapsed = collapsedGroups.has(g.id)
      if (isCollapsed) {
        return [<td key={`col-${g.id}`} className="group-collapsed-cell" onClick={() => onToggleGroup?.(g.id)} title="Expandir grupo" />]
      }
      const groupCols = activeCols.filter(c => c.group === g.id)
      return groupCols.map((col, i) => {
        const { valor, notas } = getCellData(planif.medios, col.id)
        const meta   = getCellMeta(valor)
        const isOpen = popover?.rowId === planif.id && popover?.colId === col.id
        const isLast = i === groupCols.length - 1
        return (
          <td
            key={col.id}
            className={`media-cell status-${meta.status}${isLast ? ' border-group-right' : ''}${isOpen ? ' cell-active' : ''}`}
            onClick={e => openPopover(e, planif.id, col.id, planif.medios)}
            title={valor || 'Clic para asignar estado'}
          >
            {meta.display && <span className="cell-text">{meta.display}</span>}
            {notas && <span className="cell-notes-icon" title="Tiene detalles" />}
          </td>
        )
      })
    })
  }

  // Celdas agregadas de un tema (resumen entre planificaciones)
  function renderAggregatedCells(tema) {
    return activeGroups.flatMap(g => {
      const isCollapsed = collapsedGroups.has(g.id)
      if (isCollapsed) {
        return [<td key={`col-${g.id}`} className="group-collapsed-cell" onClick={() => onToggleGroup?.(g.id)} title="Expandir grupo" />]
      }
      const groupCols = activeCols.filter(c => c.group === g.id)
      return groupCols.map((col, i) => {
        const valores   = tema.planificaciones.map(p => getCellData(p.medios, col.id).valor)
        const aggStatus = getAggregatedStatus(valores)
        const isLast    = i === groupCols.length - 1
        const matchCount = valores.filter(v => {
          if (!v) return aggStatus === 'empty'
          if (aggStatus === 'si') return v.toLowerCase().startsWith('si')
          if (aggStatus === 'pd') return v.toLowerCase().startsWith('pd')
          if (aggStatus === 'no') return v.toLowerCase() === 'no'
          return false
        }).length
        return (
          <td
            key={col.id}
            className={`media-cell tema-agg-cell status-${aggStatus}${isLast ? ' border-group-right' : ''}`}
            title={`${tema.planificaciones.length} planificación(es)`}
          >
            {aggStatus !== 'empty' && tema.planificaciones.length > 1 && (
              <span className="agg-count">{matchCount}</span>
            )}
          </td>
        )
      })
    })
  }

  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table className="media-table">
          <thead>
            {/* ROW 1: Group headers */}
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

            {/* ROW 2: Subgroup headers */}
            <tr className="subgroup-header-row">
              {activeGroups.map(g => {
                const isCollapsed = collapsedGroups.has(g.id)
                const cols        = activeCols.filter(c => c.group === g.id)
                const subs        = [...new Set(cols.map(c => c.subgroup).filter(Boolean))]
                const hasSubgroups = subs.length > 0

                if (isCollapsed)   return <th key={g.id} className="subgroup-cell subgroup-collapsed" />
                if (!hasSubgroups) return null
                return subs.map(sg => (
                  <th key={sg} colSpan={cols.filter(c => c.subgroup === sg).length} className="subgroup-cell">{sg}</th>
                ))
              })}
            </tr>

            {/* ROW 3: Column headers */}
            <tr className="sub-header-row">
              {activeGroups.map(g => {
                const isCollapsed = collapsedGroups.has(g.id)
                if (isCollapsed) return <th key={g.id} className="sub-header sub-header-placeholder" />
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
                <td colSpan={emptyColSpan} className="empty-state-cell">
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
                const n = tema.planificaciones.length

                return (
                  <>
                    {/* ── FILA DE TEMA ── */}
                    <tr key={`tema-${tema.id}`} className="tema-row">
                      {/* TEMAS col */}
                      <td className="sticky-col col-contenidos td-contenidos tema-name-cell">
                        <button
                          className={`tema-expand-btn${isExpanded ? ' expanded' : ''}`}
                          onClick={() => onToggleTema(tema.id)}
                          title={isExpanded ? 'Colapsar fechas' : 'Expandir fechas'}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                            <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <span className="tema-nombre">{tema.nombre || <em className="placeholder">Sin nombre</em>}</span>
                        {tema.sync_to_medios && <span className="sync-badge" title="Vinculado desde Editorial">E</span>}
                        <span className="planif-count">{n} {n === 1 ? 'fecha' : 'fechas'}</span>
                      </td>

                      {/* FECHA col */}
                      <td className="sticky-col col-semana td-semana tema-date-cell">
                        {n > 0 ? (
                          <span className="tema-date-range">
                            {formatDate(tema.planificaciones[0].semana)}
                            {n > 1 && <em className="tema-date-more"> +{n - 1} más</em>}
                          </span>
                        ) : <em className="placeholder">—</em>}
                      </td>

                      {/* Celdas agregadas */}
                      {renderAggregatedCells(tema)}

                      {/* Acción: + agregar fecha */}
                      <td className="col-actions td-actions">
                        <button
                          className="btn-add-planif"
                          onClick={() => onAddPlanificacion(tema.id)}
                          title="Agregar fecha"
                        >
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {/* ── FILAS DE PLANIFICACIONES (solo si expandido) ── */}
                    {isExpanded && tema.planificaciones.map((planif, idx) => {
                      const isEditingDate = editingField?.rowId === planif.id && editingField?.field === 'semana'
                      return (
                        <tr
                          key={planif.id}
                          className={`planificacion-row ${idx % 2 === 0 ? 'row-odd' : 'row-even'}${hoverPlanif === planif.id ? ' row-hover' : ''}`}
                          onMouseEnter={() => setHoverPlanif(planif.id)}
                          onMouseLeave={() => setHoverPlanif(null)}
                        >
                          {/* TEMAS col: indent */}
                          <td className="sticky-col col-contenidos td-contenidos planif-indent-cell">
                            <span className="planif-connector">└</span>
                          </td>

                          {/* FECHA col */}
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
                                title="Clic para editar"
                              >
                                {planif.semana
                                  ? formatDate(planif.semana)
                                  : <em className="placeholder">--/--/----</em>
                                }
                              </span>
                            )}
                          </td>

                          {/* Celdas de medios */}
                          {renderMediaCells(planif)}

                          {/* Eliminar */}
                          <td className="col-actions td-actions">
                            <button
                              className="btn-delete"
                              onClick={() => onDeleteRow(planif.id)}
                              title="Eliminar planificación"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5.833 6v4M8.167 6v4M3 3.5l.5 8a1 1 0 001 .917h5a1 1 0 001-.917l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

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

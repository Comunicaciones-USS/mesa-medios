import { useState, useRef } from 'react'
import { MEDIA_COLS, GROUPS } from '../config'
import { getCellData, getRowProgressFiltered } from '../utils'
import CellPopover from './CellPopover'

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

export default function MediaTable({ rows, onCellChange, onFieldChange, onDeleteRow, totalRows, filterQuery, onClearFilter, onAdd, visibleCols, collapsedGroups = new Set(), onToggleGroup }) {
  const [popover, setPopover] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [hoverRow, setHoverRow] = useState(null)

  const activeCols = visibleCols || MEDIA_COLS

  // Build active groups based on visible cols
  const activeGroups = GROUPS.filter(g => activeCols.some(c => c.group === g.id))

  // Columns of expanded groups (for progress bar and cells)
  const expandedCols = activeCols.filter(c => !collapsedGroups.has(c.group))

  function openPopover(e, rowId, colId, medios) {
    const { valor, notas } = getCellData(medios, colId)
    const rect = e.currentTarget.getBoundingClientRect()
    setPopover({ rowId, colId, value: valor, notas, position: { x: rect.left, y: rect.bottom } })
  }

  function handlePopoverSave(newValue, newNotas) {
    if (popover) onCellChange(popover.rowId, popover.colId, newValue, newNotas)
    setPopover(null)
  }

  function startEditField(rowId, field, currentValue) {
    setEditingField({ rowId, field })
    setEditValue(currentValue || '')
  }

  function commitEditField() {
    if (editingField) {
      onFieldChange(editingField.rowId, editingField.field, editValue)
    }
    setEditingField(null)
  }

  function handleFieldKeyDown(e) {
    if (e.key === 'Enter') commitEditField()
    if (e.key === 'Escape') setEditingField(null)
  }

  // Total visible header columns: 2 sticky + expanded cols + collapsed group placeholders + 1 actions
  const collapsedGroupCount = activeGroups.filter(g => collapsedGroups.has(g.id)).length
  const emptyColSpan = expandedCols.length + collapsedGroupCount + 3

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
                const isCollapsed = collapsedGroups.has(g.id)
                const groupColCount = activeCols.filter(c => c.group === g.id).length
                return (
                  <th
                    key={g.id}
                    colSpan={isCollapsed ? 1 : groupColCount}
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
                if (isCollapsed) return <th key={g.id} className="subgroup-cell subgroup-collapsed" />
                const cols = activeCols.filter(c => c.group === g.id)
                const subs = [...new Set(cols.map(c => c.subgroup).filter(Boolean))]
                if (subs.length > 0) return subs.map(sg => (
                  <th key={sg} colSpan={cols.filter(c => c.subgroup === sg).length} className="subgroup-cell">{sg}</th>
                ))
                return <th key={g.id} colSpan={cols.length} className="subgroup-cell subgroup-empty" />
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={emptyColSpan} className="empty-state-cell">
                  {totalRows === 0 ? (
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
              rows.map((row, idx) => {
                const isEditing = editingField?.rowId === row.id
                // Calculate progress only with columns from expanded groups
                const progress = getRowProgressFiltered(row.medios, expandedCols)

                return (
                  <tr
                    key={row.id}
                    className={`data-row ${idx % 2 === 0 ? 'row-odd' : 'row-even'} ${hoverRow === row.id ? 'row-hover' : ''}`}
                    onMouseEnter={() => setHoverRow(row.id)}
                    onMouseLeave={() => setHoverRow(null)}
                  >
                    {/* ── TEMAS ── */}
                    <td className="sticky-col col-contenidos td-contenidos">
                      {isEditing && editingField.field === 'nombre' ? (
                        <input
                          className="inline-edit"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEditField}
                          onKeyDown={handleFieldKeyDown}
                          autoFocus
                        />
                      ) : (
                        <>
                          <span
                            className="contenido-text"
                            onClick={() => startEditField(row.id, 'nombre', row.nombre)}
                            title="Clic para editar"
                          >
                            {row.nombre || <em className="placeholder">Sin nombre</em>}
                          </span>
                          {(() => {
                            const { filled, total, pct } = progress
                            const color = pct >= 60 ? '#22c55e' : pct >= 30 ? '#f59e0b' : '#ef4444'
                            return (
                              <div className="row-progress">
                                <div className="progress-bar-track">
                                  <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
                                </div>
                                <span className="progress-label">{filled}/{total} · {pct}%</span>
                              </div>
                            )
                          })()}
                        </>
                      )}
                    </td>

                    {/* ── FECHA ── */}
                    <td className="sticky-col col-semana td-semana">
                      {isEditing && editingField.field === 'semana' ? (
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
                          onClick={() => startEditField(row.id, 'semana', row.semana)}
                          title="Clic para editar"
                        >
                          {row.semana
                            ? new Date(row.semana + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : <em className="placeholder">--/--/----</em>
                          }
                        </span>
                      )}
                    </td>

                    {/* ── MEDIA CELLS — rendered per group ── */}
                    {activeGroups.flatMap(g => {
                      const isCollapsed = collapsedGroups.has(g.id)
                      if (isCollapsed) {
                        return [<td key={`col-${g.id}`} className="group-collapsed-cell" onClick={() => onToggleGroup?.(g.id)} title="Expandir grupo" />]
                      }
                      const groupCols = activeCols.filter(c => c.group === g.id)
                      return groupCols.map((col, i) => {
                        const { valor, notas } = getCellData(row.medios, col.id)
                        const meta = getCellMeta(valor)
                        const isOpen = popover?.rowId === row.id && popover?.colId === col.id
                        const isLast = i === groupCols.length - 1
                        return (
                          <td
                            key={col.id}
                            className={`media-cell status-${meta.status}${isLast ? ' border-group-right' : ''}${isOpen ? ' cell-active' : ''}`}
                            onClick={e => openPopover(e, row.id, col.id, row.medios)}
                            title={valor || 'Clic para asignar estado'}
                          >
                            {meta.display && <span className="cell-text">{meta.display}</span>}
                            {notas && (
                              <span className="cell-notes-icon" title="Tiene detalles">
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                  <rect x="0.5" y="0.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="0.8" />
                                  <path d="M2 3h4M2 5h2.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
                                </svg>
                              </span>
                            )}
                          </td>
                        )
                      })
                    })}

                    {/* ── ACTIONS ── */}
                    <td className="col-actions td-actions">
                      <button
                        className="btn-delete"
                        onClick={() => onDeleteRow(row.id)}
                        title="Eliminar fila"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 3.5h10M5.5 3.5V2h3v1.5M5.833 6v4M8.167 6v4M3 3.5l.5 8a1 1 0 001 .917h5a1 1 0 001-.917l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Floating popover */}
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

import { useState, useRef } from 'react'
import { MEDIA_COLS, N_PROPIOS, N_PAGADOS } from '../config'
import { getCellData, getRowProgress } from '../App'
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

export default function MediaTable({ rows, onCellChange, onFieldChange, onDeleteRow }) {
  const [popover, setPopover] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [hoverRow, setHoverRow] = useState(null)

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

  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table className="media-table">
          <thead>
            {/* ── Group header row ── */}
            <tr className="group-header-row">
              <th className="sticky-col col-contenidos group-dark" rowSpan={2}>
                CONTENIDOS
              </th>
              <th className="sticky-col col-semana group-dark" rowSpan={2}>
                SEMANA
              </th>
              <th colSpan={N_PROPIOS} className="group-propios">
                MEDIOS PROPIOS
              </th>
              <th colSpan={N_PAGADOS} className="group-pagados">
                MEDIOS PAGADOS
              </th>
              <th className="col-actions group-dark" rowSpan={2} />
            </tr>

            {/* ── Sub-header row ── */}
            <tr className="sub-header-row">
              {MEDIA_COLS.map((col, i) => (
                <th
                  key={col.id}
                  className={`sub-header ${col.group === 'PROPIOS' ? 'sub-propios' : 'sub-pagados'} ${i === N_PROPIOS - 1 ? 'border-group-right' : ''}`}
                >
                  <span className="sub-label">{col.label}</span>
                  {col.sub && <span className="sub-sublabel">{col.sub}</span>}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={MEDIA_COLS.length + 3} className="empty-state-cell">
                  <div className="empty-state">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <rect x="6" y="8" width="28" height="24" rx="3" stroke="#ceb37c" strokeWidth="2" fill="none" />
                      <path d="M13 16h14M13 22h10" stroke="#ceb37c" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p>No hay contenidos aún.</p>
                    <span>Haz clic en "Agregar contenido" para empezar.</span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const isEditing = editingField?.rowId === row.id
                return (
                  <tr
                    key={row.id}
                    className={`data-row ${idx % 2 === 0 ? 'row-odd' : 'row-even'} ${hoverRow === row.id ? 'row-hover' : ''}`}
                    onMouseEnter={() => setHoverRow(row.id)}
                    onMouseLeave={() => setHoverRow(null)}
                  >
                    {/* ── CONTENIDOS ── */}
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
                            const { filled, total, pct } = getRowProgress(row.medios)
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

                    {/* ── SEMANA ── */}
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

                    {/* ── MEDIA CELLS ── */}
                    {MEDIA_COLS.map((col, i) => {
                      const { valor, notas } = getCellData(row.medios, col.id)
                      const meta = getCellMeta(valor)
                      const isOpen = popover?.rowId === row.id && popover?.colId === col.id
                      return (
                        <td
                          key={col.id}
                          className={`media-cell status-${meta.status} ${i === N_PROPIOS - 1 ? 'border-group-right' : ''} ${isOpen ? 'cell-active' : ''}`}
                          onClick={e => openPopover(e, row.id, col.id, row.medios)}
                          title={valor || 'Clic para asignar estado'}
                        >
                          {meta.display && (
                            <span className="cell-text">{meta.display}</span>
                          )}
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

import { TIPOS_CONFIG, STATUS_CONFIG, STATUS_OPTIONS } from '../config'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function EjeSection({ eje, rows, onCellChange, onDeleteRow, collapsed, onToggle }) {
  const completadas  = rows.filter(r => r.status === 'Completado').length
  const pct = rows.length > 0 ? Math.round((completadas / rows.length) * 100) : 0

  return (
    <div className="eje-section">
      {/* ── Header del eje ── */}
      <div className="eje-header" onClick={onToggle} style={{ '--eje-color': eje.color }}>
        <div className="eje-stripe" style={{ background: eje.color }} />
        <h2 className="eje-title">{eje.label}</h2>
        <span className="eje-count">{rows.length} {rows.length === 1 ? 'acción' : 'acciones'}</span>
        <div className="eje-progress-track">
          <div className="eje-progress-fill" style={{ width: `${pct}%`, background: eje.color }} />
        </div>
        <span className="eje-pct">{pct}%</span>
        <svg
          className={`eje-chevron ${collapsed ? '' : 'eje-chevron-open'}`}
          width="14" height="14" viewBox="0 0 14 14" fill="none"
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* ── Tabla de acciones del eje ── */}
      {!collapsed && (
        <div className="eje-table-wrap">
          {rows.length === 0 ? (
            <div className="eje-empty">Sin acciones en este eje.</div>
          ) : (
            <table className="editorial-table">
              <thead>
                <tr>
                  <th className="col-tipo">Tipo</th>
                  <th className="col-tema">Tema</th>
                  <th className="col-accion">Acción</th>
                  <th className="col-canal">Tipo de acción</th>
                  <th className="col-fecha">Fecha</th>
                  <th className="col-resp">Responsable</th>
                  <th className="col-status">Status</th>
                  <th className="col-del"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <EjeRow
                    key={row.id}
                    row={row}
                    onCellChange={onCellChange}
                    onDeleteRow={onDeleteRow}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function EjeRow({ row, onCellChange, onDeleteRow }) {
  const tipoCfg   = TIPOS_CONFIG[row.tipo]   || {}
  const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG['Pendiente']

  function handleInlineEdit(field, value) {
    if (value !== row[field]) onCellChange(row.id, field, value)
  }

  return (
    <tr className="editorial-row">
      {/* Tipo — badge, no editable */}
      <td className="col-tipo">
        <span className="tipo-badge" style={{ color: tipoCfg.color, background: tipoCfg.bg }}>
          {row.tipo || '—'}
        </span>
      </td>

      {/* Tema — contenteditable */}
      <td className="col-tema">
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={e => handleInlineEdit('tema', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable"
        >
          {row.tema || ''}
        </span>
      </td>

      {/* Acción — contenteditable */}
      <td className="col-accion">
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={e => handleInlineEdit('accion', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable"
        >
          {row.accion || ''}
        </span>
      </td>

      {/* Canal — no editable */}
      <td className="col-canal">
        <span className="canal-text">{row.tipo_accion || '—'}</span>
      </td>

      {/* Fecha — display with inline date input on hover */}
      <td className="col-fecha" title={formatDate(row.fecha)}>
        <input
          type="date"
          defaultValue={row.fecha || ''}
          onBlur={e => handleInlineEdit('fecha', e.target.value || null)}
          className="editorial-date-input"
        />
        <span className="fecha-display">{formatDate(row.fecha)}</span>
      </td>

      {/* Responsable — contenteditable */}
      <td className="col-resp">
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={e => handleInlineEdit('responsable', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable"
        >
          {row.responsable || ''}
        </span>
      </td>

      {/* Status — select dropdown */}
      <td className="col-status">
        <select
          value={row.status || 'Pendiente'}
          onChange={e => handleInlineEdit('status', e.target.value)}
          className="status-select"
          style={{ color: statusCfg.text, background: statusCfg.bg }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>

      {/* Eliminar */}
      <td className="col-del">
        <button className="btn-delete-row" onClick={() => onDeleteRow(row.id)} title="Eliminar acción">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </td>
    </tr>
  )
}

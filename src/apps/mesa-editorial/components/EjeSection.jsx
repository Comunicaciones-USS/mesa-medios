import { TIPOS_CONFIG, STATUS_CONFIG, STATUS_OPTIONS, TIPOLOGIA_RESULTADO_OPTIONS } from '../config'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function EjeSection({ eje, rows, onCellChange, onDeleteRow, collapsed, onToggle, onAddBacklog }) {
  const completadas  = rows.filter(r => r.status === 'Completado').length
  const pct = rows.length > 0 ? Math.round((completadas / rows.length) * 100) : 0

  // Agrupar: Resultados como padres, Backlogs hijos bajo su padre, huérfanos al final
  const resultados = rows.filter(r => r.tipo_accion === 'Resultado')
  const backlogsByParent = {}
  const orphanBacklogs = []

  rows.filter(r => r.tipo_accion === 'Backlog').forEach(b => {
    if (b.parent_id && resultados.some(r => r.id === b.parent_id)) {
      if (!backlogsByParent[b.parent_id]) backlogsByParent[b.parent_id] = []
      backlogsByParent[b.parent_id].push(b)
    } else {
      orphanBacklogs.push(b)
    }
  })

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
                  <th className="col-canal">Tipología</th>
                  <th className="col-fecha">Fecha</th>
                  <th className="col-resp">Responsable</th>
                  <th className="col-status">Status</th>
                  <th className="col-del"></th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(resultado => (
                  <>
                    <ResultadoRow
                      key={resultado.id}
                      row={resultado}
                      onCellChange={onCellChange}
                      onDeleteRow={onDeleteRow}
                      backlogCount={(backlogsByParent[resultado.id] || []).length}
                      onAddBacklog={onAddBacklog}
                    />
                    {(backlogsByParent[resultado.id] || []).map(backlog => (
                      <BacklogRow
                        key={backlog.id}
                        row={backlog}
                        onCellChange={onCellChange}
                        onDeleteRow={onDeleteRow}
                      />
                    ))}
                  </>
                ))}
                {orphanBacklogs.map(backlog => (
                  <EjeRow
                    key={backlog.id}
                    row={backlog}
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

function ResultadoRow({ row, onCellChange, onDeleteRow, backlogCount, onAddBacklog }) {
  const tipoCfg   = TIPOS_CONFIG[row.tipo]   || {}
  const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG['Pendiente']

  function handleInlineEdit(field, value) {
    if (value !== row[field]) onCellChange(row.id, field, value)
  }

  return (
    <tr className="editorial-row resultado-row">
      {/* Tipo — select */}
      <td className="col-tipo">
        <select value={row.tipo || 'Ancla'} onChange={e => handleInlineEdit('tipo', e.target.value)}
          className="tipo-select" style={{ color: tipoCfg.color, background: tipoCfg.bg, border: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}>
          {Object.keys(TIPOS_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>

      {/* Tema */}
      <td className="col-tema">
        <span contentEditable suppressContentEditableWarning
          onBlur={e => handleInlineEdit('tema', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.tema || ''}
        </span>
      </td>

      {/* Acción — más destacada */}
      <td className="col-accion">
        <span contentEditable suppressContentEditableWarning
          onBlur={e => handleInlineEdit('accion', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable resultado-accion-text">
          {row.accion || ''}
        </span>
        <span className="resultado-backlog-count">{backlogCount} backlog{backlogCount !== 1 ? 's' : ''}</span>
      </td>

      {/* Tipología de resultado */}
      <td className="col-canal">
        <select value={row.tipologia_resultado || ''} onChange={e => handleInlineEdit('tipologia_resultado', e.target.value)}
          className="tipologia-select" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', color: '#374151' }}>
          <option value="">Sin tipología</option>
          {TIPOLOGIA_RESULTADO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>

      {/* Fecha */}
      <td className="col-fecha" title={formatDate(row.fecha)}>
        <input type="date" defaultValue={row.fecha || ''} onBlur={e => handleInlineEdit('fecha', e.target.value || null)} className="editorial-date-input" />
        <span className="fecha-display">{formatDate(row.fecha)}</span>
      </td>

      {/* Responsable */}
      <td className="col-resp">
        <span contentEditable suppressContentEditableWarning
          onBlur={e => handleInlineEdit('responsable', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.responsable || ''}
        </span>
      </td>

      {/* Status */}
      <td className="col-status">
        <select value={row.status || 'Pendiente'} onChange={e => handleInlineEdit('status', e.target.value)}
          className="status-select" style={{ color: statusCfg.text, background: statusCfg.bg }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* Acciones: agregar backlog + eliminar */}
      <td className="col-del">
        <button className="btn-add-backlog" onClick={() => onAddBacklog(row.id)} title="Agregar backlog a este resultado">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="btn-delete-row" onClick={() => onDeleteRow(row.id)} title="Eliminar resultado">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </td>
    </tr>
  )
}

function BacklogRow({ row, onCellChange, onDeleteRow }) {
  const tipoCfg   = TIPOS_CONFIG[row.tipo]   || {}
  const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG['Pendiente']

  function handleInlineEdit(field, value) {
    if (value !== row[field]) onCellChange(row.id, field, value)
  }

  return (
    <tr className="editorial-row backlog-row">
      {/* Tipo — con indentación */}
      <td className="col-tipo backlog-indent">
        <span className="backlog-connector">└</span>
        <select value={row.tipo || 'Ancla'} onChange={e => handleInlineEdit('tipo', e.target.value)}
          className="tipo-select" style={{ color: tipoCfg.color, background: tipoCfg.bg, border: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}>
          {Object.keys(TIPOS_CONFIG).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>

      {/* Tema */}
      <td className="col-tema">
        <span contentEditable suppressContentEditableWarning
          onBlur={e => handleInlineEdit('tema', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.tema || ''}
        </span>
      </td>

      {/* Acción */}
      <td className="col-accion">
        <span contentEditable suppressContentEditableWarning
          onBlur={e => handleInlineEdit('accion', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.accion || ''}
        </span>
      </td>

      {/* Tipología — etiqueta fija para backlogs */}
      <td className="col-canal">
        <span className="backlog-label">Backlog</span>
      </td>

      {/* Fecha */}
      <td className="col-fecha" title={formatDate(row.fecha)}>
        <input type="date" defaultValue={row.fecha || ''} onBlur={e => handleInlineEdit('fecha', e.target.value || null)} className="editorial-date-input" />
        <span className="fecha-display">{formatDate(row.fecha)}</span>
      </td>

      {/* Responsable */}
      <td className="col-resp">
        <span contentEditable suppressContentEditableWarning
          onBlur={e => handleInlineEdit('responsable', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.responsable || ''}
        </span>
      </td>

      {/* Status */}
      <td className="col-status">
        <select value={row.status || 'Pendiente'} onChange={e => handleInlineEdit('status', e.target.value)}
          className="status-select" style={{ color: statusCfg.text, background: statusCfg.bg }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* Eliminar */}
      <td className="col-del">
        <button className="btn-delete-row" onClick={() => onDeleteRow(row.id)} title="Eliminar backlog">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </td>
    </tr>
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
      <td className="col-tipo">
        <select
          value={row.tipo || 'Ancla'}
          onChange={e => handleInlineEdit('tipo', e.target.value)}
          className="tipo-select"
          style={{ color: tipoCfg.color, background: tipoCfg.bg, border: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
        >
          {Object.keys(TIPOS_CONFIG).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </td>

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

      <td className="col-canal">
        <span className="backlog-label">Backlog</span>
      </td>

      <td className="col-fecha" title={formatDate(row.fecha)}>
        <input
          type="date"
          defaultValue={row.fecha || ''}
          onBlur={e => handleInlineEdit('fecha', e.target.value || null)}
          className="editorial-date-input"
        />
        <span className="fecha-display">{formatDate(row.fecha)}</span>
      </td>

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

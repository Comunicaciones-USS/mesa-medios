import { useState, useEffect, useRef } from 'react'
import { EJES, EJE_COLOR_MAP, TIPOS_CONFIG, TIPOS_ORDER, STATUS_CONFIG, STATUS_OPTIONS, TIPOLOGIA_RESULTADO_OPTIONS } from '../config'
import OrphanAssigner from './OrphanAssigner'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: '2-digit' })
}

function formatArchivedAt(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function EjeSection({ eje, rows, onCellChange, onDeleteRow, collapsed, onToggle, onAddBacklog, onAssignOrphans, onSyncToggle, isArchived, onReactivate }) {
  const [expandedResults, setExpandedResults] = useState({})

  function toggleResult(id) {
    setExpandedResults(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const completadas = rows.filter(r => r.status === 'Completado').length
  const pct = rows.length > 0 ? Math.round((completadas / rows.length) * 100) : 0

  // Agrupar y ordenar Resultados por tipo (Ancla → Soporte → Always ON)
  const resultados = rows
    .filter(r => r.tipo_accion === 'Resultado')
    .sort((a, b) => {
      const orderA = TIPOS_ORDER.indexOf(a.tipo)
      const orderB = TIPOS_ORDER.indexOf(b.tipo)
      return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB)
    })

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
    <div className={`eje-section${isArchived ? ' eje-section-archived' : ''}`}>
      {/* ── Header del eje ── */}
      <div className="eje-header" onClick={onToggle} style={{ '--eje-color': eje.color }}>
        <div className="eje-stripe" style={{ background: eje.color }} />
        <h2 className="eje-title">{eje.label}</h2>
        <span className="eje-count">{rows.length} {rows.length === 1 ? 'acción' : 'acciones'}</span>
        {!isArchived && (
          <>
            <div className="eje-progress-track">
              <div className="eje-progress-fill" style={{ width: `${pct}%`, background: eje.color }} />
            </div>
            <span className="eje-pct">{pct}%</span>
          </>
        )}
        <svg
          className={`eje-chevron ${collapsed ? '' : 'eje-chevron-open'}`}
          width="14" height="14" viewBox="0 0 14 14" fill="none"
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* ── Tabla de acciones del eje ── */}
      {!collapsed && (
        <div className={`eje-table-wrap${isArchived ? ' eje-table-archived' : ''}`}>
          {rows.length === 0 ? (
            <div className="eje-empty">Sin acciones en este eje.</div>
          ) : (
            <>
              <table className="editorial-table">
                <thead>
                  <tr>
                    <th className="col-tipo">Hito</th>
                    <th className="col-eje">Eje</th>
                    <th className="col-tema">Tema</th>
                    <th className="col-canal">Tipología</th>
                    <th className="col-accion">Descripción - Acción</th>
                    <th className="col-fecha">Fecha</th>
                    <th className="col-resp">Responsable</th>
                    <th className="col-status">Status</th>
                    {isArchived
                      ? <th className="col-archived-at">Archivado el</th>
                      : <th className="col-del"></th>
                    }
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
                        expanded={!!expandedResults[resultado.id]}
                        onToggleExpand={() => toggleResult(resultado.id)}
                        onSyncToggle={onSyncToggle}
                        isArchived={isArchived}
                        onReactivate={onReactivate}
                      />
                      {expandedResults[resultado.id] && (backlogsByParent[resultado.id] || []).map(backlog => (
                        <BacklogRow
                          key={backlog.id}
                          row={backlog}
                          onCellChange={onCellChange}
                          onDeleteRow={onDeleteRow}
                          onSyncToggle={onSyncToggle}
                          isArchived={isArchived}
                          onReactivate={onReactivate}
                        />
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
              {!isArchived && (
                <OrphanAssigner
                  orphans={orphanBacklogs}
                  resultados={resultados}
                  onAssign={onAssignOrphans}
                  onDeleteRow={onDeleteRow}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResultadoRow({ row, onCellChange, onDeleteRow, backlogCount, onAddBacklog, expanded, onToggleExpand, onSyncToggle, isArchived, onReactivate }) {
  const tipoCfg   = TIPOS_CONFIG[row.tipo]   || {}
  const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG['Pendiente']
  const ejeColor  = EJE_COLOR_MAP[row.eje]   || '#64748b'
  const [localFecha, setLocalFecha] = useState(row.fecha || '')
  const fechaInputRef = useRef(null)
  useEffect(() => {
    if (document.activeElement !== fechaInputRef.current) setLocalFecha(row.fecha || '')
  }, [row.fecha])

  function handleInlineEdit(field, value) {
    if (!isArchived && value !== row[field]) onCellChange(row.id, field, value)
  }

  function handleTipoChange(newTipo) {
    handleInlineEdit('tipo', newTipo)
    if (newTipo === 'Always ON') {
      onCellChange(row.id, 'fecha', null)
    } else if (row.tipo === 'Always ON') {
      onCellChange(row.id, 'fecha', null)
    }
  }

  const isAlwaysOn = row.tipo === 'Always ON'

  return (
    <tr className={`editorial-row resultado-row${isArchived ? ' row-archived' : ''}`}>
      {/* Hito — select */}
      <td className="col-tipo">
        <select
          value={row.tipo || 'Ancla'}
          onChange={e => handleTipoChange(e.target.value)}
          className="tipo-select"
          disabled={isArchived}
          style={{ color: tipoCfg.color, background: tipoCfg.bg, border: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: '4px', padding: '2px 6px', cursor: isArchived ? 'default' : 'pointer' }}
        >
          {TIPOS_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>

      {/* Eje — editable */}
      <td className="col-eje">
        <select
          value={row.eje || EJES[0].label}
          onChange={e => handleInlineEdit('eje', e.target.value)}
          disabled={isArchived}
          className="eje-select"
          style={{ color: ejeColor, border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.74rem', padding: '2px 2px', cursor: isArchived ? 'default' : 'pointer', maxWidth: '100%' }}
        >
          {EJES.map(e => <option key={e.id} value={e.label}>{e.label}</option>)}
        </select>
      </td>

      {/* Tema */}
      <td className="col-tema">
        <span
          contentEditable={!isArchived}
          suppressContentEditableWarning
          onBlur={e => handleInlineEdit('tema', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.tema || ''}
        </span>
      </td>

      {/* Tipología */}
      <td className="col-canal">
        <select value={row.tipologia_resultado || ''} onChange={e => handleInlineEdit('tipologia_resultado', e.target.value)}
          className="tipologia-select" disabled={isArchived}
          style={{ border: 'none', background: 'transparent', cursor: isArchived ? 'default' : 'pointer', fontSize: '0.8rem', color: '#374151' }}>
          <option value="">Sin tipología</option>
          {TIPOLOGIA_RESULTADO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>

      {/* Descripción - Acción */}
      <td className="col-accion">
        <div className="resultado-accion-wrap">
          {backlogCount > 0 && (
            <button className="resultado-toggle" onClick={onToggleExpand} title={expanded ? 'Ocultar backlogs' : 'Mostrar backlogs'}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <div>
            <span
              contentEditable={!isArchived}
              suppressContentEditableWarning
              onBlur={e => handleInlineEdit('accion', e.currentTarget.textContent.trim())}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              className="editorial-editable resultado-accion-text">
              {row.accion || ''}
            </span>
            <span className="resultado-backlog-count">{backlogCount} backlog{backlogCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </td>

      {/* Fecha */}
      <td className="col-fecha" title={isAlwaysOn ? 'Permanente' : formatDate(row.fecha)}>
        {isAlwaysOn ? (
          <span className="fecha-permanente-inline">Permanente</span>
        ) : isArchived ? (
          <span className="fecha-display">{formatDate(row.fecha)}</span>
        ) : (
          <>
            <input
              ref={fechaInputRef}
              type="date"
              value={localFecha}
              onChange={e => setLocalFecha(e.target.value)}
              onBlur={e => handleInlineEdit('fecha', e.target.value || null)}
              className="editorial-date-input"
            />
            <span className="fecha-display">{formatDate(row.fecha)}</span>
          </>
        )}
      </td>

      {/* Responsable */}
      <td className="col-resp">
        <span
          contentEditable={!isArchived}
          suppressContentEditableWarning
          onBlur={e => handleInlineEdit('responsable', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.responsable || ''}
        </span>
      </td>

      {/* Status */}
      <td className="col-status">
        <select value={row.status || 'Pendiente'} onChange={e => handleInlineEdit('status', e.target.value)}
          className="status-select" disabled={isArchived}
          style={{ color: statusCfg.text, background: statusCfg.bg, cursor: isArchived ? 'default' : 'pointer' }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* Acciones o Archivado el */}
      {isArchived ? (
        <td className="col-archived-at">
          <span className="archived-at-date">{formatArchivedAt(row.archived_at)}</span>
          <button className="btn-reactivate" onClick={() => onReactivate?.(row.id)} title="Reactivar esta acción">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6a4 4 0 014-4 4 4 0 014 4 4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M6 2L4 4l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Reactivar
          </button>
        </td>
      ) : (
        <td className="col-del">
          <button
            className={`btn-sync-medios${row.sync_to_medios ? ' synced' : ''}`}
            onClick={() => onSyncToggle?.(row.id, !row.sync_to_medios)}
            title={row.sync_to_medios ? 'Desvinc. de Mesa de Medios' : 'Vincular a Mesa de Medios'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6a4 4 0 014-4M10 6a4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M9 4l1.5-1.5M9 4l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 8L1.5 9.5M3 8L1.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
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
      )}
    </tr>
  )
}

function BacklogRow({ row, onCellChange, onDeleteRow, onSyncToggle, isArchived, onReactivate }) {
  const tipoCfg   = TIPOS_CONFIG[row.tipo]   || {}
  const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG['Pendiente']
  const ejeColor  = EJE_COLOR_MAP[row.eje]   || '#64748b'
  const [localFecha, setLocalFecha] = useState(row.fecha || '')
  const fechaInputRef = useRef(null)
  useEffect(() => {
    if (document.activeElement !== fechaInputRef.current) setLocalFecha(row.fecha || '')
  }, [row.fecha])

  function handleInlineEdit(field, value) {
    if (!isArchived && value !== row[field]) onCellChange(row.id, field, value)
  }

  function handleTipoChange(newTipo) {
    handleInlineEdit('tipo', newTipo)
    if (newTipo === 'Always ON') {
      onCellChange(row.id, 'fecha', null)
    } else if (row.tipo === 'Always ON') {
      onCellChange(row.id, 'fecha', null)
    }
  }

  const isAlwaysOn = row.tipo === 'Always ON'

  return (
    <tr className={`editorial-row backlog-row${isArchived ? ' row-archived' : ''}`}>
      {/* Hito — con indentación */}
      <td className="col-tipo backlog-indent">
        <span className="backlog-connector">└</span>
        <select
          value={row.tipo || 'Ancla'}
          onChange={e => handleTipoChange(e.target.value)}
          className="tipo-select"
          disabled={isArchived}
          style={{ color: tipoCfg.color, background: tipoCfg.bg, border: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: '4px', padding: '2px 6px', cursor: isArchived ? 'default' : 'pointer' }}
        >
          {TIPOS_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>

      {/* Eje — editable */}
      <td className="col-eje">
        <select
          value={row.eje || EJES[0].label}
          onChange={e => handleInlineEdit('eje', e.target.value)}
          disabled={isArchived}
          className="eje-select"
          style={{ color: ejeColor, border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.74rem', padding: '2px 2px', cursor: isArchived ? 'default' : 'pointer', maxWidth: '100%' }}
        >
          {EJES.map(e => <option key={e.id} value={e.label}>{e.label}</option>)}
        </select>
      </td>

      {/* Tema */}
      <td className="col-tema">
        <span
          contentEditable={!isArchived}
          suppressContentEditableWarning
          onBlur={e => handleInlineEdit('tema', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.tema || ''}
        </span>
      </td>

      {/* Tipología — etiqueta fija para backlogs */}
      <td className="col-canal">
        <span className="backlog-label">Backlog</span>
      </td>

      {/* Descripción - Acción */}
      <td className="col-accion">
        <span
          contentEditable={!isArchived}
          suppressContentEditableWarning
          onBlur={e => handleInlineEdit('accion', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.accion || ''}
        </span>
      </td>

      {/* Fecha */}
      <td className="col-fecha" title={isAlwaysOn ? 'Permanente' : formatDate(row.fecha)}>
        {isAlwaysOn ? (
          <span className="fecha-permanente-inline">Permanente</span>
        ) : isArchived ? (
          <span className="fecha-display">{formatDate(row.fecha)}</span>
        ) : (
          <>
            <input
              ref={fechaInputRef}
              type="date"
              value={localFecha}
              onChange={e => setLocalFecha(e.target.value)}
              onBlur={e => handleInlineEdit('fecha', e.target.value || null)}
              className="editorial-date-input"
            />
            <span className="fecha-display">{formatDate(row.fecha)}</span>
          </>
        )}
      </td>

      {/* Responsable */}
      <td className="col-resp">
        <span
          contentEditable={!isArchived}
          suppressContentEditableWarning
          onBlur={e => handleInlineEdit('responsable', e.currentTarget.textContent.trim())}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
          className="editorial-editable">
          {row.responsable || ''}
        </span>
      </td>

      {/* Status */}
      <td className="col-status">
        <select value={row.status || 'Pendiente'} onChange={e => handleInlineEdit('status', e.target.value)}
          className="status-select" disabled={isArchived}
          style={{ color: statusCfg.text, background: statusCfg.bg, cursor: isArchived ? 'default' : 'pointer' }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* Acciones o Archivado el */}
      {isArchived ? (
        <td className="col-archived-at">
          <span className="archived-at-date">{formatArchivedAt(row.archived_at)}</span>
          <button className="btn-reactivate" onClick={() => onReactivate?.(row.id)} title="Reactivar este backlog">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6a4 4 0 014-4 4 4 0 014 4 4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M6 2L4 4l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Reactivar
          </button>
        </td>
      ) : (
        <td className="col-del">
          <button
            className={`btn-sync-medios${row.sync_to_medios ? ' synced' : ''}`}
            onClick={() => onSyncToggle?.(row.id, !row.sync_to_medios)}
            title={row.sync_to_medios ? 'Desvinc. de Mesa de Medios' : 'Vincular a Mesa de Medios'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6a4 4 0 014-4M10 6a4 4 0 01-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M9 4l1.5-1.5M9 4l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 8L1.5 9.5M3 8L1.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="btn-delete-row" onClick={() => onDeleteRow(row.id)} title="Eliminar backlog">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </td>
      )}
    </tr>
  )
}

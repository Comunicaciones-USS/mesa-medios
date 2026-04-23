import { useState } from 'react'
import { EJES, TIPOS_CONFIG, TIPOS_ORDER, STATUS_CONFIG, STATUS_OPTIONS, EJE_COLOR_MAP } from '../config'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function MobileCardViewEditorial({ rows, onCellChange, onDeleteRow, totalRows, filterQuery, onClearFilter, onAdd }) {
  const [expanded, setExpanded] = useState({})

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (totalRows === 0) {
    return (
      <div className="empty-state">
        <h3>Sin acciones registradas</h3>
        <button className="btn-add" onClick={onAdd}>+ Agregar acción</button>
      </div>
    )
  }
  if (rows.length === 0 && filterQuery) {
    return (
      <div className="empty-state">
        <h3>Sin resultados para "{filterQuery}"</h3>
        <button className="btn-secondary" onClick={onClearFilter}>Limpiar filtro</button>
      </div>
    )
  }

  // Agrupar igual que EjeSection
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
    <div className="mobile-cards">
      {/* Resultados con sus backlogs hijos */}
      {resultados.map(resultado => {
        const ejeColor  = EJE_COLOR_MAP[resultado.eje]   || '#64748b'
        const tipoCfg   = TIPOS_CONFIG[resultado.tipo]    || {}
        const statusCfg = STATUS_CONFIG[resultado.status] || STATUS_CONFIG['Pendiente']
        const children  = backlogsByParent[resultado.id] || []
        const isExpanded = expanded[resultado.id]

        return (
          <div key={resultado.id} className="mobile-card mobile-card-resultado" style={{ borderLeftColor: '#ceb37c' }}>
            <div className="mobile-card-header">
              <select
                value={resultado.eje || EJES[0].label}
                onChange={e => onCellChange(resultado.id, 'eje', e.target.value)}
                className="mobile-eje-select"
                style={{ color: ejeColor, border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.72rem', padding: '0', cursor: 'pointer' }}
              >
                {EJES.map(e => <option key={e.id} value={e.label}>{e.label}</option>)}
              </select>
              <span className="tipo-badge" style={{ color: tipoCfg.color, background: tipoCfg.bg }}>{resultado.tipo}</span>
            </div>
            {resultado.tema && <p className="mobile-tema">{resultado.tema}</p>}
            <p className="mobile-accion mobile-accion-resultado">{resultado.accion}</p>
            {resultado.tipologia_resultado && (
              <span className="mobile-tipologia-badge">{resultado.tipologia_resultado}</span>
            )}
            <div className="mobile-card-meta">
              <span>Resultado</span>
              <span>·</span>
              <span>{formatDate(resultado.fecha)}</span>
              <span>·</span>
              <span>{resultado.responsable || '—'}</span>
            </div>
            <div className="mobile-card-footer">
              <select
                value={resultado.status || 'Pendiente'}
                onChange={e => onCellChange(resultado.id, 'status', e.target.value)}
                className="status-select"
                style={{ color: statusCfg.text, background: statusCfg.bg }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-delete-row" onClick={() => onDeleteRow(resultado.id)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Backlogs hijos colapsables */}
            {children.length > 0 && (
              <div className="mobile-backlogs-section">
                <button className="mobile-backlogs-toggle" onClick={() => toggleExpand(resultado.id)}>
                  <span>{children.length} backlog{children.length !== 1 ? 's' : ''}</span>
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                  >
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {isExpanded && (
                  <div className="mobile-backlogs-list">
                    {children.map(backlog => {
                      const bTipoCfg   = TIPOS_CONFIG[backlog.tipo]    || {}
                      const bStatusCfg = STATUS_CONFIG[backlog.status] || STATUS_CONFIG['Pendiente']
                      return (
                        <div key={backlog.id} className="mobile-card mobile-card-backlog">
                          <div className="mobile-card-header">
                            <span className="backlog-connector" style={{ color: '#cbd5e1', marginRight: 4 }}>└</span>
                            <span className="tipo-badge" style={{ color: bTipoCfg.color, background: bTipoCfg.bg }}>{backlog.tipo}</span>
                          </div>
                          {backlog.tema && <p className="mobile-tema">{backlog.tema}</p>}
                          <p className="mobile-accion">{backlog.accion}</p>
                          <div className="mobile-card-meta">
                            <span>Backlog</span>
                            <span>·</span>
                            <span>{formatDate(backlog.fecha)}</span>
                            <span>·</span>
                            <span>{backlog.responsable || '—'}</span>
                          </div>
                          <div className="mobile-card-footer">
                            <select
                              value={backlog.status || 'Pendiente'}
                              onChange={e => onCellChange(backlog.id, 'status', e.target.value)}
                              className="status-select"
                              style={{ color: bStatusCfg.text, background: bStatusCfg.bg }}
                            >
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button className="btn-delete-row" onClick={() => onDeleteRow(backlog.id)}>
                              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Backlogs huérfanos — cards normales al final */}
      {orphanBacklogs.map(row => {
        const ejeColor  = EJE_COLOR_MAP[row.eje]   || '#64748b'
        const tipoCfg   = TIPOS_CONFIG[row.tipo]    || {}
        const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG['Pendiente']
        return (
          <div key={row.id} className="mobile-card" style={{ borderLeftColor: ejeColor }}>
            <div className="mobile-card-header">
              <select
                value={row.eje || EJES[0].label}
                onChange={e => onCellChange(row.id, 'eje', e.target.value)}
                className="mobile-eje-select"
                style={{ color: ejeColor, border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.72rem', padding: '0', cursor: 'pointer' }}
              >
                {EJES.map(e => <option key={e.id} value={e.label}>{e.label}</option>)}
              </select>
              <span className="tipo-badge" style={{ color: tipoCfg.color, background: tipoCfg.bg }}>{row.tipo}</span>
            </div>
            {row.tema && <p className="mobile-tema">{row.tema}</p>}
            <p className="mobile-accion">{row.accion}</p>
            <div className="mobile-card-meta">
              <span>{row.tipo_accion || '—'}</span>
              <span>·</span>
              <span>{formatDate(row.fecha)}</span>
              <span>·</span>
              <span>{row.responsable || '—'}</span>
            </div>
            <div className="mobile-card-footer">
              <select
                value={row.status || 'Pendiente'}
                onChange={e => onCellChange(row.id, 'status', e.target.value)}
                className="status-select"
                style={{ color: statusCfg.text, background: statusCfg.bg }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-delete-row" onClick={() => onDeleteRow(row.id)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { EJES, TIPOS_ORDER, TIPOS_CONFIG, STATUS_CONFIG } from '../config'

export default function ExplorerSidebar({ rows, onClose, onFilter, onAddAction }) {
  const [selectedEje, setSelectedEje] = useState(null)
  const [selectedTema, setSelectedTema] = useState(null)

  const temas = useMemo(() => {
    if (!selectedEje) return []
    const ejeRows = rows.filter(r => r.eje === selectedEje)
    return [...new Set(ejeRows.map(r => r.tema).filter(Boolean))].sort()
  }, [rows, selectedEje])

  const temaRows = useMemo(() => {
    if (!selectedTema) return []
    return rows
      .filter(r => r.eje === selectedEje && r.tema === selectedTema)
      .sort((a, b) => {
        if (a.tipo_accion === 'Resultado' && b.tipo_accion !== 'Resultado') return -1
        if (a.tipo_accion !== 'Resultado' && b.tipo_accion === 'Resultado') return 1
        const orderA = TIPOS_ORDER.indexOf(a.tipo)
        const orderB = TIPOS_ORDER.indexOf(b.tipo)
        return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB)
      })
  }, [rows, selectedEje, selectedTema])

  function handleVisualize() {
    onFilter({ eje: selectedEje, tema: selectedTema })
  }

  function handleAdd() {
    onAddAction({ eje: selectedEje, tema: selectedTema })
  }

  return (
    <div className="explorer-sidebar">
      <div className="explorer-header">
        <h3 className="explorer-title">
          {selectedTema || selectedEje || 'Explorador'}
        </h3>
        <button className="modal-close" onClick={onClose} style={{ color: '#fff' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Breadcrumb */}
      {(selectedEje || selectedTema) && (
        <div className="explorer-breadcrumb">
          <button onClick={() => { setSelectedEje(null); setSelectedTema(null) }}>Ejes</button>
          {selectedEje && (
            <>
              <span className="explorer-bc-sep">›</span>
              <button onClick={() => setSelectedTema(null)}>{selectedEje}</button>
            </>
          )}
          {selectedTema && (
            <>
              <span className="explorer-bc-sep">›</span>
              <span>{selectedTema}</span>
            </>
          )}
        </div>
      )}

      <div className="explorer-body">
        {/* Nivel 1: Ejes */}
        {!selectedEje && (
          <div className="explorer-list">
            {EJES.map(eje => {
              const count = rows.filter(r => r.eje === eje.label).length
              return (
                <button key={eje.id} className="explorer-item" onClick={() => setSelectedEje(eje.label)}>
                  <div className="explorer-item-stripe" style={{ background: eje.color }} />
                  <span className="explorer-item-label">{eje.label}</span>
                  <span className="explorer-item-count">{count}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
              )
            })}
          </div>
        )}

        {/* Nivel 2: Temas del eje */}
        {selectedEje && !selectedTema && (
          <div className="explorer-list">
            {temas.length === 0 ? (
              <p className="explorer-empty">Sin temas en este eje.</p>
            ) : (
              temas.map(tema => {
                const count = rows.filter(r => r.eje === selectedEje && r.tema === tema).length
                return (
                  <button key={tema} className="explorer-item" onClick={() => setSelectedTema(tema)}>
                    <span className="explorer-item-label">{tema}</span>
                    <span className="explorer-item-count">{count}</span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* Nivel 3: Acciones del tema — preview */}
        {selectedTema && (
          <div className="explorer-preview">
            {temaRows.length === 0 ? (
              <p className="explorer-empty">Sin acciones en este tema.</p>
            ) : (
              temaRows.map(row => {
                const tipoCfg = TIPOS_CONFIG[row.tipo] || {}
                const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG['Pendiente']
                return (
                  <div key={row.id} className={`explorer-preview-item ${row.tipo_accion === 'Resultado' ? 'explorer-resultado' : 'explorer-backlog'}`}>
                    <span className="tipo-badge" style={{ color: tipoCfg.color, background: tipoCfg.bg, fontSize: '0.65rem', padding: '1px 5px' }}>
                      {row.tipo}
                    </span>
                    <span className="explorer-preview-accion">{row.accion || '—'}</span>
                    <span className="explorer-preview-status" style={{ color: statusCfg.text }}>{row.status}</span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Footer con botones */}
      {selectedTema && (
        <div className="explorer-footer">
          <button className="btn-secondary" onClick={handleVisualize}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Visualizar
          </button>
          <button className="btn-primary" onClick={handleAdd}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            + Acción
          </button>
        </div>
      )}
    </div>
  )
}

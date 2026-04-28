import { useState, useMemo, useEffect, useRef } from 'react'
import { EJES, TIPOS_ORDER, TIPOS_CONFIG } from '../config'
import { useFocusTrap } from '../../shared/hooks/useFocusTrap'

export default function ExplorerSidebar({ rows, onClose, onFilter }) {
  const [selectedEje,  setSelectedEje]  = useState(null)
  const [selectedHito, setSelectedHito] = useState(null)
  const [searchQuery,  setSearchQuery]  = useState('')
  const sidebarRef = useRef(null)

  const triggerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null)

  useFocusTrap(sidebarRef, true)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    return () => { triggerRef.current?.focus() }
  }, [])

  const activeRows = useMemo(() => rows.filter(r => !r.archived), [rows])

  const hitoCounts = useMemo(() => {
    if (!selectedEje) return {}
    return TIPOS_ORDER.reduce((acc, tipo) => {
      acc[tipo] = activeRows.filter(r => r.eje === selectedEje && r.tipo === tipo).length
      return acc
    }, {})
  }, [activeRows, selectedEje])

  const temas = useMemo(() => {
    if (!selectedEje || !selectedHito) return []
    const temaMap = new Map()
    for (const row of activeRows) {
      if (row.eje === selectedEje && row.tipo === selectedHito && row.tema) {
        temaMap.set(row.tema, (temaMap.get(row.tema) || 0) + 1)
      }
    }
    return [...temaMap.entries()]
      .filter(([tema]) => !searchQuery || tema.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [activeRows, selectedEje, selectedHito, searchQuery])

  const level = !selectedEje ? 1 : !selectedHito ? 2 : 3

  function handleBack() {
    if (level === 3) { setSelectedHito(null); setSearchQuery('') }
    else if (level === 2) setSelectedEje(null)
  }

  return (
    <>
      <div className="explorer-overlay" onClick={onClose} />
      <aside ref={sidebarRef} className="explorer-sidebar" aria-label="Explorador de temas">

        <div className="explorer-header">
          <div>
            <h3 className="explorer-title">Explorador</h3>
            <p className="explorer-subtitle">
              {level === 1 && 'Selecciona un eje'}
              {level === 2 && `${selectedEje}`}
              {level === 3 && `${selectedEje} › ${selectedHito}`}
            </p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            style={{ color: '#fff' }}
            aria-label="Cerrar explorador de temas"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Breadcrumb */}
        {level > 1 && (
          <div className="explorer-breadcrumb">
            <button onClick={() => { setSelectedEje(null); setSelectedHito(null); setSearchQuery('') }}>
              Ejes
            </button>
            <span className="explorer-bc-sep">›</span>
            {level === 2 && <span>{selectedEje}</span>}
            {level === 3 && (
              <>
                <button onClick={() => { setSelectedHito(null); setSearchQuery('') }}>
                  {selectedEje}
                </button>
                <span className="explorer-bc-sep">›</span>
                <span>{selectedHito}</span>
              </>
            )}
          </div>
        )}

        <div className="explorer-body">

          {/* Nivel 1 — Ejes */}
          {level === 1 && (
            <div className="explorer-list">
              {EJES.map(eje => {
                const count = activeRows.filter(r => r.eje === eje.label).length
                return (
                  <button
                    key={eje.id}
                    className="explorer-item"
                    onClick={() => setSelectedEje(eje.label)}
                  >
                    <div className="explorer-item-stripe" style={{ background: eje.color }} />
                    <span className="explorer-item-label">{eje.label}</span>
                    <span className="explorer-item-count">{count}</span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                )
              })}
            </div>
          )}

          {/* Nivel 2 — Hitos del eje */}
          {level === 2 && (
            <div className="explorer-list">
              {TIPOS_ORDER.map(tipo => {
                const cfg = TIPOS_CONFIG[tipo]
                const count = hitoCounts[tipo] || 0
                const disabled = count === 0
                return (
                  <button
                    key={tipo}
                    className="explorer-item"
                    disabled={disabled}
                    style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    onClick={() => setSelectedHito(tipo)}
                  >
                    <div className="explorer-item-stripe" style={{ background: cfg.color }} />
                    <span className="explorer-item-label" style={{ fontWeight: 500 }}>{tipo}</span>
                    <span
                      className="explorer-item-count"
                      style={!disabled ? { background: cfg.bg, color: cfg.color } : {}}
                    >
                      {count}
                    </span>
                    {!disabled && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Nivel 3 — Temas del eje + hito */}
          {level === 3 && (
            <>
              <div style={{ padding: '10px 16px 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 6, padding: '6px 10px', border: '1px solid #e5e7eb' }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: '#94a3b8' }}>
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar tema..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ background: 'none', border: 'none', outline: 'none', fontSize: '0.82rem', flex: 1, color: '#374151' }}
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      className="filter-clear"
                      onClick={() => setSearchQuery('')}
                      style={{ flexShrink: 0 }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="explorer-list">
                {temas.length === 0 ? (
                  <p className="explorer-empty">
                    {searchQuery ? 'Sin resultados para la búsqueda.' : 'Sin temas en este hito.'}
                  </p>
                ) : (
                  temas.map(([tema, count]) => (
                    <button
                      key={tema}
                      className="explorer-item"
                      onClick={() => onFilter({ eje: selectedEje, tema })}
                    >
                      <span className="explorer-item-label">{tema}</span>
                      <span className="explorer-item-count">{count}</span>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Botón Atrás — visible en niveles 2 y 3 */}
        {level > 1 && (
          <div className="explorer-footer">
            <button
              className="btn-secondary"
              onClick={handleBack}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.8rem' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M8 2L3 6.5L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Atrás
            </button>
          </div>
        )}

      </aside>
    </>
  )
}

import { useState } from 'react'

export default function OrphanAssigner({ orphans, resultados, onAssign, onDeleteRow }) {
  const [selected, setSelected] = useState(new Set())
  const [targetResultado, setTargetResultado] = useState('')

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === orphans.length) setSelected(new Set())
    else setSelected(new Set(orphans.map(o => o.id)))
  }

  function handleAssign() {
    if (selected.size === 0 || !targetResultado) return
    onAssign([...selected], targetResultado)
    setSelected(new Set())
    setTargetResultado('')
  }

  if (orphans.length === 0) return null

  return (
    <div className="orphan-assigner">
      <div className="orphan-header">
        <span className="orphan-title">Backlogs sin resultado asociado ({orphans.length})</span>
        <div className="orphan-actions">
          <button className="orphan-select-all" onClick={selectAll}>
            {selected.size === orphans.length ? 'Deseleccionar' : 'Seleccionar todos'}
          </button>
          {selected.size > 0 && (
            <>
              <select value={targetResultado} onChange={e => setTargetResultado(e.target.value)} className="orphan-target-select">
                <option value="">Asociar a resultado...</option>
                {resultados.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.accion} ({r.tema || 'sin tema'})
                  </option>
                ))}
              </select>
              <button className="btn-primary btn-sm" onClick={handleAssign} disabled={!targetResultado}>
                Asociar ({selected.size})
              </button>
            </>
          )}
        </div>
      </div>
      <div className="orphan-list">
        {orphans.map(o => (
          <div key={o.id} className={`orphan-item ${selected.has(o.id) ? 'orphan-selected' : ''}`}>
            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} />
            <span className="orphan-tema">{o.tema || '—'}</span>
            <span className="orphan-accion">{o.accion || '—'}</span>
            <span className="orphan-fecha">{o.fecha || '—'}</span>
            <span className="orphan-resp">{o.responsable || '—'}</span>
            {onDeleteRow && (
              <button
                className="orphan-delete-btn btn-delete-row"
                onClick={() => onDeleteRow(o.id)}
                title="Eliminar backlog"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 5.5v4M7.5 5.5v4M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

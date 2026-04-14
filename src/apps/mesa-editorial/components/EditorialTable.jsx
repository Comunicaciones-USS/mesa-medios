import { useState } from 'react'
import { EJES } from '../config'
import EjeSection from './EjeSection'

export default function EditorialTable({ rows, onCellChange, onDeleteRow, onAddBacklog, filterQuery, totalRows, onClearFilter, onAdd }) {
  const [collapsedEjes, setCollapsedEjes] = useState({})

  function toggleEje(ejeLabel) {
    setCollapsedEjes(prev => ({ ...prev, [ejeLabel]: !prev[ejeLabel] }))
  }

  // Group rows by eje, maintaining EJES order
  const rowsByEje = EJES.reduce((acc, eje) => {
    acc[eje.label] = rows.filter(r => r.eje === eje.label)
    return acc
  }, {})

  // Empty state: no data at all
  if (totalRows === 0) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="8" width="32" height="32" rx="6" stroke="#ceb37c" strokeWidth="2" fill="none"/>
          <path d="M16 20h16M16 26h10" stroke="#ceb37c" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h3>Sin acciones registradas</h3>
        <p>Comienza agregando la primera acción editorial.</p>
        <button className="btn-add" onClick={onAdd}>+ Agregar acción</button>
      </div>
    )
  }

  // Empty state: filter with no results
  if (rows.length === 0 && filterQuery) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="22" cy="22" r="14" stroke="#ceb37c" strokeWidth="2" fill="none"/>
          <path d="M32 32l8 8" stroke="#ceb37c" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <h3>Sin resultados para "{filterQuery}"</h3>
        <p>Intenta con otro término de búsqueda.</p>
        <button className="btn-secondary" onClick={onClearFilter}>Limpiar filtro</button>
      </div>
    )
  }

  return (
    <div className="editorial-table-container">
      {EJES.map(eje => {
        const ejeRows = rowsByEje[eje.label] || []
        // Skip empty ejes when filter is active
        if (ejeRows.length === 0 && filterQuery) return null
        return (
          <EjeSection
            key={eje.id}
            eje={eje}
            rows={ejeRows}
            onCellChange={onCellChange}
            onDeleteRow={onDeleteRow}
            onAddBacklog={onAddBacklog}
            collapsed={!!collapsedEjes[eje.label]}
            onToggle={() => toggleEje(eje.label)}
          />
        )
      })}
    </div>
  )
}

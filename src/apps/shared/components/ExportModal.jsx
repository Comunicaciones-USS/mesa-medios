import { useState, useMemo, useEffect, useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

export default function ExportModal({ title, items, preselected, onGenerate, onClose }) {
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState(() => new Set(preselected))
  const [generating, setGenerating] = useState(false)
  const dialogRef   = useRef(null)
  const searchRef   = useRef(null)
  const triggerRef  = useRef(typeof document !== 'undefined' ? document.activeElement : null)

  useFocusTrap(dialogRef, true)

  useEffect(() => { searchRef.current?.focus() }, [])

  useEffect(() => {
    return () => { triggerRef.current?.focus() }
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter(i => i.name.toLowerCase().includes(q)) : items
  }, [items, search])

  function toggleItem(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(prev => {
      const next = new Set(prev)
      filtered.forEach(i => next.add(i.id))
      return next
    })
  }

  function clearAll() { setSelected(new Set()) }

  async function handleGenerate() {
    if (selected.size === 0 || generating) return
    setGenerating(true)
    await new Promise(r => setTimeout(r, 50))
    try {
      await onGenerate(selected)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className="export-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="export-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
        <div className="export-modal-header">
          <h2 id="export-modal-title" className="export-modal-title">{title}</h2>
          <button className="export-modal-close" onClick={onClose} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="export-modal-body">
          <p className="export-modal-desc">Selecciona los elementos que quieres incluir en el reporte.</p>

          <div className="export-modal-controls">
            <div className="export-search">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="export-search-input"
              />
              {search && (
                <button className="filter-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
            </div>
            <button className="export-ctrl-btn" onClick={selectAll}>Seleccionar todos</button>
            <button className="export-ctrl-btn" onClick={clearAll}>Limpiar</button>
          </div>

          <div className="export-list">
            {filtered.length === 0 && (
              <p className="export-empty">Sin resultados para "{search}"</p>
            )}
            {filtered.map(item => (
              <label key={item.id} className="export-item">
                <input
                  type="checkbox"
                  className="export-checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                />
                <span className="export-item-name">{item.name}</span>
                <span className="export-item-meta">{item.meta}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="export-modal-footer">
          <button className="btn-ghost-cancel" onClick={onClose}>Cancelar</button>
          <button
            className="btn-export-generate"
            onClick={handleGenerate}
            disabled={selected.size === 0 || generating}
          >
            {generating
              ? <><span className="export-spinner" />Generando...</>
              : `Generar Excel (${selected.size})`
            }
          </button>
        </div>
      </div>
    </div>
  )
}

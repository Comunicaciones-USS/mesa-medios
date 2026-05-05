import { useState, useEffect, useRef } from 'react'

/**
 * KebabMenu — menú de acciones contextual reutilizable.
 *
 * Props:
 *   items      Array<{ label, onClick, icon?, variant?: 'danger' }>
 *   ariaLabel  string — aria-label del botón disparador
 */
export default function KebabMenu({ items, ariaLabel = 'Acciones' }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return

    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="kebab-menu-container" ref={containerRef}>
      <button
        className="kebab-menu-trigger"
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        type="button"
      >
        &#8942;
      </button>

      {open && (
        <div className="kebab-menu-dropdown" role="menu">
          {items.map((item, i) => (
            <button
              key={i}
              className={`kebab-menu-item${item.variant === 'danger' ? ' kebab-menu-item-danger' : ''}`}
              role="menuitem"
              type="button"
              onClick={e => { e.stopPropagation(); setOpen(false); item.onClick() }}
            >
              {item.icon && <span className="kebab-menu-item-icon" aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

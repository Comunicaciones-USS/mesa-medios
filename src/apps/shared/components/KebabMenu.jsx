import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const DROPDOWN_W = 180

export default function KebabMenu({ items, ariaLabel = 'Acciones' }) {
  const [open, setOpen]       = useState(false)
  const [pos,  setPos]        = useState({ top: 0, left: 0 })
  const triggerRef            = useRef(null)
  const dropdownRef           = useRef(null)

  const handleOpen = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const top  = rect.bottom + 4
    const rawLeft = rect.right - DROPDOWN_W
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - DROPDOWN_W - 8))
    setPos({ top, left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return

    function handleMouseDown(e) {
      if (
        !triggerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleScroll() {
      setOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown',   handleKeyDown)
    window.addEventListener('scroll',  handleScroll, true)
    window.addEventListener('resize',  handleScroll)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown',   handleKeyDown)
      window.removeEventListener('scroll',  handleScroll, true)
      window.removeEventListener('resize',  handleScroll)
    }
  }, [open])

  return (
    <div className="kebab-menu-container">
      <button
        ref={triggerRef}
        className="kebab-menu-trigger"
        onClick={e => { e.stopPropagation(); open ? setOpen(false) : handleOpen() }}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        type="button"
      >
        &#8942;
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="kebab-menu-dropdown kebab-menu-dropdown-portal"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          role="menu"
        >
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
        </div>,
        document.body
      )}
    </div>
  )
}

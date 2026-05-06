import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function StatusPillDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  readOnly = false,
}) {
  const triggerRef  = useRef(null)
  const dropdownRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [pos,    setPos]    = useState({ top: 0, left: 0 })

  const currentOption = options.find(o => o.value === value) || options[0]

  const handleOpen = () => {
    if (readOnly || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left })
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return
    const close = () => setIsOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleMouseDown(e) {
      if (
        !triggerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleEsc(e) { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  const availableOptions = options.filter(o => o.value !== value)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`status-pill-trigger status-pill-${currentOption?.color ?? 'gray'}`}
        onClick={e => { e.stopPropagation(); isOpen ? setIsOpen(false) : handleOpen() }}
        disabled={readOnly}
        aria-label={ariaLabel}
        aria-haspopup={readOnly ? undefined : 'menu'}
        aria-expanded={readOnly ? undefined : isOpen}
      >
        <span className="status-pill-label">{currentOption?.label ?? value}</span>
        {!readOnly && <span className="status-pill-chevron" aria-hidden="true">▾</span>}
      </button>

      {isOpen && availableOptions.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          className="status-pill-dropdown-portal"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          role="menu"
        >
          {availableOptions.map(option => (
            <button
              key={option.value}
              type="button"
              className={`status-pill-option status-pill-option-${option.color}`}
              role="menuitem"
              onClick={e => {
                e.stopPropagation()
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

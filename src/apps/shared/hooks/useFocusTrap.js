import { useEffect } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps keyboard focus within `ref` while `isActive` is true.
 * Tab cycles forward, Shift+Tab cycles backward, staying inside the container.
 *
 * @param {React.RefObject} ref       - ref attached to the container element
 * @param {boolean}         isActive  - whether the trap is active
 */
export function useFocusTrap(ref, isActive) {
  useEffect(() => {
    if (!isActive || !ref.current) return

    const focusable = Array.from(ref.current.querySelectorAll(FOCUSABLE_SELECTOR))
    if (focusable.length === 0) return

    const first = focusable[0]
    const last  = focusable[focusable.length - 1]

    function handleTab(e) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    const node = ref.current
    node.addEventListener('keydown', handleTab)
    return () => node.removeEventListener('keydown', handleTab)
  }, [ref, isActive])
}

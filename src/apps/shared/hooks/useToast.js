import { useState, useCallback, useRef } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const addToast = useCallback((message, type = 'info', duration) => {
    const id = Date.now() + Math.random()
    const ms = duration ?? (type === 'error' ? 6000 : 4000)
    setToasts(prev => {
      const next = [...prev, { id, message, type }]
      return next.slice(-3) // máximo 3 apilados
    })
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, ms)
    timers.current.set(id, timer)
  }, [])

  const removeToast = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

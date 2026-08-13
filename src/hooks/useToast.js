import { useEffect, useRef, useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = (message, { type = 'success', action, duration } = {}) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const next = { id: Date.now(), message, type, action }
    setToast(next)
    const ms = duration ?? (action ? 7000 : 2800)
    toastTimerRef.current = setTimeout(() => {
      setToast((current) => (current?.id === next.id ? null : current))
    }, ms)
  }

  const dismissToast = () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(null)
  }

  return { toast, showToast, dismissToast }
}

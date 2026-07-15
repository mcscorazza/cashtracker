import { useState, useEffect } from 'react'

export function toast(message: string, type: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }))
}

export default function Toast() {
  const [toastData, setToastData] = useState<{ message: string, type: string } | null>(null)

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent
      setToastData(customEvent.detail)

      // Faz a mensagem sumir após 3 segundos
      setTimeout(() => {
        setToastData(null)
      }, 3000)
    }

    window.addEventListener('show-toast', handleToast)
    return () => window.removeEventListener('show-toast', handleToast)
  }, [])

  if (!toastData) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: toastData.type === 'error' ? 'var(--danger-color)' : '#10b981',
      color: 'white',
      padding: '0.8rem 1.5rem',
      borderRadius: '30px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      zIndex: 9999,
      fontWeight: 'bold',
      textAlign: 'center',
      minWidth: '250px'
    }}>
      {toastData.message}
    </div>
  )
}
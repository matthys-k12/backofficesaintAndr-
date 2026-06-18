import { X } from 'lucide-react'
import { useEffect } from 'react'

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  // Fermer avec Échap
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(15,15,30,0.55)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative bg-white rounded-2xl w-full ${SIZES[size]} max-h-[90vh] flex flex-col`}
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #ede9e3' }}
        >
          <h2
            className="text-lg font-bold text-gray-900"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ color: '#9ca3af' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f5f3f0'; e.currentTarget.style.color = '#374151' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

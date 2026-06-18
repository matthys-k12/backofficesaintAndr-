import { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (type === 'success') {
      const t = setTimeout(onClose, 3000)
      return () => clearTimeout(t)
    }
  }, [type, onClose])

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white max-w-sm ${type === 'success' ? 'bg-green-700' : 'bg-red-700'}`}>
      {type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
      <span className="text-sm font-medium flex-1">{message}</span>
      <button onClick={onClose}><X size={16} /></button>
    </div>
  )
}

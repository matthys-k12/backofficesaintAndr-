import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ImageUpload({ onUpload, bucket, multiple = false, maxFiles = 1, currentUrl }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl || null)

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      const urls = []
      for (const file of files.slice(0, maxFiles)) {
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from(bucket).upload(path, file)
        if (error) throw error
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        urls.push(data.publicUrl)
      }
      if (!multiple) setPreview(urls[0])
      onUpload(multiple ? urls : urls[0])
    } catch (err) {
      alert('Erreur upload : ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      {preview && !multiple && (
        <div className="relative mb-2 w-32 h-32">
          <img src={preview} alt="preview" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />
          <button
            onClick={() => { setPreview(null); onUpload(null) }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-bordeaux transition-colors ${uploading ? 'opacity-50' : ''}`}>
        <Upload size={16} className="text-gray-400" />
        <span className="text-sm text-gray-500">{uploading ? 'Upload en cours…' : 'Choisir un fichier'}</span>
        <input
          type="file"
          className="hidden"
          multiple={multiple}
          onChange={handleUpload}
          disabled={uploading}
          accept="image/*"
        />
      </label>
    </div>
  )
}

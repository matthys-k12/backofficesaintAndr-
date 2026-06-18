import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Image } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import Toast from '../components/Toast'
import ImageUpload from '../components/ImageUpload'

export default function Carrousel() {
  const [slides, setSlides] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalSlide, setModalSlide] = useState(false)
  const [editSlide, setEditSlide] = useState(null)
  const [toast, setToast] = useState(null)
  const [imageUrl, setImageUrl] = useState('')

  const { register, handleSubmit, reset } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const loadSlides = async () => {
    setLoading(true)
    const { data } = await supabase.from('carrousel_items')
      .select('*')
      .order('ordre', { ascending: true })
    setSlides(data || [])
    setLoading(false)
  }

  useEffect(() => { loadSlides() }, [])

  const openEdit = (s) => {
    setEditSlide(s)
    setImageUrl(s.image_url || '')
    reset({
      titre: s.titre || '',
      sous_titre: s.sous_titre || s.description || '',
      lien: s.lien || s.lien_url || '',
      est_actif: s.est_actif !== false,
    })
    setModalSlide(true)
  }

  const saveSlide = async (data) => {
    try {
      if (!imageUrl) {
        showToast('Veuillez uploader une image', 'error')
        return
      }
      const payload = {
        titre: data.titre || null,
        // envoyer les deux noms possibles selon la table existante
        sous_titre: data.sous_titre || null,
        description: data.sous_titre || null,
        lien: data.lien || null,
        lien_url: data.lien || null,
        image_url: imageUrl,
        est_actif: data.est_actif !== false,
      }
      if (editSlide) {
        await q(supabase.from('carrousel_items').update(payload).eq('id', editSlide.id))
      } else {
        const maxOrdre = slides.length > 0 ? Math.max(...slides.map(s => s.ordre || 0)) : 0
        await q(supabase.from('carrousel_items').insert({ ...payload, ordre: maxOrdre + 1 }))
      }
      showToast('Slide enregistrée ✓')
      setModalSlide(false); setEditSlide(null); setImageUrl(''); reset()
      loadSlides()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const toggleActif = async (s) => {
    await q(supabase.from('carrousel_items').update({ est_actif: !s.est_actif }).eq('id', s.id))
    loadSlides()
  }

  const deleteSlide = async (id) => {
    if (!confirm('Supprimer cette slide ?')) return
    await q(supabase.from('carrousel_items').delete().eq('id', id))
    showToast('Slide supprimée')
    loadSlides()
  }

  const moveUp = async (index) => {
    if (index === 0) return
    const current = slides[index]
    const prev = slides[index - 1]
    await Promise.all([
      supabase.from('carrousel_items').update({ ordre: prev.ordre }).eq('id', current.id),
      supabase.from('carrousel_items').update({ ordre: current.ordre }).eq('id', prev.id),
    ])
    loadSlides()
  }

  const moveDown = async (index) => {
    if (index === slides.length - 1) return
    const current = slides[index]
    const next = slides[index + 1]
    await Promise.all([
      supabase.from('carrousel_items').update({ ordre: next.ordre }).eq('id', current.id),
      supabase.from('carrousel_items').update({ ordre: current.ordre }).eq('id', next.id),
    ])
    loadSlides()
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Carrousel</h2>
        <button
          onClick={() => { setEditSlide(null); setImageUrl(''); reset(); setModalSlide(true) }}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#8B1A2E' }}
        >
          <Plus size={16} /> Ajouter une slide
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : slides.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Image size={40} className="mx-auto mb-3 text-gray-200" />
          <p>Aucune slide dans le carrousel.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((s, index) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                {/* Ordre */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 hover:bg-gray-100"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <span className="text-xs text-gray-400 text-center font-medium">{s.ordre || index + 1}</span>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === slides.length - 1}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 hover:bg-gray-100"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Image */}
                <div className="w-32 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.titre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={20} className="text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{s.titre || '(Sans titre)'}</p>
                  {s.sous_titre && <p className="text-sm text-gray-500 truncate">{s.sous_titre}</p>}
                  {s.lien && <p className="text-xs text-blue-600 truncate mt-1">{s.lien}</p>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => toggleActif(s)}
                    className="w-10 h-5 rounded-full transition-colors relative"
                    style={{ backgroundColor: s.est_actif ? '#16a34a' : '#d1d5db' }}
                    title={s.est_actif ? 'Désactiver' : 'Activer'}
                  >
                    <div
                      className="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all"
                      style={{ left: s.est_actif ? '20px' : '2px' }}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(s)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Modifier"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => deleteSlide(s.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalSlide}
        onClose={() => { setModalSlide(false); setEditSlide(null) }}
        title={editSlide ? 'Modifier la slide' : 'Ajouter une slide'}
        size="md"
      >
        <form onSubmit={handleSubmit(saveSlide)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
            <input {...register('titre')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sous-titre</label>
            <input {...register('sous_titre')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lien (optionnel)</label>
            <input {...register('lien')} type="url" placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Image *</label>
            <ImageUpload bucket="carrousel" currentUrl={imageUrl} onUpload={url => setImageUrl(url || '')} />
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="Ou collez une URL d'image"
              className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
            {imageUrl && <img src={imageUrl} alt="" className="mt-2 w-full h-32 object-cover rounded-lg" />}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...register('est_actif')} defaultChecked />
            <span>Visible dans l'app</span>
          </label>
          <button type="submit" className="w-full text-white py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#8B1A2E' }}>
            Enregistrer
          </button>
        </form>
      </Modal>
    </div>
  )
}

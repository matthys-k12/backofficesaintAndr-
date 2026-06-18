import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Image, ExternalLink } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import ImageUpload from '../components/ImageUpload'
import { fmtDate, nfcPayload } from '../lib/helpers'

const PAGE_SIZE = 20

const CATEGORIES = [
  'liturgie', 'solidarite', 'jeunesse', 'formation',
  'activites', 'mariage', 'associations', 'construction'
]
const CAT_LABELS = {
  liturgie: 'Liturgie', solidarite: 'Solidarité', jeunesse: 'Jeunesse',
  formation: 'Formation', activites: 'Activités', mariage: 'Mariage',
  associations: 'Associations', construction: 'Construction'
}

export default function Actualites() {
  const [actualites, setActualites] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalActu, setModalActu] = useState(false)
  const [editActu, setEditActu] = useState(null)
  const [filtreCat, setFiltreCat] = useState('tout')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [photos, setPhotos] = useState([])
  const [coverUrl, setCoverUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, reset } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const loadActualites = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('actualites')
      .select('*, actualite_photos(id, url, ordre)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (filtreCat !== 'tout') query = query.eq('categorie', filtreCat)
    if (search) query = query.ilike('titre', `%${search}%`)

    const { data, count } = await query
    setActualites(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, filtreCat, search])

  useEffect(() => { loadActualites() }, [loadActualites])

  const openEdit = (a) => {
    setEditActu(a)
    setCoverUrl(a.image_couverture || '')
    setPhotos(a.actualite_photos?.map(p => ({ url: p.url, id: p.id })) || [])
    reset({
      titre: a.titre,
      article: a.article,
      categorie: a.categorie,
      video_url: a.video_url || '',
      est_actif: a.est_actif !== false,
      est_a_la_une: a.est_a_la_une === true,
    })
    setModalActu(true)
  }

  const saveActu = async (data) => {
    try {
      const payload = nfcPayload({
        titre: data.titre,
        article: data.article,
        categorie: data.categorie,
        video_url: data.video_url || null,
        image_couverture: coverUrl || null,
        est_actif: data.est_actif !== false,
        est_a_la_une: data.est_a_la_une === true,
      })

      let actuId = editActu?.id
      if (editActu) {
        await q(supabase.from('actualites').update(payload).eq('id', editActu.id))
      } else {
        const { data: inserted } = await q(supabase.from('actualites').insert(payload).select().single())
        actuId = inserted.id
      }

      // Sync photos
      if (actuId) {
        if (editActu) {
          // Supprimer les anciennes photos sans ID
          const { data: existing } = await supabase.from('actualite_photos').select('id').eq('actualite_id', actuId)
          const existingIds = existing?.map(p => p.id) || []
          const newIds = photos.filter(p => p.id).map(p => p.id)
          const toDelete = existingIds.filter(id => !newIds.includes(id))
          if (toDelete.length) await supabase.from('actualite_photos').delete().in('id', toDelete)
        }
        // Insérer les nouvelles photos
        const newPhotos = photos.filter(p => !p.id)
        if (newPhotos.length) {
          await supabase.from('actualite_photos').insert(
            newPhotos.map((p, i) => ({ actualite_id: actuId, url: p.url, ordre: i }))
          )
        }
      }

      showToast('Actualité enregistrée')
      setModalActu(false)
      setEditActu(null)
      setCoverUrl('')
      setPhotos([])
      reset()
      loadActualites()
    } catch (e) {
      console.error(e)
      showToast('Erreur lors de l\'enregistrement', 'error')
    }
  }

  const toggleActif = async (a) => {
    await q(supabase.from('actualites').update({ est_actif: !a.est_actif }).eq('id', a.id))
    loadActualites()
  }

  const toggleALaUne = async (a) => {
    await q(supabase.from('actualites').update({ est_a_la_une: !a.est_a_la_une }).eq('id', a.id))
    loadActualites()
  }

  const deleteActu = async (id) => {
    if (!confirm('Supprimer cette actualité et ses photos ?')) return
    await q(supabase.from('actualite_photos').delete().eq('actualite_id', id))
    await q(supabase.from('actualites').delete().eq('id', id))
    showToast('Actualité supprimée')
    loadActualites()
  }

  const handleMultiUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      const newUrls = []
      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from('actualites').upload(path, file)
        if (error) throw error
        const { data } = supabase.storage.from('actualites').getPublicUrl(path)
        newUrls.push({ url: data.publicUrl })
      }
      setPhotos(prev => [...prev, ...newUrls])
    } catch (err) {
      showToast('Erreur upload: ' + err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const cols = [
    {
      key: 'image_couverture', label: 'Image', render: v => v ? (
        <img src={v} alt="" className="w-12 h-8 object-cover rounded" />
      ) : <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center"><Image size={14} className="text-gray-300" /></div>
    },
    { key: 'titre', label: 'Titre', render: v => <span className="font-medium">{v}</span> },
    { key: 'categorie', label: 'Catégorie', render: v => <Badge label={CAT_LABELS[v] || v} value={v} /> },
    { key: 'actualite_photos', label: 'Photos', render: v => <span className="text-gray-500 text-xs">{v?.length || 0} photo(s)</span> },
    {
      key: 'est_a_la_une', label: 'À la une', render: (v, row) => (
        <button onClick={() => toggleALaUne(row)} title="Mettre/retirer de la une" className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${v ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
          {v ? '★ Une' : '☆ —'}
        </button>
      )
    },
    {
      key: 'est_actif', label: 'Actif', render: (v, row) => (
        <button onClick={() => toggleActif(row)} className="w-8 h-4 rounded-full transition-colors relative" style={{ backgroundColor: v ? '#16a34a' : '#d1d5db' }}>
          <div className="w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all" style={{ left: v ? '14px' : '2px' }} />
        </button>
      )
    },
    { key: 'created_at', label: 'Créé le', render: v => fmtDate(v) },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Actualités</h2>
        <button
          onClick={() => { setEditActu(null); setCoverUrl(''); setPhotos([]); reset(); setModalActu(true) }}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#8B1A2E' }}
        >
          <Plus size={16} /> Nouvelle actualité
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Rechercher…"
          className="flex-1 min-w-48 max-w-xs px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
        />
        <select
          value={filtreCat}
          onChange={e => { setFiltreCat(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
        >
          <option value="tout">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
      </div>

      <DataTable
        columns={cols}
        data={actualites}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          <button key="e" onClick={() => openEdit(row)} className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50">
            <Edit2 size={12} /> Modifier
          </button>,
          <button key="d" onClick={() => deleteActu(row.id)} className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100">
            <Trash2 size={12} /> Supprimer
          </button>,
        ]}
      />

      <Modal
        isOpen={modalActu}
        onClose={() => { setModalActu(false); setEditActu(null) }}
        title={editActu ? 'Modifier l\'actualité' : 'Nouvelle actualité'}
        size="xl"
      >
        <form onSubmit={handleSubmit(saveActu)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input {...register('titre', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <select {...register('categorie', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu *</label>
            <textarea {...register('article', { required: true })} rows={6} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image de couverture</label>
            <ImageUpload bucket="actualites" currentUrl={coverUrl} onUpload={url => setCoverUrl(url || '')} />
            <input
              type="text"
              value={coverUrl}
              onChange={e => setCoverUrl(e.target.value)}
              placeholder="Ou URL de l'image de couverture"
              className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Galerie photos</label>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-red-800 transition-colors w-fit ${uploading ? 'opacity-50' : ''}`}>
              <Image size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500">{uploading ? 'Upload...' : 'Ajouter des photos'}</span>
              <input type="file" className="hidden" multiple accept="image/*" onChange={handleMultiUpload} disabled={uploading} />
            </label>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p.url} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><ExternalLink size={14} /> URL vidéo (YouTube, etc.)</span>
            </label>
            <input {...register('video_url')} type="url" placeholder="https://youtube.com/..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('est_actif')} defaultChecked />
              <span>Visible dans l'app</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('est_a_la_une')} />
              <span>★ À la une (mise en avant)</span>
            </label>
          </div>

          <button type="submit" className="w-full text-white py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#8B1A2E' }}>
            Enregistrer
          </button>
        </form>
      </Modal>
    </div>
  )
}

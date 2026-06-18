import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import ImageUpload from '../components/ImageUpload'
import { fmtDate, nfcPayload } from '../lib/helpers'

const PAGE_SIZE = 20

export default function TexteJour() {
  const [textes, setTextes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalTexte, setModalTexte] = useState(false)
  const [editTexte, setEditTexte] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)

  const { register, handleSubmit, reset } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const loadTextes = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('texte_jour')
      .select('*', { count: 'exact' })
      .order('date_lecture', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) query = query.or(`titre.ilike.%${search}%,reference.ilike.%${search}%`)

    const { data, count } = await query
    setTextes(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, search])

  useEffect(() => { loadTextes() }, [loadTextes])

  const openEdit = (t) => {
    setEditTexte(t)
    setImageUrl(t.image_url || '')
    reset({
      titre: t.titre,
      date_lecture: t.date_lecture ? t.date_lecture.split('T')[0] : '',
      reference: t.reference || '',
      contenu: t.contenu || '',
      reflexion: t.reflexion || '',
      est_actif: t.est_actif !== false,
    })
    setModalTexte(true)
  }

  const saveTexte = async (data) => {
    try {
      const payload = nfcPayload({
        titre: data.titre,
        date_lecture: data.date_lecture || null,
        reference: data.reference || null,
        contenu: data.contenu || null,
        reflexion: data.reflexion || null,
        image_url: imageUrl || null,
        est_actif: data.est_actif !== false,
      })
      if (editTexte) {
        await q(supabase.from('texte_jour').update(payload).eq('id', editTexte.id))
      } else {
        await q(supabase.from('texte_jour').insert(payload))
      }
      showToast('Texte enregistré')
      setModalTexte(false)
      setEditTexte(null)
      setImageUrl('')
      reset()
      loadTextes()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const toggleActif = async (t) => {
    await q(supabase.from('texte_jour').update({ est_actif: !t.est_actif }).eq('id', t.id))
    loadTextes()
  }

  const deleteTexte = async (id) => {
    if (!confirm('Supprimer ce texte ?')) return
    await q(supabase.from('texte_jour').delete().eq('id', id))
    showToast('Texte supprimé')
    loadTextes()
  }

  const cols = [
    { key: 'date_lecture', label: 'Date', render: v => fmtDate(v) },
    {
      key: 'titre', label: 'Titre', render: (v, row) => (
        <div>
          <p className="font-medium text-gray-800">{v}</p>
          {row.reference && <p className="text-xs text-gray-400">{row.reference}</p>}
        </div>
      )
    },
    {
      key: 'image_url', label: 'Image', render: v => v
        ? <img src={v} alt="" className="w-10 h-10 rounded object-cover border border-gray-200" />
        : <span className="text-gray-300 text-xs">—</span>
    },
    { key: 'contenu', label: 'Extrait', render: v => v ? (v.length > 60 ? v.slice(0, 60) + '…' : v) : '—' },
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
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Texte du jour</h2>
        <button
          onClick={() => { setEditTexte(null); setImageUrl(''); reset(); setModalTexte(true) }}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#8B1A2E' }}
        >
          <Plus size={16} /> Nouveau texte
        </button>
      </div>

      <div className="flex gap-3">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Rechercher par titre ou référence…"
          className="flex-1 max-w-sm px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
        />
      </div>

      <DataTable
        columns={cols}
        data={textes}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          <button key="e" onClick={() => openEdit(row)} className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50">
            <Edit2 size={12} /> Modifier
          </button>,
          <button key="d" onClick={() => deleteTexte(row.id)} className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100">
            <Trash2 size={12} /> Supprimer
          </button>,
        ]}
      />

      <Modal
        isOpen={modalTexte}
        onClose={() => { setModalTexte(false); setEditTexte(null) }}
        title={editTexte ? 'Modifier le texte' : 'Nouveau texte du jour'}
        size="lg"
      >
        <form onSubmit={handleSubmit(saveTexte)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input {...register('titre', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de lecture</label>
              <input type="date" {...register('date_lecture')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Référence biblique</label>
            <input {...register('reference')} placeholder="ex: Jean 3:16" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Texte biblique</label>
            <textarea {...register('contenu')} rows={5} placeholder="Le texte de l'Évangile ou de la lecture du jour…" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Réflexion / Commentaire</label>
            <textarea {...register('reflexion')} rows={4} placeholder="Méditation ou commentaire pastoral…" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Image (optionnelle)</label>
            <ImageUpload bucket="textes" currentUrl={imageUrl} onUpload={url => setImageUrl(url || '')} />
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="Ou URL de l'image"
              className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
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

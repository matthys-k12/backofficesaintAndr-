import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Star } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import ImageUpload from '../components/ImageUpload'
import { fmtDate, nfcPayload } from '../lib/helpers'

const PAGE_SIZE = 20

export default function SaintJour() {
  const [saints, setSaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalSaint, setModalSaint] = useState(false)
  const [editSaint, setEditSaint] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [imageUrl, setImageUrl] = useState('')

  const { register, handleSubmit, reset } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const loadSaints = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('saint_jour')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })  // date_fete peut être null
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (search) query = query.ilike('nom', `%${search}%`)

      const { data, count } = await q(query)
      setSaints(data || [])
      setTotal(count || 0)
    } catch (err) {
      // Ne pas appeler showToast ici (provoque une boucle de re-render)
      console.error('Erreur chargement saints:', err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { loadSaints() }, [loadSaints])

  const openEdit = (s) => {
    setEditSaint(s)
    setImageUrl(s.image_url || '')
    reset({
      nom: s.nom,
      date_fete: s.fete_date ? s.fete_date.split('T')[0] : '',
      biographie: s.biographie || '',
      lieu: s.lieu || '',
      epoque: s.epoque || '',
      patronage: s.patronage || '',
    })
    setModalSaint(true)
  }

  const saveSaint = async (data) => {
    try {
      const payload = nfcPayload({
        nom: data.nom,
        sous_titre: data.sous_titre || null,
        fete_date: data.date_fete || null,
        biographie: data.biographie || null,
        citation: data.citation || null,
        lieu: data.lieu || null,
        epoque: data.epoque || null,
        patronage: data.patronage || null,
        image_url: imageUrl || null,
      })
      if (editSaint) {
        await q(supabase.from('saint_jour').update(payload).eq('id', editSaint.id))
      } else {
        await q(supabase.from('saint_jour').insert({ ...payload, est_saint_du_jour: false }))
      }
      showToast('Saint enregistré ✓')
      setModalSaint(false); setEditSaint(null); setImageUrl(''); reset()
      loadSaints()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const definirSaintDuJour = async (id) => {
    try {
      await q(supabase.from('saint_jour').update({ est_saint_du_jour: false }).neq('id', id))
      await q(supabase.from('saint_jour').update({ est_saint_du_jour: true }).eq('id', id))
      showToast('Saint du jour défini !')
      loadSaints()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const retirerSaintDuJour = async (id) => {
    try {
      await q(supabase.from('saint_jour').update({ est_saint_du_jour: false }).eq('id', id))
      showToast('Saint du jour retiré')
      loadSaints()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const deleteSaint = async (id) => {
    if (!confirm('Supprimer ce saint ?')) return
    try {
      await q(supabase.from('saint_jour').delete().eq('id', id))
      showToast('Saint supprimé')
      loadSaints()
    } catch (err) { showToast(err.message, 'error') }
  }

  const cols = [
    {
      key: 'image_url', label: 'Image', render: v => v ? (
        <img src={v} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <Star size={14} className="text-gray-300" />
        </div>
      )
    },
    {
      key: 'nom', label: 'Nom', render: (v, row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{v}</span>
          {row.est_saint_du_jour && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium">Aujourd'hui</span>}
        </div>
      )
    },
    { key: 'fete_date', label: 'Fête le', render: v => v ? new Date(v).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '—' },
    { key: 'lieu', label: 'Lieu', render: v => v || '—' },
    { key: 'epoque', label: 'Époque', render: v => v || '—' },
    { key: 'patronage', label: 'Patronage', render: v => v ? (v.length > 30 ? v.slice(0, 30) + '…' : v) : '—' },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Saint du jour</h2>
        <button
          onClick={() => { setEditSaint(null); setImageUrl(''); reset(); setModalSaint(true) }}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#8B1A2E' }}
        >
          <Plus size={16} /> Ajouter un saint
        </button>
      </div>

      <div className="flex gap-3">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Rechercher par nom…"
          className="flex-1 max-w-xs px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
        />
      </div>

      <DataTable
        columns={cols}
        data={saints}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          row.est_saint_du_jour ? (
            <button
              key="s"
              onClick={() => retirerSaintDuJour(row.id)}
              className="flex items-center gap-1 bg-yellow-100 text-yellow-900 border border-yellow-300 px-2 py-1 rounded text-xs hover:bg-yellow-200"
            >
              <Star size={12} fill="currentColor" /> Retirer
            </button>
          ) : (
            <button
              key="s"
              onClick={() => definirSaintDuJour(row.id)}
              className="flex items-center gap-1 bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-1 rounded text-xs hover:bg-yellow-100"
            >
              <Star size={12} /> Saint du jour
            </button>
          ),
          <button key="e" onClick={() => openEdit(row)} className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50">
            <Edit2 size={12} /> Modifier
          </button>,
          <button key="d" onClick={() => deleteSaint(row.id)} className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100">
            <Trash2 size={12} /> Supprimer
          </button>,
        ].filter(Boolean)}
      />

      <Modal
        isOpen={modalSaint}
        onClose={() => { setModalSaint(false); setEditSaint(null) }}
        title={editSaint ? 'Modifier le saint' : 'Ajouter un saint'}
        size="lg"
      >
        <form onSubmit={handleSubmit(saveSaint)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input {...register('nom', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de fête</label>
              <input type="date" {...register('date_fete')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
              <input {...register('lieu')} placeholder="ex: Rome, Italie" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Époque</label>
              <input {...register('epoque')} placeholder="ex: IIIe siècle" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patronage</label>
            <input {...register('patronage')} placeholder="ex: Patron des étudiants" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Biographie</label>
            <textarea {...register('biographie')} rows={5} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photo</label>
            <ImageUpload bucket="saints" currentUrl={imageUrl} onUpload={url => setImageUrl(url || '')} />
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="Ou URL de la photo"
              className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
          </div>
          <button type="submit" className="w-full text-white py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#8B1A2E' }}>
            Enregistrer
          </button>
        </form>
      </Modal>
    </div>
  )
}

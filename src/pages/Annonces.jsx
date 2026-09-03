import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, AlertTriangle, Settings } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import ImageUpload from '../components/ImageUpload'
import { fmtDate, nfcPayload } from '../lib/helpers'

const PAGE_SIZE = 20

// Catégories par défaut (fallback si table vide)
const CAT_DEFAUT = [
  { slug: 'liturgie',      label: 'Liturgie' },
  { slug: 'solidarite',    label: 'Solidarité' },
  { slug: 'jeunesse',      label: 'Jeunesse' },
  { slug: 'formation',     label: 'Formation' },
  { slug: 'activites',     label: 'Activités' },
  { slug: 'mariage',       label: 'Mariage' },
  { slug: 'prieres',       label: 'Prières' },
  { slug: 'ceb',           label: 'CEB' },
  { slug: 'associations',  label: 'Associations' },
  { slug: 'rappel_a_dieu', label: 'Rappel à Dieu' },
  { slug: 'construction',  label: 'Construction' },
]

export default function Annonces() {
  const [annonces, setAnnonces] = useState([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState(CAT_DEFAUT)
  const [loadingCats, setLoadingCats] = useState(true)
  const [modalAnnonce, setModalAnnonce] = useState(false)
  const [modalCats, setModalCats] = useState(false)
  const [editAnnonce, setEditAnnonce] = useState(null)
  const [filtreCat, setFiltreCat] = useState('tout')
  const [filtreUrgent, setFiltreUrgent] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  // Gestion des catégories
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatSlug, setNewCatSlug] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  const { register, handleSubmit, reset } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  // Chargement des catégories depuis Supabase
  const loadCategories = useCallback(async () => {
    setLoadingCats(true)
    try {
      const { data } = await supabase
        .from('categorie_annonces')
        .select('slug, label')
        .eq('est_actif', true)
        .order('ordre')
      if (data && data.length > 0) setCategories(data)
      else setCategories(CAT_DEFAUT)
    } catch {
      setCategories(CAT_DEFAUT)
    } finally {
      setLoadingCats(false)
    }
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  // Helper : label d'une catégorie par slug
  const catLabel = (slug) => categories.find(c => c.slug === slug)?.label || slug

  const loadAnnonces = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('annonces')
        .select('*', { count: 'exact' })
        .order('est_urgent', { ascending: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (filtreCat !== 'tout') query = query.eq('categorie', filtreCat)
      if (filtreUrgent) query = query.eq('est_urgent', true)
      if (search) query = query.ilike('titre', `%${search}%`)

      const { data, count } = await q(query)
      setAnnonces(data || [])
      setTotal(count || 0)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, filtreCat, filtreUrgent, search])

  useEffect(() => { loadAnnonces() }, [loadAnnonces])

  const openEdit = (a) => {
    setEditAnnonce(a)
    setImageUrl(a.image_url || '')
    reset({
      titre: a.titre,
      contenu: a.contenu,
      categorie: a.categorie,
      date_debut: a.date_debut ? a.date_debut.split('T')[0] : '',
      date_fin: a.date_fin ? a.date_fin.split('T')[0] : '',
      est_urgent: a.est_urgent,
      est_actif: a.est_actif,
    })
    setModalAnnonce(true)
  }

  const saveAnnonce = async (data) => {
    try {
      const payload = nfcPayload({
        titre: data.titre,
        contenu: data.contenu,
        categorie: data.categorie,
        est_urgent: !!data.est_urgent,
      })
      if (editAnnonce) {
        await q(supabase.from('annonces').update(payload).eq('id', editAnnonce.id))
      } else {
        await q(supabase.from('annonces').insert(payload))
        // Envoyer une notification push aux abonnés "annonces"
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              titre: data.titre,
              corps: data.contenu?.substring(0, 150) || '',
              topic: 'annonces',
            },
          })
          await supabase.from('push_notifications').insert({
            titre: data.titre,
            corps: data.contenu?.substring(0, 150) || '',
            type: 'annonce',
          })
        } catch (_) { /* notification non bloquante */ }
      }
      showToast('Annonce enregistrée ✓')
      setModalAnnonce(false)
      setEditAnnonce(null)
      setImageUrl('')
      reset()
      loadAnnonces()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const toggleUrgent = async (a) => {
    try {
      await q(supabase.from('annonces').update({ est_urgent: !a.est_urgent }).eq('id', a.id))
      showToast(a.est_urgent ? 'Marqué non urgent' : 'Marqué urgent')
      loadAnnonces()
    } catch (err) { showToast(err.message, 'error') }
  }

  const toggleActif = async (a) => {
    try {
      await q(supabase.from('annonces').update({ est_actif: !a.est_actif }).eq('id', a.id))
      loadAnnonces()
    } catch (err) { showToast(err.message, 'error') }
  }

  const deleteAnnonce = async (id) => {
    if (!confirm('Supprimer cette annonce ?')) return
    try {
      await q(supabase.from('annonces').delete().eq('id', id))
      showToast('Annonce supprimée')
      loadAnnonces()
    } catch (err) { showToast(err.message, 'error') }
  }

  // Gestion des catégories
  const addCategorie = async () => {
    if (!newCatLabel.trim()) return
    const slug = newCatSlug.trim() ||
      newCatLabel.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    setSavingCat(true)
    try {
      await supabase.from('categorie_annonces').insert({
        slug, label: newCatLabel.trim(), ordre: categories.length + 1
      })
      showToast('Catégorie ajoutée')
      setNewCatLabel(''); setNewCatSlug('')
      loadCategories()
    } catch (err) { showToast('Erreur : ' + err.message, 'error') }
    finally { setSavingCat(false) }
  }

  const deleteCategorie = async (slug) => {
    if (!confirm(`Supprimer la catégorie "${catLabel(slug)}" ?`)) return
    try {
      await supabase.from('categorie_annonces').delete().eq('slug', slug)
      showToast('Catégorie supprimée')
      loadCategories()
    } catch (err) { showToast('Erreur : ' + err.message, 'error') }
  }

  const cols = [
    {
      key: 'titre', label: 'Titre', render: (v, row) => (
        <div className="flex items-center gap-2">
          {row.est_urgent && <AlertTriangle size={14} className="text-red-600 shrink-0" />}
          <span className="font-medium">{v}</span>
        </div>
      )
    },
    { key: 'categorie', label: 'Catégorie', render: v => <Badge label={catLabel(v)} value={v} /> },
    {
      key: 'est_actif', label: 'Actif', render: (v, row) => (
        <button
          onClick={() => toggleActif(row)}
          className="w-8 h-4 rounded-full transition-colors relative"
          style={{ backgroundColor: v ? '#16a34a' : '#d1d5db' }}
        >
          <div className="w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all" style={{ left: v ? '14px' : '2px' }} />
        </button>
      )
    },
    { key: 'date_debut', label: 'Début', render: v => fmtDate(v) },
    { key: 'date_fin', label: 'Fin', render: v => fmtDate(v) },
    { key: 'created_at', label: 'Créé le', render: v => fmtDate(v) },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Annonces</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setModalCats(true)}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
            title="Gérer les catégories"
          >
            <Settings size={15} /> Catégories
          </button>
          <button
            onClick={() => { setEditAnnonce(null); setImageUrl(''); reset(); setModalAnnonce(true) }}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            <Plus size={16} /> Nouvelle annonce
          </button>
        </div>
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
          {categories.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm cursor-pointer">
          <input type="checkbox" checked={filtreUrgent} onChange={e => { setFiltreUrgent(e.target.checked); setPage(1) }} />
          <span>Urgent seulement</span>
        </label>
      </div>

      <DataTable
        columns={cols}
        data={annonces}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          <button
            key="u"
            onClick={() => toggleUrgent(row)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${row.est_urgent ? 'bg-orange-100 text-orange-800' : 'border border-gray-200 text-gray-600'}`}
            title={row.est_urgent ? 'Retirer urgent' : 'Marquer urgent'}
          >
            <AlertTriangle size={12} /> {row.est_urgent ? 'Non urgent' : 'Urgent'}
          </button>,
          <button key="e" onClick={() => openEdit(row)} className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50">
            <Edit2 size={12} /> Modifier
          </button>,
          <button key="d" onClick={() => deleteAnnonce(row.id)} className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100">
            <Trash2 size={12} /> Supprimer
          </button>,
        ]}
      />

      {/* Modal annonce */}
      <Modal
        isOpen={modalAnnonce}
        onClose={() => { setModalAnnonce(false); setEditAnnonce(null) }}
        title={editAnnonce ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
        size="lg"
      >
        <form onSubmit={handleSubmit(saveAnnonce)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input {...register('titre', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
            <select {...register('categorie', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contenu</label>
            <textarea {...register('contenu')} rows={5} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
              <input type="date" {...register('date_debut')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
              <input type="date" {...register('date_fin')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
            <ImageUpload bucket="annonces" currentUrl={imageUrl} onUpload={url => setImageUrl(url || '')} />
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="Ou collez une URL d'image"
              className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('est_urgent')} />
              <span>Marquer comme urgent</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" {...register('est_actif')} defaultChecked />
              <span>Visible dans l'app</span>
            </label>
          </div>
          <button type="submit" className="w-full text-white py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#8B1A2E' }}>
            Enregistrer
          </button>
        </form>
      </Modal>

      {/* Modal gestion des catégories */}
      <Modal
        isOpen={modalCats}
        onClose={() => setModalCats(false)}
        title="Gérer les catégories d'annonces"
        size="md"
      >
        <div className="space-y-4">
          {/* Liste des catégories actuelles */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {loadingCats ? (
              <div className="h-8 bg-gray-100 rounded animate-pulse" />
            ) : categories.map(c => (
              <div key={c.slug} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-800">{c.label}</span>
                  <span className="ml-2 text-xs text-gray-400">{c.slug}</span>
                </div>
                <button
                  onClick={() => deleteCategorie(c.slug)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Ajouter une catégorie */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Ajouter une catégorie</p>
            <div className="space-y-2">
              <input
                value={newCatLabel}
                onChange={e => setNewCatLabel(e.target.value)}
                placeholder="Nom affiché (ex: Évangélisation)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              />
              <input
                value={newCatSlug}
                onChange={e => setNewCatSlug(e.target.value)}
                placeholder="Slug (auto-généré si vide, ex: evangelisation)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none text-gray-500"
              />
              <button
                onClick={addCategorie}
                disabled={savingCat || !newCatLabel.trim()}
                className="w-full text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: '#8B1A2E' }}
              >
                {savingCat ? 'Enregistrement…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

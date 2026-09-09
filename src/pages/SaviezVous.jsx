import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Lightbulb, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import ImageUpload from '../components/ImageUpload'

const PAGE_SIZE = 20

export default function SaviezVous() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [imageUrl, setImageUrl] = useState('')

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, count } = await q(
        supabase
          .from('saviez_vous')
          .select('*', { count: 'exact' })
          .order('ordre', { ascending: true })
          .order('created_at', { ascending: false })
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      )
      setItems(data || [])
      setTotal(count || 0)
    } catch (err) {
      console.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditItem(null)
    setImageUrl('')
    reset({ titre: '', contenu: '', corps: '', source: '', ordre: 0, est_actif: true })
    setModal(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setImageUrl(item.image_url || '')
    reset({
      titre: item.titre || '',
      contenu: item.contenu,
      corps: item.corps || '',
      source: item.source || '',
      ordre: item.ordre ?? 0,
      est_actif: item.est_actif,
    })
    setModal(true)
  }

  const save = async (data) => {
    try {
      const payload = {
        titre: data.titre?.trim() || null,
        contenu: data.contenu.trim(),
        corps: data.corps?.trim() || null,
        source: data.source?.trim() || null,
        image_url: imageUrl || null,
        ordre: parseInt(data.ordre) || 0,
        est_actif: data.est_actif === true || data.est_actif === 'true',
      }
      if (editItem) {
        await q(supabase.from('saviez_vous').update(payload).eq('id', editItem.id))
      } else {
        await q(supabase.from('saviez_vous').insert(payload))
      }
      showToast('Enregistré ✓')
      setModal(false)
      setEditItem(null)
      reset()
      load()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const toggleActif = async (item) => {
    try {
      await q(supabase.from('saviez_vous').update({ est_actif: !item.est_actif }).eq('id', item.id))
      showToast(item.est_actif ? 'Désactivé' : 'Activé')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const deleteItem = async (id) => {
    if (!confirm('Supprimer cette entrée ?')) return
    try {
      await q(supabase.from('saviez_vous').delete().eq('id', id))
      showToast('Supprimé')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const cols = [
    {
      key: 'ordre',
      label: '#',
      render: v => (
        <span className="text-xs font-mono text-gray-400 w-6 inline-block">{v}</span>
      ),
    },
    {
      key: 'titre',
      label: 'Titre',
      render: v => v ? (
        <span className="text-sm font-semibold text-gray-800">{v}</span>
      ) : <span className="text-gray-300 text-xs italic">—</span>,
    },
    {
      key: 'contenu',
      label: 'Contenu',
      render: v => (
        <span className="text-sm text-gray-600 leading-snug">
          {v.length > 80 ? v.slice(0, 80) + '…' : v}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      render: v => v ? (
        <span className="text-xs text-gray-500 italic">{v}</span>
      ) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'est_actif',
      label: 'Statut',
      render: (v) => v ? (
        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Actif</span>
      ) : (
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inactif</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#FFF9C4' }}
          >
            <Lightbulb size={18} style={{ color: '#F9A825' }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Le Saviez-Vous
          </h2>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#8B1A2E' }}
        >
          <Plus size={16} /> Ajouter un fait
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Ces faits s'affichent en rotation quotidienne dans la section <strong>Aujourd'hui</strong> de l'application.
        Ordonnez-les avec le champ <em>Ordre</em>.
      </p>

      <DataTable
        columns={cols}
        data={items}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          <button
            key="t"
            onClick={() => toggleActif(row)}
            title={row.est_actif ? 'Désactiver' : 'Activer'}
            className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
          >
            {row.est_actif
              ? <ToggleRight size={14} style={{ color: '#15803d' }} />
              : <ToggleLeft size={14} />}
            {row.est_actif ? 'Actif' : 'Inactif'}
          </button>,
          <button
            key="e"
            onClick={() => openEdit(row)}
            className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
          >
            <Edit2 size={12} /> Modifier
          </button>,
          <button
            key="d"
            onClick={() => deleteItem(row.id)}
            className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100"
          >
            <Trash2 size={12} /> Supprimer
          </button>,
        ]}
      />

      <Modal
        isOpen={modal}
        onClose={() => { setModal(false); setEditItem(null) }}
        title={editItem ? 'Modifier l\'entrée' : 'Ajouter un fait'}
        size="lg"
      >
        <form onSubmit={handleSubmit(save)} className="space-y-4">

          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              {...register('titre')}
              placeholder="Ex : La cathédrale et son histoire"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
          </div>

          {/* Contenu — accroche affichée dans la carte */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Accroche <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">— texte affiché dans la carte Aujourd'hui</span>
            </label>
            <textarea
              {...register('contenu', { required: true })}
              rows={3}
              placeholder="Ex : La cathédrale Saint-André abrite l'une des plus anciennes orgues de la région…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none"
            />
          </div>

          {/* Corps — détails affichés dans l'écran complet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contenu détaillé <span className="text-gray-400 font-normal">(optionnel)</span>
              <span className="text-gray-400 font-normal ml-1">— visible en cliquant sur la carte</span>
            </label>
            <textarea
              {...register('corps')}
              rows={5}
              placeholder={"Paragraphe 1…\n\nParagraphe 2… (séparer les paragraphes par une ligne vide)"}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <ImageUpload
              bucket="saviez-vous"
              currentUrl={imageUrl || undefined}
              onUpload={url => setImageUrl(url || '')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source / Référence</label>
              <input
                {...register('source')}
                placeholder="Ex : Diocèse de Yopougon"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
              <input
                type="number"
                {...register('ordre')}
                defaultValue={0}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" {...register('est_actif')} defaultChecked className="rounded" />
            <span className="text-sm text-gray-700">Actif (visible dans l'app)</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

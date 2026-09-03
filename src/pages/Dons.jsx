import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Download, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import ImageUpload from '../components/ImageUpload'
import { fmtMontant, fmtDate } from '../lib/helpers'

const PAGE_SIZE = 20

export default function Dons() {
  const [campagnes, setCampagnes] = useState([])
  const [dons, setDons] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingD, setLoadingD] = useState(true)
  const [modalCampagne, setModalCampagne] = useState(false)
  const [editCampagne, setEditCampagne] = useState(null)
  const [modalDetail, setModalDetail] = useState(null)
  const [filtreStatut, setFiltreStatut] = useState('tout')
  const [filtreCampagne, setFiltreCampagne] = useState('tout')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [imageUrl, setImageUrl] = useState('')

  const { register, handleSubmit, reset, setValue } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const loadCampagnes = async () => {
    try {
      const { data } = await q(supabase.from('don_campagnes').select('*').order('ordre'))
      setCampagnes(data || [])
    } catch (err) { showToast(err.message, 'error') }
    setLoading(false)
  }

  const loadDons = useCallback(async () => {
    setLoadingD(true)
    let query = supabase.from('dons')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)
    if (filtreCampagne !== 'tout') query = query.eq('campagne_id', filtreCampagne)

    const { data, count, error } = await query
    if (error) {
      console.error('[Dons]', error)
      showToast('Erreur chargement dons : ' + error.message, 'error')
      setLoadingD(false); return
    }

    // Charger profils et types de campagnes en parallèle
    const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
    const campIds = [...new Set((data || []).map(r => r.campagne_id).filter(Boolean))]

    const [profsRes, campsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('profiles').select('id, nom, telephone').in('id', userIds)
        : Promise.resolve({ data: [] }),
      campIds.length > 0
        ? supabase.from('don_campagnes').select('id, type').in('id', campIds)
        : Promise.resolve({ data: [] }),
    ])

    const profsMap = {}
    ;(profsRes.data || []).forEach(p => { profsMap[p.id] = p })
    const campTypeMap = {}
    ;(campsRes.data || []).forEach(c => { campTypeMap[c.id] = c.type })

    setDons((data || []).map(r => ({
      ...r,
      profiles: profsMap[r.user_id] || null,
      _campagne_type: campTypeMap[r.campagne_id] || null,
    })))
    setTotal(count || 0)
    setLoadingD(false)
  }, [page, filtreStatut, filtreCampagne])

  useEffect(() => { loadCampagnes() }, [])
  useEffect(() => { loadDons() }, [loadDons])

  const openEdit = (c) => {
    setEditCampagne(c)
    setImageUrl(c.image_url || '')
    reset({
      titre: c.titre,
      description: c.description,
      objectif: c.objectif,
      date_fin: c.date_fin ? c.date_fin.split('T')[0] : '',
      type: c.type || 'categorie',
    })
    setModalCampagne(true)
  }

  const saveCampagne = async (data) => {
    try {
      const payload = {
        titre: data.titre,
        description: data.description || null,
        objectif: data.objectif ? parseInt(data.objectif) : 0,
        image_url: imageUrl || null,
        type: data.type || 'categorie',
      }
      if (editCampagne) {
        await q(supabase.from('don_campagnes').update(payload).eq('id', editCampagne.id))
      } else {
        await q(supabase.from('don_campagnes').insert({ ...payload, est_actif: true, montant_collecte: 0 }))
      }
      showToast('Campagne enregistrée ✓')
      setModalCampagne(false); setEditCampagne(null); setImageUrl(''); reset()
      loadCampagnes()
    } catch (err) { showToast('Erreur : ' + err.message, 'error') }
  }

  const toggleActif = async (c) => {
    if (c.type === 'app') return
    try {
      await q(supabase.from('don_campagnes').update({ est_actif: !c.est_actif }).eq('id', c.id))
      showToast(c.est_actif ? 'Campagne désactivée' : 'Campagne activée')
      loadCampagnes()
    } catch (err) { showToast(err.message, 'error') }
  }

  const deleteCampagne = async (id) => {
    if (!confirm('Supprimer cette campagne ?')) return
    try {
      await q(supabase.from('don_campagnes').delete().eq('id', id))
      showToast('Campagne supprimée'); loadCampagnes()
    } catch (err) { showToast(err.message, 'error') }
  }

  const exportCSV = () => {
    const rows = [['Donateur', 'Campagne', 'Montant', 'Opérateur', 'Statut', 'Date']]
    dons.forEach(d => rows.push([
      d.profiles?.nom || d.user_id || '', d.don_campagnes?.titre || 'Don libre',
      d.montant || '', d.operateur_paiement || '', d.statut || '', d.created_at || ''
    ]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'dons.csv'
    a.click()
  }

  const STATUT_LABELS = { en_attente: 'En attente', valide: 'Validé', validee: 'Validé', annulee: 'Annulé', tout: 'Tous' }

  const isAppDon = (row) => row._campagne_type === 'app'

  // Normal : St André = montant - frais_op - frais_admin ; Web Ivoire = frais_admin (1%) ; Opér. = frais_op (1%)
  // App    : St André = 0 ; Web Ivoire = montant - frais_op ; Opér. = frais_op (1%)
  const calcRevenuStAndre = (row) => {
    if (isAppDon(row)) return 0
    const fraisOper = row.frais_mobile_money || 0
    const fraisAdmin = row.frais_plateforme || 0
    return Math.max(0, (row.montant || 0) - fraisOper - fraisAdmin)
  }

  const calcRevenuWebIvoire = (row) => {
    const fraisOper = row.frais_mobile_money || 0
    if (isAppDon(row)) return Math.max(0, (row.montant || 0) - fraisOper)
    return row.frais_plateforme || 0
  }

  const colsDons = [
    {
      key: 'profiles', label: 'Utilisateur',
      render: (v) => (
        <div className="leading-tight">
          <div className="font-medium text-gray-800 text-sm">{v?.nom || <span className="text-gray-400 italic text-xs">Anonyme</span>}</div>
          {v?.telephone && <div className="text-xs text-gray-400">{v.telephone}</div>}
        </div>
      )
    },
    {
      key: 'transaction_id', label: 'N° Transaction',
      render: v => v ? <span className="text-xs font-mono text-gray-600">{v}</span> : <span className="text-gray-300">—</span>
    },
    { key: 'operateur_paiement', label: 'Opérateur', render: v => v || '—' },
    { key: 'montant', label: 'Montant', render: v => <span className="font-semibold text-gray-800">{fmtMontant(v)}</span> },
    {
      key: '_revenu_st_andre', label: 'Revenu St André',
      render: (_, row) => {
        const v = calcRevenuStAndre(row)
        return <span className={`font-semibold ${v > 0 ? 'text-green-700' : 'text-gray-300'}`}>{fmtMontant(v)}</span>
      }
    },
    {
      key: '_revenu_web_ivoire', label: 'Revenu Web Ivoire',
      render: (_, row) => {
        const v = calcRevenuWebIvoire(row)
        return <span className={`font-semibold ${v > 0 ? 'text-indigo-700' : 'text-gray-300'}`}>{fmtMontant(v)}</span>
      }
    },
    {
      key: 'frais_mobile_money', label: 'Frais opér.',
      render: v => <span className="text-xs text-gray-500">{fmtMontant(v || 0)}</span>
    },
    { key: 'statut', label: 'Statut', render: v => <Badge label={STATUT_LABELS[v] || v} value={v} /> },
    { key: 'created_at', label: 'Date', render: v => fmtDate(v) },
  ]

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* CAMPAGNES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Campagnes de dons
          </h2>
          <button
            onClick={() => { setEditCampagne(null); setImageUrl(''); reset(); setModalCampagne(true) }}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            <Plus size={16} /> Nouvelle campagne
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : campagnes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            Aucune campagne. Créez-en une !
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campagnes.map(c => {
              const pct = c.objectif > 0 ? Math.min(100, Math.round(((c.montant_collecte || 0) / c.objectif) * 100)) : 0
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {c.image_url && (
                    <img src={c.image_url} alt={c.titre} className="w-full h-36 object-cover" />
                  )}
                  <div className="p-4">
                    {c.type === 'app' && (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 mb-3">
                        <span>💻</span>
                        <span className="font-medium">Bénéficiaire : Web Ivoire Média</span>
                        <span className="text-indigo-400 ml-1">— 0% frais admin · frais opérateur uniquement</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm">{c.titre}</h3>
                      {c.type === 'app'
                        ? <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 select-none" title="Campagne permanente — ne peut pas être désactivée">🔒 Permanent</span>
                        : <button
                            onClick={() => toggleActif(c)}
                            className="w-8 h-4 rounded-full transition-colors relative shrink-0 ml-2"
                            style={{ backgroundColor: c.est_actif ? '#16a34a' : '#d1d5db' }}
                          >
                            <div
                              className="w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all"
                              style={{ left: c.est_actif ? '16px' : '2px' }}
                            />
                          </button>
                      }
                    </div>
                    {c.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{c.description}</p>
                    )}
                    {c.objectif > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{fmtMontant(c.montant_collecte || 0)}</span>
                          <span>{fmtMontant(c.objectif)} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: '#D4A017' }}
                          />
                        </div>
                      </div>
                    )}
                    {c.date_fin && (
                      <p className="text-xs text-gray-400 mb-3">Fin : {fmtDate(c.date_fin)}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(c)}
                        className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:underline"
                      >
                        <Edit2 size={12} /> Modifier
                      </button>
                      <button
                        onClick={() => deleteCampagne(c.id)}
                        className="flex items-center gap-1 text-red-600 text-xs font-medium hover:underline"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* TRANSACTIONS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Transactions
          </h2>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <Download size={16} /> Exporter CSV
          </button>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            value={filtreStatut}
            onChange={e => { setFiltreStatut(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={filtreCampagne}
            onChange={e => { setFiltreCampagne(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="tout">Toutes les campagnes</option>
            {campagnes.map(c => <option key={c.id} value={c.id}>{c.titre}</option>)}
          </select>
        </div>

        <DataTable
          columns={colsDons}
          data={dons}
          loading={loadingD}
          pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
          onPageChange={setPage}
          actions={row => [
            <button key="d" onClick={() => setModalDetail(row)} className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50">
              <Eye size={12} /> Détails
            </button>
          ]}
        />
      </div>

      {/* Modal campagne */}
      <Modal
        isOpen={modalCampagne}
        onClose={() => { setModalCampagne(false); setEditCampagne(null) }}
        title={editCampagne ? 'Modifier la campagne' : 'Nouvelle campagne'}
        size="md"
      >
        <form onSubmit={handleSubmit(saveCampagne)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input {...register('titre', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select {...register('type', { required: true })} defaultValue="categorie" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white">
              <option value="categorie">Catégorie (don général)</option>
              <option value="construction">Construction</option>
              <option value="libre">Don libre</option>
              <option value="seminaire">Séminaire</option>
              <option value="secours">Secours</option>
              <option value="app">Soutien application (permanent)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objectif (FCFA)</label>
              <input type="number" {...register('objectif')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
              <input type="date" {...register('date_fin')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
            <ImageUpload
              bucket="campagnes"
              currentUrl={imageUrl}
              onUpload={(url) => setImageUrl(url || '')}
            />
            {imageUrl && (
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="Ou collez une URL d'image"
                className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              />
            )}
            {!imageUrl && (
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="Ou collez une URL d'image"
                className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              />
            )}
          </div>
          <button type="submit" className="w-full text-white py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#8B1A2E' }}>
            Enregistrer
          </button>
        </form>
      </Modal>

      {/* Modal détail don */}
      <Modal isOpen={!!modalDetail} onClose={() => setModalDetail(null)} title="Détails du don" size="sm">
        {modalDetail && (() => {
          const estAppDon = isAppDon(modalDetail)
          return (
            <div className="space-y-3 text-sm">
              {/* Bandeau bénéficiaire */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${estAppDon ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <span>{estAppDon ? '💻' : '⛪'}</span>
                <span>Bénéficiaire : {estAppDon ? 'Web Ivoire Média' : 'Cathédrale Saint André'}</span>
              </div>

              {[
                ['Donateur', modalDetail.profiles?.nom || modalDetail.profiles?.telephone],
                ['Téléphone', modalDetail.profiles?.telephone],
                ['Campagne', modalDetail.campagne_titre || 'Don libre'],
                ['Montant brut', fmtMontant(modalDetail.montant)],
                ['Frais opérateur', fmtMontant(modalDetail.frais_mobile_money || 0)],
                ['Frais admin', estAppDon ? '0 FCFA' : fmtMontant(modalDetail.frais_plateforme || 0)],
              ].map(([label, val]) => val != null ? (
                <div key={label} className="flex gap-4">
                  <span className="text-gray-500 w-36 shrink-0">{label}</span>
                  <span className="text-gray-900 font-medium">{val}</span>
                </div>
              ) : null)}

              {/* Répartition nette */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex gap-4">
                  <span className="text-gray-500 w-36 shrink-0">→ Revenu St André</span>
                  <span className={`font-semibold ${estAppDon ? 'text-gray-300' : 'text-green-700'}`}>
                    {fmtMontant(calcRevenuStAndre(modalDetail))}
                  </span>
                </div>
                <div className="flex gap-4">
                  <span className="text-gray-500 w-36 shrink-0">→ Revenu Web Ivoire</span>
                  <span className={`font-semibold ${estAppDon ? 'text-indigo-700' : 'text-gray-300'}`}>
                    {fmtMontant(calcRevenuWebIvoire(modalDetail))}
                  </span>
                </div>
              </div>

              {[
                ['Opérateur', modalDetail.operateur_paiement],
                ['N° transaction', modalDetail.transaction_id],
                ['Statut', modalDetail.statut],
                ['Date', fmtDate(modalDetail.created_at)],
              ].map(([label, val]) => val ? (
                <div key={label} className="flex gap-4">
                  <span className="text-gray-500 w-36 shrink-0">{label}</span>
                  <span className="text-gray-900 font-medium">{val}</span>
                </div>
              ) : null)}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

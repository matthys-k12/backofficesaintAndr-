import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, X, Eye, Download, Edit2, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import { fmtMontant, fmtDate } from '../lib/helpers'

const PAGE_SIZE = 20
const CATEGORIES = ['initiation', 'mariage', 'enterrement']
const STATUT_LABELS = { en_attente: 'En attente', validee: 'Validée', annulee: 'Annulée', tout: 'Tous' }

function getPeriodRange(periode) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  if (periode === 'semaine') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); mon.setHours(0,0,0,0)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { start: mon.toISOString().slice(0,10), end: sun.toISOString().slice(0,10) }
  }
  if (periode === 'mois') return { start: `${y}-${String(m+1).padStart(2,'0')}-01`, end: `${y}-${String(m+1).padStart(2,'0')}-31` }
  if (periode === 'mois_dernier') {
    const pm = m === 0 ? 12 : m, py = m === 0 ? y - 1 : y
    return { start: `${py}-${String(pm).padStart(2,'0')}-01`, end: `${py}-${String(pm).padStart(2,'0')}-31` }
  }
  if (periode === 'trimestre') return { start: `${y}-${String(Math.floor(m/3)*3+1).padStart(2,'0')}-01`, end: `${y}-12-31` }
  return null
}

export default function Casuels() {
  const [tarifs, setTarifs] = useState([])
  const [demandes, setDemandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingD, setLoadingD] = useState(true)
  const [modalTarif, setModalTarif] = useState(false)
  const [editTarif, setEditTarif] = useState(null)
  const [modalDetail, setModalDetail] = useState(null)
  const [filtreStatut, setFiltreStatut] = useState('tout')
  const [filtreCategorie, setFiltreCategorie] = useState('tout')
  const [filtrePeriode, setFiltrePeriode] = useState('tout')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [editingMontant, setEditingMontant] = useState(null)
  const [newMontant, setNewMontant] = useState('')
  const [queryError, setQueryError] = useState(null)

  const { register, handleSubmit, reset } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const loadTarifs = async () => {
    const { data } = await supabase.from('casuel_tarifs').select('*').order('categorie').order('montant')
    setTarifs(data || [])
    setLoading(false)
  }

  const loadDemandes = useCallback(async () => {
    setLoadingD(true)
    setQueryError(null)
    let query = supabase.from('casuel_demandes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)
    if (filtreCategorie !== 'tout') query = query.eq('categorie', filtreCategorie)
    const range = getPeriodRange(filtrePeriode)
    if (range) query = query.gte('created_at', range.start).lte('created_at', range.end)
    const { data, count, error } = await query
    if (error) {
      console.error('[Casuels]', error)
      setQueryError(error.message)
      setLoadingD(false); return
    }

    const ids = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
    let profsMap = {}
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, nom, telephone').in('id', ids)
      ;(profs || []).forEach(p => { profsMap[p.id] = p })
    }
    setDemandes((data || []).map(r => ({ ...r, profiles: profsMap[r.user_id] || null })))
    setTotal(count || 0)
    setLoadingD(false)
  }, [page, filtreStatut, filtreCategorie, filtrePeriode])

  useEffect(() => { loadTarifs() }, [])
  useEffect(() => { loadDemandes() }, [loadDemandes])

  const saveTarif = async (data) => {
    try {
      const payload = {
        ...data,
        montant: parseInt(data.montant),
        est_actif: data.est_actif === 'true' || data.est_actif === true
      }
      if (editTarif) {
        await q(supabase.from('casuel_tarifs').update(payload).eq('id', editTarif.id))
      } else {
        await q(supabase.from('casuel_tarifs').insert(payload))
      }
      showToast('Tarif enregistré')
      setModalTarif(false)
      reset()
      setEditTarif(null)
      loadTarifs()
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error')
    }
  }

  const saveMontant = async (id) => {
    const v = parseInt(newMontant)
    if (isNaN(v)) return
    await q(supabase.from('casuel_tarifs').update({ montant: v }).eq('id', id))
    showToast('Montant mis à jour')
    setEditingMontant(null)
    loadTarifs()
  }

  const valider = async (id) => {
    if (!confirm('Confirmer la validation de cette demande ?')) return
    await q(supabase.from('casuel_demandes').update({ statut: 'validee' }).eq('id', id))
    showToast('Demande validée')
    loadDemandes()
  }

  const annuler = async (id) => {
    if (!confirm('Annuler cette demande ?')) return
    await q(supabase.from('casuel_demandes').update({ statut: 'annulee' }).eq('id', id))
    showToast('Demande annulée')
    loadDemandes()
  }

  const supprimer = async (id) => {
    if (!confirm('Supprimer définitivement cette demande ?')) return
    await q(supabase.from('casuel_demandes').delete().eq('id', id))
    showToast('Demande supprimée')
    loadDemandes()
  }

  const exportCSV = async () => {
    let query = supabase.from('casuel_demandes')
      .select('*')
      .order('created_at', { ascending: false })
    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)
    if (filtreCategorie !== 'tout') query = query.eq('categorie', filtreCategorie)
    const range = getPeriodRange(filtrePeriode)
    if (range) query = query.gte('created_at', range.start).lte('created_at', range.end)
    const { data } = await query

    const allIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
    let profsMap = {}
    if (allIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, nom, telephone').in('id', allIds)
      ;(profs || []).forEach(p => { profsMap[p.id] = p })
    }

    const header = ['Demandeur', 'Téléphone', 'Catégorie', 'Sous-type', 'Bénéficiaire', 'Montant', 'Opérateur', 'Statut', 'Date']
    const body = (data || []).map(d => [
      profsMap[d.user_id]?.nom || '', profsMap[d.user_id]?.telephone || '',
      d.categorie || '', d.sous_type || '',
      `"${(d.nom_beneficiaire || '').replace(/"/g, '""')}"`,
      d.montant || '', d.operateur_paiement || '',
      d.statut || '', d.created_at?.slice(0, 10) || ''
    ])
    const csv = '﻿' + [header, ...body].map(r => r.join(',')).join('\n')
    const parts = [filtreCategorie !== 'tout' ? filtreCategorie : '', filtrePeriode !== 'tout' ? filtrePeriode : ''].filter(Boolean)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `casuels${parts.length ? '_' + parts.join('_') : ''}.csv`
    a.click()
  }

  const tarifsByCategorie = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = tarifs.filter(t => t.categorie === cat)
    return acc
  }, {})

  const colsDemandes = [
    { key: 'profiles', label: 'Demandeur', render: v => v?.nom || '—' },
    { key: 'categorie', label: 'Catégorie', render: v => <span className="capitalize">{v}</span> },
    { key: 'sous_type', label: 'Sous-type', render: v => v?.replace(/_/g, ' ') || '—' },
    { key: 'nom_beneficiaire', label: 'Bénéficiaire', render: v => v || '—' },
    { key: 'montant', label: 'Montant', render: v => fmtMontant(v) },
    { key: 'operateur_paiement', label: 'Opérateur' },
    { key: 'statut', label: 'Statut', render: v => <Badge label={STATUT_LABELS[v] || v} value={v} /> },
    { key: 'created_at', label: 'Date', render: v => fmtDate(v) },
  ]

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {queryError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <strong>Erreur de chargement :</strong> {queryError}
          <p className="mt-1 text-xs text-red-500">
            Vérifiez que la table <code>casuel_demandes</code> existe et que les politiques RLS permettent la lecture.
          </p>
        </div>
      )}

      {/* TARIFS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Tarifs des casuels
          </h2>
          <button
            onClick={() => { setEditTarif(null); reset(); setModalTarif(true) }}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            <Plus size={16} /> Ajouter un tarif
          </button>
        </div>

        {loading ? (
          <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ) : (
          <div className="space-y-4">
            {CATEGORIES.map(cat => (
              <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-700 capitalize">{cat}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      {['Sous-type', 'Label', 'Montant (FCFA)', 'Actif', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(tarifsByCategorie[cat] || []).map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-600">{t.sous_type}</td>
                        <td className="px-4 py-2 text-sm text-gray-800 font-medium">{t.label}</td>
                        <td className="px-4 py-2 text-sm">
                          {editingMontant === t.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={newMontant}
                                onChange={e => setNewMontant(e.target.value)}
                                className="w-24 px-2 py-1 rounded border border-gray-200 text-sm"
                              />
                              <button onClick={() => saveMontant(t.id)} className="text-green-600 text-xs font-medium">✓</button>
                              <button onClick={() => setEditingMontant(null)} className="text-gray-400 text-xs">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{fmtMontant(t.montant)}</span>
                              <button onClick={() => { setEditingMontant(t.id); setNewMontant(t.montant) }}>
                                <Edit2 size={12} className="text-gray-400 hover:text-red-800" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-medium ${t.est_actif ? 'text-green-600' : 'text-gray-400'}`}>
                            {t.est_actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => { setEditTarif(t); reset({ ...t, montant: t.montant?.toString() }); setModalTarif(true) }}
                            className="text-blue-600 text-sm font-medium hover:underline"
                          >
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(tarifsByCategorie[cat] || []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-sm">
                          Aucun tarif dans cette catégorie
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DEMANDES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Demandes reçues
          </h2>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <Download size={16} /> Exporter CSV
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-3 items-center">
          <select
            value={filtreCategorie}
            onChange={e => { setFiltreCategorie(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="tout">Tous les casuels</option>
            <option value="initiation">Initiation</option>
            <option value="mariage">Mariage</option>
            <option value="enterrement">Enterrement</option>
          </select>
          <select
            value={filtrePeriode}
            onChange={e => { setFiltrePeriode(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="tout">Toute période</option>
            <option value="semaine">Cette semaine</option>
            <option value="mois">Ce mois</option>
            <option value="mois_dernier">Mois dernier</option>
            <option value="trimestre">Ce trimestre</option>
          </select>
          <select
            value={filtreStatut}
            onChange={e => { setFiltreStatut(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {(filtreCategorie !== 'tout' || filtrePeriode !== 'tout' || filtreStatut !== 'tout') && (
            <button
              onClick={() => { setFiltreCategorie('tout'); setFiltrePeriode('tout'); setFiltreStatut('tout'); setPage(1) }}
              className="text-xs text-gray-500 hover:text-red-700 underline"
            >
              Réinitialiser
            </button>
          )}
          {total > 0 && (
            <span className="ml-auto text-xs text-gray-500 font-medium">
              {total} demande{total > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <DataTable
          columns={colsDemandes}
          data={demandes}
          loading={loadingD}
          pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
          onPageChange={setPage}
          actions={row => [
            row.statut === 'en_attente' && (
              <button key="v" onClick={() => valider(row.id)} className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700">
                <Check size={12} /> Valider
              </button>
            ),
            row.statut === 'en_attente' && (
              <button key="a" onClick={() => annuler(row.id)} className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">
                <X size={12} /> Annuler
              </button>
            ),
            <button key="d" onClick={() => setModalDetail(row)} className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50">
              <Eye size={12} /> Détails
            </button>,
            <button key="del" onClick={() => supprimer(row.id)} className="flex items-center gap-1 border border-red-200 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-50">
              <Trash2 size={12} /> Supprimer
            </button>,
          ].filter(Boolean)}
        />
      </div>

      <Modal
        isOpen={modalTarif}
        onClose={() => { setModalTarif(false); setEditTarif(null) }}
        title={editTarif ? 'Modifier le tarif' : 'Ajouter un tarif'}
        size="sm"
      >
        <form onSubmit={handleSubmit(saveTarif)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
            <select {...register('categorie', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sous-type (snake_case) *</label>
            <input {...register('sous_type', { required: true })} placeholder="ex: bapteme_bebe" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label affiché *</label>
            <input {...register('label', { required: true })} placeholder="ex: Baptême bébé" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) *</label>
            <input type="number" {...register('montant', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...register('est_actif')} defaultChecked id="actif" />
            <label htmlFor="actif" className="text-sm text-gray-700">Actif</label>
          </div>
          <button type="submit" className="w-full text-white py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#8B1A2E' }}>
            Enregistrer
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!modalDetail} onClose={() => setModalDetail(null)} title="Détails de la demande" size="md">
        {modalDetail && (
          <div className="space-y-3 text-sm">
            {[
              ['Demandeur', modalDetail.profiles?.nom],
              ['Téléphone', modalDetail.profiles?.telephone],
              ['Type demandeur', modalDetail.type_demandeur],
              ['Bénéficiaire', modalDetail.nom_beneficiaire],
              ['Catégorie', modalDetail.categorie],
              ['Sous-type', modalDetail.sous_type],
              ['Label', modalDetail.label],
              ['Montant', fmtMontant(modalDetail.montant)],
              ['Opérateur', modalDetail.operateur_paiement],
              ['Statut', modalDetail.statut],
              ['Date', fmtDate(modalDetail.created_at)],
            ].map(([label, val]) => val ? (
              <div key={label} className="flex gap-4">
                <span className="text-gray-500 w-36 shrink-0">{label}</span>
                <span className="text-gray-900 font-medium">{val}</span>
              </div>
            ) : null)}
          </div>
        )}
      </Modal>
    </div>
  )
}

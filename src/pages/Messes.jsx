import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, X, Eye, Download } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import { fmtMontant, fmtDate, fmtDateTime } from '../lib/helpers'

const PAGE_SIZE = 20
const STATUT_LABELS = { en_attente: 'En attente', validee: 'Validée', annulee: 'Annulée', tout: 'Tous les statuts' }
const TYPE_LABELS = { tout: 'Tous les types', action_de_grace: 'Action de grâce', assistance_protection: 'Assistance et protection', repos_ame: 'Repos de l\'âme' }
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const DOW = { 0: 'Dimanche', 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' }

function getJour(dateStr) {
  if (!dateStr) return null
  return DOW[new Date(dateStr + 'T12:00:00').getDay()] || null
}

function getPeriodRange(periode) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0,0,0,0)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  if (periode === 'semaine') return { start: monday.toISOString().slice(0,10), end: sunday.toISOString().slice(0,10) }
  if (periode === 'mois')    return { start: `${y}-${String(m+1).padStart(2,'0')}-01`, end: `${y}-${String(m+1).padStart(2,'0')}-31` }
  if (periode === 'mois_dernier') {
    const pm = m === 0 ? 12 : m; const py = m === 0 ? y - 1 : y
    return { start: `${py}-${String(pm).padStart(2,'0')}-01`, end: `${py}-${String(pm).padStart(2,'0')}-31` }
  }
  if (periode === 'trimestre') return { start: `${y}-${String(Math.floor(m/3)*3+1).padStart(2,'0')}-01`, end: `${y}-12-31` }
  return null
}

export default function Messes() {
  const [horaires, setHoraires] = useState([])
  const [demandes, setDemandes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingD, setLoadingD] = useState(true)
  const [modalHoraire, setModalHoraire] = useState(false)
  const [modalDetail, setModalDetail] = useState(null)
  const [editHoraire, setEditHoraire] = useState(null)
  const [filtreStatut, setFiltreStatut] = useState('tout')
  const [filtreType, setFiltreType] = useState('tout')
  const [filtreJour, setFiltreJour] = useState('tout')
  const [filtrePeriode, setFiltrePeriode] = useState('tout')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)

  const { register, handleSubmit, reset } = useForm()

  const loadHoraires = async () => {
    const { data } = await supabase.from('messe_horaires').select('*').order('jour').order('heure')
    setHoraires(data || [])
    setLoading(false)
  }

  const loadDemandes = useCallback(async () => {
    setLoadingD(true)
    const useJourFilter = filtreJour !== 'tout'

    let query = supabase.from('messe_demandes')
      .select('*, profiles(nom, telephone)', { count: 'exact' })
      .order('date_messe', { ascending: false })

    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)
    if (filtreType !== 'tout') query = query.eq('type_messe', filtreType)

    const range = getPeriodRange(filtrePeriode)
    if (range) {
      query = query.gte('date_messe', range.start).lte('date_messe', range.end)
    } else {
      if (filtreDateDebut) query = query.gte('date_messe', filtreDateDebut)
      if (filtreDateFin) query = query.lte('date_messe', filtreDateFin)
    }

    if (!useJourFilter) {
      query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    }

    const { data, count } = await query
    if (useJourFilter) {
      const filtered = (data || []).filter(r => getJour(r.date_messe) === filtreJour)
      setDemandes(filtered)
      setTotal(filtered.length)
    } else {
      setDemandes(data || [])
      setTotal(count || 0)
    }
    setLoadingD(false)
  }, [page, filtreStatut, filtreType, filtreJour, filtrePeriode, filtreDateDebut, filtreDateFin])

  useEffect(() => { loadHoraires() }, [])
  useEffect(() => { loadDemandes() }, [loadDemandes])

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const saveHoraire = async (data) => {
    try {
      if (editHoraire) {
        await q(supabase.from('messe_horaires').update(data).eq('id', editHoraire.id))
      } else {
        await q(supabase.from('messe_horaires').insert({ ...data, est_actif: true }))
      }
      showToast('Horaire enregistré')
      setModalHoraire(false)
      reset()
      setEditHoraire(null)
      loadHoraires()
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error')
    }
  }

  const toggleActif = async (h) => {
    await q(supabase.from('messe_horaires').update({ est_actif: !h.est_actif }).eq('id', h.id))
    loadHoraires()
  }

  const deleteHoraire = async (id) => {
    if (!confirm('Supprimer cet horaire ?')) return
    await q(supabase.from('messe_horaires').delete().eq('id', id))
    showToast('Horaire supprimé')
    loadHoraires()
  }

  const valider = async (id) => {
    await q(supabase.from('messe_demandes').update({ statut: 'validee' }).eq('id', id))
    showToast('Demande validée')
    loadDemandes()
  }

  const annuler = async (id) => {
    if (!confirm('Annuler cette demande ?')) return
    await q(supabase.from('messe_demandes').update({ statut: 'annulee' }).eq('id', id))
    showToast('Demande annulée')
    loadDemandes()
  }

  const exportCSV = async () => {
    let query = supabase.from('messe_demandes')
      .select('*, profiles(nom, telephone)')
      .order('date_messe', { ascending: false })
    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)
    if (filtreType !== 'tout') query = query.eq('type_messe', filtreType)
    const range = getPeriodRange(filtrePeriode)
    if (range) {
      query = query.gte('date_messe', range.start).lte('date_messe', range.end)
    } else {
      if (filtreDateDebut) query = query.gte('date_messe', filtreDateDebut)
      if (filtreDateFin) query = query.lte('date_messe', filtreDateFin)
    }
    const { data } = await query
    let rows = data || []
    if (filtreJour !== 'tout') rows = rows.filter(r => getJour(r.date_messe) === filtreJour)

    const header = ['Nom', 'Téléphone', 'Type', 'Date messe', 'Jour', 'Intention', 'Montant', 'Statut', 'Date demande']
    const body = rows.map(d => [
      d.profiles?.nom || '', d.profiles?.telephone || '',
      d.type_messe || '', d.date_messe || '', getJour(d.date_messe) || '',
      `"${(d.intention || '').replace(/"/g, '""')}"`,
      d.montant || '', d.statut || '', d.created_at?.slice(0, 10) || ''
    ])
    const csv = '﻿' + [header, ...body].map(r => r.join(',')).join('\n')
    const suffix = filtrePeriode !== 'tout' ? `_${filtrePeriode}` : ''
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    a.download = `messes${suffix}.csv`
    a.click()
  }

  const exportWord = async () => {
    let query = supabase.from('messe_demandes')
      .select('*, profiles(nom, telephone)')
      .order('date_messe', { ascending: false })
    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)
    if (filtreType !== 'tout') query = query.eq('type_messe', filtreType)
    const range = getPeriodRange(filtrePeriode)
    if (range) {
      query = query.gte('date_messe', range.start).lte('date_messe', range.end)
    } else {
      if (filtreDateDebut) query = query.gte('date_messe', filtreDateDebut)
      if (filtreDateFin) query = query.lte('date_messe', filtreDateFin)
    }
    const { data } = await query
    let rows = data || []
    if (filtreJour !== 'tout') rows = rows.filter(r => getJour(r.date_messe) === filtreJour)

    const lignes = rows.map(d => `
      <tr>
        <td>${fmtDate(d.date_messe)}</td>
        <td>${d.profiles?.nom || '—'}</td>
        <td>${d.profiles?.telephone || '—'}</td>
        <td>${TYPE_LABELS[d.type_messe] || d.type_messe || '—'}</td>
        <td>${d.intention || '—'}</td>
        <td>${fmtMontant(d.montant)}</td>
        <td>${STATUT_LABELS[d.statut] || d.statut || '—'}</td>
      </tr>`).join('')

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Demandes de messes</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; }
  h1 { color: #8B1A2E; font-size: 16pt; margin-bottom: 4pt; }
  p { color: #555; font-size: 9pt; margin-bottom: 12pt; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #8B1A2E; color: white; padding: 6pt 8pt; text-align: left; font-size: 9pt; }
  td { padding: 5pt 8pt; font-size: 9pt; border-bottom: 1px solid #ddd; }
  tr:nth-child(even) td { background: #FAF8F5; }
</style></head>
<body>
  <h1>Demandes de messes — Cathédrale Saint André</h1>
  <p>Exporté le ${new Date().toLocaleDateString('fr-FR')} · ${rows.length} demande(s)</p>
  <table>
    <thead><tr><th>Date messe</th><th>Paroissien</th><th>Téléphone</th><th>Type</th><th>Intention</th><th>Montant</th><th>Statut</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table>
</body></html>`

    const blob = new Blob(['﻿' + html], { type: 'application/msword' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `demandes_messes_${new Date().toISOString().slice(0,10)}.doc`
    a.click()
  }

  const colsDemandes = [
    { key: 'profiles', label: 'Paroissien', render: (v) => v?.nom || '—' },
    {
      key: 'nom_tiers',
      label: 'Pour',
      render: (v, row) => {
        if (row.type_demandeur === 'pour_tiers') {
          return v
            ? <span className="font-semibold text-gray-800">{v}</span>
            : <span className="text-gray-400 italic text-xs">Tiers non précisé</span>
        }
        if (row.type_demandeur === 'anonymat') {
          return <span className="text-gray-400 italic text-xs">Anonyme</span>
        }
        return <span className="text-gray-500 text-xs">Soi-même</span>
      }
    },
    { key: 'type_messe', label: 'Type', render: v => TYPE_LABELS[v] || v?.replace(/_/g, ' ') || '—' },
    { key: 'date_messe', label: 'Date', render: v => fmtDate(v) },
    { key: 'intention', label: 'Intention', render: v => v ? (v.length > 40 ? v.slice(0, 40) + '…' : v) : '—' },
    { key: 'montant', label: 'Montant', render: v => fmtMontant(v) },
    { key: 'statut', label: 'Statut', render: v => <Badge label={STATUT_LABELS[v] || v} value={v} /> },
    { key: 'created_at', label: 'Demandé le', render: v => fmtDate(v) },
  ]

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* HORAIRES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Horaires de messe
          </h2>
          <button
            onClick={() => { setEditHoraire(null); reset(); setModalHoraire(true) }}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            <Plus size={16} /> Ajouter un horaire
          </button>
        </div>

        {loading ? (
          <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Jour', 'Heure', 'Délai (min)', 'Actif', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {horaires.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun horaire configuré</td>
                  </tr>
                ) : horaires.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{h.jour}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{h.heure?.substring(0, 5)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{h.delai_minutes ?? 120} min</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActif(h)}
                        className="w-10 h-5 rounded-full transition-colors relative"
                        style={{ backgroundColor: h.est_actif ? '#16a34a' : '#d1d5db' }}
                      >
                        <div
                          className="w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all"
                          style={{ left: h.est_actif ? '20px' : '2px' }}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setEditHoraire(h); reset(h); setModalHoraire(true) }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => deleteHoraire(h.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEMANDES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Demandes reçues
          </h2>
          <div className="flex gap-2">
          <button
            onClick={exportWord}
            className="flex items-center gap-2 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm hover:bg-blue-50"
          >
            <Download size={16} /> Word
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <Download size={16} /> CSV
          </button>
          </div>
        </div>

        {/* Compteur total */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-700">
            {loadingD ? '…' : total} demande{total !== 1 ? 's' : ''}
          </span>
          {(filtreJour !== 'tout' || filtrePeriode !== 'tout' || filtreStatut !== 'tout' || filtreType !== 'tout' || filtreDateDebut || filtreDateFin) && (
            <button
              onClick={() => { setFiltreJour('tout'); setFiltrePeriode('tout'); setFiltreStatut('tout'); setFiltreType('tout'); setFiltreDateDebut(''); setFiltreDateFin(''); setPage(1) }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="space-y-3 mb-4">
          {/* Ligne 1 : période + statut + type + recherche */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={filtrePeriode}
              onChange={e => { setFiltrePeriode(e.target.value); setFiltreDateDebut(''); setFiltreDateFin(''); setPage(1) }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            >
              <option value="tout">Toute la période</option>
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
            <select
              value={filtreType}
              onChange={e => { setFiltreType(e.target.value); setPage(1) }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Rechercher un paroissien…"
              className="flex-1 min-w-[180px] max-w-xs px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
          </div>
          {/* Ligne 2 : dates début/fin personnalisées */}
          {filtrePeriode === 'tout' && (
            <div className="flex gap-3 items-center flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400" style={{ fontSize: 10 }}>Dates :</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Du</label>
                <input type="date" value={filtreDateDebut} onChange={e => { setFiltreDateDebut(e.target.value); setPage(1) }}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Au</label>
                <input type="date" value={filtreDateFin} onChange={e => { setFiltreDateFin(e.target.value); setPage(1) }}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none" />
              </div>
            </div>
          )}
          {/* Ligne 3 : filtre par jour (pills) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 mr-1" style={{ fontSize: 10 }}>Jour :</span>
            {['tout', ...JOURS].map(j => (
              <button
                key={j}
                onClick={() => { setFiltreJour(j); setPage(1) }}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={filtreJour === j
                  ? { backgroundColor: '#1A237E', color: 'white', boxShadow: '0 2px 8px rgba(26,35,126,0.25)' }
                  : { backgroundColor: '#f3f4f6', color: '#6b7280' }
                }
              >
                {j === 'tout' ? 'Tous' : j}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={colsDemandes}
          data={demandes}
          loading={loadingD}
          pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
          onPageChange={setPage}
          actions={row => [
            row.statut === 'en_attente' && (
              <button
                key="v"
                onClick={() => valider(row.id)}
                className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
              >
                <Check size={12} /> Valider
              </button>
            ),
            row.statut === 'en_attente' && (
              <button
                key="a"
                onClick={() => annuler(row.id)}
                className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
              >
                <X size={12} /> Annuler
              </button>
            ),
            <button
              key="d"
              onClick={() => setModalDetail(row)}
              className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
            >
              <Eye size={12} /> Détails
            </button>
          ].filter(Boolean)}
        />
      </div>

      {/* Modal horaire */}
      <Modal
        isOpen={modalHoraire}
        onClose={() => { setModalHoraire(false); setEditHoraire(null) }}
        title={editHoraire ? "Modifier l'horaire" : 'Ajouter un horaire'}
        size="sm"
      >
        <form onSubmit={handleSubmit(saveHoraire)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jour *</label>
            <select
              {...register('jour', { required: true })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            >
              {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heure *</label>
            <input
              type="time"
              {...register('heure', { required: true })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Délai de fermeture (minutes avant la messe)</label>
            <input
              type="number"
              min="0"
              {...register('delai_minutes')}
              defaultValue={120}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              placeholder="120"
            />
            <p className="text-xs text-gray-400 mt-1">Ex : 120 = fermeture 2h avant. Les paroissiens ne pourront plus réserver après ce délai.</p>
          </div>
          <button
            type="submit"
            className="w-full text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            Enregistrer
          </button>
        </form>
      </Modal>

      {/* Modal détail */}
      <Modal isOpen={!!modalDetail} onClose={() => setModalDetail(null)} title="Détails de la demande" size="md">
        {modalDetail && (
          <div className="space-y-3 text-sm">
            {[
              ['Paroissien', modalDetail.profiles?.nom],
              ['Téléphone', modalDetail.profiles?.telephone],
              ['Type demandeur', modalDetail.type_demandeur],
              ['Pour (tiers)', modalDetail.nom_tiers],
              ['Type de messe', modalDetail.type_messe?.replace(/_/g, ' ')],
              ['Date', fmtDate(modalDetail.date_messe)],
              ['Heure', modalDetail.heure_messe],
              ['Intention', modalDetail.intention],
              ['Montant', fmtMontant(modalDetail.montant)],
              ['Frais plateforme', fmtMontant(modalDetail.frais_plateforme)],
              ['Opérateur', modalDetail.operateur_paiement],
              ['Statut', modalDetail.statut],
              ['Date demande', fmtDateTime(modalDetail.created_at)],
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

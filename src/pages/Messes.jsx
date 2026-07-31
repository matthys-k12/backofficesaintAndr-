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
    const hasSearch = search.trim().length > 0

    let query = supabase.from('messe_demandes')
      .select('*', { count: 'exact' })
      .order('date_messe', { ascending: false })

    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)
    if (filtreType !== 'tout') query = query.eq('type_messe', filtreType)
    if (filtreDateDebut) query = query.gte('date_messe', filtreDateDebut)
    if (filtreDateFin)   query = query.lte('date_messe', filtreDateFin + 'T23:59:59')

    // Pas de pagination si filtre jour ou recherche (on filtre côté client)
    if (!useJourFilter && !hasSearch) {
      query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    }

    const { data, count } = await query
    let rows = data || []

    // Fetch profils séparé — évite le join silencieux
    const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
    const profsMap = {}
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, nom, telephone').in('id', ids)
      ;(profs || []).forEach(p => { profsMap[p.id] = p })
    }
    rows = rows.map(r => ({ ...r, profiles: profsMap[r.user_id] || null }))

    if (useJourFilter) rows = rows.filter(r => getJour(r.date_messe) === filtreJour)

    // Recherche client-side (nom paroissien, intention, nom tiers)
    if (hasSearch) {
      const sq = search.trim().toLowerCase()
      rows = rows.filter(r =>
        r.profiles?.nom?.toLowerCase().includes(sq) ||
        r.intention?.toLowerCase().includes(sq) ||
        r.nom_tiers?.toLowerCase().includes(sq)
      )
    }

    setDemandes(rows)
    setTotal(useJourFilter || hasSearch ? rows.length : (count || 0))
    setLoadingD(false)
  }, [page, filtreStatut, filtreType, filtreJour, filtreDateDebut, filtreDateFin, search])

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

  const exportWord = async () => {
    let query = supabase.from('messe_demandes')
      .select('*')
      .order('date_messe', { ascending: false })
    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)
    if (filtreType !== 'tout') query = query.eq('type_messe', filtreType)
    if (filtreDateDebut) query = query.gte('date_messe', filtreDateDebut)
    if (filtreDateFin)   query = query.lte('date_messe', filtreDateFin + 'T23:59:59')
    const { data } = await query
    let rows = data || []

    // Fetch profils pour l'export
    const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
    const profsMap = {}
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, nom, telephone').in('id', ids)
      ;(profs || []).forEach(p => { profsMap[p.id] = p })
    }
    rows = rows.map(r => ({ ...r, profiles: profsMap[r.user_id] || null }))

    if (filtreJour !== 'tout') rows = rows.filter(r => getJour(r.date_messe) === filtreJour)

    // Grouper par type de messe
    const typeOrder = ['action_de_grace', 'assistance_protection', 'repos_ame']
    const types = typeOrder.filter(t => rows.some(r => r.type_messe === t))
    const autresTypes = [...new Set(rows.map(r => r.type_messe).filter(t => !typeOrder.includes(t)))]
    const allTypes = [...types, ...autresTypes]

    // Période couverte par l'export
    const dates = rows.map(r => r.date_messe).filter(Boolean).sort()
    const periodeStr = dates.length
      ? `Du ${fmtDate(dates[0])} au ${fmtDate(dates[dates.length - 1])}`
      : ''

    const sections = allTypes.map(type => {
      const group = rows.filter(r => r.type_messe === type)
      const items = group
        .map(d => d.intention?.trim())
        .filter(Boolean)
        .map(i => `<li style="margin-bottom:4pt;">${i}</li>`)
        .join('')
      return `
        <h2 style="color:#8B1A2E;font-size:13pt;margin-top:20pt;margin-bottom:4pt;border-bottom:2px solid #8B1A2E;padding-bottom:3pt;">
          ${TYPE_LABELS[type] || type?.replace(/_/g,' ')}
          <span style="font-size:10pt;color:#888;font-weight:normal;"> — ${group.length} intention${group.length > 1 ? 's' : ''}</span>
        </h2>
        ${periodeStr ? `<p style="color:#666;font-size:9pt;margin:4pt 0 10pt;">${periodeStr}</p>` : ''}
        <ul style="margin:0;padding-left:18pt;font-size:10.5pt;line-height:1.7;">
          ${items || '<li style="color:#999;font-style:italic;">Aucune intention renseignée</li>'}
        </ul>`
    }).join('')

    const filtreStr = (() => {
      const parts = []
      if (filtreDateDebut && filtreDateFin) parts.push(`Du ${fmtDate(filtreDateDebut)} au ${fmtDate(filtreDateFin)}`)
      else if (filtreDateDebut) parts.push(`À partir du ${fmtDate(filtreDateDebut)}`)
      else if (filtreDateFin) parts.push(`Jusqu'au ${fmtDate(filtreDateFin)}`)
      if (filtreStatut !== 'tout') parts.push(STATUT_LABELS[filtreStatut])
      if (filtreType !== 'tout') parts.push(TYPE_LABELS[filtreType])
      if (filtreJour !== 'tout') parts.push(filtreJour)
      return parts.length ? parts.join(' · ') : 'Toutes les demandes'
    })()

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Intentions de messe</title>
<style>
  body { font-family: Georgia, serif; font-size: 11pt; margin: 40pt; }
  h1 { color: #8B1A2E; font-size: 18pt; margin-bottom: 2pt; }
  .subtitle { color: #666; font-size: 9pt; font-family: Arial, sans-serif; margin-bottom: 4pt; }
  .filtre { color: #8B1A2E; font-size: 9pt; font-family: Arial, sans-serif; margin-bottom: 20pt; font-style: italic; }
</style></head>
<body>
  <h1>Intentions de messe — Cathédrale Saint André</h1>
  <p class="subtitle">Exporté le ${new Date().toLocaleDateString('fr-FR')} · ${rows.length} intention${rows.length > 1 ? 's' : ''}</p>
  <p class="filtre">Filtre : ${filtreStr}</p>
  ${sections}
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
          <button
            onClick={exportWord}
            className="flex items-center gap-2 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm hover:bg-blue-50"
            title={filtreDateDebut || filtreDateFin ? `Export filtré : ${filtreDateDebut || '…'} → ${filtreDateFin || '…'}` : 'Exporter toutes les demandes'}
          >
            <Download size={16} /> Word
            {(filtreDateDebut || filtreDateFin) && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold">filtré</span>
            )}
          </button>
        </div>

        {/* Compteur total */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-700">
            {loadingD ? '…' : total} demande{total !== 1 ? 's' : ''}
          </span>
          {(filtreJour !== 'tout' || filtreStatut !== 'tout' || filtreType !== 'tout' || filtreDateDebut || filtreDateFin) && (
            <button
              onClick={() => { setFiltreJour('tout'); setFiltreStatut('tout'); setFiltreType('tout'); setFiltreDateDebut(''); setFiltreDateFin(''); setPage(1) }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="space-y-3 mb-4">
          {/* Ligne 1 : dates + statut + type + recherche */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">Du</label>
              <input type="date" value={filtreDateDebut} onChange={e => { setFiltreDateDebut(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">Au</label>
              <input type="date" value={filtreDateFin} onChange={e => { setFiltreDateFin(e.target.value); setPage(1) }}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
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
          {/* Ligne 2 : filtre par jour (pills) */}
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

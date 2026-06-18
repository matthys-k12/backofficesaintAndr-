import { useState, useEffect, useCallback } from 'react'
import { Trash2, Eye, EyeOff, Download } from 'lucide-react'
import { supabase, q } from '../lib/supabase'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import { fmtDate } from '../lib/helpers'

const PAGE_SIZE = 25

export default function Intentions() {
  const [intentions, setIntentions] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [filtreStatut, setFiltreStatut] = useState('tout')

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const [queryError, setQueryError] = useState(null)

  const loadIntentions = useCallback(async () => {
    setLoading(true)
    setQueryError(null)
    let query = supabase
      .from('intentions_priere')
      // Hint explicite sur le FK pour éviter l'ambiguïté PostgREST
      .select('*, profiles!user_id(nom, telephone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (filtreStatut === 'non_lues') query = query.eq('est_lue', false)
    if (filtreStatut === 'lues') query = query.eq('est_lue', true)

    const { data, count, error } = await query
    if (error) {
      console.error('[Intentions]', error)
      setQueryError(error.message)
      setLoading(false)
      return
    }
    setIntentions(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, filtreStatut])

  useEffect(() => { loadIntentions() }, [loadIntentions])

  const toggleLue = async (intention) => {
    await q(supabase.from('intentions_priere').update({ est_lue: !intention.est_lue }).eq('id', intention.id))
    loadIntentions()
  }

  const deleteIntention = async (id) => {
    if (!confirm('Supprimer cette intention ?')) return
    await q(supabase.from('intentions_priere').delete().eq('id', id))
    showToast('Intention supprimée')
    loadIntentions()
  }

  const exportWord = async () => {
    let query = supabase
      .from('intentions_priere')
      .select('*, profiles!user_id(nom, telephone)')
      .order('created_at', { ascending: false })
    if (filtreStatut === 'non_lues') query = query.eq('est_lue', false)
    if (filtreStatut === 'lues') query = query.eq('est_lue', true)
    const { data } = await query
    const rows = data || []

    const lignes = rows.map(r => `
      <tr>
        <td>${fmtDate(r.created_at)}</td>
        <td>${r.profiles?.nom || r.profiles?.telephone || 'Anonyme'}</td>
        <td>${r.texte || '—'}</td>
        <td>${r.est_lue ? 'Lue' : 'Non lue'}</td>
      </tr>`).join('')

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Intentions de prière</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; }
  h1 { color: #8B1A2E; font-size: 16pt; margin-bottom: 4pt; }
  p { color: #555; font-size: 9pt; margin-bottom: 12pt; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #8B1A2E; color: white; padding: 6pt 8pt; text-align: left; font-size: 9pt; }
  td { padding: 5pt 8pt; font-size: 9pt; border-bottom: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #FAF8F5; }
</style></head>
<body>
  <h1>Intentions de prière — Cathédrale Saint André</h1>
  <p>Exporté le ${new Date().toLocaleDateString('fr-FR')} · ${rows.length} intention(s)</p>
  <table>
    <thead><tr><th>Date</th><th>Fidèle</th><th>Intention</th><th>Statut</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table>
</body></html>`

    const blob = new Blob(['﻿' + html], { type: 'application/msword' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `intentions_priere_${new Date().toISOString().slice(0,10)}.doc`
    a.click()
  }

  const nonLues = intentions.filter(i => !i.est_lue).length

  const cols = [
    {
      key: 'est_lue', label: '', render: (v) => (
        <div className={`w-2 h-2 rounded-full ${v ? 'bg-gray-300' : 'bg-amber-400'}`} title={v ? 'Lue' : 'Non lue'} />
      )
    },
    {
      key: 'profiles', label: 'Fidèle', render: (v) => {
        if (!v) return <span className="text-gray-400 text-xs italic">Anonyme</span>
        const nom = v.nom || v.telephone || '—'
        return <span className="text-sm font-medium text-gray-800">{nom}</span>
      }
    },
    {
      key: 'texte', label: 'Intention', render: (v) => (
        <span className="text-sm text-gray-700 line-clamp-2" style={{ maxWidth: 420 }}>{v}</span>
      )
    },
    { key: 'created_at', label: 'Date', render: v => <span className="text-xs text-gray-500">{fmtDate(v)}</span> },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {queryError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <strong>Erreur de chargement :</strong> {queryError}
          <p className="mt-1 text-xs text-red-500">
            Vérifiez que la table <code>intentions_priere</code> existe et que les politiques RLS permettent la lecture.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Intentions de prière</h2>
          {nonLues > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">{nonLues} intention{nonLues > 1 ? 's' : ''} non lue{nonLues > 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={exportWord}
            className="flex items-center gap-2 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm hover:bg-blue-50"
          >
            <Download size={14} /> Word
          </button>
          <select
            value={filtreStatut}
            onChange={e => { setFiltreStatut(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="tout">Toutes</option>
            <option value="non_lues">Non lues</option>
            <option value="lues">Lues</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={cols}
        data={intentions}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          <button
            key="lue"
            onClick={() => toggleLue(row)}
            title={row.est_lue ? 'Marquer non lue' : 'Marquer comme lue'}
            className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
          >
            {row.est_lue ? <EyeOff size={12} /> : <Eye size={12} />}
            {row.est_lue ? 'Non lue' : 'Lue'}
          </button>,
          <button
            key="d"
            onClick={() => deleteIntention(row.id)}
            className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100"
          >
            <Trash2 size={12} /> Supprimer
          </button>,
        ]}
      />
    </div>
  )
}

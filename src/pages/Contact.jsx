import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { supabase, q } from '../lib/supabase'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { fmtDate } from '../lib/helpers'

const PAGE_SIZE = 25
const TYPE_LABELS = {
  suggestion: 'Suggestion',
  reclamation: 'Réclamation',
  bug: 'Signalement de bug',
  autre: 'Autre',
}
const TYPE_COLORS = {
  suggestion: 'validee',
  reclamation: 'en_attente',
  bug: 'annulee',
  autre: 'en_attente',
}

export default function Contact() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [filtreType, setFiltreType] = useState('tout')
  const [filtreStatut, setFiltreStatut] = useState('tout')
  const [modalDetail, setModalDetail] = useState(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('contact_messages')
      .select('*, profiles(nom, telephone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (filtreType !== 'tout') query = query.eq('type', filtreType)
    if (filtreStatut === 'non_lus') query = query.eq('est_lu', false)
    if (filtreStatut === 'lus') query = query.eq('est_lu', true)

    const { data, count } = await query
    setMessages(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, filtreType, filtreStatut])

  useEffect(() => { load() }, [load])

  const toggleLu = async (msg) => {
    await q(supabase.from('contact_messages').update({ est_lu: !msg.est_lu }).eq('id', msg.id))
    load()
  }

  const supprimer = async (id) => {
    if (!confirm('Supprimer ce message ?')) return
    await q(supabase.from('contact_messages').delete().eq('id', id))
    showToast('Message supprimé')
    load()
  }

  const ouvrirDetail = async (row) => {
    setModalDetail(row)
    if (!row.est_lu) {
      await q(supabase.from('contact_messages').update({ est_lu: true }).eq('id', row.id))
      load()
    }
  }

  const nonLus = messages.filter(m => !m.est_lu).length

  const cols = [
    {
      key: 'est_lu', label: '', render: (v) => (
        <div className={`w-2 h-2 rounded-full ${v ? 'bg-gray-300' : 'bg-amber-400'}`} title={v ? 'Lu' : 'Non lu'} />
      )
    },
    { key: 'profiles', label: 'Paroissien', render: v => v?.nom || <span className="text-gray-400 italic text-xs">Anonyme</span> },
    { key: 'type', label: 'Type', render: v => <Badge label={TYPE_LABELS[v] || v} value={TYPE_COLORS[v] || 'en_attente'} /> },
    { key: 'objet', label: 'Objet', render: v => <span className="text-sm text-gray-700">{v || '—'}</span> },
    {
      key: 'message', label: 'Message', render: v => (
        <span className="text-sm text-gray-600 line-clamp-1" style={{ maxWidth: 280 }}>
          {v ? (v.length > 80 ? v.slice(0, 80) + '…' : v) : '—'}
        </span>
      )
    },
    { key: 'created_at', label: 'Date', render: v => <span className="text-xs text-gray-500">{fmtDate(v)}</span> },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Messages & Suggestions</h2>
          {nonLus > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">{nonLus} message{nonLus > 1 ? 's' : ''} non lu{nonLus > 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="flex gap-2">
          <select
            value={filtreType}
            onChange={e => { setFiltreType(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="tout">Tous les types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={filtreStatut}
            onChange={e => { setFiltreStatut(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="tout">Tous</option>
            <option value="non_lus">Non lus</option>
            <option value="lus">Lus</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={cols}
        data={messages}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          <button
            key="voir"
            onClick={() => ouvrirDetail(row)}
            className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
          >
            <Eye size={12} /> Voir
          </button>,
          <button
            key="lue"
            onClick={() => toggleLu(row)}
            className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
          >
            {row.est_lu ? <EyeOff size={12} /> : <Eye size={12} />}
            {row.est_lu ? 'Non lu' : 'Lu'}
          </button>,
          <button
            key="del"
            onClick={() => supprimer(row.id)}
            className="flex items-center gap-1 border border-red-200 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-50"
          >
            <Trash2 size={12} /> Supprimer
          </button>,
        ]}
      />

      <Modal isOpen={!!modalDetail} onClose={() => setModalDetail(null)} title="Détail du message" size="md">
        {modalDetail && (
          <div className="space-y-4 text-sm">
            <div className="flex gap-4">
              <span className="text-gray-500 w-24 shrink-0">Paroissien</span>
              <span className="text-gray-900 font-medium">{modalDetail.profiles?.nom || 'Anonyme'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-24 shrink-0">Téléphone</span>
              <span className="text-gray-900">{modalDetail.profiles?.telephone || '—'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-24 shrink-0">Type</span>
              <Badge label={TYPE_LABELS[modalDetail.type] || modalDetail.type} value={TYPE_COLORS[modalDetail.type] || 'en_attente'} />
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-24 shrink-0">Objet</span>
              <span className="text-gray-900 font-medium">{modalDetail.objet || '—'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-24 shrink-0">Date</span>
              <span className="text-gray-900">{fmtDate(modalDetail.created_at)}</span>
            </div>
            <div>
              <p className="text-gray-500 mb-2">Message</p>
              <div className="bg-gray-50 rounded-lg p-4 text-gray-800 leading-relaxed whitespace-pre-wrap">
                {modalDetail.message}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

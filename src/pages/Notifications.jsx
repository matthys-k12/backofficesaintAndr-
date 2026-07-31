import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Send, Bell, Trash2 } from 'lucide-react'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import { fmtDate } from '../lib/helpers'

export default function Notifications() {
  const [titre,   setTitre]   = useState('')
  const [corps,   setCorps]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)

  const [historique, setHistorique] = useState([])
  const [loadingH,   setLoadingH]   = useState(true)
  const [toast,      setToast]      = useState(null)

  const showToast = (msg, t = 'success') => setToast({ msg, type: t })

  // ── Chargement historique ─────────────────────────────────────────
  const loadHistorique = useCallback(async () => {
    setLoadingH(true)
    const { data } = await supabase
      .from('push_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setHistorique(data || [])
    setLoadingH(false)
  }, [])

  useEffect(() => { loadHistorique() }, [loadHistorique])

  // ── Envoi ─────────────────────────────────────────────────────────
  const envoyer = async () => {
    if (!titre.trim() || !corps.trim()) return
    setLoading(true)
    setResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { titre: titre.trim(), corps: corps.trim() },
      })

      if (error || data?.error) {
        setResult({ ok: false, msg: error?.message || JSON.stringify(data?.error) })
      } else {
        // Sauvegarder dans l'historique
        await supabase.from('push_notifications').insert({
          titre: titre.trim(),
          corps: corps.trim(),
          type: 'general',
        })
        setResult({ ok: true, msg: 'Notification envoyée à tous les utilisateurs.' })
        setTitre('')
        setCorps('')
        loadHistorique()
      }
    } catch (e) {
      setResult({ ok: false, msg: e.message })
    } finally {
      setLoading(false)
    }
  }

  const supprimer = async (id) => {
    if (!confirm('Supprimer cette notification de l\'historique ?')) return
    await supabase.from('push_notifications').delete().eq('id', id)
    showToast('Notification supprimée de l\'historique')
    loadHistorique()
  }

  const colsHistorique = [
    {
      key: 'created_at',
      label: 'Date',
      render: v => <span className="text-xs text-gray-500">{fmtDate(v)}</span>,
    },
    {
      key: 'titre',
      label: 'Titre',
      render: v => <span className="text-sm font-semibold text-gray-800">{v}</span>,
    },
    {
      key: 'corps',
      label: 'Message',
      render: v => (
        <span className="text-sm text-gray-600">
          {v && v.length > 80 ? v.slice(0, 80) + '…' : v}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-10">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Formulaire d'envoi ─────────────────────────────────────── */}
      <div className="max-w-xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Bell size={20} style={{ color: '#8B1A2E' }} />
            <h1 className="text-xl font-bold" style={{ color: '#1a1a2e', fontFamily: 'Georgia, serif' }}>
              Notifications push
            </h1>
          </div>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Le message sera reçu immédiatement sur tous les téléphones connectés.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
              Titre
            </label>
            <input
              type="text"
              value={titre}
              onChange={e => setTitre(e.target.value)}
              maxLength={65}
              placeholder="ex : Messe spéciale ce dimanche"
              className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2"
              style={{ borderColor: '#d1d5db', '--tw-ring-color': '#8B1A2E' }}
            />
            <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{titre.length}/65</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#374151' }}>
              Message
            </label>
            <textarea
              value={corps}
              onChange={e => setCorps(e.target.value)}
              maxLength={200}
              rows={4}
              placeholder="ex : La messe de 10h sera célébrée en plein air ce dimanche. Venez nombreux."
              className="w-full border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 resize-none"
              style={{ borderColor: '#d1d5db', '--tw-ring-color': '#8B1A2E' }}
            />
            <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{corps.length}/200</p>
          </div>

          {(titre || corps) && (
            <div className="rounded-xl p-4 border" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>
                Aperçu
              </p>
              <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ backgroundColor: '#1c1c1e' }}>
                <div
                  className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
                  style={{ backgroundColor: '#8B1A2E' }}
                >
                  ✝
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold leading-tight">{titre || 'Titre'}</p>
                  <p className="text-sm mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {corps || 'Message…'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div
              className="rounded-lg px-4 py-3 text-sm font-medium"
              style={{
                backgroundColor: result.ok ? '#f0fdf4' : '#fef2f2',
                color: result.ok ? '#166534' : '#991b1b',
                border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`,
              }}
            >
              {result.msg}
            </div>
          )}

          <button
            onClick={envoyer}
            disabled={!titre.trim() || !corps.trim() || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            <Send size={15} />
            {loading ? 'Envoi en cours…' : 'Envoyer à tous'}
          </button>
        </div>
      </div>

      {/* ── Historique ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
          Historique des notifications
        </h2>

        <DataTable
          columns={colsHistorique}
          data={historique}
          loading={loadingH}
          actions={row => [
            <button
              key="del"
              onClick={() => supprimer(row.id)}
              className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100"
            >
              <Trash2 size={12} /> Supprimer
            </button>,
          ]}
        />
      </div>
    </div>
  )
}

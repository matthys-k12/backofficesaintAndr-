import { useState, useEffect, useCallback } from 'react'
import { Eye, Search } from 'lucide-react'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import { fmtMontant, fmtDate, fmtDateTime } from '../lib/helpers'

const PAGE_SIZE = 20

export default function Utilisateurs() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [modalUser, setModalUser] = useState(null)
  const [userStats, setUserStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const loadUsers = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) query = query.or(`nom.ilike.%${search}%,email.ilike.%${search}%,telephone.ilike.%${search}%`)

    const { data, count } = await query
    setUsers(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [page, search])

  useEffect(() => { loadUsers() }, [loadUsers])

  const openUser = async (user) => {
    setModalUser(user)
    setLoadingStats(true)
    setUserStats(null)
    try {
      const [messes, dons, casuels] = await Promise.all([
        supabase.from('messe_demandes').select('id, montant, statut, created_at, type_messe').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('dons').select('id, montant, statut, created_at, don_campagnes(titre)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('casuel_demandes').select('id, montant, statut, created_at, categorie').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])

      const totalDons = (dons.data || []).reduce((s, d) => s + (d.montant || 0), 0)
      const totalMesses = (messes.data || []).reduce((s, m) => s + (m.montant || 0), 0)
      const totalCasuels = (casuels.data || []).reduce((s, c) => s + (c.montant || 0), 0)

      setUserStats({
        messes: messes.data || [],
        dons: dons.data || [],
        casuels: casuels.data || [],
        totalDons,
        totalMesses,
        totalCasuels,
        total: totalDons + totalMesses + totalCasuels,
      })
    } catch {
      showToast('Erreur lors du chargement', 'error')
    }
    setLoadingStats(false)
  }

  const cols = [
    {
      key: 'nom', label: 'Nom', render: (v, row) => (
        <div>
          <p className="font-medium text-gray-800">{v || '—'}</p>
          <p className="text-xs text-gray-400">{row.email || '—'}</p>
        </div>
      )
    },
    { key: 'telephone', label: 'Téléphone', render: v => v || '—' },
    { key: 'paroisse', label: 'Paroisse', render: v => v || '—' },
    { key: 'quartier', label: 'Quartier', render: v => v || '—' },
    { key: 'created_at', label: 'Inscrit le', render: v => fmtDate(v) },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
          Utilisateurs
          <span className="ml-2 text-sm font-normal text-gray-400">{total.toLocaleString()} membres</span>
        </h2>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher par nom, email, téléphone…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          />
        </div>
      </div>

      <DataTable
        columns={cols}
        data={users}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          <button
            key="v"
            onClick={() => openUser(row)}
            className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
          >
            <Eye size={12} /> Profil
          </button>
        ]}
      />

      {/* Modal profil utilisateur */}
      <Modal isOpen={!!modalUser} onClose={() => { setModalUser(null); setUserStats(null) }} title="Profil utilisateur" size="xl">
        {modalUser && (
          <div className="space-y-6">
            {/* Info utilisateur */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0" style={{ backgroundColor: '#8B1A2E' }}>
                {(modalUser.nom || modalUser.email || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{modalUser.nom || '—'}</h3>
                <p className="text-gray-500 text-sm">{modalUser.email || '—'}</p>
                <p className="text-gray-400 text-sm">{modalUser.telephone || '—'}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Inscrit le</p>
                <p className="font-medium text-gray-800">{fmtDate(modalUser.created_at)}</p>
              </div>
            </div>

            {/* Stats rapides */}
            {loadingStats ? (
              <div className="grid grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : userStats && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Dons versés', value: fmtMontant(userStats.totalDons), count: userStats.dons.length },
                    { label: 'Demandes messe', value: fmtMontant(userStats.totalMesses), count: userStats.messes.length },
                    { label: 'Casuels', value: fmtMontant(userStats.totalCasuels), count: userStats.casuels.length },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                      <p className="text-lg font-bold text-gray-900">{s.value}</p>
                      <p className="text-xs text-gray-400">{s.count} transaction(s)</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Total engagements</p>
                  <p className="text-2xl font-bold" style={{ color: '#8B1A2E' }}>{fmtMontant(userStats.total)}</p>
                </div>

                {/* Dernières messes */}
                {userStats.messes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Dernières demandes de messe</h4>
                    <div className="space-y-1">
                      {userStats.messes.slice(0, 5).map(m => (
                        <div key={m.id} className="flex justify-between text-sm py-1 border-b border-gray-50">
                          <span className="text-gray-600">{m.type_messe?.replace(/_/g, ' ') || '—'} · {fmtDate(m.created_at)}</span>
                          <span className="font-medium">{fmtMontant(m.montant)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Derniers dons */}
                {userStats.dons.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Derniers dons</h4>
                    <div className="space-y-1">
                      {userStats.dons.slice(0, 5).map(d => (
                        <div key={d.id} className="flex justify-between text-sm py-1 border-b border-gray-50">
                          <span className="text-gray-600">{d.don_campagnes?.titre || 'Don libre'} · {fmtDate(d.created_at)}</span>
                          <span className="font-medium text-green-700">{fmtMontant(d.montant)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

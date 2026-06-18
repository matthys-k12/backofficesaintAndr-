import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Check, Download } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import { fmtMontant, fmtDate } from '../lib/helpers'

const PAGE_SIZE = 25
const ANNEE_COURANTE = new Date().getFullYear()

export default function DenierCulte() {
  // ── Tarifs par profession ────────────────────────────────────────
  const [tarifs, setTarifs] = useState([])
  const [loadingTarifs, setLoadingTarifs] = useState(true)
  const [modalTarif, setModalTarif] = useState(false)
  const [editTarif, setEditTarif] = useState(null)

  // ── Cotisations ──────────────────────────────────────────────────
  const [cotisations, setCotisations] = useState([])
  const [loadingCot, setLoadingCot] = useState(true)
  const [filtreAnnee, setFiltreAnnee] = useState(ANNEE_COURANTE)
  const [filtreStatut, setFiltreStatut] = useState('tout')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [queryError, setQueryError] = useState(null)

  // ── Stats ────────────────────────────────────────────────────────
  const [stats, setStats] = useState({ total_paye: 0, nb_paye: 0, nb_partiel: 0, nb_nonpaye: 0 })

  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const { register, handleSubmit, reset } = useForm()

  // Années disponibles (5 dernières + courante)
  const annees = Array.from({ length: 5 }, (_, i) => ANNEE_COURANTE - i)

  // ── Chargement tarifs ────────────────────────────────────────────
  const loadTarifs = async () => {
    setLoadingTarifs(true)
    const { data, error } = await supabase
      .from('denier_culte_tarifs')
      .select('*')
      .order('profession')
    if (!error) setTarifs(data || [])
    setLoadingTarifs(false)
  }

  // ── Chargement cotisations ───────────────────────────────────────
  const loadCotisations = useCallback(async () => {
    setLoadingCot(true)
    setQueryError(null)
    let query = supabase
      .from('denier_culte')
      .select('*', { count: 'exact' })
      .eq('annee', filtreAnnee)
      .order('date_paiement', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (filtreStatut !== 'tout') query = query.eq('statut', filtreStatut)

    const { data, count, error } = await query
    if (error) {
      console.error('[DenierCulte]', error)
      setQueryError(error.message)
      setLoadingCot(false); return
    }

    const ids = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
    let profsMap = {}
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, nom, telephone').in('id', ids)
      ;(profs || []).forEach(p => { profsMap[p.id] = p })
    }
    setCotisations((data || []).map(r => ({ ...r, profiles: profsMap[r.user_id] || null })))
    setTotal(count || 0)
    setLoadingCot(false)
  }, [page, filtreAnnee, filtreStatut])

  // ── Stats de l'année ─────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    const { data } = await supabase
      .from('denier_culte')
      .select('statut, montant')
      .eq('annee', filtreAnnee)
    if (!data) return
    const totalPaye = data.filter(r => r.statut === 'paye').reduce((s, r) => s + (r.montant || 0), 0)
    setStats({
      total_paye: totalPaye,
      nb_paye: data.filter(r => r.statut === 'paye').length,
      nb_partiel: data.filter(r => r.statut === 'partiel').length,
      nb_nonpaye: data.filter(r => r.statut === 'non_paye').length,
    })
  }, [filtreAnnee])

  useEffect(() => { loadTarifs() }, [])
  useEffect(() => { loadCotisations(); loadStats() }, [loadCotisations, loadStats])

  // ── CRUD Tarifs ──────────────────────────────────────────────────
  const saveTarif = async (data) => {
    try {
      const payload = {
        profession: data.profession.trim(),
        montant: parseInt(data.montant),
        description: data.description?.trim() || null,
        est_actif: true,
      }
      if (editTarif) {
        await q(supabase.from('denier_culte_tarifs').update(payload).eq('id', editTarif.id))
        showToast('Tarif mis à jour')
      } else {
        await q(supabase.from('denier_culte_tarifs').insert(payload))
        showToast('Profession ajoutée')
      }
      setModalTarif(false); setEditTarif(null); reset()
      loadTarifs()
    } catch (err) { showToast(err.message, 'error') }
  }

  const deleteTarif = async (id) => {
    if (!confirm('Supprimer ce tarif ?')) return
    await q(supabase.from('denier_culte_tarifs').delete().eq('id', id))
    showToast('Tarif supprimé')
    loadTarifs()
  }

  const toggleTarifActif = async (t) => {
    await q(supabase.from('denier_culte_tarifs').update({ est_actif: !t.est_actif }).eq('id', t.id))
    loadTarifs()
  }

  // ── Marquer manuellement comme payé ─────────────────────────────
  const marquerPaye = async (row) => {
    if (!confirm(`Marquer la cotisation de ${row.profiles?.nom || 'cet utilisateur'} comme payée ?`)) return
    await q(supabase.from('denier_culte').update({
      statut: 'paye',
      date_paiement: new Date().toISOString(),
    }).eq('id', row.id))
    showToast('Cotisation marquée payée')
    loadCotisations()
    loadStats()
  }

  // ── Export CSV ───────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [['Nom', 'Téléphone', 'Profession', 'Montant', 'Statut', 'Date paiement', 'Opérateur']]
    cotisations.forEach(r => rows.push([
      r.profiles?.nom || '', r.profiles?.telephone || '',
      r.profession || '', r.montant || '',
      r.statut || '', r.date_paiement || '', r.operateur_paiement || '',
    ]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `denier_culte_${filtreAnnee}.csv`
    a.click()
  }

  const STATUT_LABELS = { paye: 'Payé', partiel: 'Partiel', non_paye: 'Non payé' }

  const colsCotisations = [
    {
      key: 'profiles', label: 'Paroissien',
      render: (v) => {
        if (!v) return <span className="text-gray-400 italic text-xs">Inconnu</span>
        return (
          <div>
            <p className="text-sm font-semibold text-gray-800">{v.nom || '—'}</p>
            {v.telephone && <p className="text-xs text-gray-400">{v.telephone}</p>}
          </div>
        )

      }
    },
    {
      key: 'profession', label: 'Profession',
      render: v => v ? <span className="text-sm text-gray-700">{v}</span>
        : <span className="text-gray-400 italic text-xs">Non renseignée</span>
    },
    { key: 'montant', label: 'Montant', render: v => <span className="font-semibold text-gray-800">{fmtMontant(v)}</span> },
    { key: 'operateur_paiement', label: 'Opérateur', render: v => v || '—' },
    {
      key: 'statut', label: 'Statut',
      render: v => <Badge label={STATUT_LABELS[v] || v} value={v} />
    },
    { key: 'date_paiement', label: 'Date paiement', render: v => v ? fmtDate(v) : '—' },
  ]

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Stats année ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total collecté', value: fmtMontant(stats.total_paye), color: '#15803d', bg: '#f0fdf4' },
          { label: 'Cotisations payées', value: stats.nb_paye, color: '#15803d', bg: '#f0fdf4' },
          { label: 'Paiements partiels', value: stats.nb_partiel, color: '#D4A017', bg: '#fffbeb' },
          { label: 'Non payés', value: stats.nb_nonpaye, color: '#b91c1c', bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 relative overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: s.color }} />
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 pl-2 mb-1" style={{ fontSize: 10 }}>{s.label}</p>
            <p className="text-xl font-bold pl-2" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tarifs par profession ────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Tarifs par profession</h2>
          <button
            onClick={() => { setEditTarif(null); reset(); setModalTarif(true) }}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#8B1A2E', boxShadow: '0 2px 8px rgba(139,26,46,0.25)' }}
          >
            <Plus size={15} /> Ajouter une profession
          </button>
        </div>

        {loadingTarifs ? (
          <div className="h-32 skeleton rounded-xl" />
        ) : tarifs.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <p className="text-gray-400 text-sm">Aucun tarif configuré. Ajoutez des professions pour personnaliser les montants.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #ede9e3' }}>
                  {['Profession', 'Montant suggéré', 'Description', 'Actif', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-widest"
                      style={{ color: '#b0a99f', fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tarifs.map((t, i) => (
                  <tr key={t.id}
                    style={{ borderBottom: '1px solid #f5f1ec' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FDFAF7')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">{t.profession}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#15803d' }}>{fmtMontant(t.montant)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{t.description || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleTarifActif(t)}
                        className="w-9 h-5 rounded-full transition-colors relative"
                        style={{ backgroundColor: t.est_actif ? '#16a34a' : '#d1d5db' }}
                      >
                        <div className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all"
                          style={{ left: t.est_actif ? '19px' : '3px' }} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setEditTarif(t); reset({ profession: t.profession, montant: t.montant, description: t.description }); setModalTarif(true) }}
                          className="text-xs font-semibold transition-opacity hover:opacity-70"
                          style={{ color: '#1A237E' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => deleteTarif(t.id)}
                          className="text-xs font-semibold transition-opacity hover:opacity-70"
                          style={{ color: '#b91c1c' }}
                        >
                          <Trash2 size={13} />
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

      {/* ── Cotisations ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Cotisations {filtreAnnee}</h2>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            <Download size={15} /> Exporter CSV
          </button>
        </div>

        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            value={filtreAnnee}
            onChange={e => { setFiltreAnnee(parseInt(e.target.value)); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filtreStatut}
            onChange={e => { setFiltreStatut(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
          >
            <option value="tout">Tous les statuts</option>
            <option value="paye">Payés</option>
            <option value="partiel">Partiels</option>
            <option value="non_paye">Non payés</option>
          </select>
        </div>

        {queryError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-4">
            <strong>Erreur :</strong> {queryError}
            <p className="mt-1 text-xs text-red-500">
              Vérifiez que la table <code>denier_culte</code> existe et que les RLS permettent la lecture admin.
            </p>
          </div>
        )}

        <DataTable
          columns={colsCotisations}
          data={cotisations}
          loading={loadingCot}
          pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
          onPageChange={setPage}
          actions={row => [
            row.statut !== 'paye' && (
              <button
                key="paye"
                onClick={() => marquerPaye(row)}
                className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
              >
                <Check size={12} /> Marquer payé
              </button>
            ),
          ].filter(Boolean)}
        />
      </div>

      {/* ── Modal tarif ─────────────────────────────────────────── */}
      <Modal
        isOpen={modalTarif}
        onClose={() => { setModalTarif(false); setEditTarif(null); reset() }}
        title={editTarif ? 'Modifier le tarif' : 'Ajouter une profession'}
        size="sm"
      >
        <form onSubmit={handleSubmit(saveTarif)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Profession *</label>
            <input
              {...register('profession', { required: true })}
              placeholder="ex : Fonctionnaire, Commerçant, Étudiant…"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
              style={{ background: '#faf8f6' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Montant suggéré (FCFA) *</label>
            <input
              type="number"
              {...register('montant', { required: true, min: 100 })}
              placeholder="ex : 5000"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
              style={{ background: '#faf8f6' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Description (optionnel)</label>
            <input
              {...register('description')}
              placeholder="Note ou précision…"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
              style={{ background: '#faf8f6' }}
            />
          </div>
          <button
            type="submit"
            className="w-full text-white py-3 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#8B1A2E', boxShadow: '0 3px 12px rgba(139,26,46,0.25)' }}
          >
            Enregistrer
          </button>
        </form>
      </Modal>
    </div>
  )
}

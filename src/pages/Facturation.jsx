import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Toast from '../components/Toast'
import { fmtMontant, fmtDate } from '../lib/helpers'

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const ANNEE_COURANTE = new Date().getFullYear()
const MOIS_COURANT  = new Date().getMonth() + 1

const SERVICE_CONFIG = [
  { key: 'messe',   label: 'Demande de Messe', table: 'messe_demandes',  statutFilter: null,   dateField: 'created_at'    },
  { key: 'casuel',  label: 'Casuel',            table: 'casuel_demandes', statutFilter: null,   dateField: 'created_at'    },
  { key: 'dons',    label: 'Dons',              table: 'dons',            statutFilter: null,   dateField: 'created_at'    },
  { key: 'denier',  label: 'Denier du culte',   table: 'denier_culte',   statutFilter: 'paye', dateField: 'date_paiement' },
]

function padZ(n) { return String(n).padStart(2, '0') }
function monthRange(year, month) {
  const start = `${year}-${padZ(month)}-01T00:00:00`
  const nextM = month === 12 ? 1 : month + 1
  const nextY = month === 12 ? year + 1 : year
  const end   = `${nextY}-${padZ(nextM)}-01T00:00:00`
  return { start, end }
}

export default function Facturation() {
  const [annee,   setAnnee]   = useState(ANNEE_COURANTE)
  const [mois,    setMois]    = useState(MOIS_COURANT)
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [toast,   setToast]   = useState(null)

  const annees = Array.from({ length: 4 }, (_, i) => ANNEE_COURANTE - i)

  const load = useCallback(async () => {
    setLoading(true)
    const { start, end } = monthRange(annee, mois)
    const all = []

    for (const svc of SERVICE_CONFIG) {
      const df = svc.dateField || 'created_at'
      let query = supabase
        .from(svc.table)
        .select(`user_id, montant, operateur_paiement, ${df}`)
        .gte(df, start)
        .lt(df, end)
        .order(df, { ascending: false })

      if (svc.statutFilter) {
        query = query.eq('statut', svc.statutFilter)
      }

      const { data, error } = await query
      if (error) { console.error(svc.table, error); continue }

      ;(data || []).forEach(r => all.push({
        service:      svc.label,
        user_id:      r.user_id,
        nom:          null,
        telephone:    null,
        montant:      r.montant || 0,
        operateur:    r.operateur_paiement || '—',
        reference:    r.reference_transaction || '—',
        date:         r[df],
      }))
    }

    // Résolution des profils utilisateurs
    const allIds = [...new Set(all.map(r => r.user_id).filter(Boolean))]
    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nom, telephone')
        .in('id', allIds)
      const profsMap = {}
      ;(profs || []).forEach(p => { profsMap[p.id] = { nom: p.nom, telephone: p.telephone } })
      all.forEach(r => {
        r.nom       = profsMap[r.user_id]?.nom       || 'Anonyme'
        r.telephone = profsMap[r.user_id]?.telephone || '—'
      })
    } else {
      all.forEach(r => { r.nom = 'Anonyme'; r.telephone = '—' })
    }

    all.sort((a, b) => new Date(b.date) - new Date(a.date))
    setRows(all)
    setLoading(false)
  }, [annee, mois])

  useEffect(() => { load() }, [load])

  // ── Agrégats globaux ──────────────────────────────────────────────
  const totalMontant  = rows.reduce((s, r) => s + r.montant, 0)
  const totalWIM      = rows.reduce((s, r) => s + Math.round(r.montant * 0.01), 0)
  const totalFraisOp  = rows.reduce((s, r) => s + Math.round(r.montant * 0.01), 0)
  const totalRevTotal = Math.round(totalMontant * 1.02)

  // ── Répartition par service ───────────────────────────────────────
  const byService = SERVICE_CONFIG.map(svc => {
    const svcRows = rows.filter(r => r.service === svc.label)
    const net     = svcRows.reduce((s, r) => s + r.montant, 0)
    return {
      label:    svc.label,
      nb:       svcRows.length,
      net,
      wim:      svcRows.reduce((s, r) => s + Math.round(r.montant * 0.01), 0),
      fraisOp:  svcRows.reduce((s, r) => s + Math.round(r.montant * 0.01), 0),
    }
  })

  const KPI_CARDS = [
    {
      label: 'TRANSACTIONS',
      value: loading ? '…' : rows.length,
      bg:    '#111111',
    },
    {
      label: 'REVENU TOTAL',
      value: loading ? '…' : fmtMontant(totalRevTotal),
      bg:    '#1A237E',
    },
    {
      label: 'REVENU ST ANDRE',
      value: loading ? '…' : fmtMontant(totalMontant),
      bg:    '#15803d',
    },
    {
      label: 'REVENU WEB IVOIRE MEDIA',
      value: loading ? '…' : fmtMontant(totalWIM),
      bg:    '#f97316',
    },
    {
      label: 'FRAIS OPÉRATEUR',
      value: loading ? '…' : fmtMontant(totalFraisOp),
      bg:    '#6b7280',
    },
  ]

  const thStyle = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#b0a99f',
    whiteSpace: 'nowrap',
    backgroundColor: '#FAF8F5',
    borderBottom: '1px solid #ede9e3',
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── En-tête ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
          Revenus
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Revenus de la cathédrale et commissions WebIvoire Media (1 % par transaction)
        </p>
      </div>

      {/* ── Sélecteur période ────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={mois}
          onChange={e => setMois(parseInt(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          {MOIS_LABELS.map((l, i) => (
            <option key={i + 1} value={i + 1}>{l}</option>
          ))}
        </select>
        <select
          value={annee}
          onChange={e => setAnnee(parseInt(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {KPI_CARDS.map(card => (
          <div
            key={card.label}
            className="rounded-xl p-5"
            style={{ backgroundColor: card.bg }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}
            >
              {card.label}
            </p>
            <p
              className="text-xl font-bold text-white"
              style={{ fontFamily: 'Playfair Display, Georgia, serif', fontVariantNumeric: 'tabular-nums' }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Table 1 : Répartition par service ────────────────────── */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #ede9e3' }}
      >
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #ede9e3', backgroundColor: '#FAF8F5' }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>Répartition par service</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                {['SERVICE', 'NOMBRE TRANSACTIONS', 'REVENU ST ANDRE', 'REVENU WEB IVOIRE MEDIA', 'FRAIS OPÉRATEUR (1%)'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byService.map(svc => (
                <tr
                  key={svc.label}
                  style={{ borderBottom: '1px solid #f5f1ec' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FDFAF7')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">{svc.label}</td>
                  <td className="px-4 py-3 text-sm text-gray-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {svc.nb}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtMontant(svc.net)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: '#f97316', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtMontant(svc.wim)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold" style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtMontant(svc.fraisOp)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#111111' }}>
                <td className="px-4 py-3.5 text-sm font-bold text-white">TOTAL</td>
                <td className="px-4 py-3.5 text-sm font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {rows.length}
                </td>
                <td className="px-4 py-3.5 text-sm font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMontant(totalMontant)}
                </td>
                <td className="px-4 py-3.5 text-sm font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMontant(totalWIM)}
                </td>
                <td className="px-4 py-3.5 text-sm font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMontant(totalFraisOp)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Table 2 : Détail des transactions ────────────────────── */}
      <div>
        <h2 className="section-title mb-4">Détail des transactions</h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 skeleton rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <div
            className="bg-white rounded-xl p-12 text-center"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <p className="text-4xl mb-3">∅</p>
            <p className="text-gray-500 text-sm">
              Aucune transaction pour {MOIS_LABELS[mois - 1]} {annee}
            </p>
          </div>
        ) : (
          <div
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid #ede9e3' }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    {[
                      'DATE',
                      'SERVICE',
                      'UTILISATEUR',
                      'TELEPHONE',
                      'NUMERO TRANSACTION',
                      'OPERATEUR',
                      'MONTANT',
                      'REVENU ST ANDRE',
                      'REVENU WEB IVOIRE MEDIA',
                      'FRAIS OPÉRATEUR (1%)',
                    ].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const wim     = Math.round(r.montant * 0.01)
                    const fraisOp = Math.round(r.montant * 0.01)
                    return (
                      <tr
                        key={i}
                        style={{ borderBottom: '1px solid #f5f1ec' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FDFAF7')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {fmtDate(r.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ backgroundColor: '#eef0fb', color: '#1A237E' }}
                          >
                            {r.service}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
                          {r.nom}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {r.telephone}
                        </td>
                        <td
                          className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {r.reference}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {r.operateur}
                        </td>
                        <td
                          className="px-4 py-3 text-sm font-semibold text-gray-800 whitespace-nowrap"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {fmtMontant(r.montant)}
                        </td>
                        <td
                          className="px-4 py-3 text-sm font-bold whitespace-nowrap"
                          style={{ color: '#15803d', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {fmtMontant(r.montant)}
                        </td>
                        <td
                          className="px-4 py-3 text-sm font-bold whitespace-nowrap"
                          style={{ color: '#f97316', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {fmtMontant(wim)}
                        </td>
                        <td
                          className="px-4 py-3 text-sm font-bold whitespace-nowrap"
                          style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {fmtMontant(fraisOp)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { Download, Printer, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Toast from '../components/Toast'
import { fmtMontant, fmtDate } from '../lib/helpers'

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const ANNEE_COURANTE = new Date().getFullYear()
const MOIS_COURANT = new Date().getMonth() + 1

const SOURCE_CONFIG = [
  { key: 'dons',    label: 'Dons & campagnes',  table: 'dons' },
  { key: 'messes',  label: 'Demandes de messe', table: 'messe_demandes' },
  { key: 'casuels', label: 'Casuels',            table: 'casuel_demandes' },
  { key: 'podcasts',label: 'Podcasts',           table: 'podcast_achats' },
]
// Denier du culte traité à part (pas de colonne frais_plateforme dans la table)
const FRAIS_DENIER_PLAT = 200
const FRAIS_DENIER_MM   = 30

function padZ(n) { return String(n).padStart(2, '0') }
function monthRange(year, month) {
  const start = `${year}-${padZ(month)}-01T00:00:00`
  const nextM = month === 12 ? 1 : month + 1
  const nextY = month === 12 ? year + 1 : year
  const end = `${nextY}-${padZ(nextM)}-01T00:00:00`
  return { start, end }
}

export default function Facturation() {
  const [annee, setAnnee] = useState(ANNEE_COURANTE)
  const [mois, setMois] = useState(MOIS_COURANT)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [showInvoice, setShowInvoice] = useState(false)
  const invoiceRef = useRef(null)

  const annees = Array.from({ length: 4 }, (_, i) => ANNEE_COURANTE - i)

  const load = useCallback(async () => {
    setLoading(true)
    const { start, end } = monthRange(annee, mois)
    const all = []

    for (const src of SOURCE_CONFIG) {
      const { data, error } = await supabase
        .from(src.table)
        .select('user_id, montant, frais_plateforme, frais_mobile_money, operateur_paiement, created_at')
        .gte('created_at', start)
        .lt('created_at', end)
        .not('frais_plateforme', 'is', null)
        .order('created_at', { ascending: false })

      if (error) { console.error(src.table, error); continue }
      ;(data || []).forEach(r => all.push({
        source: src.label,
        user_id: r.user_id,
        nom: null,
        telephone: null,
        montant: r.montant || 0,
        frais_plateforme: r.frais_plateforme || 0,
        frais_mobile_money: r.frais_mobile_money || 0,
        operateur: r.operateur_paiement || '—',
        date: r.created_at,
      }))
    }

    // Denier du culte (frais fixes : 200 FCFA admin + 30 FCFA opérateur)
    const { data: denierData } = await supabase
      .from('denier_culte')
      .select('user_id, montant, operateur_paiement, created_at')
      .gte('created_at', start)
      .lt('created_at', end)
      .eq('statut', 'paye')
      .order('created_at', { ascending: false })
    ;(denierData || []).forEach(r => all.push({
      source: 'Denier du culte',
      user_id: r.user_id,
      nom: null,
      telephone: null,
      montant: r.montant || 0,
      frais_plateforme: FRAIS_DENIER_PLAT,
      frais_mobile_money: FRAIS_DENIER_MM,
      operateur: r.operateur_paiement || '—',
      date: r.created_at,
    }))

    const allIds = [...new Set(all.map(r => r.user_id).filter(Boolean))]
    let profsMap = {}
    if (allIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, nom, telephone').in('id', allIds)
      ;(profs || []).forEach(p => { profsMap[p.id] = { nom: p.nom, telephone: p.telephone } })
    }
    all.forEach(r => {
      r.nom = profsMap[r.user_id]?.nom || 'Anonyme'
      r.telephone = profsMap[r.user_id]?.telephone || '—'
    })

    all.sort((a, b) => new Date(b.date) - new Date(a.date))
    setRows(all)
    setLoading(false)
  }, [annee, mois])

  useEffect(() => { load() }, [load])

  // ── Agrégats ──────────────────────────────────────────────────────
  // frais_plateforme → WebIvoire Media (facturé)
  // frais_mobile_money → opérateur mobile (Orange, MTN…) — affiché en info seulement
  const totalFraisPlat = rows.reduce((s, r) => s + r.frais_plateforme, 0)
  const totalFraisMM   = rows.reduce((s, r) => s + r.frais_mobile_money, 0)
  const totalNet       = rows.reduce((s, r) => s + r.montant, 0)

  // Breakdown par source
  const bySource = [...SOURCE_CONFIG.map(s => s.label), 'Denier du culte'].map(label => {
    const srRows = rows.filter(r => r.source === label)
    return {
      label,
      nb: srRows.length,
      net: srRows.reduce((sum, r) => sum + r.montant, 0),
      frais_plat: srRows.reduce((sum, r) => sum + r.frais_plateforme, 0),
      frais_mm: srRows.reduce((sum, r) => sum + r.frais_mobile_money, 0),
    }
  }).filter(s => s.nb > 0)

  // ── Export CSV ────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = ['Date','Service','Paroissien','Téléphone','Montant net cathédrale (FCFA)','Frais WebIvoire (200 FCFA)','Frais opérateur (info)','Total facturé','Opérateur']
    const body = rows.map(r => [
      fmtDate(r.date), r.source, r.nom, r.telephone || '—', r.montant, r.frais_plateforme, r.frais_mobile_money,
      r.montant + r.frais_plateforme + r.frais_mobile_money, r.operateur,
    ])
    const footer = ['TOTAL','','','','',totalFraisPlat, totalFraisMM, rows.reduce((s, r) => s + r.montant + r.frais_plateforme + r.frais_mobile_money, 0),'']
    const csv = [header, ...body, footer].map(row => row.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv, { type: 'text/csv;charset=utf-8' }]))
    a.download = `facture_webivoire_${annee}_${padZ(mois)}.csv`
    a.click()
  }

  // ── Impression facture ─────────────────────────────────────────────
  const printInvoice = () => {
    const w = window.open('', '_blank', 'width=900,height=700')
    const invoiceNum = `FACT-${annee}-${padZ(mois)}`
    const periodLabel = `${MOIS_LABELS[mois - 1]} ${annee}`
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Facture ${invoiceNum}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 48px; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #1A237E; padding-bottom: 24px; }
        .logo-area h1 { font-size: 20px; font-weight: 800; color: #1A237E; }
        .logo-area p { font-size: 11px; color: #888; margin-top: 2px; }
        .invoice-meta { text-align: right; }
        .invoice-meta h2 { font-size: 26px; font-weight: 900; color: #8B1A2E; letter-spacing: 0.04em; }
        .invoice-meta p { font-size: 11px; color: #666; margin-top: 3px; }
        .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 36px; }
        .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #aaa; margin-bottom: 8px; }
        .party p { font-size: 13px; line-height: 1.6; }
        .party strong { font-size: 14px; font-weight: 700; color: #1a1a2e; }
        .period-box { background: #F8F5F0; border-left: 4px solid #D4A017; padding: 12px 16px; margin-bottom: 32px; border-radius: 0 8px 8px 0; }
        .period-box p { font-size: 12px; color: #666; } .period-box strong { font-size: 14px; color: #1a1a2e; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        thead tr { background: #1A237E; color: white; }
        thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
        tbody tr:nth-child(even) { background: #F8F5F0; }
        tbody td { padding: 9px 14px; font-size: 12px; border-bottom: 1px solid #ede9e3; }
        tfoot tr { background: #1A237E; color: white; font-weight: 700; }
        tfoot td { padding: 12px 14px; font-size: 13px; }
        .total-box { display: flex; justify-content: flex-end; margin-top: 8px; }
        .total-inner { background: #8B1A2E; color: white; padding: 16px 28px; border-radius: 12px; text-align: right; min-width: 260px; }
        .total-inner p { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.8; }
        .total-inner strong { font-size: 24px; font-weight: 900; display: block; margin-top: 4px; }
        .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; text-align: center; }
        @media print { body { padding: 24px; } }
      </style>
    </head><body>
      <div class="header">
        <div class="logo-area">
          <h1>✝ WebIvoire Media</h1>
          <p>Plateforme de services paroissiaux numériques</p>
        </div>
        <div class="invoice-meta">
          <h2>FACTURE</h2>
          <p><strong>N°</strong> ${invoiceNum}</p>
          <p><strong>Date d'émission :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <h3>Émis par</h3>
          <strong>WebIvoire Media</strong>
          <p>Société de services numériques<br>Abidjan, Côte d'Ivoire</p>
        </div>
        <div class="party">
          <h3>Destinataire</h3>
          <strong>Paroisse Saint André de Yopougon</strong>
          <p>Cathédrale Saint André<br>Yopougon, Abidjan</p>
        </div>
      </div>

      <div class="period-box">
        <p>Objet : Frais d'utilisation de la plateforme paroissiale numérique</p>
        <strong>Période : ${periodLabel}</strong>
      </div>

      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Nb transactions</th>
            <th>Tarif unitaire</th>
            <th>Frais plateforme WebIvoire</th>
          </tr>
        </thead>
        <tbody>
          ${bySource.map(s => `
            <tr>
              <td>${s.label}</td>
              <td>${s.nb}</td>
              <td>200 FCFA / transaction</td>
              <td><strong>${s.frais_plat.toLocaleString('fr-FR')} FCFA</strong></td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">TOTAL (${rows.length} transactions)</td>
            <td></td>
            <td>${totalFraisPlat.toLocaleString('fr-FR')} FCFA</td>
          </tr>
        </tfoot>
      </table>

      <p style="font-size:11px;color:#aaa;margin-bottom:16px;">
        * Les frais Mobile Money (prélevés par l'opérateur) ne sont pas inclus dans cette facture — ils sont déduits directement par Orange/MTN au moment du paiement.
      </p>

      <div class="total-box">
        <div class="total-inner">
          <p>Montant total à régler</p>
          <strong>${totalFraisPlat.toLocaleString('fr-FR')} FCFA</strong>
        </div>
      </div>

      <div class="footer">
        <p>WebIvoire Media — Facture générée automatiquement depuis le backoffice paroissial</p>
        <p>Document de référence ${invoiceNum} — Période ${periodLabel}</p>
      </div>

      <script>window.onload=()=>window.print()</script>
    </body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── En-tête ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Revenus & Facturation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Revenus nets de la cathédrale + frais de plateforme dus à WebIvoire Media (200 FCFA / transaction)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={printInvoice}
            disabled={rows.length === 0}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: '#8B1A2E', boxShadow: '0 2px 8px rgba(139,26,46,0.25)' }}
          >
            <Printer size={15} /> Générer la facture
          </button>
        </div>
      </div>

      {/* ── Sélecteur période ────────────────────────────────────── */}
      <div className="flex gap-3">
        <select
          value={mois}
          onChange={e => setMois(parseInt(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          {MOIS_LABELS.map((l, i) => <option key={i + 1} value={i + 1}>{l}</option>)}
        </select>
        <select
          value={annee}
          onChange={e => setAnnee(parseInt(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="flex items-center px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-500"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <FileText size={13} className="mr-2 text-gray-400" />
          Facture N° FACT-{annee}-{padZ(mois)}
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Transactions', value: rows.length, color: '#1A237E', fmt: v => v },
          { label: 'Montant net cathédrale', value: totalNet, color: '#15803d', fmt: fmtMontant },
          { label: 'Frais opérateurs mobile (info)', value: totalFraisMM, color: '#6b7280', fmt: fmtMontant },
          { label: 'Total à facturer WebIvoire', value: totalFraisPlat, color: '#8B1A2E', fmt: fmtMontant },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 relative overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: s.color }} />
            <p className="text-xs font-semibold uppercase tracking-widest pl-2 mb-1"
              style={{ color: '#b0a99f', fontSize: 10 }}>{s.label}</p>
            <p className="text-xl font-bold pl-2" style={{ fontFamily: 'Playfair Display, Georgia, serif', color: s.color }}>
              {loading ? '…' : s.fmt(s.value)}
            </p>
          </div>
        ))}
      </div>

      {/* ── Répartition par service ──────────────────────────────── */}
      {!loading && bySource.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #ede9e3' }}>
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid #ede9e3', backgroundColor: '#FAF8F5' }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Répartition par service</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #ede9e3' }}>
                {[
                  'Service',
                  'Transactions',
                  'Revenus cathédrale',
                  'Frais WebIvoire (200 FCFA × n)',
                  'Frais opérateurs (info)',
                  'Dû à WebIvoire',
                ].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                    style={{ color: '#b0a99f', fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bySource.map((s) => (
                <tr key={s.label}
                  style={{ borderBottom: '1px solid #f5f1ec' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FDFAF7')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td className="px-5 py-3 text-sm font-semibold text-gray-800">{s.label}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{s.nb}</td>
                  <td className="px-5 py-3 text-sm font-bold" style={{ color: '#15803d' }}>{fmtMontant(s.net)}</td>
                  <td className="px-5 py-3 text-sm font-medium" style={{ color: '#D4A017' }}>{fmtMontant(s.frais_plat)}</td>
                  <td className="px-5 py-3 text-sm text-gray-400 italic">{fmtMontant(s.frais_mm)}</td>
                  <td className="px-5 py-3 text-sm font-bold" style={{ color: '#8B1A2E' }}>{fmtMontant(s.frais_plat)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#1A237E' }}>
                <td className="px-5 py-3.5 text-sm font-bold text-white">TOTAL ({rows.length} transactions)</td>
                <td className="px-5 py-3.5 text-sm text-white/80">{rows.length}</td>
                <td className="px-5 py-3.5 text-sm font-bold text-white">{fmtMontant(totalNet)}</td>
                <td className="px-5 py-3.5 text-sm font-bold text-white">{fmtMontant(totalFraisPlat)}</td>
                <td className="px-5 py-3.5 text-sm text-white/60 italic">{fmtMontant(totalFraisMM)}</td>
                <td className="px-5 py-3.5 text-sm font-bold text-white">{fmtMontant(totalFraisPlat)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Détail transaction par transaction ──────────────────── */}
      <div>
        <h2 className="section-title mb-4">Détail des transactions</h2>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 skeleton rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <p className="text-4xl mb-3">∅</p>
            <p className="text-gray-500 text-sm">Aucune transaction avec frais pour {MOIS_LABELS[mois - 1]} {annee}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #ede9e3' }}>
                  {['Date','Service','Paroissien','Téléphone','Montant cathédrale','Frais WebIvoire','Frais opérateur (info)','Total facturé','Opérateur'].map(h => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                      style={{ color: '#b0a99f', fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}
                    style={{ borderBottom: '1px solid #f5f1ec' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FDFAF7')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#eef0fb', color: '#1A237E' }}>{r.source}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.nom}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.telephone || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#15803d' }}>{fmtMontant(r.montant)}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: '#8B1A2E' }}>{fmtMontant(r.frais_plateforme)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 italic">{fmtMontant(r.frais_mobile_money)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtMontant(r.montant + r.frais_plateforme + r.frais_mobile_money)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.operateur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

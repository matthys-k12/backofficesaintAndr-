import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Mail, Heart, TrendingUp, ArrowRight } from 'lucide-react'
import { supabase, q } from '../lib/supabase'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import SetupDiag from '../components/SetupDiag'
import { fmtMontant, fmtDate } from '../lib/helpers'
import { subDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUT_LABELS = { en_attente: 'En attente', validee: 'Validée', annulee: 'Annulée' }

// Couleur d'avatar déterministe
const AV_COLORS = ['#8B1A2E', '#1A237E', '#15803d', '#b45309', '#6d28d9', '#0369a1']
function avColor(str = '') { return AV_COLORS[(str.charCodeAt(0) || 0) % AV_COLORS.length] }

function Avatar({ name = '?' }) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: avColor(name) }}>
      {initials}
    </div>
  )
}

// Tooltip Recharts personnalisé
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl px-3 py-2 text-xs"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #ede9e3' }}>
      <p className="font-semibold text-gray-700">{label}</p>
      <p style={{ color: '#8B1A2E' }}>{payload[0].value} demande{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ users: 0, messes: 0, dons: 0 })
  const [chartData, setChartData] = useState([])
  const [derniersMesses, setDerniersMesses] = useState([])
  const [derniersDons, setDerniersDons] = useState([])
  const [campagnes, setCampagnes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const startMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [users, messes, dons, campagnesData, chartRaw, dernMesses, dernDons] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('messe_demandes').select('id', { count: 'exact', head: true }).gte('created_at', startMois),
        supabase.from('dons').select('montant').in('statut', ['en_attente', 'valide', 'validee']),
        supabase.from('don_campagnes').select('*').eq('est_actif', true),
        supabase.from('messe_demandes').select('created_at').gte('created_at', subDays(now, 7).toISOString()),
        supabase.from('messe_demandes').select('*, profiles(nom, telephone)').order('created_at', { ascending: false }).limit(5),
        supabase.from('dons').select('*, don_campagnes(titre)').order('created_at', { ascending: false }).limit(5),
      ])

      const totalDons = (dons.data || []).reduce((s, d) => s + (d.montant || 0), 0)

      const days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(now, 6 - i)
        const dateStr = format(d, 'yyyy-MM-dd')
        const count = (chartRaw.data || []).filter(m => m.created_at?.startsWith(dateStr)).length
        return { date: format(d, 'EEE', { locale: fr }), demandes: count }
      })

      setStats({ users: users.count || 0, messes: messes.count || 0, dons: totalDons })
      setChartData(days)
      setCampagnes(campagnesData.data || [])
      setDerniersMesses(dernMesses.data || [])
      setDerniersDons(dernDons.data || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <SetupDiag />

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Utilisateurs inscrits" value={loading ? '…' : stats.users.toLocaleString()} icon={Users} color="bg-blue-900" />
        <StatCard title="Messes ce mois" value={loading ? '…' : stats.messes.toLocaleString()} icon={Mail} color="bg-red-800" />
        <StatCard title="Total des dons" value={loading ? '…' : fmtMontant(stats.dons)} icon={Heart} color="bg-green-700" />
        <StatCard title="Campagnes actives" value={loading ? '…' : campagnes.length.toString()} icon={TrendingUp} color="bg-yellow-600" />
      </div>

      {/* ── Graphique ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-6"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="section-title">Activité des 7 derniers jours</h3>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="demandes"
              stroke="#8B1A2E"
              strokeWidth={2.5}
              dot={{ fill: '#8B1A2E', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#8B1A2E', strokeWidth: 0 }}
              name="Demandes de messe"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Deux colonnes ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Dernières demandes de messe */}
        <div className="bg-white rounded-xl p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Dernières demandes</h3>
            <button
              onClick={() => navigate('/messes')}
              className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: '#8B1A2E' }}
            >
              Voir tout <ArrowRight size={13} />
            </button>
          </div>
          <div className="space-y-1">
            {derniersMesses.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Aucune demande</p>
            ) : derniersMesses.map((m) => {
              const nom = m.profiles?.nom || m.user_id?.slice(0, 8) || '?'
              return (
                <div key={m.id}
                  className="flex items-center gap-3 py-2.5 rounded-lg px-2 -mx-2 transition-colors"
                  style={{ borderBottom: '1px solid #f5f1ec' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fdfaf7')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Avatar name={nom} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{nom}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {m.type_messe?.replace(/_/g, ' ')} · {fmtDate(m.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-700">{fmtMontant(m.montant)}</span>
                    <Badge label={STATUT_LABELS[m.statut] || m.statut} value={m.statut} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Dons récents */}
        <div className="bg-white rounded-xl p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Dons récents</h3>
            <button
              onClick={() => navigate('/dons')}
              className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: '#8B1A2E' }}
            >
              Voir tout <ArrowRight size={13} />
            </button>
          </div>
          <div className="space-y-1">
            {derniersDons.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Aucun don</p>
            ) : derniersDons.map((d) => {
              const label = d.don_campagnes?.titre || 'Don libre'
              return (
                <div key={d.id}
                  className="flex items-center gap-3 py-2.5 rounded-lg px-2 -mx-2 transition-colors"
                  style={{ borderBottom: '1px solid #f5f1ec' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fdfaf7')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Avatar name={label} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
                    <p className="text-xs text-gray-400">{d.operateur_paiement} · {fmtDate(d.created_at)}</p>
                  </div>
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: '#15803d' }}>
                    +{fmtMontant(d.montant)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Progression campagnes ─────────────────────────────── */}
      {campagnes.filter(c => c.objectif > 0).length > 0 && (
        <div className="bg-white rounded-xl p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
          <h3 className="section-title mb-5">Progression des campagnes</h3>
          <div className="space-y-5">
            {campagnes.filter(c => c.objectif > 0).map((c) => {
              const pct = Math.min(100, Math.round(((c.montant_collecte || 0) / c.objectif) * 100))
              const collected = fmtMontant(c.montant_collecte || 0)
              const goal = fmtMontant(c.objectif)
              return (
                <div key={c.id}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-semibold text-gray-800">{c.titre}</span>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {collected} <span className="text-gray-300">/</span> {goal}
                      <span
                        className="ml-2 font-bold"
                        style={{ color: pct >= 100 ? '#15803d' : '#D4A017' }}
                      >
                        {pct}%
                      </span>
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pct >= 100 ? '#15803d' : '#D4A017',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Composant de diagnostic — affiché dans le Dashboard.
// Teste la connexion Supabase, vérifie les tables et crée les buckets manquants.

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, RefreshCw, HardDrive } from 'lucide-react'
import { supabase } from '../lib/supabase'

const BUCKETS_NEEDED = ['annonces', 'actualites', 'saints', 'podcasts', 'carrousel']
const TABLES_NEEDED  = ['profiles', 'annonces', 'actualites', 'don_campagnes', 'dons',
                        'messe_horaires', 'messe_demandes', 'casuel_tarifs', 'casuel_demandes']

export default function SetupDiag() {
  const [status, setStatus]   = useState('idle')  // idle | loading | done | error
  const [conn,   setConn]     = useState(null)     // true | false
  const [tables, setTables]   = useState({})       // { tableName: true|false }
  const [buckets, setBuckets] = useState({})       // { bucketName: 'ok'|'missing'|'created'|'error' }
  const [log,    setLog]      = useState([])

  const addLog = (msg, type = 'info') =>
    setLog(prev => [...prev, { msg, type, t: new Date().toLocaleTimeString() }])

  const runDiag = async () => {
    setStatus('loading')
    setLog([])
    setConn(null)
    setTables({})
    setBuckets({})

    // ── 1. Test connexion de base ────────────────────────────────────
    addLog('Test de connexion Supabase…')
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1)
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = table vide, c'est OK
        if (error.message.includes('does not exist')) {
          addLog('Connexion OK — table profiles absente (run le SQL setup)', 'warn')
          setConn(true)
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          addLog('❌ Impossible de joindre Supabase — vérifiez VITE_SUPABASE_URL dans .env', 'error')
          setConn(false)
          setStatus('done')
          return
        } else {
          addLog(`Connexion OK (${error.message})`, 'warn')
          setConn(true)
        }
      } else {
        addLog('✓ Connexion Supabase OK', 'ok')
        setConn(true)
      }
    } catch (e) {
      addLog('❌ Erreur réseau : ' + e.message, 'error')
      setConn(false)
      setStatus('done')
      return
    }

    // ── 2. Vérifier les tables ───────────────────────────────────────
    addLog('Vérification des tables…')
    const tableResults = {}
    for (const t of TABLES_NEEDED) {
      const { error } = await supabase.from(t).select('id').limit(1)
      const exists = !error || error.code === 'PGRST116'
      tableResults[t] = exists
      if (!exists) addLog(`⚠ Table "${t}" absente`, 'warn')
    }
    setTables(tableResults)
    const missingTables = TABLES_NEEDED.filter(t => !tableResults[t])
    if (missingTables.length === 0) addLog('✓ Toutes les tables sont présentes', 'ok')
    else addLog(`${missingTables.length} table(s) manquante(s) — run supabase_setup.sql`, 'warn')

    // ── 3. Vérifier les buckets Storage (lecture seule — création via SQL)
    addLog('Vérification des buckets Storage…')
    const { data: existingBuckets = [] } = await supabase.storage.listBuckets()
    const existingNames = (existingBuckets || []).map(b => b.name)

    const bucketResults = {}
    for (const bucket of BUCKETS_NEEDED) {
      if (existingNames.includes(bucket)) {
        bucketResults[bucket] = 'ok'
        addLog(`✓ Bucket "${bucket}" existe`, 'ok')
      } else {
        bucketResults[bucket] = 'missing'
        addLog(`⚠ Bucket "${bucket}" manquant — run le SQL setup`, 'warn')
      }
    }
    setBuckets(bucketResults)

    addLog('Diagnostic terminé.')
    setStatus('done')
  }

  // Lance le diagnostic au montage
  useEffect(() => { runDiag() }, [])

  const allGood = conn === true
    && Object.values(tables).every(v => v)
    && Object.values(buckets).every(v => v === 'ok')

  if (allGood && status === 'done') return null // Cache le composant si tout est OK

  return (
    <div className="rounded-xl border p-5 mb-6"
      style={{ backgroundColor: '#fff8e1', borderColor: '#fbbf24' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} style={{ color: '#d97706' }} />
          <span className="font-semibold text-sm" style={{ color: '#92400e' }}>
            Diagnostic de configuration
          </span>
        </div>
        <button onClick={runDiag} disabled={status === 'loading'}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-50">
          <RefreshCw size={12} className={status === 'loading' ? 'animate-spin' : ''} />
          {status === 'loading' ? 'En cours…' : 'Relancer'}
        </button>
      </div>

      {/* Statut connexion */}
      {conn !== null && (
        <div className="flex items-center gap-2 mb-2">
          {conn
            ? <CheckCircle size={14} className="text-green-600" />
            : <XCircle size={14} className="text-red-600" />}
          <span className="text-xs text-gray-700">
            Connexion Supabase : <strong>{conn ? 'OK' : 'ÉCHEC'}</strong>
          </span>
        </div>
      )}

      {/* Tables */}
      {Object.keys(tables).length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-600 mb-1">Tables :</p>
          <div className="flex flex-wrap gap-1.5">
            {TABLES_NEEDED.map(t => (
              <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                tables[t] ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Buckets */}
      {Object.keys(buckets).length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-600 mb-1">Buckets Storage :</p>
          <div className="flex flex-wrap gap-1.5">
            {BUCKETS_NEEDED.map(b => (
              <span key={b} className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                buckets[b] === 'ok' ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'}`}>
                {b} {buckets[b] === 'missing' ? '⚠' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Log détaillé */}
      {log.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-amber-700 cursor-pointer select-none">Voir les détails</summary>
          <div className="mt-2 bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto">
            {log.map((l, i) => (
              <div key={i} className={`text-xs font-mono mb-0.5 ${
                l.type === 'ok' ? 'text-green-400'
                : l.type === 'error' ? 'text-red-400'
                : l.type === 'warn' ? 'text-yellow-400'
                : 'text-gray-300'}`}>
                [{l.t}] {l.msg}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Message tables manquantes */}
      {Object.values(tables).some(v => !v) && (
        <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-700">
          <strong>Tables manquantes détectées.</strong> Exécute le fichier{' '}
          <code className="bg-red-100 px-1 rounded">supabase_setup.sql</code>{' '}
          dans <strong>Supabase → SQL Editor</strong>.
        </div>
      )}

      {/* Message buckets manquants */}
      {Object.values(buckets).some(v => v === 'missing') && (
        <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-xs text-yellow-800">
          <strong>Buckets Storage manquants.</strong> Les buckets ne peuvent pas être créés
          automatiquement (restriction Supabase). Exécute ce SQL dans{' '}
          <strong>Supabase → SQL Editor</strong> :
          <pre className="mt-2 bg-yellow-100 rounded p-2 overflow-x-auto whitespace-pre-wrap leading-relaxed">{`INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('annonces',   'annonces',   true, 52428800, ARRAY['image/jpeg','image/png','image/webp']),
  ('actualites', 'actualites', true, 52428800, ARRAY['image/jpeg','image/png','image/webp']),
  ('saints',     'saints',     true, 52428800, ARRAY['image/jpeg','image/png','image/webp']),
  ('podcasts',   'podcasts',   true, 52428800, ARRAY['audio/mpeg','audio/mp4','audio/wav']),
  ('carrousel',  'carrousel',  true, 52428800, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;`}</pre>
        </div>
      )}
    </div>
  )
}

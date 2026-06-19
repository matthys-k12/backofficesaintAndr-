// Page publique de partage — accessible sans authentification.
// Affiche le contenu d'une actualité / saint / texte du jour
// et propose un bouton "Ouvrir dans l'app" qui lance saintandre://...
// Ce lien HTTPS est cliquable dans WhatsApp, contrairement aux schemes custom.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Icône croix ──────────────────────────────────────────────────────
function Cross({ size = 28, color = '#8B1A2E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v20M2 12h20"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Spinner ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen"
      style={{ background: '#FAF8F6' }}>
      <div
        className="w-10 h-10 border-4 rounded-full animate-spin mb-4"
        style={{ borderColor: '#E8D8D8', borderTopColor: '#8B1A2E' }}
      />
      <p className="text-sm" style={{ color: '#9B7A7A' }}>Chargement…</p>
    </div>
  )
}

// ── Header commun ────────────────────────────────────────────────────
function Header() {
  return (
    <div className="flex items-center gap-3 mb-8 pb-6"
      style={{ borderBottom: '1px solid #E8D0D0' }}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #8B1A2E, #6B1222)' }}
      >
        <Cross size={18} color="white" />
      </div>
      <div>
        <p className="text-xs font-bold tracking-widest uppercase"
          style={{ color: '#8B1A2E', letterSpacing: '0.12em' }}>
          Cathédrale Saint André
        </p>
        <p className="text-xs" style={{ color: '#B09090' }}>Yopougon</p>
      </div>
    </div>
  )
}

// ── Bouton principal "Ouvrir dans l'app" ─────────────────────────────
function BoutonApp({ deepLink, label = "Ouvrir dans l'app" }) {
  const [etat, setEtat] = useState('idle') // idle | essai | echec

  const ouvrir = () => {
    setEtat('essai')
    window.location.href = deepLink

    // Si après 2s on est toujours ici → app probablement pas installée
    setTimeout(() => {
      if (document.visibilityState !== 'hidden') {
        setEtat('echec')
      }
    }, 2000)
  }

  return (
    <div>
      <button
        onClick={ouvrir}
        className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #8B1A2E, #6B1222)',
          boxShadow: '0 4px 20px rgba(139,26,46,0.3)',
        }}
      >
        <span style={{ fontSize: 20 }}>📱</span>
        {label}
      </button>

      {etat === 'echec' && (
        <div
          className="mt-4 p-4 rounded-xl text-sm text-center"
          style={{ background: '#FFF3F3', border: '1px solid #FFCECE', color: '#8B1A2E' }}
        >
          <p className="font-semibold mb-1">L'app n'est pas installée</p>
          <p style={{ color: '#B07070' }}>
            Demandez l'APK à la paroisse pour accéder à ce contenu.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Badge catégorie ──────────────────────────────────────────────────
function BadgeCat({ cat }) {
  const map = {
    vie_paroisse: { label: 'Vie de la paroisse', color: '#8B1A2E' },
    evenements:   { label: 'Événements',          color: '#C9922A' },
    social:       { label: 'Social',               color: '#1D9E75' },
    liturgie:     { label: 'Liturgie',             color: '#185FA5' },
  }
  const info = map[cat] || { label: 'Actualité', color: '#8B1A2E' }
  return (
    <span
      className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
      style={{ background: info.color + '18', color: info.color, letterSpacing: '0.08em' }}
    >
      {info.label}
    </span>
  )
}

// ── Format date ──────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Page Actualité ───────────────────────────────────────────────────
function PageActualite({ id }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('actualites')
      .select('*, actualite_photos(*)')
      .eq('id', id)
      .single()
      .then(({ data: d }) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F6' }}>
      <div className="max-w-lg mx-auto px-6 py-8">
        <Header />

        {data ? (
          <>
            {/* Hero photo */}
            {data.actualite_photos?.length > 0 && (
              <div
                className="w-full h-52 rounded-2xl mb-6 overflow-hidden"
                style={{ background: '#E8D0D0' }}
              >
                <img
                  src={[...data.actualite_photos].sort((a, b) => a.ordre - b.ordre)[0]?.url}
                  alt={data.titre}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Badge + date */}
            <div className="flex items-center gap-3 mb-3">
              <BadgeCat cat={data.categorie} />
              <span className="text-xs" style={{ color: '#B09090' }}>
                {formatDate(data.created_at)}
              </span>
            </div>

            {/* Titre */}
            <h1
              className="text-2xl font-bold mb-4 leading-snug"
              style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}
            >
              {data.titre}
            </h1>

            {/* Séparateur */}
            <div className="w-10 h-1 rounded mb-6" style={{ background: '#8B1A2E' }} />

            {/* Article (extrait) */}
            <p className="text-sm leading-relaxed mb-8" style={{ color: '#444', lineHeight: 1.9 }}>
              {data.article?.slice(0, 400)}{data.article?.length > 400 ? '…' : ''}
            </p>

            {data.actualite_photos?.length > 1 && (
              <p className="text-xs mb-4 text-center" style={{ color: '#B09090' }}>
                📸 {data.actualite_photos.length} photos disponibles dans l'app
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-4xl mb-4">📰</p>
            <p className="font-semibold mb-2" style={{ color: '#1A1A1A' }}>
              Article partagé
            </p>
            <p className="text-sm mb-8" style={{ color: '#888' }}>
              Ouvrez l'app pour lire le contenu complet.
            </p>
          </div>
        )}

        <BoutonApp
          deepLink={`saintandre://actualites/${id}`}
          label="Lire l'article complet dans l'app"
        />
      </div>
    </div>
  )
}

// ── Page Saint du Jour ───────────────────────────────────────────────
function PageSaintJour() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('saint_jour')
      .select()
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data: d }) => { setData(d?.[0] || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F6' }}>
      <div className="max-w-lg mx-auto px-6 py-8">
        <Header />

        {/* Kicker */}
        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: '#8B1A2E', letterSpacing: '0.12em' }}
        >
          ✝ Saint du Jour
        </p>

        {data ? (
          <>
            {/* Photo */}
            {data.image_url && (
              <div
                className="w-full h-48 rounded-2xl mb-5 overflow-hidden"
                style={{ background: '#1A3A6B' }}
              >
                <img
                  src={data.image_url}
                  alt={data.nom}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Nom */}
            <h1
              className="text-2xl font-bold mb-1"
              style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}
            >
              🌟 {data.nom}
            </h1>
            {data.sous_titre && (
              <p className="text-sm mb-4" style={{ color: '#888' }}>{data.sous_titre}</p>
            )}

            <div className="w-10 h-1 rounded mb-5" style={{ background: '#8B1A2E' }} />

            {/* Citation */}
            {data.citation && (
              <div
                className="p-5 rounded-xl mb-6"
                style={{
                  background: '#FFF8E8',
                  borderLeft: '4px solid #8B1A2E',
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: '#8B1A2E' }}>
                  Citation
                </p>
                <p className="text-base italic leading-relaxed" style={{ color: '#333' }}>
                  « {data.citation} »
                </p>
              </div>
            )}

            {/* Extrait bio */}
            {data.biographie && (
              <p className="text-sm leading-relaxed mb-8" style={{ color: '#444', lineHeight: 1.9 }}>
                {data.biographie.slice(0, 350)}…
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🌟</p>
            <p className="font-semibold mb-6" style={{ color: '#1A1A1A' }}>
              Découvrez le saint du jour dans l'app
            </p>
          </div>
        )}

        <BoutonApp
          deepLink="saintandre://saint-du-jour"
          label="Lire la biographie complète dans l'app"
        />
      </div>
    </div>
  )
}

// ── Page Texte du Jour ───────────────────────────────────────────────
function PageTexteJour() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('texte_jour')
      .select()
      .eq('date_lecture', today)
      .limit(1)
      .then(({ data: d }) => {
        if (d?.length) { setData(d[0]); setLoading(false); return }
        return supabase.from('texte_jour').select()
          .order('date_lecture', { ascending: false }).limit(1)
      })
      .then((r) => { if (r) { setData(r.data?.[0] || null); setLoading(false) } })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div className="min-h-screen" style={{ background: '#FAF8F6' }}>
      <div className="max-w-lg mx-auto px-6 py-8">
        <Header />

        <p
          className="text-xs font-bold tracking-widest uppercase mb-2"
          style={{ color: '#8B1A2E', letterSpacing: '0.12em' }}
        >
          📖 Texte du Jour
        </p>

        {data ? (
          <>
            <h1
              className="text-2xl font-bold mb-1 leading-snug"
              style={{ fontFamily: 'Georgia, serif', color: '#1A1A1A' }}
            >
              {data.titre}
            </h1>
            <p className="text-sm font-semibold mb-4" style={{ color: '#8B1A2E' }}>
              {data.reference}
            </p>

            <div className="w-10 h-1 rounded mb-5" style={{ background: '#8B1A2E' }} />

            {data.evangile && (
              <div
                className="p-5 rounded-xl mb-6"
                style={{ background: '#8B1A2E', color: 'white' }}
              >
                <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">
                  Évangile du Jour
                </p>
                <p className="text-sm italic leading-relaxed">
                  « {data.evangile} »
                </p>
              </div>
            )}

            <p className="text-sm leading-relaxed mb-8" style={{ color: '#444', lineHeight: 1.9 }}>
              {data.contenu?.slice(0, 350)}…
            </p>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📖</p>
            <p className="font-semibold mb-6" style={{ color: '#1A1A1A' }}>
              Découvrez le texte du jour dans l'app
            </p>
          </div>
        )}

        <BoutonApp
          deepLink="saintandre://texte-du-jour"
          label="Lire la lecture complète dans l'app"
        />
      </div>
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────────────
export default function Partage() {
  const { type, id } = useParams()

  if (type === 'actualites' && id) return <PageActualite id={id} />
  if (type === 'saint-du-jour')    return <PageSaintJour />
  if (type === 'texte-du-jour')    return <PageTexteJour />

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: '#FAF8F6' }}>
      <div className="text-center px-6">
        <Cross size={40} />
        <p className="font-semibold mt-4" style={{ color: '#1A1A1A' }}>
          Cathédrale Saint André · Yopougon
        </p>
        <p className="text-sm mt-2" style={{ color: '#888' }}>
          Lien invalide ou expiré.
        </p>
      </div>
    </div>
  )
}

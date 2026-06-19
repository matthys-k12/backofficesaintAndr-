// Page pont de redirection — NE FAIT PAS de requête Supabase.
// Rôle unique : rediriger vers saintandre:// dès l'ouverture.
// Si l'app est installée → s'ouvre directement sur le bon écran.
// Si l'app n'est pas installée → message pour l'obtenir.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

function Cross({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2v20M2 12h20" stroke="#8B1A2E" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// Construit le deep link app à partir de la route backoffice
function buildDeepLink(type, id) {
  if (type === 'app')          return 'saintandre://home'
  if (type === 'saint-du-jour') return 'saintandre://saint-du-jour'
  if (type === 'texte-du-jour') return 'saintandre://texte-du-jour'
  if (type === 'actualites' && id) return `saintandre://actualites/${id}`
  if (type === 'annonces'   && id) return `saintandre://annonces/${id}`
  return null
}

// Libellé affiché selon le type de contenu
function labelFor(type) {
  if (type === 'actualites')    return 'l\'actualité'
  if (type === 'annonces')      return 'l\'annonce'
  if (type === 'saint-du-jour') return 'le saint du jour'
  if (type === 'texte-du-jour') return 'le texte du jour'
  return 'l\'application'
}

export default function Partage() {
  const { type, id } = useParams()
  const [etat, setEtat] = useState('ouverture') // ouverture | echec | invalide

  // Détecter /s/app (route sans :type)
  const effectiveType = type || (window.location.pathname.includes('/s/app') ? 'app' : null)
  const deepLink = buildDeepLink(effectiveType, id)

  useEffect(() => {
    if (!deepLink) { setEtat('invalide'); return }

    // Tentative immédiate d'ouverture de l'app
    window.location.href = deepLink

    // Si après 2,5s on est toujours ici → l'app n'est pas installée
    const timer = setTimeout(() => {
      if (document.visibilityState !== 'hidden') setEtat('echec')
    }, 2500)

    // Annuler si l'utilisateur revient à l'onglet depuis l'app
    const onVisible = () => {
      if (document.visibilityState === 'visible') clearTimeout(timer)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [deepLink])

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8"
      style={{ background: '#FAF8F6' }}
    >
      {/* Logo */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'linear-gradient(135deg, #8B1A2E, #6B1222)',
                 boxShadow: '0 8px 32px rgba(139,26,46,0.25)' }}
      >
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <path d="M12 2v20M2 12h20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>

      <p
        className="text-xs font-bold tracking-widest uppercase mb-1"
        style={{ color: '#8B1A2E', letterSpacing: '0.12em' }}
      >
        Cathédrale Saint André
      </p>
      <p className="text-xs mb-10" style={{ color: '#B09090' }}>Yopougon</p>

      {etat === 'ouverture' && (
        <>
          {/* Spinner */}
          <div
            className="w-10 h-10 border-4 rounded-full animate-spin mb-6"
            style={{ borderColor: '#E8D0D0', borderTopColor: '#8B1A2E' }}
          />
          <p className="text-base font-semibold mb-2" style={{ color: '#1A1A1A' }}>
            Ouverture de l'app…
          </p>
          <p className="text-sm text-center" style={{ color: '#888', maxWidth: 260 }}>
            Vous allez être redirigé vers {labelFor(effectiveType)}.
          </p>
        </>
      )}

      {etat === 'echec' && (
        <>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-6"
            style={{ background: '#FFF0F0', border: '2px solid #FFCECE' }}
          >
            <span style={{ fontSize: 28 }}>📱</span>
          </div>
          <p className="text-lg font-bold mb-2 text-center" style={{ color: '#1A1A1A' }}>
            L'app n'est pas installée
          </p>
          <p className="text-sm text-center mb-8" style={{ color: '#888', maxWidth: 280 }}>
            Pour accéder à {labelFor(effectiveType)}, installez l'application
            de la Cathédrale Saint André.
          </p>
          <div
            className="p-5 rounded-2xl text-center w-full"
            style={{
              background: 'white',
              border: '1px solid #F0E8E8',
              maxWidth: 320,
            }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: '#1A1A1A' }}>
              Obtenir l'application
            </p>
            <p className="text-xs" style={{ color: '#888' }}>
              Contactez la paroisse ou demandez le lien de téléchargement
              à un membre de votre communauté.
            </p>
          </div>
        </>
      )}

      {etat === 'invalide' && (
        <>
          <Cross size={36} />
          <p className="text-base font-semibold mt-4 mb-2" style={{ color: '#1A1A1A' }}>
            Lien invalide
          </p>
          <p className="text-sm text-center" style={{ color: '#888' }}>
            Ce lien de partage n'est plus valide ou a expiré.
          </p>
        </>
      )}
    </div>
  )
}

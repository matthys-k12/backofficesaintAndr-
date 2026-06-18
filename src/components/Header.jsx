import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'

const PAGES = {
  '/':            { section: null,       title: 'Tableau de bord' },
  '/messes':      { section: 'Demandes', title: 'Demandes de messe' },
  '/casuels':     { section: 'Demandes', title: 'Casuels' },
  '/dons':        { section: 'Finances', title: 'Dons & campagnes' },
  '/annonces':    { section: 'Contenu',  title: 'Annonces' },
  '/actualites':  { section: 'Contenu',  title: 'Actualités' },
  '/saint-jour':  { section: 'Contenu',  title: 'Saint du jour' },
  '/texte-jour':  { section: 'Contenu',  title: 'Texte du jour' },
  '/podcasts':    { section: 'Contenu',  title: 'Podcasts' },
  '/carrousel':   { section: 'Contenu',  title: 'Carrousel' },
  '/intentions':  { section: 'Contenu',  title: 'Intentions de prière' },
  '/utilisateurs':{ section: 'Gestion',  title: 'Utilisateurs' },
  '/parametres':  { section: 'Gestion',  title: 'Paramètres' },
}

export default function Header() {
  const { pathname } = useLocation()
  const page = PAGES[pathname] || { section: null, title: 'Back Office' }
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) return
      const { data: prof } = await supabase
        .from('profiles')
        .select('nom')
        .eq('id', data.user.id)
        .single()
      setProfile({ email: data.user.email, nom: prof?.nom || null })
    })
  }, [])

  const displayName = profile?.nom || profile?.email?.split('@')[0] || 'Administrateur'
  const initial = displayName[0]?.toUpperCase() || 'A'

  return (
    <header
      className="h-16 bg-white flex items-center justify-between px-6 fixed top-0 right-0 z-30"
      style={{
        left: '240px',
        borderBottom: '1px solid #ede9e3',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* ── Breadcrumb ──────────────────────────────────── */}
      <div>
        {page.section ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 leading-tight mb-0.5"
              style={{ fontSize: 10 }}>
              {page.section}
              <span className="mx-1.5" style={{ color: '#d1c9bf' }}>›</span>
              {page.title}
            </p>
            <h2
              className="text-base font-bold text-gray-900 leading-tight"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              {page.section}
            </h2>
          </>
        ) : (
          <h2
            className="text-lg font-bold text-gray-900"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {page.title}
          </h2>
        )}
      </div>

      {/* ── Actions droite ────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Cloche notifications */}
        <button
          className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ color: '#9ca3af' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f5f3f0'; e.currentTarget.style.color = '#374151' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}
        >
          <Bell size={18} />
        </button>

        <div className="w-px h-6 bg-gray-100" />

        {/* Profil */}
        <div className="flex items-center gap-2.5 cursor-default">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            {initial}
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{displayName}</p>
            {profile?.email && (
              <p className="text-xs text-gray-400 leading-tight">{profile.email}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

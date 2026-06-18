import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, Mail, Receipt, Heart, Megaphone, Newspaper,
  Star, BookOpen, Mic, Images, Users, Settings, HandHeart, LogOut, Coins, FileText, MessageSquare
} from 'lucide-react'

const navItems = [
  {
    section: 'PRINCIPAL',
    items: [{ to: '/', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  {
    section: 'DEMANDES',
    items: [
      { to: '/messes', label: 'Demandes de messe', icon: Mail },
      { to: '/casuels', label: 'Casuels', icon: Receipt },
      { to: '/dons', label: 'Dons & campagnes', icon: Heart },
    ],
  },
  {
    section: 'CONTENU',
    items: [
      { to: '/annonces', label: 'Annonces', icon: Megaphone },
      { to: '/actualites', label: 'Actualités', icon: Newspaper },
      { to: '/saint-jour', label: 'Saint du jour', icon: Star },
      { to: '/texte-jour', label: 'Texte du jour', icon: BookOpen },
      { to: '/podcasts', label: 'Podcasts', icon: Mic },
      { to: '/carrousel', label: 'Carrousel', icon: Images },
      { to: '/intentions', label: 'Intentions de prière', icon: HandHeart },
    ],
  },
  {
    section: 'FINANCES',
    items: [
      { to: '/denier-culte', label: 'Dénier du culte', icon: Coins },
      { to: '/facturation', label: 'Revenus', icon: FileText },
    ],
  },
  {
    section: 'GESTION',
    items: [
      { to: '/utilisateurs', label: 'Utilisateurs', icon: Users },
      { to: '/contact', label: 'Messages & Suggestions', icon: MessageSquare },
      { to: '/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
]

// Couleur d'avatar déterministe selon la lettre initiale
const AVATAR_COLORS = ['#8B1A2E', '#1A237E', '#15803d', '#b45309', '#6d28d9', '#0369a1']
function avatarColor(str = '') {
  return AVATAR_COLORS[str.charCodeAt(0) % AVATAR_COLORS.length]
}

export default function Sidebar() {
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const displayName = profile?.nom || profile?.email?.split('@')[0] || 'Administrateur'
  const initials = displayName.slice(0, 2).toUpperCase()
  const bgColor = avatarColor(displayName)

  return (
    <div
      className="w-60 h-screen flex flex-col fixed left-0 top-0 z-40"
      style={{ backgroundColor: '#1A237E' }}
    >
      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #8B1A2E 0%, #6B1222 100%)',
              boxShadow: '0 3px 12px rgba(139,26,46,0.45)',
            }}
          >
            <span style={{ color: '#D4A017', fontSize: 18, lineHeight: 1 }}>✝</span>
          </div>
          <div className="min-w-0">
            <h1
              className="text-white font-bold text-sm leading-tight"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              Saint André
            </h1>
            <p
              className="text-xs font-semibold tracking-widest"
              style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}
            >
              YOPOUGON
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 sidebar-nav">
        {navItems.map((group) => (
          <div key={group.section} className="mb-5">
            <p
              className="text-xs font-semibold uppercase px-3 mb-2"
              style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em', fontSize: 10 }}
            >
              {group.section}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white'
                      : 'text-white/55 hover:text-white/90 hover:bg-white/[0.06]'
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        backgroundColor: '#8B1A2E',
                        boxShadow: '0 2px 10px rgba(139,26,46,0.45)',
                      }
                    : {}
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={15} style={{ opacity: isActive ? 1 : 0.65, flexShrink: 0 }} />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Profil utilisateur ────────────────────────────── */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate leading-tight">{displayName}</p>
            <p className="text-xs truncate leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
              Administrateur
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex-shrink-0 transition-colors"
            title="Déconnexion"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

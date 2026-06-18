import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { Lock } from 'lucide-react'
import heroImg from '../assets/vitrail.png'

export default function Login() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Si une session existe déjà, aller directement au dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true })
    })
  }, [navigate])

  const onSubmit = async ({ email, password }) => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else navigate('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT — Image + Branding ─────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{
          backgroundImage: `url(${heroImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay dégradé navy */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, rgba(26,35,126,0.92) 0%, rgba(26,35,126,0.78) 100%)' }}
        />

        {/* Logo en haut */}
        <div className="relative z-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8B1A2E, #6B1222)', boxShadow: '0 4px 20px rgba(139,26,46,0.4)' }}
          >
            <span style={{ color: '#D4A017', fontSize: 24, fontWeight: 700 }}>✝</span>
          </div>
        </div>

        {/* Texte central */}
        <div className="relative z-10">
          <h1
            className="text-white leading-tight mb-4"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 38, fontWeight: 700, lineHeight: 1.2 }}
          >
            Cathédrale Saint André<br />
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 32 }}>de Yopougon</span>
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 320 }}>
            Espace d'administration de la paroisse. Gérez les demandes de messe, les dons, les contenus et la vie de la communauté.
          </p>
          <div className="flex items-center gap-2 mt-8">
            <span style={{ color: '#D4A017', fontSize: 14 }}>★</span>
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Jubilé d'Or · 1973 — 2023 · 50 ans
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © 2026 Paroisse Saint André · Tous droits réservés
          </p>
        </div>
      </div>

      {/* ── RIGHT — Formulaire ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">

          {/* Icône cadenas */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-7"
            style={{ backgroundColor: '#8B1A2E', boxShadow: '0 4px 20px rgba(139,26,46,0.25)' }}
          >
            <Lock size={22} color="white" />
          </div>

          <h2
            className="text-gray-900 mb-1"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 32, fontWeight: 700 }}
          >
            Connexion
          </h2>
          <p className="text-sm text-gray-400 mb-8">Accédez à votre tableau de bord.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Adresse e-mail
              </label>
              <input
                type="email"
                {...register('email', { required: 'Email requis' })}
                placeholder="admin@cathedrale-yopougon.ci"
                className="w-full px-4 py-3 rounded-xl border text-sm"
                style={{ borderColor: errors.email ? '#ef4444' : '#e8e4df', background: '#faf8f6' }}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                {...register('password', { required: 'Mot de passe requis' })}
                placeholder="••••••••••••••"
                className="w-full px-4 py-3 rounded-xl border text-sm"
                style={{ borderColor: '#e8e4df', background: '#faf8f6' }}
              />
              {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="rounded" style={{ accentColor: '#8B1A2E', width: 15, height: 15 }} />
                <span className="text-sm text-gray-600">Se souvenir de moi</span>
              </label>
              <button type="button" className="text-sm font-semibold" style={{ color: '#8B1A2E' }}>
                Mot de passe oublié ?
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: '#8B1A2E',
                boxShadow: '0 4px 16px rgba(139,26,46,0.3)',
              }}
            >
              {loading ? 'Connexion en cours…' : (
                <><span>Se connecter</span><span style={{ fontSize: 18, lineHeight: 1 }}>›</span></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 mt-10">
            © 2026 Paroisse Saint André · Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  )
}

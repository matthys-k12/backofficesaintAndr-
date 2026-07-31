import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

export default function AuthGuard() {
  const { session, isSuperAdmin, permissions } = useAuth()

  // Session ou permissions en cours de chargement
  if (session === undefined || (session && permissions === undefined && !isSuperAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F5F0' }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#8B1A2E', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Connecté mais sans accès backoffice (accès révoqué ou aucun rôle)
  if (!isSuperAdmin && Array.isArray(permissions) && permissions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: '#F8F5F0' }}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: '#8B1A2E' }}
        >
          <span style={{ color: '#D4A017', fontSize: 20 }}>✝</span>
        </div>
        <p className="text-gray-800 font-semibold mt-2">Accès non autorisé</p>
        <p className="text-sm text-gray-500">Votre compte n'a pas accès au backoffice.</p>
        <button
          onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })}
          className="mt-2 text-sm font-medium underline"
          style={{ color: '#8B1A2E' }}
        >
          Se déconnecter
        </button>
      </div>
    )
  }

  return <Outlet />
}

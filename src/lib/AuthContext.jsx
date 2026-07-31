import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session,     setSession]     = useState(undefined) // undefined = loading
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [permissions, setPermissions] = useState(undefined) // undefined = loading, null = all
  const [roleName,    setRoleName]    = useState('Administrateur')

  const loadPermissions = useCallback(async (userId) => {
    if (!userId) {
      setIsSuperAdmin(false)
      setPermissions([])
      setRoleName('')
      return
    }

    // 1. Admin via profiles.role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.role === 'admin') {
      setIsSuperAdmin(true)
      setPermissions(null)
      setRoleName('Super Admin')
      return
    }

    // 2. Vérifier si un rôle backoffice est assigné
    const { data: assignment } = await supabase
      .from('backoffice_user_roles')
      .select('role_id, is_active')
      .eq('user_id', userId)
      .maybeSingle()

    if (!assignment) {
      // Pas de row = admin (compatibilité avec admins existants)
      setIsSuperAdmin(true)
      setPermissions(null)
      setRoleName('Super Admin')
      return
    }

    if (!assignment.is_active) {
      setIsSuperAdmin(false)
      setPermissions([])
      setRoleName('')
      return
    }

    // 3. Charger les permissions du rôle
    const { data: role } = await supabase
      .from('backoffice_roles')
      .select('nom, permissions')
      .eq('id', assignment.role_id)
      .single()

    setIsSuperAdmin(false)
    setPermissions(role?.permissions || [])
    setRoleName(role?.nom || 'Utilisateur')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      loadPermissions(session?.user?.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      loadPermissions(session?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [loadPermissions])

  const hasPermission = (key) => {
    if (isSuperAdmin || permissions === null) return true
    if (permissions === undefined) return false
    return permissions.includes(key)
  }

  return (
    <AuthContext.Provider value={{ session, isSuperAdmin, permissions, roleName, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

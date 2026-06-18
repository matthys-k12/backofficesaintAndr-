import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

// Client standard — respecte les RLS, utilisé pour toutes les opérations normales
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client admin — utilise la service_role key, contourne les RLS
// Réservé aux opérations de setup (création de buckets, etc.)
// La service_role key est acceptable ici : le backoffice est protégé par auth admin
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// Wrapper : lance une vraie exception si Supabase retourne une erreur
export async function q(queryPromise) {
  const result = await queryPromise
  if (result.error) {
    const msg = result.error.message || result.error.code || JSON.stringify(result.error)
    console.error('[Supabase error]', msg, result.error)
    throw new Error(msg)
  }
  return result
}

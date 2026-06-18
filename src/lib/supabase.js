import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Wrapper : lance une vraie exception si Supabase retourne une erreur
// Usage : const { data } = await q(supabase.from('x').select('*'))
export async function q(queryPromise) {
  const result = await queryPromise
  if (result.error) {
    const msg = result.error.message || result.error.code || JSON.stringify(result.error)
    console.error('[Supabase error]', msg, result.error)
    throw new Error(msg)
  }
  return result
}

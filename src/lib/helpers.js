import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Normalise une chaîne en Unicode NFC (évite les □ sur Android). */
export const nfc = (v) => (typeof v === 'string' ? v.normalize('NFC') : v)

/** Normalise tous les champs texte d'un objet avant envoi à Supabase. */
export const nfcPayload = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, nfc(v)]))

export const fmtMontant = (v) => {
  if (!v && v !== 0) return '—'
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
}

export const fmtDate = (d) => {
  if (!d) return '—'
  try { return format(new Date(d), 'd MMMM yyyy', { locale: fr }) }
  catch { return d }
}

export const fmtDateTime = (d) => {
  if (!d) return '—'
  try { return format(new Date(d), "d MMM yyyy 'à' HH:mm", { locale: fr }) }
  catch { return d }
}

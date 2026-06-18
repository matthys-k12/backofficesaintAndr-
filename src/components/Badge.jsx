// Palette : [bg, text, dot]
const STYLES = {
  en_attente:    ['#FFF7ED', '#c2410c', '#f97316'],
  validee:       ['#F0FDF4', '#15803d', '#22c55e'],
  valide:        ['#F0FDF4', '#15803d', '#22c55e'],
  annulee:       ['#FEF2F2', '#b91c1c', '#ef4444'],
  refuse:        ['#FEF2F2', '#b91c1c', '#ef4444'],
  confirme:      ['#F0FDF4', '#15803d', '#22c55e'],
  confirmee:     ['#F0FDF4', '#15803d', '#22c55e'],
  gratuit:       ['#F0FDF4', '#15803d', '#22c55e'],
  payant:        ['#F8F5F0', '#374151', '#9ca3af'],
  paye:          ['#F0FDF4', '#15803d', '#22c55e'],
  audio:         ['#EFF6FF', '#1d4ed8', '#60a5fa'],
  video:         ['#F5F3FF', '#6d28d9', '#a78bfa'],
  urgent:        ['#FEF2F2', '#b91c1c', '#ef4444'],
  epinglee:      ['#FFFBEB', '#92400e', '#f59e0b'],
  liturgie:      ['#FEF2F2', '#9f1239', '#f43f5e'],
  solidarite:    ['#F0FDF4', '#15803d', '#22c55e'],
  jeunesse:      ['#FFF7ED', '#c2410c', '#fb923c'],
  formation:     ['#EFF6FF', '#1d4ed8', '#60a5fa'],
  activites:     ['#F5F3FF', '#6d28d9', '#a78bfa'],
  mariage:       ['#FEFCE8', '#854d0e', '#eab308'],
  prieres:       ['#EEF2FF', '#3730a3', '#818cf8'],
  ceb:           ['#EFF6FF', '#1d4ed8', '#60a5fa'],
  associations:  ['#F0FDFA', '#0f766e', '#2dd4bf'],
  rappel_a_dieu: ['#F9FAFB', '#374151', '#9ca3af'],
  construction:  ['#FFFBEB', '#92400e', '#f59e0b'],
  libre:         ['#F9FAFB', '#374151', '#9ca3af'],
  publie:        ['#F0FDF4', '#15803d', '#22c55e'],
  brouillon:     ['#F9FAFB', '#6b7280', '#d1d5db'],
  actif:         ['#F0FDF4', '#15803d', '#22c55e'],
  inactif:       ['#F9FAFB', '#6b7280', '#d1d5db'],
  objectif_atteint: ['#EFF6FF', '#1d4ed8', '#60a5fa'],
}

export default function Badge({ label, value }) {
  const key = (value || label || '').toLowerCase().replace(/[éèê]/g, 'e').replace(/\s+/g, '_')
  const style = STYLES[key]

  if (style) {
    const [bg, text, dot] = style
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ backgroundColor: bg, color: text }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dot, flexShrink: 0, display: 'inline-block' }} />
        {label}
      </span>
    )
  }

  // Fallback neutre
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: '#F3F4F6', color: '#374151' }}>
      {label}
    </span>
  )
}

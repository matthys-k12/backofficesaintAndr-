const ACCENT_COLORS = {
  'bg-blue-900':  { bar: '#1e3a8a', icon: '#1e3a8a', light: '#eff6ff' },
  'bg-red-800':   { bar: '#8B1A2E', icon: '#8B1A2E', light: '#fff0f2' },
  'bg-green-700': { bar: '#15803d', icon: '#15803d', light: '#f0fdf4' },
  'bg-yellow-600':{ bar: '#D4A017', icon: '#D4A017', light: '#fffbeb' },
  'bg-purple-700':{ bar: '#6d28d9', icon: '#6d28d9', light: '#f5f3ff' },
  'bg-teal-700':  { bar: '#0f766e', icon: '#0f766e', light: '#f0fdfa' },
}

export default function StatCard({ title, value, icon: Icon, color, subtitle }) {
  const palette = ACCENT_COLORS[color] || { bar: '#8B1A2E', icon: '#8B1A2E', light: '#fff0f2' }

  return (
    <div
      className="bg-white rounded-xl p-5 relative overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}
    >
      {/* Barre accent gauche */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: palette.bar }}
      />

      <div className="flex items-start justify-between pl-2">
        <div className="flex-1 min-w-0 pr-3">
          <p
            className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2"
            style={{ fontSize: 10 }}
          >
            {title}
          </p>
          <p
            className="text-2xl font-bold text-gray-900 leading-tight"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              {subtitle}
            </p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: palette.light }}
        >
          <Icon size={20} style={{ color: palette.icon }} />
        </div>
      </div>
    </div>
  )
}

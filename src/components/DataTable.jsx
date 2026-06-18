import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function DataTable({ columns, data, actions, loading, pagination, onPageChange }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
        <div className="p-4 space-y-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      </div>
    )
  }

  const totalPages = pagination?.totalPages || 1
  const currentPage = pagination?.page || 1

  // Plage de pages à afficher
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)
  const pageNums = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <div
      className="bg-white rounded-xl overflow-hidden"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#FAF8F5', borderBottom: '1px solid #ede9e3' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-widest whitespace-nowrap"
                  style={{ color: '#b0a99f', fontSize: 10 }}
                >
                  {col.label}
                </th>
              ))}
              {actions && (
                <th
                  className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-widest"
                  style={{ color: '#b0a99f', fontSize: 10 }}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#FAF8F5' }}
                    >
                      <span className="text-gray-300 text-2xl">∅</span>
                    </div>
                    <p className="text-sm text-gray-400">Aucune donnée à afficher</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.id || i}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid #f5f1ec' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FDFAF7')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                    >
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────── */}
      {pagination && (
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid #ede9e3', backgroundColor: '#FAF8F5' }}
        >
          <span className="text-xs text-gray-400">
            {pagination.total} résultat{pagination.total !== 1 ? 's' : ''}
            {totalPages > 1 && (
              <span className="text-gray-300 mx-1">·</span>
            )}
            {totalPages > 1 && `Page ${currentPage} / ${totalPages}`}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ color: '#6b7280' }}
                onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#f0ede8')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ChevronLeft size={15} />
              </button>

              {start > 1 && (
                <>
                  <button
                    onClick={() => onPageChange(1)}
                    className="w-8 h-8 rounded-lg text-xs font-semibold transition-colors"
                    style={{ color: '#6b7280' }}
                  >1</button>
                  {start > 2 && <span className="text-gray-300 text-xs px-1">…</span>}
                </>
              )}

              {pageNums.map((n) => (
                <button
                  key={n}
                  onClick={() => onPageChange(n)}
                  className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: n === currentPage ? '#1A237E' : 'transparent',
                    color: n === currentPage ? 'white' : '#6b7280',
                    boxShadow: n === currentPage ? '0 2px 8px rgba(26,35,126,0.3)' : 'none',
                  }}
                >
                  {n}
                </button>
              ))}

              {end < totalPages && (
                <>
                  {end < totalPages - 1 && <span className="text-gray-300 text-xs px-1">…</span>}
                  <button
                    onClick={() => onPageChange(totalPages)}
                    className="w-8 h-8 rounded-lg text-xs font-semibold transition-colors"
                    style={{ color: '#6b7280' }}
                  >{totalPages}</button>
                </>
              )}

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
                style={{ color: '#6b7280' }}
                onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#f0ede8')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

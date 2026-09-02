import type { ReactNode } from 'react'

export function DataTable({
  columns,
  rows,
  emptyMessage = 'No records found.',
}: {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[]
  rows: Record<string, unknown>[]
  emptyMessage?: string
}) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, i) => (
            <tr key={(row.id as string) ?? i} className="hover:bg-slate-50/80">
              {columns.map((col) => (
                <td key={col.key} className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

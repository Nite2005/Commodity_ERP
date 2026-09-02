const map: Record<string, string> = {
  CONTRACT_OPEN: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-red-100 text-red-800',
  NEW: 'bg-blue-100 text-blue-800',
  AMENDMENT: 'bg-amber-100 text-amber-800',
  CANCEL: 'bg-red-100 text-red-700',
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-slate-100 text-slate-500',
}

export function Badge({ label, tone }: { label: string; tone?: string }) {
  const cls = tone ?? map[label] ?? 'bg-slate-100 text-slate-700'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

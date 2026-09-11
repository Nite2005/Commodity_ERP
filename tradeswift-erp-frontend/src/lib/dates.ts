/** Date helpers — display/input as DD/MM/YYYY, API as YYYY-MM-DD */

export function isoToDmy(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function dmyToIso(dmy: string): string | null {
  const cleaned = dmy.trim()
  if (!cleaned) return null
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null
  }
  const dd = String(day).padStart(2, '0')
  const mm = String(month).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** Auto-insert slashes while typing digits: 08092026 → 08/09/2026 */
export function maskDmyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function formatDateDmy(iso: string | null | undefined): string {
  const dmy = isoToDmy(iso)
  return dmy || '—'
}

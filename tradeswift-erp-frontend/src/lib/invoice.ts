/** Tradeswift company profile for invoice header (until Company Settings master exists). */
export const TRADESWIFT_COMPANY = {
  name: 'TRADESWIFT COMMODITIES PVT. LTD.',
  tagline: 'Physical Commodity Trading · Jaipur, Rajasthan',
  address: 'Commodity Exchange Complex, Jaipur',
  city: 'Jaipur',
  state: 'Rajasthan',
  pincode: '302001',
  gstin: '08AABCT1234A1Z5',
  phone: '+91-141-0000000',
  email: 'accounts@tradeswift.com',
}

export function formatInr(value: number | string): string {
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(d: string): string {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

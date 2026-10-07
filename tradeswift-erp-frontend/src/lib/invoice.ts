/** Tradeswift / Broker company profile for invoice header. */
export const TRADESWIFT_COMPANY = {
  name: 'SHRI NATH BROKERS',
  tagline: 'Physical Commodity Brokerage · Jaipur, Rajasthan',
  devotional_heading: 'Jai shri Shyam',
  address: 'Plot No. 344 Mahaveer Nagar II, Maharani Farm Durgapura',
  city: 'Jaipur',
  state: 'Rajasthan',
  state_code: '08',
  pincode: '302018',
  pan: 'ACRPK8612P',
  gstin: '08ACRPK8612P1ZR',
  phone: '9829016187',
  email: 'accounts@shrinathbrokers.com',
  bank_name: 'SHRINATH BROKERS',
  account_no: '674705113977',
  ifsc_code: 'ICIC0006747',
  branch: 'Durgapura Jaipur',
}

export function formatInr(value: number | string): string {
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatNum(value: number | string, decimals = 2): string {
  return Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
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

/** Formats dates as DD.MM.YYYY matching standard GST invoice format */
export function formatDateDmyDot(d?: string | null): string {
  if (!d) return '—'
  const match = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    const [, y, m, day] = match
    return `${day}.${m}.${y}`
  }
  try {
    const dt = new Date(d)
    const day = String(dt.getDate()).padStart(2, '0')
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const year = dt.getFullYear()
    return `${day}.${month}.${year}`
  } catch {
    return d
  }
}

function convertLessThanOneThousand(n: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ]

  let str = ''
  if (n >= 100) {
    str += ones[Math.floor(n / 100)] + ' Hundred '
    n %= 100
  }
  if (n >= 20) {
    str += tens[Math.floor(n / 10)]
    if (n % 10 > 0) {
      str += '-' + ones[n % 10]
    }
    str += ' '
  } else if (n > 0) {
    str += ones[n] + ' '
  }
  return str.trim()
}

/** Converts a numeric currency amount into Indian English Words */
export function amountInWords(val: number | string): string {
  const num = Math.round(Number(val) * 100) / 100
  if (isNaN(num) || num === 0) return 'Zero Rupees only'

  const rupees = Math.floor(Math.abs(num))
  const paise = Math.round((Math.abs(num) - rupees) * 100)

  let rem = rupees
  const crore = Math.floor(rem / 10000000)
  rem %= 10000000
  const lakh = Math.floor(rem / 100000)
  rem %= 100000
  const thousand = Math.floor(rem / 1000)
  rem %= 1000
  const hundredAndBelow = rem

  const parts: string[] = []
  if (crore > 0) parts.push(convertLessThanOneThousand(crore) + ' Crore')
  if (lakh > 0) parts.push(convertLessThanOneThousand(lakh) + ' Lakh')
  if (thousand > 0) parts.push(convertLessThanOneThousand(thousand) + ' Thousand')
  if (hundredAndBelow > 0) parts.push(convertLessThanOneThousand(hundredAndBelow))

  let result = parts.join(' ').trim()
  if (!result) result = 'Zero'
  result += ' Rupees'

  if (paise > 0) {
    result += ' and ' + convertLessThanOneThousand(paise) + ' Paise'
  }
  result += ' only'
  return result
}

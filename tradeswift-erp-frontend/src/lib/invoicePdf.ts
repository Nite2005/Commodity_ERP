import type { BillDetail } from '../types'
import { TaxInvoice } from '../components/TaxInvoice'
import { componentToPdfBlob, triggerDownload } from './pdfDownload'

async function billToPdfBlob(bill: BillDetail): Promise<Blob> {
  return componentToPdfBlob(TaxInvoice, { bill }, '#tax-invoice')
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export async function downloadInvoicePdf(bill: BillDetail) {
  const blob = await billToPdfBlob(bill)
  const safeNo = String(bill.bill_no).replace(/[^\w.-]+/g, '_')
  triggerDownload(blob, `invoice-${safeNo}.pdf`)

  // Asynchronously archive PDF to Cloudflare R2 in the background
  if (bill.id) {
    try {
      const formData = new FormData()
      formData.append('file', blob, `invoice-${safeNo}.pdf`)
      fetch(`${BASE}/bills/${bill.id}/pdf`, {
        method: 'POST',
        body: formData,
      }).catch(() => {})
    } catch {
      // Non-blocking
    }
  }
}

export async function downloadInvoicesZip(
  bills: BillDetail[],
  zipName = 'invoices.zip',
  onProgress?: (done: number, total: number) => void,
) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const total = bills.length
  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i]
    const blob = await billToPdfBlob(bill)
    const safeNo = String(bill.bill_no).replace(/[^\w.-]+/g, '_')
    zip.file(`invoice-${safeNo}.pdf`, blob)
    onProgress?.(i + 1, total)
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(zipBlob, zipName)
}

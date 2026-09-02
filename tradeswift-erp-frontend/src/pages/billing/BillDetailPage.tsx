import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { billsApi, ApiClientError } from '../../api/client'
import type { BillDetail } from '../../types'
import { TaxInvoice } from '../../components/TaxInvoice'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Modal'

export function BillDetailPage() {
  const { id } = useParams()
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    billsApi
      .get(id)
      .then(setBill)
      .catch((e) => setError(e instanceof ApiClientError ? e.message : 'Failed to load bill'))
  }, [id])

  const handlePrint = () => window.print()

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert message={error} />
      </div>
    )
  }

  if (!bill) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading invoice…</div>
  }

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          to="/billing"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600"
        >
          <ArrowLeft size={16} /> Back to Bills
        </Link>
        <Button onClick={handlePrint}>
          <Printer size={16} /> Print Invoice
        </Button>
      </div>

      <TaxInvoice bill={bill} />
    </div>
  )
}

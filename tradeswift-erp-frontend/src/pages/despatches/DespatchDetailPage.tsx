import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { contractsApi, despatchesApi, ApiClientError } from '../../api/client'
import type { ContractBalance, DespatchDetail } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { Alert } from '../../components/Modal'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-50 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value ?? '—'}</span>
    </div>
  )
}

export function DespatchDetailPage() {
  const { id } = useParams()
  const [despatch, setDespatch] = useState<DespatchDetail | null>(null)
  const [balance, setBalance] = useState<ContractBalance | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const d = await despatchesApi.get(id)
        setDespatch(d)
        const b = await contractsApi.balance(d.contract_id)
        setBalance(b)
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : 'Failed to load despatch')
      }
    })()
  }, [id])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert message={error} />
      </div>
    )
  }

  if (!despatch) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/despatches"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={16} /> Back to Despatches
      </Link>

      <Card>
        <CardHeader
          title={`Despatch #${despatch.despatch_no}`}
          subtitle={`${despatch.despatch_date} · Contract #${despatch.contract_no}`}
          action={<Badge label={despatch.billing_status.toLowerCase()} />}
        />
        <CardBody>
          <Row label="Commodity" value={despatch.commodity_short_name} />
          <Row label="Seller" value={despatch.seller_name} />
          <Row label="Buyer" value={despatch.buyer_name} />
          <Row label="Bags" value={despatch.bags} />
          <Row
            label="Quantity"
            value={`${despatch.quantity} ${despatch.qty_unit ?? ''}`}
          />
          <Row label="Delivery Type" value={despatch.delivery_type} />
          <Row label="Billing Status" value={despatch.billing_status} />
        </CardBody>
      </Card>

      {balance && (
        <Card>
          <CardHeader title="Contract Balance" subtitle={`#${balance.contract_no}`} />
          <CardBody>
            <Row label="Billing Qty" value={balance.billing_qty} />
            <Row label="Fulfilled Qty" value={balance.fulfilled_qty} />
            <Row label="Remaining Qty" value={balance.remaining_qty} />
            <Row label="Max Allowed" value={balance.max_allowed_qty} />
          </CardBody>
        </Card>
      )}

      <div className="text-center">
        <Link
          to={`/contracts/${despatch.contract_id}`}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          View contract →
        </Link>
      </div>
    </div>
  )
}

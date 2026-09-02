import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { contractsApi, ApiClientError } from '../../api/client'
import type { ContractBalance, ContractDetail } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { FormField, inputClass, Alert } from '../../components/Modal'

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-50 py-2.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  )
}

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [balance, setBalance] = useState<ContractBalance | null>(null)
  const [error, setError] = useState('')
  const [finalQty, setFinalQty] = useState('')
  const [closing, setClosing] = useState(false)
  const [closeMsg, setCloseMsg] = useState('')

  const load = async () => {
    if (!id) return
    try {
      const [c, b] = await Promise.all([contractsApi.get(id), contractsApi.balance(id)])
      setContract(c)
      setBalance(b)
      setFinalQty(String(c.final_qty ?? c.qty_high))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load')
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const handleClose = async () => {
    if (!id) return
    setClosing(true)
    setCloseMsg('')
    try {
      await contractsApi.close(id, Number(finalQty))
      setCloseMsg('Contract closed with final quantity set.')
      await load()
    } catch (e) {
      setCloseMsg(e instanceof ApiClientError ? e.message : 'Closure failed')
    } finally {
      setClosing(false)
    }
  }

  if (error) return <Alert message={error} />
  if (!contract) return <div className="py-12 text-center text-slate-500">Loading…</div>

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/contracts" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Back to contracts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Contract #{contract.contract_no}</h2>
          <p className="text-slate-500">{contract.contract_date} · {contract.contract_type}</p>
        </div>
        <Badge label={contract.status} />
        {contract.status === 'CONTRACT_OPEN' && id && (
          <Link to={`/despatches/new?contract_id=${id}`}>
            <Button size="sm">Record Despatch</Button>
          </Link>
        )}
      </div>

      {closeMsg && (
        <Alert message={closeMsg} type={closeMsg.includes('failed') ? 'error' : 'success'} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Contract Details" />
          <CardBody className="grid gap-0 sm:grid-cols-2 sm:gap-x-8">
            <div>
              <Row label="Company" value={contract.company_name} />
              <Row label="Seller" value={contract.seller_name} />
              <Row label="Buyer" value={contract.buyer_name} />
              <Row label="Commodity" value={contract.commodity_name} />
              <Row label="Short Name" value={contract.commodity_short_name} />
              <Row label="Packing" value={contract.packing} />
              <Row label="Quality" value={contract.quality_allowance} />
            </div>
            <div>
              <Row label="Qty Range" value={`${contract.qty_low} – ${contract.qty_high} ${contract.qty_unit}`} />
              <Row label="Rate" value={`${contract.rate} ${contract.currency}`} />
              <Row label="Tax" value={contract.tax_name} />
              <Row label="Payment Term" value={contract.payment_term_name} />
              <Row label="Weightment" value={contract.weightment_unit_name} />
              <Row label="Despatch" value={`${contract.despatch_from} → ${contract.despatch_to}`} />
              <Row label="Broker" value={`${contract.broker_name} @ ${contract.broker_rate}`} />
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Fulfillment" subtitle="Balance & tolerance" />
            <CardBody className="space-y-3 text-sm">
              {balance && (
                <>
                  <Row label="Billing Qty" value={balance.billing_qty} />
                  <Row label="Fulfilled" value={balance.fulfilled_qty} />
                  <Row label="Remaining" value={balance.remaining_qty} />
                  <Row label="Max (+ tolerance)" value={balance.max_allowed_qty} />
                  <Row label="Tolerance" value={`${balance.tolerance_percent}%`} />
                </>
              )}
            </CardBody>
          </Card>

          {contract.status !== 'CANCELLED' && contract.status !== 'CLOSED' && (
            <Card>
              <CardHeader title="Contract Closure" subtitle="Final qty for billing" />
              <CardBody className="space-y-4">
                <FormField label="Final Quantity" hint="Defaults to Qty High if not set">
                  <input
                    type="number"
                    step="0.01"
                    className={inputClass}
                    value={finalQty}
                    onChange={(e) => setFinalQty(e.target.value)}
                  />
                </FormField>
                <Button className="w-full" onClick={handleClose} disabled={closing}>
                  {closing ? 'Closing…' : 'Close Contract'}
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

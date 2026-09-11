import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { contractsApi, ApiClientError } from '../../api/client'
import type { ContractDetail } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { FormField, inputClass, Alert } from '../../components/Modal'
import { ContractReport } from '../../components/ContractReport'
import { formatDateDmy } from '../../lib/dates'
import { downloadContractReportPdf } from '../../lib/contractPdf'

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
  const [error, setError] = useState('')
  const [finalQty, setFinalQty] = useState('')
  const [closing, setClosing] = useState(false)
  const [closeMsg, setCloseMsg] = useState('')
  const [downloading, setDownloading] = useState(false)

  const load = async () => {
    if (!id) return
    try {
      const c = await contractsApi.get(id)
      setContract(c)
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

  const handleDownload = async () => {
    if (!contract) return
    setDownloading(true)
    setError('')
    try {
      await downloadContractReportPdf(contract)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download contract report')
    } finally {
      setDownloading(false)
    }
  }

  if (error && !contract) return <Alert message={error} />
  if (!contract) return <div className="py-12 text-center text-slate-500">Loading…</div>

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link
          to="/contracts"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} /> Back to contracts
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {error && <span className="text-sm text-red-600">{error}</span>}
          <Button variant="secondary" size="sm" onClick={handleDownload} disabled={downloading}>
            <Download size={16} />
            {downloading ? 'Downloading…' : 'Download Report'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </Button>
          {contract.status !== 'CANCELLED' && id && (
            <Link to={`/contracts/${id}/edit`}>
              <Button size="sm" variant="secondary">
                Edit
              </Button>
            </Link>
          )}
          <Badge label={contract.status} />
        </div>
      </div>

      {closeMsg && (
        <div className="print:hidden">
          <Alert message={closeMsg} type={closeMsg.includes('failed') ? 'error' : 'success'} />
        </div>
      )}

      <div className="print:hidden">
        <div className="mb-2">
          <h2 className="text-2xl font-bold text-slate-900">Contract #{contract.contract_no}</h2>
          <p className="text-slate-500">
            {formatDateDmy(contract.contract_date)} · {contract.contract_type}
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
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
              </div>
              <div>
                <Row
                  label="Qty Range"
                  value={`${contract.qty_low} – ${contract.qty_high} ${contract.qty_unit}`}
                />
                <Row
                  label="Final Qty"
                  value={
                    contract.final_qty != null
                      ? `${contract.final_qty} ${contract.qty_unit}`
                      : '—'
                  }
                />
                <Row label="Rate" value={String(contract.rate)} />
                <Row label="Tax" value={contract.tax_name} />
                <Row label="Payment Term" value={contract.payment_term_name} />
                <Row
                  label="Despatch"
                  value={`${formatDateDmy(contract.despatch_from)} → ${formatDateDmy(contract.despatch_to)}`}
                />
                <Row label="Broker" value={`${contract.broker_name} @ ${contract.broker_rate}`} />
              </div>
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

      <div className="print:block">
        <div className="mb-3 print:hidden">
          <h3 className="text-sm font-semibold text-slate-700">Contract Report Preview</h3>
          <p className="text-xs text-slate-500">
            Download PDF to share with seller / buyer
          </p>
        </div>
        <ContractReport contract={contract} />
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Eye } from 'lucide-react'
import { contractsApi, despatchesApi, ApiClientError } from '../../api/client'
import type { Contract, Despatch } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Badge } from '../../components/Badge'
import { Alert } from '../../components/Modal'

export function DespatchesPage() {
  const [rows, setRows] = useState<Despatch[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [contractFilter, setContractFilter] = useState('')
  const [billingFilter, setBillingFilter] = useState('')

  const contractMap = Object.fromEntries(contracts.map((c) => [c.id, c.contract_no]))
  const contractUnitMap = Object.fromEntries(contracts.map((c) => [c.id, c.qty_unit]))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = { active_only: 'true' }
      if (contractFilter) params.contract_id = contractFilter
      if (billingFilter) params.billing_status = billingFilter
      const [d, c] = await Promise.all([
        despatchesApi.list(params),
        contractsApi.list({ active_only: 'true' }),
      ])
      setRows(d)
      setContracts(c)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load despatches')
    } finally {
      setLoading(false)
    }
  }, [contractFilter, billingFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader
        title="Despatches"
        subtitle="Shipment / challan entries linked to contracts"
        action={
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
            >
              <option value="">All contracts</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.contract_no}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={billingFilter}
              onChange={(e) => setBillingFilter(e.target.value)}
            >
              <option value="">All billing</option>
              <option value="UNBILLED">Unbilled</option>
              <option value="BILLED">Billed</option>
            </select>
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw size={16} />
            </Button>
            <Link to="/despatches/new">
              <Button size="sm">
                <Plus size={16} /> New Despatch
              </Button>
            </Link>
          </div>
        }
      />
      <CardBody>
        {error && <Alert message={error} />}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <DataTable
            columns={[
              { key: 'despatch_no', label: 'Despatch #' },
              { key: 'despatch_date', label: 'Date' },
              {
                key: 'contract_id',
                label: 'Contract',
                render: (r) => contractMap[r.contract_id as string] ?? '—',
              },
              { key: 'bags', label: 'Bags' },
              {
                key: 'quantity',
                label: 'Qty',
                render: (r) => {
                  const unit = contractUnitMap[r.contract_id as string]
                  const qty = r.quantity
                  return unit ? `${qty} ${unit}` : String(qty ?? '—')
                },
              },
              { key: 'delivery_type', label: 'Delivery' },
              {
                key: 'billing_status',
                label: 'Billing',
                render: (r) => (
                  <Badge
                    label={(r.billing_status as string).toLowerCase()}
                    tone={
                      r.billing_status === 'BILLED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }
                  />
                ),
              },
              {
                key: 'view',
                label: '',
                render: (r) => (
                  <Link
                    to={`/despatches/${r.id}`}
                    className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
                  >
                    <Eye size={14} /> View
                  </Link>
                ),
              },
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
            emptyMessage="No despatches yet. Record a shipment against an open contract."
          />
        )}
      </CardBody>
    </Card>
  )
}

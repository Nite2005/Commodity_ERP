import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Eye } from 'lucide-react'
import { contractsApi, mastersApi, ApiClientError } from '../../api/client'
import type { Company, Contract } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Badge } from '../../components/Badge'
import { Alert } from '../../components/Modal'

export function ContractsPage() {
  const [rows, setRows] = useState<Contract[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = { active_only: 'true' }
      if (statusFilter) params.status = statusFilter
      setRows(await contractsApi.list(params))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    mastersApi.companies.list().then((c) => setCompanies(c))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const companyName = (id: string | null) =>
    id ? companies.find((c) => c.id === id)?.name ?? '—' : '—'

  return (
    <Card>
      <CardHeader
        title="Contracts"
        subtitle="Purchase / sales trade agreements"
        action={
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="CONTRACT_OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw size={16} />
            </Button>
            <Link to="/contracts/new">
              <Button size="sm">
                <Plus size={16} /> New Contract
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
              { key: 'contract_no', label: 'Contract #' },
              { key: 'contract_date', label: 'Date' },
              {
                key: 'company_id',
                label: 'Company',
                render: (r) => companyName(r.company_id as string | null),
              },
              { key: 'contract_type', label: 'Type' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <Badge label={r.status as string} />,
              },
              { key: 'qty_low', label: 'Qty Low' },
              { key: 'qty_high', label: 'Qty High' },
              { key: 'qty_unit', label: 'Unit' },
              { key: 'rate', label: 'Rate' },
              {
                key: 'view',
                label: '',
                render: (r) => (
                  <Link
                    to={`/contracts/${r.id}`}
                    className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
                  >
                    <Eye size={14} /> View
                  </Link>
                ),
              },
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
            emptyMessage="No contracts found. Create one to get started."
          />
        )}
      </CardBody>
    </Card>
  )
}

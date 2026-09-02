import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Eye } from 'lucide-react'
import { billsApi, mastersApi, ApiClientError } from '../../api/client'
import type { Bill, Party } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { formatInr } from '../../lib/invoice'
import { Alert } from '../../components/Modal'

export function BillsPage() {
  const [rows, setRows] = useState<Bill[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const partyMap = Object.fromEntries(parties.map((p) => [p.id, p.name]))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [b, p] = await Promise.all([
        billsApi.list({ active_only: 'true' }),
        mastersApi.parties.list(),
      ])
      setRows(b)
      setParties(p)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load bills')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader
        title="Bills / Invoices"
        subtitle="Generated tax invoices from unbilled despatches"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw size={16} />
            </Button>
            <Link to="/billing/generate">
              <Button size="sm">
                <Plus size={16} /> Generate Bill
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
              { key: 'bill_no', label: 'Bill #' },
              { key: 'bill_date', label: 'Date' },
              {
                key: 'party_id',
                label: 'Party',
                render: (r) => partyMap[r.party_id as string] ?? '—',
              },
              { key: 'base_amount', label: 'Base', render: (r) => formatInr(r.base_amount as number) },
              { key: 'gross_amount', label: 'Gross', render: (r) => formatInr(r.gross_amount as number) },
              { key: 'supply_type', label: 'Supply' },
              {
                key: 'view',
                label: '',
                render: (r) => (
                  <Link
                    to={`/billing/${r.id}`}
                    className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
                  >
                    <Eye size={14} /> Invoice
                  </Link>
                ),
              },
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
            emptyMessage="No bills yet. Generate one from unbilled despatches."
          />
        )}
      </CardBody>
    </Card>
  )
}

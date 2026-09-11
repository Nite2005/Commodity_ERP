import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Eye, Download, FileArchive } from 'lucide-react'
import { billsApi, mastersApi, reportsApi, ApiClientError } from '../../api/client'
import type { Bill, Party } from '../../types'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { formatInr } from '../../lib/invoice'
import { Alert } from '../../components/Modal'
import { DateInputDmy } from '../../components/DateInputDmy'
import { formatDateDmy } from '../../lib/dates'
import { downloadInvoicePdf, downloadInvoicesZip } from '../../lib/invoicePdf'

export function BillsPage() {
  const { company } = useSelectedCompany()
  const [rows, setRows] = useState<Bill[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingCsv, setDownloadingCsv] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [zipProgress, setZipProgress] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [partyId, setPartyId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const partyMap = Object.fromEntries(parties.map((p) => [p.id, p.name]))

  const filterParams = useCallback(() => {
    const params: Record<string, string> = { active_only: 'true' }
    if (partyId) params.party_id = partyId
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (company?.id) params.company_id = company.id
    return params
  }, [partyId, dateFrom, dateTo, company?.id])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = filterParams()
      const listParams: Record<string, string> = {
        active_only: params.active_only,
      }
      if (params.party_id) listParams.party_id = params.party_id
      if (params.date_from) listParams.date_from = params.date_from
      if (params.date_to) listParams.date_to = params.date_to

      const partyListParams = company?.id ? { companyId: company.id } : undefined
      const [b, p] = await Promise.all([
        billsApi.list(listParams),
        mastersApi.parties.list(partyListParams),
      ])
      const activeParties = p.filter((x) => x.is_active)
      setParties(activeParties)

      if (company?.id) {
        const allowed = new Set(activeParties.map((x) => x.id))
        setRows(b.filter((bill) => allowed.has(bill.party_id)))
      } else {
        setRows(b)
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load bills report')
    } finally {
      setLoading(false)
    }
  }, [filterParams, company?.id])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.base += Number(r.base_amount) || 0
        acc.gross += Number(r.gross_amount) || 0
        return acc
      },
      { base: 0, gross: 0 },
    )
  }, [rows])

  const clearDates = () => {
    setDateFrom('')
    setDateTo('')
  }

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true)
    setError('')
    try {
      await reportsApi.downloadSalesRegister(filterParams())
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to download bills report')
    } finally {
      setDownloadingCsv(false)
    }
  }

  const handleDownloadInvoice = async (billId: string) => {
    setDownloadingId(billId)
    setError('')
    try {
      const detail = await billsApi.get(billId)
      await downloadInvoicePdf(detail)
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to download invoice',
      )
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDownloadAllInvoices = async () => {
    if (rows.length === 0) return
    setDownloadingZip(true)
    setZipProgress(`0 / ${rows.length}`)
    setError('')
    try {
      const details = []
      for (let i = 0; i < rows.length; i++) {
        details.push(await billsApi.get(rows[i].id))
        setZipProgress(`${i + 1} / ${rows.length}`)
      }
      await downloadInvoicesZip(details, 'all-invoices.zip', (done, total) => {
        setZipProgress(`PDF ${done} / ${total}`)
      })
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to download invoices ZIP',
      )
    } finally {
      setDownloadingZip(false)
      setZipProgress('')
    }
  }

  return (
    <Card>
      <CardHeader
        title="Bills Report"
        subtitle={
          company
            ? `Sales register for ${company.name}`
            : 'Sales register — tax invoices from billable contracts'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="whitespace-nowrap">From</span>
              <DateInputDmy value={dateFrom} onChange={setDateFrom} />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <span className="whitespace-nowrap">To</span>
              <DateInputDmy value={dateTo} onChange={setDateTo} />
            </label>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={clearDates}>
                Clear dates
              </Button>
            )}
            <select
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="">All parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={downloadingCsv || rows.length === 0}
              title="Download bills report CSV"
            >
              <Download size={16} />
              {downloadingCsv ? 'CSV…' : 'Report CSV'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadAllInvoices}
              disabled={downloadingZip || rows.length === 0}
              title="Download all invoices as ZIP"
            >
              <FileArchive size={16} />
              {downloadingZip ? zipProgress || 'ZIP…' : 'All Invoices'}
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
        {!loading && rows.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Bills</div>
              <div className="font-semibold text-slate-800">{rows.length}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Base Total</div>
              <div className="font-semibold text-slate-800">{formatInr(totals.base)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Gross Total</div>
              <div className="font-semibold text-slate-800">{formatInr(totals.gross)}</div>
            </div>
          </div>
        )}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <DataTable
            columns={[
              { key: 'bill_no', label: 'Bill #' },
              {
                key: 'bill_date',
                label: 'Date',
                render: (r) => formatDateDmy(r.bill_date as string),
              },
              {
                key: 'party_id',
                label: 'Party',
                render: (r) => partyMap[r.party_id as string] ?? '—',
              },
              {
                key: 'base_amount',
                label: 'Base',
                render: (r) => formatInr(r.base_amount as number),
              },
              {
                key: 'gross_amount',
                label: 'Gross',
                render: (r) => formatInr(r.gross_amount as number),
              },
              { key: 'supply_type', label: 'Supply' },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-brand-600 disabled:opacity-50"
                      disabled={downloadingId === (r.id as string) || downloadingZip}
                      onClick={() => handleDownloadInvoice(r.id as string)}
                      title="Download invoice PDF"
                    >
                      <Download size={14} />
                      {downloadingId === (r.id as string) ? '…' : 'PDF'}
                    </button>
                    <Link
                      to={`/billing/${r.id}`}
                      className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
                    >
                      <Eye size={14} /> Invoice
                    </Link>
                  </div>
                ),
              },
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
            emptyMessage="No bills in this period. Generate one from billable contracts."
          />
        )}
      </CardBody>
    </Card>
  )
}

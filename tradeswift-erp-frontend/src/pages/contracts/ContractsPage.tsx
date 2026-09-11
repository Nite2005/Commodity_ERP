import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, RefreshCw, Eye, Pencil, Download, FileArchive } from 'lucide-react'
import { contractsApi, reportsApi, ApiClientError } from '../../api/client'
import type { Contract } from '../../types'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Badge } from '../../components/Badge'
import { Alert } from '../../components/Modal'
import { DateInputDmy } from '../../components/DateInputDmy'
import { formatDateDmy } from '../../lib/dates'
import {
  downloadContractReportPdf,
  downloadContractReportsZip,
} from '../../lib/contractPdf'

export function ContractsPage() {
  const { company } = useSelectedCompany()
  const [rows, setRows] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingCsv, setDownloadingCsv] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [zipProgress, setZipProgress] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const reportParams = useCallback(() => {
    if (!company) return null
    const params: Record<string, string> = { active_only: 'true', company_id: company.id }
    if (statusFilter) params.status = statusFilter
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    return params
  }, [company, statusFilter, dateFrom, dateTo])

  const load = useCallback(async () => {
    const params = reportParams()
    if (!params) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setRows(await contractsApi.list(params))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }, [reportParams])

  useEffect(() => {
    load()
  }, [load])

  const clearDates = () => {
    setDateFrom('')
    setDateTo('')
  }

  const handleDownloadCsv = async () => {
    const params = reportParams()
    if (!params) return
    setDownloadingCsv(true)
    setError('')
    try {
      await reportsApi.downloadContractRegister(params)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to download contract register')
    } finally {
      setDownloadingCsv(false)
    }
  }

  const handleDownloadReport = async (contractId: string) => {
    setDownloadingId(contractId)
    setError('')
    try {
      const detail = await contractsApi.get(contractId)
      await downloadContractReportPdf(detail)
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to download contract report',
      )
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDownloadAllReports = async () => {
    if (rows.length === 0) return
    setDownloadingZip(true)
    setZipProgress(`0 / ${rows.length}`)
    setError('')
    try {
      const details = []
      for (let i = 0; i < rows.length; i++) {
        details.push(await contractsApi.get(rows[i].id))
        setZipProgress(`${i + 1} / ${rows.length}`)
      }
      await downloadContractReportsZip(details, 'contract-reports.zip', (done, total) => {
        setZipProgress(`PDF ${done} / ${total}`)
      })
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to download contract reports ZIP',
      )
    } finally {
      setDownloadingZip(false)
      setZipProgress('')
    }
  }

  return (
    <Card>
      <CardHeader
        title="Contracts"
        subtitle={
          company ? `Contracts for ${company.name}` : 'Purchase / sales trade agreements'
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadCsv}
              disabled={!company || downloadingCsv || rows.length === 0}
              title="Download contract register CSV"
            >
              <Download size={16} />
              {downloadingCsv ? 'CSV…' : 'Register CSV'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadAllReports}
              disabled={!company || downloadingZip || rows.length === 0}
              title="Download all contract report PDFs as ZIP"
            >
              <FileArchive size={16} />
              {downloadingZip ? zipProgress || 'ZIP…' : 'All Reports'}
            </Button>
            {company ? (
              <Link to="/contracts/new">
                <Button size="sm">
                  <Plus size={16} /> New Contract
                </Button>
              </Link>
            ) : (
              <Button size="sm" disabled>
                <Plus size={16} /> New Contract
              </Button>
            )}
          </div>
        }
      />
      <CardBody>
        {!company && (
          <Alert message="Select a company in Masters → Company (checkbox) to view contracts." />
        )}
        {error && <Alert message={error} />}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <DataTable
            columns={[
              { key: 'contract_no', label: 'Contract #' },
              {
                key: 'contract_date',
                label: 'Date',
                render: (r) => formatDateDmy(r.contract_date as string),
              },
              {
                key: 'company_id',
                label: 'Company',
                render: () => company?.name ?? '—',
              },
              { key: 'contract_type', label: 'Type' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => <Badge label={r.status as string} />,
              },
              { key: 'qty_low', label: 'Qty Low' },
              { key: 'qty_high', label: 'Qty High' },
              {
                key: 'final_qty',
                label: 'Final Qty',
                render: (r) =>
                  r.final_qty != null && r.final_qty !== ''
                    ? String(r.final_qty)
                    : '—',
              },
              { key: 'qty_unit', label: 'Unit' },
              { key: 'rate', label: 'Rate' },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 disabled:opacity-50"
                      title="Download contract report PDF"
                      disabled={downloadingId === (r.id as string) || downloadingZip}
                      onClick={() => handleDownloadReport(r.id as string)}
                    >
                      <Download size={16} />
                    </button>
                    {(r.status as string) !== 'CANCELLED' && (
                      <Link
                        to={`/contracts/${r.id}/edit`}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                        title="Edit contract"
                      >
                        <Pencil size={16} />
                      </Link>
                    )}
                    <Link
                      to={`/contracts/${r.id}`}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                      title="View contract"
                    >
                      <Eye size={16} />
                    </Link>
                  </div>
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

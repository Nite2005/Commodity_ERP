import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react'
import { reportsApi, ApiClientError } from '../api/client'
import type { PartyLedgerResponse } from '../types'
import { Card, CardBody, CardHeader } from './Card'
import { formatDateDmy } from '../lib/dates'

interface PartyLedgerPanelProps {
  sellerId: string
  sellerName: string
  buyerId: string
  buyerName: string
  currentContractNo?: string
}

function formatInr(value: number | string | undefined): string {
  if (value === undefined || value === null) return '₹0.00'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num)
}

export function PartyLedgerPanel({
  sellerId,
  sellerName,
  buyerId,
  buyerName,
  currentContractNo,
}: PartyLedgerPanelProps) {
  // Default to buyer or seller
  const [selectedPartyId, setSelectedPartyId] = useState<string>(buyerId || sellerId)
  const [ledger, setLedger] = useState<PartyLedgerResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  const isSellerSelected = selectedPartyId === sellerId

  const fetchLedger = async (partyId: string) => {
    if (!partyId) return
    setLoading(true)
    setError('')
    try {
      const data = await reportsApi.getPartyLedger(partyId)
      setLedger(data)
      setLastSynced(new Date().toLocaleTimeString())
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Unable to load party ledger data.',
      )
      setLedger(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedPartyId) {
      fetchLedger(selectedPartyId)
    }
  }, [selectedPartyId])

  const utilizationPercent =
    ledger && ledger.credit_limit > 0
      ? Math.min(100, Math.max(0, (ledger.total_outstanding / ledger.credit_limit) * 100))
      : 0

  return (
    <Card className="h-full flex flex-col border border-slate-200/80 shadow-sm">
      <CardHeader
        title="Integrated Party Ledger"
        subtitle="Real-time financial exposure, credit limits, and contract breakdown"
        action={
          <button
            type="button"
            onClick={() => fetchLedger(selectedPartyId)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
            title="Sync Ledger"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span>{loading ? 'Syncing…' : 'Sync'}</span>
          </button>
        }
      />

      <CardBody className="p-4 sm:p-5 flex-1 flex flex-col gap-4">
        {/* Counterparty Toggle Switch */}
        <div className="flex items-center gap-2 rounded-lg bg-slate-100/80 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setSelectedPartyId(buyerId)}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              !isSellerSelected
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="truncate">Buyer: {buyerName}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedPartyId(sellerId)}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              isSellerSelected
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="truncate">Seller: {sellerName}</span>
          </button>
        </div>

        {/* Loading / Error / Data States */}
        {loading && !ledger ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span className="text-xs">Fetching real-time ledger & balances…</span>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={() => fetchLedger(selectedPartyId)}
                className="mt-2 text-rose-700 underline font-semibold"
              >
                Retry Loading
              </button>
            </div>
          </div>
        ) : ledger ? (
          <>
            {/* Header Financial Exposure Widget */}
            <div
              className={`rounded-xl border p-4 transition-colors ${
                ledger.is_overdue
                  ? 'bg-gradient-to-br from-rose-50/90 to-red-100/40 border-rose-200'
                  : 'bg-gradient-to-br from-emerald-50/90 to-teal-50/40 border-emerald-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Total Outstanding Amount
                  </span>
                  <div
                    className={`text-2xl font-bold tracking-tight ${
                      ledger.is_overdue ? 'text-rose-900' : 'text-emerald-950'
                    }`}
                  >
                    {formatInr(ledger.total_outstanding)}
                  </div>
                </div>

                <div className="text-right">
                  {ledger.is_overdue ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                      <AlertCircle size={12} />
                      Overdue / Limit Exceeded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 size={12} />
                      Within Credit Limit
                    </span>
                  )}
                  {lastSynced && (
                    <div className="text-[10px] text-slate-400 mt-1">Synced {lastSynced}</div>
                  )}
                </div>
              </div>

              {/* Exposure Bar & Metrics */}
              <div className="mt-3.5 pt-3 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                  <span>Credit Limit: <strong className="text-slate-900">{formatInr(ledger.credit_limit)}</strong></span>
                  <span>
                    Exposure:{' '}
                    <strong
                      className={
                        ledger.is_overdue ? 'text-rose-700' : 'text-emerald-700'
                      }
                    >
                      {utilizationPercent.toFixed(1)}%
                    </strong>
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      ledger.is_overdue
                        ? 'bg-rose-500'
                        : utilizationPercent > 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                  ></div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div>
                    Total Contracts Value: <span className="font-semibold text-slate-800">{formatInr(ledger.total_contract_value)}</span>
                  </div>
                  <div className="text-right">
                    Adjustments / Billed: <span className="font-semibold text-slate-800">{formatInr(ledger.total_adjustments)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract Breakdown Table */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet size={14} className="text-slate-500" />
                  Contract Breakdown Table ({ledger.contracts_count})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Party Code: {ledger.party_code}
                </span>
              </div>

              {ledger.contracts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                  No contracts found for this party.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2 px-2.5">Contract No.</th>
                        <th className="py-2 px-2">Date</th>
                        <th className="py-2 px-2 text-right">Total Value</th>
                        <th className="py-2 px-2 text-right">Pending Payment</th>
                        <th className="py-2 px-2 text-right">Adjustments</th>
                        <th className="py-2 px-2.5 text-right font-bold text-slate-800">Net Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.contracts.map((c) => {
                        const isCurrent = c.contract_no === currentContractNo
                        return (
                          <tr
                            key={c.contract_id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isCurrent ? 'bg-amber-50/50 font-medium' : ''
                            }`}
                          >
                            <td className="py-2 px-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800">
                                  #{c.contract_no}
                                </span>
                                {isCurrent && (
                                  <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {c.commodity_name || 'Commodity'} · {c.role}
                              </div>
                            </td>
                            <td className="py-2 px-2 whitespace-nowrap text-slate-600">
                              {formatDateDmy(c.contract_date)}
                            </td>
                            <td className="py-2 px-2 text-right whitespace-nowrap text-slate-700">
                              {formatInr(c.total_value)}
                            </td>
                            <td className="py-2 px-2 text-right whitespace-nowrap text-slate-700">
                              {formatInr(c.pending_payment)}
                            </td>
                            <td className="py-2 px-2 text-right whitespace-nowrap text-slate-500">
                              {formatInr(c.adjustments)}
                            </td>
                            <td className="py-2 px-2.5 text-right whitespace-nowrap font-bold text-slate-900">
                              {formatInr(c.net_due)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </CardBody>
    </Card>
  )
}

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react'
import { approvalsApi, ApiClientError } from '../api/client'
import type { ApprovalRequest, FieldDiffItem } from '../types'
import { Modal } from './Modal'
import { Button } from './Button'
import { formatDateDmy } from '../lib/dates'

interface ChangeLogModalProps {
  open: boolean
  onClose: () => void
  entityId: string | null
  entityName: string
  entityType?: 'PARTY' | 'RATE_MASTER'
}

export function ChangeLogModal({
  open,
  onClose,
  entityId,
  entityName,
  entityType = 'PARTY',
}: ChangeLogModalProps) {
  const [logs, setLogs] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadHistory = async () => {
    if (!entityId) return
    setLoading(true)
    setError('')
    try {
      const data = await approvalsApi.getEntityHistory(entityId)
      setLogs(data)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load change history logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && entityId) {
      loadHistory()
    } else {
      setLogs([])
      setError('')
    }
  }, [open, entityId])

  const parseDiffs = (jsonStr: string): Record<string, FieldDiffItem> => {
    try {
      return JSON.parse(jsonStr)
    } catch {
      return {}
    }
  }

  return (
    <Modal
      open={open}
      title="Audit Log & Change History"
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 p-3.5 rounded-lg">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
              <History size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">{entityName}</h4>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {entityType === 'PARTY' ? 'Party Master' : 'Rate Master'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of changes, previous vs new values, and supervisor authorization
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadHistory}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Content list */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin text-indigo-500" />
            <span className="text-xs">Loading change logs…</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-lg p-6 bg-slate-50/50">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400 mb-2">
              <Shield size={20} />
            </div>
            <h5 className="text-xs font-bold text-slate-700">No Change Logs Recorded</h5>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-1">
              This record is in its baseline state. When sensitive fields (Bank Details, IFSC, GST, Credit Limit, or Rates) are updated, the previous value, new value, and approving supervisor (Kannu / Kanha) will be logged here.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {logs.map((req) => {
              const diffs = parseDiffs(req.changes_json)
              const isApproved = req.status === 'APPROVED'
              const isPending = req.status === 'PENDING'
              const isRejected = req.status === 'REJECTED'

              return (
                <div
                  key={req.id}
                  className={`rounded-lg border p-4 transition-all ${
                    isApproved
                      ? 'border-emerald-200 bg-white shadow-xs'
                      : isPending
                      ? 'border-amber-300 bg-amber-50/20'
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  {/* Event Meta Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      {isApproved && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          Approved via {req.reviewed_by || 'Supervisor'}
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Clock size={12} />
                          Pending Supervisor Review
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                          <XCircle size={12} />
                          Rejected by {req.reviewed_by || 'Supervisor'}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        Requested by <strong className="text-slate-700">{req.requested_by}</strong>
                      </span>
                    </div>

                    <div className="text-right text-[11px] text-slate-500">
                      {isApproved && req.reviewed_at ? (
                        <span>
                          Approved on <strong className="text-slate-700">{formatDateDmy(req.reviewed_at)}</strong>
                        </span>
                      ) : (
                        <span>
                          Created on <strong className="text-slate-700">{formatDateDmy(req.created_at)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reason if rejected */}
                  {isRejected && req.rejection_reason && (
                    <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                      <strong>Rejection reason:</strong> {req.rejection_reason}
                    </div>
                  )}

                  {/* Before vs After Diff Table */}
                  <div className="overflow-x-auto rounded border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <tr>
                          <th className="py-1.5 px-3 w-1/3">Field Name</th>
                          <th className="py-1.5 px-3 w-1/3">Previous Value (Old)</th>
                          <th className="py-1.5 px-3 w-1/3">New Value (Approved/Proposed)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {Object.entries(diffs).map(([fieldKey, item]) => (
                          <tr key={fieldKey} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-medium text-slate-700">
                              {item.label || fieldKey.replace(/_/g, ' ').toUpperCase()}
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-rose-50 text-rose-700 border border-rose-200">
                                {item.old != null && String(item.old).trim() !== ''
                                  ? String(item.old)
                                  : '— (Empty)'}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                {item.new != null && String(item.new).trim() !== ''
                                  ? String(item.new)
                                  : '— (Empty)'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

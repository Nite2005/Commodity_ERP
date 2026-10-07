import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { approvalsApi, ApiClientError } from '../../api/client'
import type { ApprovalRequest, FieldDiffItem } from '../../types'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Modal'
import { formatDateDmy } from '../../lib/dates'
import { useActiveUser } from '../../context/UserContext'

export function ApprovalsPage() {
  const { currentUser, isEmployee, supervisors } = useActiveUser()
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [activeSupervisor, setActiveSupervisor] = useState<string>('Kannu')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Sync active supervisor with current user if Admin
  useEffect(() => {
    if (currentUser?.role === 'ADMIN') {
      setActiveSupervisor(currentUser.full_name)
    } else if (supervisors.length > 0) {
      setActiveSupervisor(supervisors[0].full_name)
    }
  }, [currentUser, supervisors])

  const loadRequests = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await approvalsApi.list(statusFilter || undefined)
      setRequests(data)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load approval requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [statusFilter])

  const handleApprove = async (id: string) => {
    if (isEmployee) {
      setFeedbackMsg({
        type: 'error',
        text: 'Action forbidden: Employees have read-only access. Only Administrators can authorize changes.',
      })
      return
    }
    setActionLoadingId(id)
    setFeedbackMsg(null)
    try {
      await approvalsApi.approve(id, activeSupervisor)
      setFeedbackMsg({
        type: 'success',
        text: `Request successfully approved by Supervisor ${activeSupervisor} and applied to master record.`,
      })
      await loadRequests()
    } catch (e) {
      setFeedbackMsg({
        type: 'error',
        text: e instanceof ApiClientError ? e.message : 'Approval failed',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleReject = async (id: string) => {
    if (isEmployee) {
      setFeedbackMsg({
        type: 'error',
        text: 'Action forbidden: Employees have read-only access. Only Administrators can reject requests.',
      })
      return
    }
    setActionLoadingId(id)
    setFeedbackMsg(null)
    try {
      await approvalsApi.reject(id, activeSupervisor, rejectReason || undefined)
      setFeedbackMsg({
        type: 'success',
        text: `Request rejected by Supervisor ${activeSupervisor}.`,
      })
      setRejectingId(null)
      setRejectReason('')
      await loadRequests()
    } catch (e) {
      setFeedbackMsg({
        type: 'error',
        text: e instanceof ApiClientError ? e.message : 'Rejection failed',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const parseDiffs = (jsonStr: string): Record<string, FieldDiffItem> => {
    try {
      return JSON.parse(jsonStr)
    } catch {
      return {}
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 mt-1">
            <ShieldCheck size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                Supervisor Authorization Gate
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                MULTI-GATE WORKFLOW
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and authorize sensitive master data changes (Bank Accounts, GST, Rates) staged by employees
            </p>
          </div>
        </div>

        {/* Dynamic Supervisor Profile Selector */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Authorizing Supervisor
            </div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1 justify-end">
              <UserCheck size={13} className="text-indigo-600" />
              {activeSupervisor}
            </div>
          </div>
          <div className="flex gap-1 bg-white p-1 rounded-md border border-slate-200 shadow-xs">
            {supervisors.length > 0 ? (
              supervisors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSupervisor(s.full_name)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                    activeSupervisor === s.full_name
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.full_name}
                </button>
              ))
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSupervisor('Kannu')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                    activeSupervisor === 'Kannu'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kannu
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSupervisor('Kanha')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                    activeSupervisor === 'Kanha'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kanha
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Employee Read-Only Warning Banner */}
      {isEmployee && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h4 className="font-bold text-amber-950">Employee Read-Only Mode Active</h4>
            <p className="mt-0.5 text-amber-800">
              You are signed in as an Employee (<strong>{currentUser?.full_name}</strong>). You have read-only permissions to review change requests and past logs. Authorizing or rejecting updates requires Administrator rights.
            </p>
          </div>
        </div>
      )}

      {feedbackMsg && (
        <Alert
          message={feedbackMsg.text}
          type={feedbackMsg.type === 'error' ? 'error' : 'success'}
        />
      )}
      {error && <Alert message={error} />}

      {/* Filter Tabs & Refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={13} />
            Pending Approval
            {statusFilter === 'PENDING' && requests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {requests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              statusFilter === 'APPROVED'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 size={13} />
            Approved Logs (History)
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              statusFilter === 'REJECTED'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle size={13} />
            Rejected
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all ${
              statusFilter === ''
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Requests
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-1"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
          <RefreshCw size={24} className="animate-spin text-indigo-500" />
          <span className="text-xs">Loading staged change requests…</span>
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-300">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <CheckCircle2 size={22} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {statusFilter === 'PENDING'
                ? 'No Pending Authorization Requests'
                : 'No Requests Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {statusFilter === 'PENDING'
                ? 'All master data edits are fully approved. Edits to sensitive party profiles or rates will appear here for supervisor authorization.'
                : 'No records match the current filter.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const diffs = parseDiffs(req.changes_json)
            const isPending = req.status === 'PENDING'
            const isApproved = req.status === 'APPROVED'
            const isRejected = req.status === 'REJECTED'

            return (
              <Card
                key={req.id}
                className={`border transition-all ${
                  isPending
                    ? 'border-amber-300/80 shadow-xs bg-white'
                    : isApproved
                    ? 'border-emerald-200 bg-slate-50/50'
                    : 'border-slate-200 bg-slate-50/50 opacity-90'
                }`}
              >
                <div className="p-5">
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          req.entity_type === 'PARTY'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {req.entity_type === 'PARTY' ? (
                          <Shield size={18} />
                        ) : (
                          <ShieldAlert size={18} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {req.entity_type === 'CONTRACT' ? 'Contract Agreement' : `${req.entity_type.replace('_', ' ')} Master`}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-500">
                            Requested by <strong className="text-slate-700">{req.requested_by}</strong> on {formatDateDmy(req.created_at)}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 mt-0.5">
                          {req.entity_name}
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">{req.change_summary}</p>
                      </div>
                    </div>

                    <div>
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                          <Clock size={12} />
                          Pending Review
                        </span>
                      )}
                      {isApproved && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 size={12} />
                          Approved by {req.reviewed_by}
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-300">
                          <XCircle size={12} />
                          Rejected by {req.reviewed_by}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Staged Diffs Table */}
                  <div className="mt-4">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Proposed Master Data Changes (Before vs After)
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr>
                            <th className="py-2 px-3 w-1/3">Field Name</th>
                            <th className="py-2 px-3 w-1/3">Current Value (Before)</th>
                            <th className="py-2 px-3 w-1/3">Proposed Value (After)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(diffs).map(([fieldKey, diff]) => (
                            <tr key={fieldKey} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {diff.label || fieldKey}
                              </td>
                              <td className="py-2 px-3 text-rose-800 bg-rose-50/40 font-mono">
                                {diff.old ? String(diff.old) : <em className="text-slate-400 not-italic">None / Empty</em>}
                              </td>
                              <td className="py-2 px-3 font-bold text-emerald-900 bg-emerald-50/40 font-mono">
                                {diff.new ? String(diff.new) : <em className="text-slate-400 not-italic">Cleared</em>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Review Information or Action Buttons */}
                  {isPending && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        Authorization required from:{' '}
                        <strong className="text-slate-800">
                          {supervisors.length > 0
                            ? supervisors.map((s) => s.full_name).join(' / ')
                            : 'Administrator'}
                        </strong>
                      </div>

                      {isEmployee ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200"
                            title="Employees have read-only access. Only Administrators can authorize master data updates."
                          >
                            <ShieldAlert size={14} className="text-amber-600" />
                            Admin Approval Required · Read-Only Mode
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {rejectingId === req.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Reason for rejection (optional)…"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 w-56 focus:outline-none focus:ring-1 focus:ring-rose-500"
                              />
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={actionLoadingId === req.id}
                                onClick={() => handleReject(req.id)}
                              >
                                Confirm Reject
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRejectingId(null)
                                  setRejectReason('')
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={actionLoadingId === req.id}
                                onClick={() => setRejectingId(req.id)}
                                className="text-rose-700 hover:bg-rose-50 border-rose-200"
                              >
                                <X size={14} className="mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={actionLoadingId === req.id}
                                onClick={() => handleApprove(req.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Check size={14} className="mr-1" />
                                Approve as {activeSupervisor}
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {isRejected && req.rejection_reason && (
                    <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                      <strong>Rejection Note:</strong> {req.rejection_reason}
                    </div>
                  )}

                  {isApproved && (
                    <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      Changes permanently applied to master database by <strong>{req.reviewed_by}</strong> on {formatDateDmy(req.reviewed_at || req.created_at)}.
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

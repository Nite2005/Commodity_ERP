import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, RefreshCw, Download, FileCheck, Lock, Upload, ShieldCheck, History } from 'lucide-react'
import { mastersApi, ApiClientError } from '../../api/client'
import type { CustomerType, Party } from '../../types'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Modal, FormField, inputClass, Alert } from '../../components/Modal'
import { Badge } from '../../components/Badge'
import { ChangeLogModal } from '../../components/ChangeLogModal'
import { BulkImportModal } from '../../components/BulkImportModal'
import { useActiveUser } from '../../context/UserContext'

const customerTypes: { value: CustomerType; label: string }[] = [
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'UNREGISTERED', label: 'Unregistered' },
  { value: 'COMPOSITION', label: 'Composition' },
  { value: 'SEZ', label: 'SEZ' },
  { value: 'BUYER', label: 'Buyer' },
  { value: 'SELLER', label: 'Seller' },
  { value: 'BOTH', label: 'Both' },
]

const emptyForm = () => ({
  name: '',
  short_name: '',
  customer_type: 'BUYER' as CustomerType,
  gst_tin: '',
  address_line: '',
  city: '',
  state: '',
  pincode: '',
  mobile: '',
  designation: '',
  account_no: '',
  bank_name: '',
  ifsc_code: '',
})

export function PartiesPage() {
  const { company } = useSelectedCompany()
  const { isAdmin, currentUser } = useActiveUser()
  const [rows, setRows] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [editing, setEditing] = useState<Party | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [chequeFile, setChequeFile] = useState<File | null>(null)
  const [chequeLoading, setChequeLoading] = useState(false)
  const [chequeMsg, setChequeMsg] = useState('')
  const [historyParty, setHistoryParty] = useState<Party | null>(null)

  const load = useCallback(async () => {
    if (!company) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setRows(await mastersApi.parties.list({ companyId: company.id }))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    if (!isAdmin) return
    setEditing(null)
    setForm(emptyForm())
    setChequeFile(null)
    setChequeMsg('')
    setModalOpen(true)
  }

  const openEdit = (row: Party) => {
    setEditing(row)
    setChequeFile(null)
    setChequeMsg('')
    setForm({
      name: row.name,
      short_name: row.short_name,
      customer_type: row.customer_type,
      gst_tin: row.gst_tin ?? '',
      address_line: row.address_line,
      city: row.city,
      state: row.state,
      pincode: row.pincode,
      mobile: row.mobile ?? '',
      designation: row.designation ?? '',
      account_no: row.account_no ?? '',
      bank_name: row.bank_name ?? '',
      ifsc_code: row.ifsc_code ?? '',
    })
    setModalOpen(true)
  }

  const handleUploadCheque = async () => {
    if (!editing || !chequeFile) return
    setChequeLoading(true)
    setChequeMsg('')
    try {
      await mastersApi.parties.uploadCheque(editing.id, chequeFile)
      setChequeMsg('Cancelled cheque successfully uploaded to secured vault!')
      setChequeFile(null)
      await load()
      // Refresh editing party
      const updated = await mastersApi.parties.list({ companyId: company?.id })
      const match = updated.find((p) => p.id === editing.id)
      if (match) setEditing(match)
    } catch (e) {
      setChequeMsg(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setChequeLoading(false)
    }
  }

  const handleDownloadCheque = async () => {
    if (!editing) return
    setChequeLoading(true)
    try {
      const blob = await mastersApi.parties.downloadCheque(
        editing.id,
        currentUser?.role || (isAdmin ? 'ADMIN' : 'EMPLOYEE'),
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = editing.cancelled_cheque_filename || `cheque_${editing.party_code}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      setChequeMsg(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setChequeLoading(false)
    }
  }

  const handleDeleteCheque = async () => {
    if (!isAdmin) {
      setChequeMsg('Access Denied: Employees can only view cancelled cheques. Deletion is restricted to Administrators.')
      return
    }
    if (!editing || !window.confirm('Remove this cancelled cheque from the vault?')) return
    setChequeLoading(true)
    try {
      await mastersApi.parties.deleteCheque(editing.id, currentUser?.role || 'ADMIN')
      setChequeMsg('Cheque removed from vault')
      await load()
      const updated = await mastersApi.parties.list({ companyId: company?.id })
      const match = updated.find((p) => p.id === editing.id)
      if (match) setEditing(match)
    } catch (e) {
      setChequeMsg(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setChequeLoading(false)
    }
  }

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    if (!company) {
      setError('Select a company in Company Master first.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      company_id: company.id,
      name: form.name,
      short_name: form.short_name,
      customer_type: form.customer_type,
      gst_tin: form.gst_tin || null,
      address_line: form.address_line,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      mobile: form.mobile || null,
      designation: form.designation || null,
      account_no: form.account_no || null,
      bank_name: form.bank_name || null,
      ifsc_code: form.ifsc_code || null,
    }
    try {
      if (editing) {
        const res = await mastersApi.parties.update(editing.id, payload)
        if (!isAdmin || res.has_pending_approval) {
          alert('Change request submitted! Since you are signed in as an Employee, changes are not updated immediately and have been routed to the Governance → Approvals section for Administrator approval.')
        }
      } else {
        await mastersApi.parties.create(payload)
      }
      setModalOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!isAdmin) return
    if (!confirm('Deactivate this party?')) return
    await mastersApi.parties.remove(id)
    await load()
  }

  return (
    <Card>
      <CardHeader
        title="Party"
        subtitle={
          company
            ? `Parties for ${company.name}`
            : 'Clients and counterparties linked to the selected company'
        }
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load} disabled={loading} title="Reload parties">
              <RefreshCw size={16} className={loading ? 'animate-spin text-brand-600' : ''} />
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setImportModalOpen(true)}
                  disabled={!company}
                  title="Import parties from file (.xlsx, .csv, .json, etc.)"
                >
                  <Upload size={16} /> Import
                </Button>
                <Button size="sm" onClick={openCreate} disabled={!company}>
                  <Plus size={16} /> Add Party
                </Button>
              </>
            )}
          </div>
        }
      />
      <CardBody>
        {!company && !loading && (
          <Alert message="Select a company in Masters → Company (checkbox), then add parties." />
        )}
        {company && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Working company:{' '}
            <span className="font-semibold text-slate-800">{company.name}</span>
            {' · '}
            <Link to="/masters/companies" className="text-brand-600 hover:underline">
              Change in Company Master
            </Link>
          </div>
        )}

        {error && !modalOpen && <Alert message={error} />}

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <DataTable
            columns={[
              { key: 'party_code', label: 'Code' },
              {
                key: 'name',
                label: 'Party Name',
                render: (r) => (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{r.name as string}</span>
                    {(r as unknown as Party).has_pending_approval && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        ⏳ Pending Approval
                      </span>
                    )}
                  </div>
                ),
              },
              { key: 'short_name', label: 'Short' },
              { key: 'customer_type', label: 'Type' },
              { key: 'city', label: 'City' },
              { key: 'gst_tin', label: 'GST', render: (r) => (r.gst_tin as string) || '—' },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <Badge label={(r.is_active as boolean) ? 'active' : 'inactive'} />
                ),
              },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHistoryParty(r as unknown as Party)}
                      className="rounded p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="View Change Log & Supervisor Approvals"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => openEdit(r as unknown as Party)}
                      className="rounded p-1.5 text-slate-400 hover:text-brand-600"
                      title="Edit Party"
                    >
                      <Pencil size={16} />
                    </button>
                    {isAdmin && (r.is_active as boolean) && (
                      <button
                        onClick={() => remove(r.id as string)}
                        className="rounded p-1.5 text-slate-400 hover:text-red-600"
                        title="Deactivate"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
          />
        )}
      </CardBody>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Party' : 'New Party'}
        onClose={() => setModalOpen(false)}
        wide
      >
        {error && modalOpen && (
          <div className="mb-4">
            <Alert message={error} />
          </div>
        )}
        {editing && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold text-amber-800">Multi-Gate Supervisor Authorization Policy</p>
                <button
                  type="button"
                  onClick={() => setHistoryParty(editing)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 shadow-xs"
                >
                  <History size={12} /> View Change Log
                </button>
              </div>
              <p className="text-amber-700 mt-0.5">
                Edits to sensitive master records (Bank Account, IFSC, GST-TIN, Party Legal Name) are automatically staged and routed to Supervisors (Kannu / Kanha) in Governance → Approvals for verification before taking final effect.
              </p>
              {editing.has_pending_approval && (
                <p className="mt-1 font-medium text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded inline-block">
                  ⏳ This party currently has pending changes awaiting supervisor review.
                </p>
              )}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Company">
            <input className={inputClass} value={company?.name ?? ''} disabled />
          </FormField>
          <FormField label="Party Name" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </FormField>
          <FormField label="Short Name" required>
            <input
              className={inputClass}
              value={form.short_name}
              onChange={(e) => set('short_name', e.target.value)}
              required
            />
          </FormField>
          <FormField label="Customer Type" required>
            <select
              className={inputClass}
              value={form.customer_type}
              onChange={(e) => set('customer_type', e.target.value)}
            >
              {customerTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="GST-TIN">
            <input
              className={inputClass}
              value={form.gst_tin}
              onChange={(e) => set('gst_tin', e.target.value)}
              placeholder="15 char GSTIN"
            />
          </FormField>
          <FormField label="Address" required>
            <input
              className={inputClass}
              value={form.address_line}
              onChange={(e) => set('address_line', e.target.value)}
              required
            />
          </FormField>
          <FormField label="City" required>
            <input
              className={inputClass}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              required
            />
          </FormField>
          <FormField label="State" required>
            <input
              className={inputClass}
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
              required
            />
          </FormField>
          <FormField label="Pincode" required>
            <input
              className={inputClass}
              value={form.pincode}
              onChange={(e) => set('pincode', e.target.value)}
              required
            />
          </FormField>
          <FormField label="Mobile">
            <input className={inputClass} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
          </FormField>
          <FormField label="Designation">
            <input
              className={inputClass}
              value={form.designation}
              onChange={(e) => set('designation', e.target.value)}
            />
          </FormField>
          <FormField label="Bank Name">
            <input
              className={inputClass}
              value={form.bank_name}
              onChange={(e) => set('bank_name', e.target.value)}
              placeholder="e.g. HDFC Bank"
            />
          </FormField>
          <FormField label="Account No">
            <input
              className={inputClass}
              value={form.account_no}
              onChange={(e) => set('account_no', e.target.value)}
            />
          </FormField>
          <FormField label="IFSC Code">
            <input
              className={inputClass}
              value={form.ifsc_code}
              onChange={(e) => set('ifsc_code', e.target.value)}
            />
          </FormField>
        </div>

        {editing && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-slate-200 p-1 text-slate-700">
                  <Lock size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Secured Document Vault — Canceled Cheque
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Required by clients for payment processing. Access restricted to authorized profiles.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                <Lock size={10} /> RESTRICTED
              </span>
            </div>

            {chequeMsg && (
              <div className="mb-3 text-xs font-medium text-brand-700 bg-brand-50 p-2 rounded">
                {chequeMsg}
              </div>
            )}

            {editing.cancelled_cheque_filename ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="text-emerald-600" size={18} />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">
                      {editing.cancelled_cheque_filename}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-medium">
                      Verified cheque image on file in secured storage
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleDownloadCheque}
                    disabled={chequeLoading}
                  >
                    <Download size={14} className="mr-1" />
                    Download / View
                  </Button>
                  {isAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleDeleteCheque}
                      disabled={chequeLoading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete cheque (Admin only)"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
                <p className="text-xs text-slate-600 mb-2">
                  No canceled cheque uploaded for this party.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setChequeFile(e.target.files?.[0] || null)}
                    className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2.5 file:py-1 file:text-xs file:font-semibold hover:file:bg-slate-300"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUploadCheque}
                    disabled={!chequeFile || chequeLoading}
                  >
                    <Upload size={14} className="mr-1" />
                    {chequeLoading ? 'Uploading…' : 'Upload to Vault'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Modal>

      <ChangeLogModal
        open={Boolean(historyParty)}
        onClose={() => setHistoryParty(null)}
        entityId={historyParty?.id ?? null}
        entityName={historyParty?.name ?? ''}
        entityType="PARTY"
      />

      <BulkImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Parties"
        entityType="Party"
        onImport={(items) => mastersApi.parties.bulkCreate(company!.id, items)}
        onSuccess={load}
      />
    </Card>
  )
}

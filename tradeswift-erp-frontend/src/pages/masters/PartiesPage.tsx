import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { mastersApi, ApiClientError } from '../../api/client'
import type { CustomerType, Party } from '../../types'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Modal, FormField, inputClass, Alert } from '../../components/Modal'
import { Badge } from '../../components/Badge'

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
  const [rows, setRows] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Party | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

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
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (row: Party) => {
    setEditing(row)
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
      if (editing) await mastersApi.parties.update(editing.id, payload)
      else await mastersApi.parties.create(payload)
      setModalOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
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
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw size={16} />
            </Button>
            <Button size="sm" onClick={openCreate} disabled={!company}>
              <Plus size={16} /> Add Party
            </Button>
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
              { key: 'name', label: 'Party Name' },
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(r as unknown as Party)}
                      className="rounded p-1.5 text-slate-400 hover:text-brand-600"
                    >
                      <Pencil size={16} />
                    </button>
                    {(r.is_active as boolean) && (
                      <button
                        onClick={() => remove(r.id as string)}
                        className="rounded p-1.5 text-slate-400 hover:text-red-600"
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
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Modal>
    </Card>
  )
}

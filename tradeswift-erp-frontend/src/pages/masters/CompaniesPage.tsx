import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { mastersApi, ApiClientError } from '../../api/client'
import type { Company } from '../../types'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Modal, FormField, inputClass, Alert } from '../../components/Modal'
import { Badge } from '../../components/Badge'

const emptyForm = () => ({
  name: '',
  gst_tin: '',
  address: '',
  account_no: '',
  bank_name: '',
  ifsc_code: '',
  phone: '',
})

export function CompaniesPage() {
  const { refresh: refreshSelected } = useSelectedCompany()
  const [rows, setRows] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await mastersApi.companies.list())
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  const openEdit = (row: Company) => {
    setEditing(row)
    setForm({
      name: row.name,
      gst_tin: row.gst_tin ?? '',
      address: row.address ?? '',
      account_no: row.account_no ?? '',
      bank_name: row.bank_name ?? '',
      ifsc_code: row.ifsc_code ?? '',
      phone: row.phone ?? '',
    })
    setModalOpen(true)
  }

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    setSaving(true)
    setError('')
    const payload = {
      name: form.name,
      gst_tin: form.gst_tin || null,
      address: form.address || '',
      account_no: form.account_no || null,
      bank_name: form.bank_name || null,
      ifsc_code: form.ifsc_code || null,
      phone: form.phone || null,
    }
    try {
      if (editing) await mastersApi.companies.update(editing.id, payload)
      else await mastersApi.companies.create(payload)
      setModalOpen(false)
      await load()
      await refreshSelected()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Deactivate this company?')) return
    try {
      await mastersApi.companies.remove(id)
      await load()
      await refreshSelected()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Delete failed')
    }
  }

  const onSelect = async (row: Company) => {
    if (row.is_selected || !row.is_active) return
    setSelectingId(row.id)
    setError('')
    try {
      await mastersApi.companies.select(row.id)
      await load()
      await refreshSelected()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not select company')
    } finally {
      setSelectingId(null)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Company"
        subtitle="Select one company — that company is used across the whole ERP"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw size={16} />
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} /> Add New
            </Button>
          </div>
        }
      />
      <CardBody>
        {error && !modalOpen && <Alert message={error} />}
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <DataTable
            columns={[
              {
                key: 'is_selected',
                label: 'Selected',
                render: (r) => {
                  const row = r as unknown as Company
                  return (
                    <input
                      type="checkbox"
                      checked={!!row.is_selected}
                      disabled={!row.is_active || selectingId === row.id}
                      onChange={() => onSelect(row)}
                      title={
                        row.is_selected
                          ? 'Currently selected company'
                          : 'Select this company for the ERP'
                      }
                      className="h-4 w-4 cursor-pointer accent-brand-600"
                    />
                  )
                },
              },
              { key: 'company_code', label: 'Code' },
              { key: 'name', label: 'Company Name' },
              { key: 'gst_tin', label: 'GST', render: (r) => (r.gst_tin as string) || '—' },
              { key: 'bank_name', label: 'Bank', render: (r) => (r.bank_name as string) || '—' },
              { key: 'phone', label: 'Phone', render: (r) => (r.phone as string) || '—' },
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
                      onClick={() => openEdit(r as unknown as Company)}
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
        title={editing ? 'Edit Company' : 'New Company'}
        onClose={() => setModalOpen(false)}
        wide
      >
        {error && modalOpen && (
          <div className="mb-4">
            <Alert message={error} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Company Name" required>
            <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </FormField>
          <FormField label="GST">
            <input className={inputClass} value={form.gst_tin} onChange={(e) => set('gst_tin', e.target.value)} placeholder="15 char GSTIN" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Address">
              <textarea className={`${inputClass} min-h-[80px]`} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </FormField>
          </div>
          <FormField label="A/c No">
            <input className={inputClass} value={form.account_no} onChange={(e) => set('account_no', e.target.value)} />
          </FormField>
          <FormField label="Bank Name">
            <input className={inputClass} value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
          </FormField>
          <FormField label="IFSC Code">
            <input className={inputClass} value={form.ifsc_code} onChange={(e) => set('ifsc_code', e.target.value)} placeholder="e.g. BDBL0001166" />
          </FormField>
          <FormField label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
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

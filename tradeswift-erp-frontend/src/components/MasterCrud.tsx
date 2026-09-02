import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { Card, CardBody, CardHeader } from './Card'
import { DataTable } from './DataTable'
import { Modal, Alert, FormField, inputClass } from './Modal'
import { Badge } from './Badge'
import { ApiClientError } from '../api/client'

export interface FieldConfig {
  name: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select'
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  step?: string
}

interface MasterCrudProps<T extends { id: string; is_active: boolean }> {
  title: string
  subtitle: string
  fields: FieldConfig[]
  columns: { key: string; label: string; render?: (row: T) => ReactNode }[]
  listFn: () => Promise<T[]>
  createFn: (data: Record<string, unknown>) => Promise<T>
  updateFn: (id: string, data: Record<string, unknown>) => Promise<T>
  deleteFn: (id: string) => Promise<void>
  toForm?: (row: T) => Record<string, string>
  fromForm?: (form: Record<string, string>) => Record<string, unknown>
}

export function MasterCrud<T extends { id: string; is_active: boolean }>({
  title,
  subtitle,
  fields,
  columns,
  listFn,
  createFn,
  updateFn,
  deleteFn,
  toForm,
  fromForm,
}: MasterCrudProps<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await listFn())
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [listFn])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(Object.fromEntries(fields.map((f) => [f.name, ''])))
    setModalOpen(true)
  }

  const openEdit = (row: T) => {
    setEditing(row)
    setForm(toForm ? toForm(row) : (row as unknown as Record<string, string>))
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = fromForm ? fromForm(form) : form
      if (editing) await updateFn(editing.id, payload)
      else await createFn(payload)
      setModalOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: T) => {
    if (!confirm('Deactivate this record?')) return
    try {
      await deleteFn(row.id)
      await load()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Delete failed')
    }
  }

  const tableColumns = [
    ...columns,
    {
      key: 'status',
      label: 'Status',
      render: (row: Record<string, unknown>) => (
        <Badge label={(row.is_active as boolean) ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Record<string, unknown>) => (
        <div className="flex gap-1">
          <button
            onClick={() => openEdit(row as T)}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
          >
            <Pencil size={16} />
          </button>
          {(row.is_active as boolean) && (
            <button
              onClick={() => handleDelete(row as T)}
              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
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
            columns={tableColumns as { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[]}
            rows={rows as unknown as Record<string, unknown>[]}
          />
        )}
      </CardBody>

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${title}` : `New ${title}`}
        onClose={() => setModalOpen(false)}
        wide={fields.length > 4}
      >
        {error && modalOpen && <div className="mb-4"><Alert message={error} /></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <FormField key={f.name} label={f.label} required={f.required}>
              {f.type === 'textarea' ? (
                <textarea
                  className={`${inputClass} min-h-[80px]`}
                  value={form[f.name] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  placeholder={f.placeholder}
                />
              ) : f.type === 'select' ? (
                <select
                  className={inputClass}
                  value={form[f.name] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                >
                  <option value="">Select…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type ?? 'text'}
                  step={f.step}
                  className={inputClass}
                  value={form[f.name] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  placeholder={f.placeholder}
                />
              )}
            </FormField>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Modal>
    </Card>
  )
}

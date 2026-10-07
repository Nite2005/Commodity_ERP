import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { mastersApi, ApiClientError } from '../../api/client'
import type { Contact, Party } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Modal, FormField, inputClass, Alert } from '../../components/Modal'
import { Badge } from '../../components/Badge'

import { useActiveUser } from '../../context/UserContext'

export function ContactsPage() {
  const { isAdmin } = useActiveUser()
  const [rows, setRows] = useState<Contact[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState({
    party_id: '',
    contact_name: '',
    email: '',
    phone: '',
    designation: '',
  })
  const [saving, setSaving] = useState(false)

  const partyMap = Object.fromEntries(parties.map((p) => [p.id, p.name]))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [contacts, p] = await Promise.all([
        mastersApi.contacts.list(),
        mastersApi.parties.list(),
      ])
      setRows(contacts)
      setParties(p.filter((x) => x.is_active))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ party_id: '', contact_name: '', email: '', phone: '', designation: '' })
    setModalOpen(true)
  }

  const openEdit = (row: Contact) => {
    setEditing(row)
    setForm({
      party_id: row.party_id,
      contact_name: row.contact_name,
      email: row.email ?? '',
      phone: row.phone ?? '',
      designation: row.designation ?? '',
    })
    setModalOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    const payload = {
      party_id: form.party_id,
      contact_name: form.contact_name,
      email: form.email || null,
      phone: form.phone || null,
      designation: form.designation || null,
    }
    try {
      if (editing) {
        await mastersApi.contacts.update(editing.id, payload)
        if (!isAdmin) {
          alert('Change request submitted! Since you are signed in as an Employee, changes are not updated immediately and have been routed to the Governance → Approvals section for Administrator approval.')
        }
      } else {
        await mastersApi.contacts.create(payload)
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
    if (!confirm('Deactivate this contact?')) return
    await mastersApi.contacts.remove(id)
    await load()
  }

  return (
    <Card>
      <CardHeader
        title="Contact Master"
        subtitle="Contact persons linked to parties / companies"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load} disabled={loading} title="Reload contacts">
              <RefreshCw size={16} className={loading ? 'animate-spin text-brand-600' : ''} />
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={openCreate}>
                <Plus size={16} /> Add Contact
              </Button>
            )}
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
                key: 'party_id',
                label: 'Party / Company',
                render: (r) => partyMap[r.party_id as string] ?? '—',
              },
              { key: 'contact_name', label: 'Contact Name' },
              { key: 'designation', label: 'Designation' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
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
                render: (r: Record<string, unknown>) => (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(r as unknown as Contact)}
                      className="rounded p-1.5 text-slate-400 hover:text-brand-600"
                      title="Edit Contact"
                    >
                      <Pencil size={16} />
                    </button>
                    {isAdmin && (r.is_active as boolean) && (
                      <button
                        onClick={() => remove(r.id as string)}
                        className="rounded p-1.5 text-slate-400 hover:text-red-600"
                        title="Deactivate Contact"
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
        title={editing ? 'Edit Contact' : 'New Contact'}
        onClose={() => setModalOpen(false)}
      >
        {error && modalOpen && (
          <div className="mb-4">
            <Alert message={error} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Party / Company" required>
              <select
              className={inputClass}
              value={form.party_id}
              onChange={(e) => setForm({ ...form, party_id: e.target.value })}
            >
              <option value="">Select party…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.party_code})
                </option>
              ))}
            </select>
            </FormField>
          </div>
          <FormField label="Contact Name" required>
            <input
              className={inputClass}
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </FormField>
          <FormField label="Designation">
            <input
              className={inputClass}
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
          </FormField>
          <FormField label="Phone">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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

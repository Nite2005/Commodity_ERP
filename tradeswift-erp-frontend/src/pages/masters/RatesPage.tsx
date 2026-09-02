import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { mastersApi, ApiClientError } from '../../api/client'
import type { Commodity, CustomerType, Currency, Party, QtyUnit, RateMaster } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Modal, FormField, inputClass, Alert } from '../../components/Modal'
import { Badge } from '../../components/Badge'

export function RatesPage() {
  const [rows, setRows] = useState<RateMaster[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RateMaster | null>(null)
  const [form, setForm] = useState({
    party_id: '',
    customer_type: 'BUYER' as CustomerType,
    commodity_id: '',
    rate: '',
    unit: 'MT' as QtyUnit,
    currency: 'INR' as Currency,
    brokerage: '0',
  })
  const [saving, setSaving] = useState(false)

  const partyMap = Object.fromEntries(parties.map((p) => [p.id, p.name]))
  const commMap = Object.fromEntries(commodities.map((c) => [c.id, c.commodity_name]))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, p, c] = await Promise.all([
        mastersApi.rates.list(),
        mastersApi.parties.list(),
        mastersApi.commodities.list(),
      ])
      setRows(r)
      setParties(p.filter((x) => x.is_active))
      setCommodities(c.filter((x) => x.is_active))
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
    setForm({
      party_id: '',
      customer_type: 'BUYER',
      commodity_id: '',
      rate: '',
      unit: 'MT',
      currency: 'INR',
      brokerage: '0',
    })
    setModalOpen(true)
  }

  const openEdit = (row: RateMaster) => {
    setEditing(row)
    setForm({
      party_id: row.party_id,
      customer_type: row.customer_type,
      commodity_id: row.commodity_id,
      rate: String(row.rate),
      unit: row.unit,
      currency: row.currency,
      brokerage: String(row.brokerage),
    })
    setModalOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    const payload = {
      party_id: form.party_id,
      customer_type: form.customer_type,
      commodity_id: form.commodity_id,
      rate: Number(form.rate),
      unit: form.unit,
      currency: form.currency,
      brokerage: Number(form.brokerage || 0),
    }
    try {
      if (editing) await mastersApi.rates.update(editing.id, payload)
      else await mastersApi.rates.create(payload)
      setModalOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Deactivate this billing rate?')) return
    await mastersApi.rates.remove(id)
    await load()
  }

  return (
    <Card>
      <CardHeader
        title="Billing Rate"
        subtitle="Party + commodity default billing rates and brokerage"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw size={16} />
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} /> Add Billing Rate
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
              { key: 'rate_code', label: 'Code' },
              {
                key: 'party_id',
                label: 'Party',
                render: (r) => partyMap[r.party_id as string] ?? '—',
              },
              {
                key: 'commodity_id',
                label: 'Commodity',
                render: (r) => commMap[r.commodity_id as string] ?? '—',
              },
              { key: 'rate', label: 'Rate' },
              { key: 'unit', label: 'Unit' },
              { key: 'currency', label: 'Curr' },
              { key: 'brokerage', label: 'Brokerage' },
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
                      onClick={() => openEdit(r as unknown as RateMaster)}
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

      <Modal open={modalOpen} title={editing ? 'Edit Billing Rate' : 'New Billing Rate'} onClose={() => setModalOpen(false)} wide>
        {error && modalOpen && (
          <div className="mb-4">
            <Alert message={error} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Party" required>
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
          <FormField label="Commodity" required>
            <select
              className={inputClass}
              value={form.commodity_id}
              onChange={(e) => setForm({ ...form, commodity_id: e.target.value })}
            >
              <option value="">Select commodity…</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.commodity_name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Customer Type" required>
            <select
              className={inputClass}
              value={form.customer_type}
              onChange={(e) =>
                setForm({ ...form, customer_type: e.target.value as CustomerType })
              }
            >
              <option value="BUYER">Buyer</option>
              <option value="SELLER">Seller</option>
              <option value="BOTH">Both</option>
            </select>
          </FormField>
          <FormField label="Rate" required>
            <input
              type="number"
              className={inputClass}
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
            />
          </FormField>
          <FormField label="Unit" required>
            <select
              className={inputClass}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value as QtyUnit })}
            >
              <option value="MT">MT</option>
              <option value="KGS">KGS</option>
              <option value="QUINTAL">QUINTAL</option>
              <option value="BAGS">BAGS</option>
            </select>
          </FormField>
          <FormField label="Currency" required>
            <select
              className={inputClass}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </FormField>
          <FormField label="Brokerage (default)">
            <input
              type="number"
              className={inputClass}
              value={form.brokerage}
              onChange={(e) => setForm({ ...form, brokerage: e.target.value })}
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

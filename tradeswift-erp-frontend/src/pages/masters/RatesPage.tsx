import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, ShieldCheck, History } from 'lucide-react'
import { mastersApi, ApiClientError } from '../../api/client'
import { ChangeLogModal } from '../../components/ChangeLogModal'
import type {
  Commodity,
  CustomerType,
  Currency,
  Party,
  QtyUnit,
  RateMaster,
  RateType,
} from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { DataTable } from '../../components/DataTable'
import { Modal, FormField, inputClass, Alert } from '../../components/Modal'
import { Badge } from '../../components/Badge'
import { useActiveUser } from '../../context/UserContext'

export function RatesPage() {
  const { isAdmin } = useActiveUser()
  const [rows, setRows] = useState<RateMaster[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RateMaster | null>(null)
  const [historyRate, setHistoryRate] = useState<RateMaster | null>(null)
  const [form, setForm] = useState({
    party_id: '',
    customer_type: 'BUYER' as CustomerType,
    commodity_id: '',
    rate_type: 'FIXED' as RateType,
    rate: '',
    unit: 'MT' as QtyUnit,
    currency: 'INR' as Currency,
    brokerage_type: 'FIXED' as RateType,
    brokerage: '0',
  })
  const [saving, setSaving] = useState(false)

  const partyMap = Object.fromEntries(parties.map((p) => [p.id, p.name]))
  const commMap = Object.fromEntries(commodities.map((c) => [c.id, c.commodity_name]))
  const isPercentage = form.rate_type === 'PERCENTAGE'

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
    if (!isAdmin) return
    setEditing(null)
    setForm({
      party_id: '',
      customer_type: 'BUYER',
      commodity_id: '',
      rate_type: 'FIXED',
      rate: '',
      unit: 'MT',
      currency: 'INR',
      brokerage_type: 'FIXED',
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
      rate_type: row.rate_type ?? 'FIXED',
      rate: String(row.rate),
      unit: row.unit,
      currency: row.currency,
      brokerage_type: row.brokerage_type ?? 'FIXED',
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
      rate_type: form.rate_type,
      rate: Number(form.rate),
      unit: form.unit,
      currency: form.currency,
      brokerage_type: form.brokerage_type,
      brokerage: Number(form.brokerage || 0),
    }
    try {
      if (editing) {
        const res = await mastersApi.rates.update(editing.id, payload)
        if (!isAdmin || res.has_pending_approval) {
          alert('Change request submitted! Since you are signed in as an Employee, changes are not updated immediately and have been routed to the Governance → Approvals section for Administrator approval.')
        }
      } else {
        await mastersApi.rates.create(payload)
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
    if (!confirm('Deactivate this billing rate?')) return
    await mastersApi.rates.remove(id)
    await load()
  }

  const formatRate = (row: RateMaster) => {
    const type = row.rate_type ?? 'FIXED'
    if (type === 'PERCENTAGE') return `${row.rate}%`
    return String(row.rate)
  }

  return (
    <Card>
      <CardHeader
        title="Billing Rate"
        subtitle="Party + commodity default billing rates (fixed or percentage) and brokerage"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load} disabled={loading} title="Reload billing rates">
              <RefreshCw size={16} className={loading ? 'animate-spin text-brand-600' : ''} />
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={openCreate}>
                <Plus size={16} /> Add Billing Rate
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
                key: 'rate_code',
                label: 'Code',
                render: (r) => {
                  const rateItem = r as unknown as RateMaster
                  return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-800">{rateItem.rate_code}</span>
                      {rateItem.has_pending_approval && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          ⏳ Pending Approval
                        </span>
                      )}
                    </div>
                  )
                },
              },
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
              {
                key: 'rate_type',
                label: 'Type',
                render: (r) => ((r.rate_type as string) || 'FIXED') === 'PERCENTAGE' ? '%' : 'Fixed',
              },
              {
                key: 'rate',
                label: 'Rate',
                render: (r) => formatRate(r as unknown as RateMaster),
              },
              { key: 'unit', label: 'Unit' },
              { key: 'currency', label: 'Curr' },
              {
                key: 'brokerage',
                label: 'Brokerage',
                render: (r) => {
                  const item = r as unknown as RateMaster
                  if (item.brokerage == null || item.brokerage === 0) return '—'
                  if (item.brokerage_type === 'PERCENTAGE') return `${item.brokerage}% of value`
                  return `${item.brokerage} / ${item.unit || 'MT'}`
                },
              },
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
                render: (r) => {
                  const rateItem = r as unknown as RateMaster
                  return (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setHistoryRate(rateItem)}
                        className="rounded p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="View Change Log & Supervisor Approvals"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => openEdit(rateItem)}
                        className="rounded p-1.5 text-slate-400 hover:text-brand-600"
                        title="Edit Rate"
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
                  )
                },
              },
            ]}
            rows={rows as unknown as Record<string, unknown>[]}
          />
        )}
      </CardBody>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Billing Rate' : 'New Billing Rate'}
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
                  onClick={() => setHistoryRate(editing)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 shadow-xs"
                >
                  <History size={12} /> View Change Log
                </button>
              </div>
              <p className="text-amber-700 mt-0.5">
                Edits to sensitive rate definitions (Base Rate & Brokerage) are automatically staged and routed to Supervisors (Kannu / Kanha) in Governance → Approvals for verification before taking final effect.
              </p>
              {editing.has_pending_approval && (
                <p className="mt-1 font-medium text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded inline-block">
                  ⏳ This rate definition currently has pending changes awaiting supervisor review.
                </p>
              )}
            </div>
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
          <FormField label="Rate Type" required>
            <select
              className={inputClass}
              value={form.rate_type}
              onChange={(e) =>
                setForm({ ...form, rate_type: e.target.value as RateType })
              }
            >
              <option value="FIXED">Fixed (amount)</option>
              <option value="PERCENTAGE">Percentage (%)</option>
            </select>
          </FormField>
          <FormField
            label={isPercentage ? 'Rate (%)' : 'Rate'}
            required
            hint={isPercentage ? 'Commodity value percentage, max 100' : undefined}
          >
            <input
              type="number"
              step="0.01"
              min="0"
              max={isPercentage ? 100 : undefined}
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
          {!isPercentage && (
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
          )}
          <FormField label="Brokerage Type" required>
            <select
              className={inputClass}
              value={form.brokerage_type}
              onChange={(e) =>
                setForm({ ...form, brokerage_type: e.target.value as RateType })
              }
            >
              <option value="FIXED">Fixed (Per Unit / {form.unit || 'MT'})</option>
              <option value="PERCENTAGE">Percentage (% of Transaction Value)</option>
            </select>
          </FormField>
          <FormField
            label={form.brokerage_type === 'PERCENTAGE' ? 'Brokerage (% of Value)' : `Brokerage (₹ / ${form.unit || 'MT'})`}
            hint={
              form.brokerage_type === 'PERCENTAGE'
                ? 'Brokerage calculated on total transaction value, not MT quantity'
                : `Fixed brokerage per ${form.unit || 'MT'}`
            }
          >
            <input
              type="number"
              step="0.01"
              min="0"
              max={form.brokerage_type === 'PERCENTAGE' ? 100 : undefined}
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

      <ChangeLogModal
        open={Boolean(historyRate)}
        onClose={() => setHistoryRate(null)}
        entityId={historyRate?.id ?? null}
        entityName={`Rate ${historyRate?.rate_code ?? ''} (${partyMap[historyRate?.party_id ?? ''] ?? 'Party'})`}
        entityType="RATE_MASTER"
      />
    </Card>
  )
}

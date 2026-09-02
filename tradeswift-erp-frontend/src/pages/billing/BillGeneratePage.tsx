import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { billsApi, despatchesApi, mastersApi, ApiClientError } from '../../api/client'
import type { Party, Tax, UnbilledDespatch } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { FormField, inputClass, Alert } from '../../components/Modal'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function monthStart() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function BillGeneratePage() {
  const navigate = useNavigate()
  const [parties, setParties] = useState<Party[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [rows, setRows] = useState<UnbilledDespatch[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    party_id: '',
    tax_id: '',
    from_date: monthStart(),
    to_date: today(),
    bill_date: today(),
  })

  useEffect(() => {
    Promise.all([mastersApi.parties.list(), mastersApi.taxes.list()]).then(([p, t]) => {
      setParties(p.filter((x) => x.is_active))
      setTaxes(t.filter((x) => x.is_active))
    })
  }, [])

  const fetchUnbilled = async () => {
    if (!form.party_id) {
      setError('Select a party first.')
      return
    }
    setLoading(true)
    setError('')
    setSelected(new Set())
    try {
      const res = await despatchesApi.unbilled(form.party_id, form.from_date, form.to_date)
      setRows(res.unbilled_records)
      if (res.unbilled_records.length === 0) {
        setError('No unbilled despatches found for this party and date range.')
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Fetch failed')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.id)))
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const baseTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + Number(r.line_base_amount), 0),
    [selectedRows],
  )

  const generate = async () => {
    if (!form.tax_id) {
      setError('Select tax schedule.')
      return
    }
    if (selected.size === 0) {
      setError('Select at least one despatch.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await billsApi.create({
        bill_date: form.bill_date,
        party_id: form.party_id,
        tax_id: form.tax_id,
        from_date: form.from_date,
        to_date: form.to_date,
        despatch_ids: [...selected],
      })
      navigate(`/billing/${res.id}`)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Bill generation failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/billing"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={16} /> Back to Bills
      </Link>

      <Card>
        <CardHeader
          title="Generate Bill"
          subtitle="Select unbilled despatches and create tax invoice"
        />
        <CardBody>
          {error && (
            <div className="mb-4">
              <Alert message={error} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <FormField label="Tax" required>
              <select
                className={inputClass}
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              >
                <option value="">Select tax…</option>
                {taxes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tax_name} (IGST {t.igst_percent}% / CGST {t.cgst_percent}% / SGST{' '}
                    {t.sgst_percent}%)
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Bill Date" required>
              <input
                type="date"
                className={inputClass}
                value={form.bill_date}
                onChange={(e) => setForm({ ...form, bill_date: e.target.value })}
              />
            </FormField>
            <FormField label="From Date" required>
              <input
                type="date"
                className={inputClass}
                value={form.from_date}
                onChange={(e) => setForm({ ...form, from_date: e.target.value })}
              />
            </FormField>
            <FormField label="To Date" required>
              <input
                type="date"
                className={inputClass}
                value={form.to_date}
                onChange={(e) => setForm({ ...form, to_date: e.target.value })}
              />
            </FormField>
            <div className="flex items-end">
              <Button onClick={fetchUnbilled} disabled={loading} className="w-full">
                <Search size={16} /> {loading ? 'Loading…' : 'Fetch Unbilled'}
              </Button>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-300"
                  />
                  Select All ({rows.length} despatches)
                </label>
                {selected.size > 0 && (
                  <span className="text-sm text-slate-600">
                    Selected base: <strong>₹{baseTotal.toLocaleString('en-IN')}</strong>
                  </span>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3" />
                      <th className="px-4 py-3">Despatch</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Contract</th>
                      <th className="px-4 py-3">Commodity</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Rate</th>
                      <th className="px-4 py-3">Base</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggle(r.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">{r.despatch_no}</td>
                        <td className="px-4 py-3">{r.despatch_date}</td>
                        <td className="px-4 py-3">#{r.contract_no}</td>
                        <td className="px-4 py-3">{r.commodity_short_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          {r.quantity} {r.qty_unit ?? ''}
                        </td>
                        <td className="px-4 py-3">{r.rate}</td>
                        <td className="px-4 py-3">{Number(r.line_base_amount).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={generate} disabled={saving || selected.size === 0}>
                  {saving ? 'Generating…' : 'Generate Invoice'}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { billsApi, mastersApi, ApiClientError } from '../../api/client'
import type { BillableContract, Party, Tax } from '../../types'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
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
  const { company } = useSelectedCompany()
  const [parties, setParties] = useState<Party[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [rows, setRows] = useState<BillableContract[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [qtyById, setQtyById] = useState<Record<string, string>>({})
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
    Promise.all([
      mastersApi.parties.list({ companyId: company?.id }),
      mastersApi.taxes.list(),
    ]).then(([p, t]) => {
      setParties(p.filter((x) => x.is_active))
      setTaxes(t.filter((x) => x.is_active))
    })
  }, [company])

  const fetchBillable = async () => {
    if (!form.party_id) {
      setError('Select a party first.')
      return
    }
    setLoading(true)
    setError('')
    setSelected(new Set())
    try {
      const list = await billsApi.billableContracts({
        partyId: form.party_id,
        fromDate: form.from_date,
        toDate: form.to_date,
        companyId: company?.id,
      })
      setRows(list)
      setQtyById(
        Object.fromEntries(list.map((r) => [r.id, String(r.remaining_billable)])),
      )
      if (list.length === 0) {
        setError('No billable contracts found for this party and date range.')
      } else if (!form.tax_id && list[0]?.tax_id) {
        setForm((f) => ({ ...f, tax_id: list[0].tax_id }))
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
    () =>
      selectedRows.reduce((s, r) => {
        const qty = Number(qtyById[r.id] || 0)
        return s + qty * Number(r.rate)
      }, 0),
    [selectedRows, qtyById],
  )

  const generate = async () => {
    if (!form.tax_id) {
      setError('Select tax schedule.')
      return
    }
    if (selected.size === 0) {
      setError('Select at least one contract.')
      return
    }

    const lines: { contract_id: string; quantity: number }[] = []
    for (const r of selectedRows) {
      const qty = Number(qtyById[r.id])
      if (!qty || qty <= 0) {
        setError(`Enter a valid bill qty for contract #${r.contract_no}.`)
        return
      }
      if (qty > Number(r.remaining_billable)) {
        setError(
          `Contract #${r.contract_no}: qty exceeds remaining billable ${r.remaining_billable}.`,
        )
        return
      }
      lines.push({ contract_id: r.id, quantity: qty })
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
        lines,
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
          subtitle="Select billable contracts (qty from final qty / remaining) — despatch optional"
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
            <FormField label="Contract From" required>
              <input
                type="date"
                className={inputClass}
                value={form.from_date}
                onChange={(e) => setForm({ ...form, from_date: e.target.value })}
              />
            </FormField>
            <FormField label="Contract To" required>
              <input
                type="date"
                className={inputClass}
                value={form.to_date}
                onChange={(e) => setForm({ ...form, to_date: e.target.value })}
              />
            </FormField>
            <div className="flex items-end">
              <Button onClick={fetchBillable} disabled={loading} className="w-full">
                <Search size={16} /> {loading ? 'Loading…' : 'Fetch Contracts'}
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
                  Select All ({rows.length} contracts)
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
                      <th className="px-4 py-3">Contract</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Commodity</th>
                      <th className="px-4 py-3">Billing Qty</th>
                      <th className="px-4 py-3">Already Billed</th>
                      <th className="px-4 py-3">Bill Qty</th>
                      <th className="px-4 py-3">Rate</th>
                      <th className="px-4 py-3">Base</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const qty = Number(qtyById[r.id] || 0)
                      const base = qty * Number(r.rate)
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(r.id)}
                              onChange={() => toggle(r.id)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium">#{r.contract_no}</td>
                          <td className="px-4 py-3">{r.contract_date}</td>
                          <td className="px-4 py-3">{r.status}</td>
                          <td className="px-4 py-3">{r.commodity_short_name ?? '—'}</td>
                          <td className="px-4 py-3">
                            {r.billing_qty} {r.qty_unit}
                          </td>
                          <td className="px-4 py-3">{r.billed_qty}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={r.remaining_billable}
                              className="w-28 rounded border border-slate-200 px-2 py-1"
                              value={qtyById[r.id] ?? ''}
                              disabled={!selected.has(r.id)}
                              onChange={(e) =>
                                setQtyById((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                            />
                          </td>
                          <td className="px-4 py-3">{r.rate}</td>
                          <td className="px-4 py-3">
                            {selected.has(r.id) ? base.toLocaleString('en-IN') : '—'}
                          </td>
                        </tr>
                      )
                    })}
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

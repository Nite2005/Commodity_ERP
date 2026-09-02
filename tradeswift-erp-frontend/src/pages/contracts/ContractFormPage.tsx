import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { mastersApi, contractsApi, ApiClientError } from '../../api/client'
import type {
  Broker,
  Commodity,
  Company,
  Currency,
  Party,
  PaymentTerm,
  QtyUnit,
  Tax,
  Unit,
} from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { FormField, inputClass, Alert } from '../../components/Modal'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function ContractFormPage() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Company[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    contract_no: '',
    contract_date: today(),
    company_id: '',
    seller_id: '',
    buyer_id: '',
    commodity_id: '',
    quality_allowance: '',
    qty_low: '',
    qty_high: '',
    qty_unit: 'MT' as QtyUnit,
    rate: '',
    currency: 'INR' as Currency,
    payment_term_id: '',
    weightment_unit_id: '',
    despatch_from: today(),
    despatch_to: today(),
    broker_id: '',
  })

  useEffect(() => {
    Promise.all([
      mastersApi.companies.list(),
      mastersApi.commodities.list(),
      mastersApi.taxes.list(),
      mastersApi.brokers.list(),
      mastersApi.paymentTerms.list(),
      mastersApi.units.list(),
    ]).then(([co, c, t, b, pt, u]) => {
      setCompanies(co.filter((x) => x.is_active))
      setCommodities(c.filter((x) => x.is_active))
      setTaxes(t.filter((x) => x.is_active))
      setBrokers(b.filter((x) => x.is_active))
      setPaymentTerms(pt.filter((x) => x.is_active))
      setUnits(u.filter((x) => x.is_active))
    })
  }, [])

  useEffect(() => {
    if (!form.company_id) {
      setParties([])
      return
    }
    mastersApi.parties.list({ companyId: form.company_id }).then((p) => {
      setParties(p.filter((x) => x.is_active))
    })
  }, [form.company_id])

  const onCompanyChange = (companyId: string) => {
    setForm((f) => ({
      ...f,
      company_id: companyId,
      seller_id: '',
      buyer_id: '',
    }))
  }

  const onCommodityChange = (id: string) => {
    const comm = commodities.find((c) => c.id === id)
    setForm((f) => ({
      ...f,
      commodity_id: id,
      quality_allowance: comm?.quality_allowance ?? f.quality_allowance,
    }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const defaultTax = taxes[0]
    if (!defaultTax) {
      setError('Add at least one active tax in Tax Master before creating a contract.')
      setSaving(false)
      return
    }

    if (!form.company_id) {
      setError('Select a company before creating a contract.')
      setSaving(false)
      return
    }

    try {
      const res = await contractsApi.create({
        contract_no: form.contract_no || null,
        contract_type: 'NEW',
        contract_date: form.contract_date,
        company_id: form.company_id,
        seller_id: form.seller_id,
        buyer_id: form.buyer_id,
        is_nominee: false,
        commodity_id: form.commodity_id,
        quality_allowance: form.quality_allowance || null,
        packing: 'NA',
        qty_low: Number(form.qty_low),
        qty_high: Number(form.qty_high),
        qty_unit: form.qty_unit,
        rate: Number(form.rate),
        currency: form.currency,
        tax_id: defaultTax.id,
        payment_term_id: form.payment_term_id || null,
        weightment_unit_id: form.weightment_unit_id || null,
        despatch_from: form.despatch_from,
        despatch_to: form.despatch_to,
        broker_id: form.broker_id,
        broker_rate: 0,
      })
      navigate(`/contracts/${res.id}`)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create contract')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/contracts"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Back to contracts
      </Link>

      <Card>
        <CardHeader title="New Contract" subtitle="SCR-CNT-06 — Trade contract entry" />
        <CardBody>
          {error && (
            <div className="mb-6">
              <Alert message={error} />
            </div>
          )}
          <form onSubmit={submit} className="space-y-8">
            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Contract Info
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Contract #" hint="Leave blank for auto-number">
                  <input className={inputClass} value={form.contract_no} onChange={(e) => set('contract_no', e.target.value)} />
                </FormField>
                <FormField label="Date" required>
                  <input type="date" className={inputClass} value={form.contract_date} onChange={(e) => set('contract_date', e.target.value)} />
                </FormField>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Parties
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField label="Company" required>
                    <select
                      className={inputClass}
                      value={form.company_id}
                      onChange={(e) => onCompanyChange(e.target.value)}
                      required
                    >
                      <option value="">Select company…</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <FormField label="Seller" required>
                  <select
                    className={inputClass}
                    value={form.seller_id}
                    onChange={(e) => set('seller_id', e.target.value)}
                    required
                    disabled={!form.company_id}
                  >
                    <option value="">{form.company_id ? 'Select seller…' : 'Select company first…'}</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Buyer" required>
                  <select
                    className={inputClass}
                    value={form.buyer_id}
                    onChange={(e) => set('buyer_id', e.target.value)}
                    required
                    disabled={!form.company_id}
                  >
                    <option value="">{form.company_id ? 'Select buyer…' : 'Select company first…'}</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Commodity & Quantity
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Commodity" required>
                  <select className={inputClass} value={form.commodity_id} onChange={(e) => onCommodityChange(e.target.value)} required>
                    <option value="">Select…</option>
                    {commodities.map((c) => (
                      <option key={c.id} value={c.id}>{c.commodity_name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Quality Allowance" hint="Auto-filled from commodity">
                  <textarea className={`${inputClass} min-h-[72px]`} value={form.quality_allowance} onChange={(e) => set('quality_allowance', e.target.value)} />
                </FormField>
                <FormField label="Weightment Rule">
                  <select className={inputClass} value={form.weightment_unit_id} onChange={(e) => set('weightment_unit_id', e.target.value)}>
                    <option value="">Optional…</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.unit_name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Qty Low" required>
                  <input type="number" step="0.01" className={inputClass} value={form.qty_low} onChange={(e) => set('qty_low', e.target.value)} required />
                </FormField>
                <FormField label="Qty High" required>
                  <input type="number" step="0.01" className={inputClass} value={form.qty_high} onChange={(e) => set('qty_high', e.target.value)} required />
                </FormField>
                <FormField label="Qty Unit" required>
                  <select className={inputClass} value={form.qty_unit} onChange={(e) => set('qty_unit', e.target.value)}>
                    <option value="MT">MT</option>
                    <option value="KGS">KGS</option>
                    <option value="QUINTAL">QUINTAL</option>
                    <option value="BAGS">BAGS</option>
                  </select>
                </FormField>
                <FormField label="Rate" required>
                  <input type="number" step="0.01" className={inputClass} value={form.rate} onChange={(e) => set('rate', e.target.value)} required />
                </FormField>
                <FormField label="Currency" required>
                  <select className={inputClass} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </FormField>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Payment & Despatch
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Payment Term">
                  <select className={inputClass} value={form.payment_term_id} onChange={(e) => set('payment_term_id', e.target.value)}>
                    <option value="">Optional…</option>
                    {paymentTerms.map((pt) => (
                      <option key={pt.id} value={pt.id}>{pt.term_name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Despatch From" required>
                  <input type="date" className={inputClass} value={form.despatch_from} onChange={(e) => set('despatch_from', e.target.value)} required />
                </FormField>
                <FormField label="Despatch To" required>
                  <input type="date" className={inputClass} value={form.despatch_to} onChange={(e) => set('despatch_to', e.target.value)} required />
                </FormField>
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Broker
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Broker" required>
                  <select className={inputClass} value={form.broker_id} onChange={(e) => set('broker_id', e.target.value)} required>
                    <option value="">Select broker…</option>
                    {brokers.map((b) => (
                      <option key={b.id} value={b.id}>{b.broker_name}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </section>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
              <Link to="/contracts">
                <Button type="button" variant="secondary">Cancel</Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create Contract'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

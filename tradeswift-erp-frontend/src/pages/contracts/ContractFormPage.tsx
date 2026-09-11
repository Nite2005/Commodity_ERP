import { useEffect, useState } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { mastersApi, contractsApi, ApiClientError } from '../../api/client'
import type { Broker, Commodity, Party, PaymentTerm, QtyUnit, Tax } from '../../types'
import { useSelectedCompany } from '../../context/SelectedCompanyContext'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { FormField, inputClass, Alert } from '../../components/Modal'
import { DateInputDmy } from '../../components/DateInputDmy'

function today() {
  return new Date().toISOString().slice(0, 10)
}

const emptyForm = () => ({
  contract_no: '',
  contract_date: today(),
  company_id: '',
  seller_id: '',
  buyer_id: '',
  commodity_id: '',
  qty_low: '',
  qty_high: '',
  qty_unit: 'MT' as QtyUnit,
  rate: '',
  payment_term_id: '',
  despatch_from: today(),
  despatch_to: today(),
  broker_id: '',
  tax_id: '',
})

export function ContractFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { company } = useSelectedCompany()
  const [parties, setParties] = useState<Party[]>([])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [form, setForm] = useState(emptyForm)
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    Promise.all([
      mastersApi.commodities.list(),
      mastersApi.taxes.list(),
      mastersApi.brokers.list(),
      mastersApi.paymentTerms.list(),
    ]).then(([c, t, b, pt]) => {
      setCommodities(c.filter((x) => x.is_active))
      setTaxes(t.filter((x) => x.is_active))
      setBrokers(b.filter((x) => x.is_active))
      setPaymentTerms(pt.filter((x) => x.is_active))
    })
  }, [])

  useEffect(() => {
    if (isEdit) return
    if (!company) {
      setForm((f) => ({ ...f, company_id: '', seller_id: '', buyer_id: '' }))
      setParties([])
      return
    }
    setForm((f) => ({
      ...f,
      company_id: company.id,
      seller_id: '',
      buyer_id: '',
    }))
    mastersApi.parties.list({ companyId: company.id }).then((p) => {
      setParties(p.filter((x) => x.is_active))
    })
  }, [company, isEdit])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const c = await contractsApi.get(id)
        if (cancelled) return
        if (c.status === 'CANCELLED') {
          setError('Cancelled contracts cannot be edited.')
          return
        }
        const companyId = c.company_id ?? ''
        const partyList = companyId
          ? await mastersApi.parties.list({ companyId })
          : await mastersApi.parties.list()
        if (cancelled) return
        setParties(partyList.filter((x) => x.is_active))
        setCompanyName(c.company_name ?? '')
        setForm({
          contract_no: c.contract_no ?? '',
          contract_date: c.contract_date,
          company_id: companyId,
          seller_id: c.seller_id,
          buyer_id: c.buyer_id,
          commodity_id: c.commodity_id,
          qty_low: String(c.qty_low),
          qty_high: String(c.qty_high),
          qty_unit: c.qty_unit,
          rate: String(c.rate),
          payment_term_id: c.payment_term_id ?? '',
          despatch_from: c.despatch_from,
          despatch_to: c.despatch_to,
          broker_id: c.broker_id,
          tax_id: c.tax_id,
        })
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiClientError ? e.message : 'Failed to load contract')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const buildPayload = () => {
    const taxId = form.tax_id || taxes[0]?.id
    if (!taxId) {
      throw new Error('Add at least one active tax in Tax Master before saving a contract.')
    }
    if (!form.company_id) {
      throw new Error('Select a company in Company Master before saving a contract.')
    }
    return {
      contract_no: form.contract_no || null,
      contract_type: 'NEW' as const,
      contract_date: form.contract_date,
      company_id: form.company_id,
      seller_id: form.seller_id,
      buyer_id: form.buyer_id,
      is_nominee: false,
      commodity_id: form.commodity_id,
      quality_allowance: null,
      packing: 'NA',
      qty_low: Number(form.qty_low),
      qty_high: Number(form.qty_high),
      qty_unit: form.qty_unit,
      rate: Number(form.rate),
      currency: 'INR' as const,
      tax_id: taxId,
      payment_term_id: form.payment_term_id || null,
      weightment_unit_id: null,
      despatch_from: form.despatch_from,
      despatch_to: form.despatch_to,
      broker_id: form.broker_id,
      broker_rate: 0,
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = buildPayload()
      if (isEdit && id) {
        await contractsApi.update(id, payload)
        navigate(`/contracts/${id}`)
      } else {
        const res = await contractsApi.create(payload)
        navigate(`/contracts/${res.id}`)
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : isEdit
              ? 'Failed to update contract'
              : 'Failed to create contract',
      )
    } finally {
      setSaving(false)
    }
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  if (loading) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading contract…</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to={isEdit && id ? `/contracts/${id}` : '/contracts'}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> {isEdit ? 'Back to contract' : 'Back to contracts'}
      </Link>

      <Card>
        <CardHeader
          title={isEdit ? 'Edit Contract' : 'New Contract'}
          subtitle={isEdit ? `Contract #${form.contract_no || id}` : 'Trade contract entry'}
        />
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
                <FormField label="Contract #" hint={isEdit ? undefined : 'Leave blank for auto-number'}>
                  <input
                    className={inputClass}
                    value={form.contract_no}
                    onChange={(e) => set('contract_no', e.target.value)}
                    disabled={isEdit}
                  />
                </FormField>
                <FormField label="Date" required>
                  <DateInputDmy
                    value={form.contract_date}
                    onChange={(v) => set('contract_date', v)}
                    required
                  />
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
                    <input
                      className={inputClass}
                      value={isEdit ? companyName || company?.name || '' : company?.name ?? ''}
                      disabled
                    />
                  </FormField>
                  {!form.company_id && (
                    <p className="mt-1 text-xs text-amber-600">
                      Go to Masters → Company and tick the checkbox for your working company.
                    </p>
                  )}
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
                  <select
                    className={inputClass}
                    value={form.commodity_id}
                    onChange={(e) => set('commodity_id', e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {commodities.map((c) => (
                      <option key={c.id} value={c.id}>{c.commodity_name}</option>
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
                  <DateInputDmy
                    value={form.despatch_from}
                    onChange={(v) => set('despatch_from', v)}
                    required
                  />
                </FormField>
                <FormField label="Despatch To" required>
                  <DateInputDmy
                    value={form.despatch_to}
                    onChange={(v) => set('despatch_to', v)}
                    required
                  />
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
              <Link to={isEdit && id ? `/contracts/${id}` : '/contracts'}>
                <Button type="button" variant="secondary">Cancel</Button>
              </Link>
              <Button type="submit" disabled={saving || !form.company_id}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Contract'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

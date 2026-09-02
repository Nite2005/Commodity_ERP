import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { contractsApi, despatchesApi, ApiClientError } from '../../api/client'
import type { Contract, ContractBalance } from '../../types'
import { Card, CardBody, CardHeader } from '../../components/Card'
import { Button } from '../../components/Button'
import { FormField, inputClass, Alert } from '../../components/Modal'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function DespatchFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedContract = searchParams.get('contract_id') ?? ''
  const [contracts, setContracts] = useState<Contract[]>([])
  const [balance, setBalance] = useState<ContractBalance | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingBalance, setLoadingBalance] = useState(false)

  const [form, setForm] = useState({
    contract_id: preselectedContract,
    despatch_date: today(),
    bags: '',
    quantity: '',
    delivery_type: 'FOR',
  })

  useEffect(() => {
    contractsApi
      .list({ active_only: 'true', status: 'CONTRACT_OPEN' })
      .then(setContracts)
      .catch(() => setError('Failed to load contracts'))
  }, [])

  useEffect(() => {
    if (!form.contract_id) {
      setBalance(null)
      return
    }
    setLoadingBalance(true)
    contractsApi
      .balance(form.contract_id)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setLoadingBalance(false))
  }, [form.contract_id])

  const selected = contracts.find((c) => c.id === form.contract_id)
  const qtyUnit = selected?.qty_unit ?? 'unit'

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await despatchesApi.create({
        contract_id: form.contract_id,
        despatch_date: form.despatch_date,
        bags: form.bags ? Number(form.bags) : null,
        quantity: Number(form.quantity),
        delivery_type: form.delivery_type || null,
      })
      navigate(`/despatches/${res.id}`)
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/despatches"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft size={16} /> Back to Despatches
      </Link>

      <Card>
        <CardHeader title="New Despatch" subtitle="Record shipment / challan against a contract" />
        <CardBody>
          {error && (
            <div className="mb-4">
              <Alert message={error} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Contract" required>
                <select
                  className={inputClass}
                  value={form.contract_id}
                  onChange={(e) => setForm({ ...form, contract_id: e.target.value })}
                >
                  <option value="">Select open contract…</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.contract_no} — {c.qty_low}–{c.qty_high} {c.qty_unit}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {selected && (
              <div className="sm:col-span-2 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-800">
                  Contract #{selected.contract_no}
                </div>
                <div className="mt-1">
                  Contract unit: <strong>{selected.qty_unit}</strong> · Despatch window:{' '}
                  {selected.despatch_from} → {selected.despatch_to}
                </div>
                {loadingBalance ? (
                  <div className="mt-2 text-slate-400">Loading balance…</div>
                ) : balance ? (
                  <div className="mt-2 grid gap-1 sm:grid-cols-3">
                    <span>
                      Billing qty:{' '}
                      <strong>
                        {balance.billing_qty} {qtyUnit}
                      </strong>
                    </span>
                    <span>
                      Fulfilled:{' '}
                      <strong>
                        {balance.fulfilled_qty} {qtyUnit}
                      </strong>
                    </span>
                    <span>
                      Remaining:{' '}
                      <strong>
                        {balance.remaining_qty} {qtyUnit}
                      </strong>
                    </span>
                    <span className="sm:col-span-3 text-xs text-slate-500">
                      Max allowed (incl. {balance.tolerance_percent}% tolerance):{' '}
                      {balance.max_allowed_qty} {qtyUnit}
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            <FormField label="Despatch Date" required>
              <input
                type="date"
                className={inputClass}
                value={form.despatch_date}
                min={selected?.despatch_from}
                max={selected?.despatch_to}
                onChange={(e) => setForm({ ...form, despatch_date: e.target.value })}
              />
            </FormField>

            <FormField label="Delivery Type">
              <select
                className={inputClass}
                value={form.delivery_type}
                onChange={(e) => setForm({ ...form, delivery_type: e.target.value })}
              >
                <option value="FOR">FOR</option>
                <option value="EX-WORKS">EX-WORKS</option>
                <option value="CIF">CIF</option>
              </select>
            </FormField>

            <FormField label="Bags">
              <input
                type="number"
                className={inputClass}
                value={form.bags}
                min={0}
                onChange={(e) => setForm({ ...form, bags: e.target.value })}
              />
            </FormField>

            <FormField label={`Quantity (${qtyUnit})`} required hint={selected ? `Enter qty in contract unit (${qtyUnit})` : undefined}>
              <input
                type="number"
                step="0.001"
                className={inputClass}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </FormField>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Link to="/despatches">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button
              onClick={submit}
              disabled={saving || !form.contract_id || !form.quantity}
            >
              {saving ? 'Saving…' : 'Create Despatch'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

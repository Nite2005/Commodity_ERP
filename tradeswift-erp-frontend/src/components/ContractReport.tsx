import type { ContractDetail } from '../types'
import { TRADESWIFT_COMPANY, formatInr } from '../lib/invoice'
import { formatDateDmy } from '../lib/dates'

interface ContractReportProps {
  contract: ContractDetail
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="border-b border-slate-100 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-900">{value ?? '—'}</div>
    </div>
  )
}

export function ContractReport({ contract }: ContractReportProps) {
  const qtyRange = `${contract.qty_low} – ${contract.qty_high} ${contract.qty_unit}`
  const finalQty =
    contract.final_qty != null ? `${contract.final_qty} ${contract.qty_unit}` : '—'

  return (
    <article
      id="contract-report"
      className="mx-auto max-w-[210mm] bg-white text-slate-900 shadow-lg ring-1 ring-slate-200 print:shadow-none print:ring-0"
    >
      <header className="border-b-4 border-brand-600 bg-gradient-to-r from-slate-900 to-slate-800 px-8 py-6 text-white print:bg-slate-900 print:text-white">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
              {TRADESWIFT_COMPANY.tagline}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{TRADESWIFT_COMPANY.name}</h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
              {TRADESWIFT_COMPANY.address}
              <br />
              {TRADESWIFT_COMPANY.city}, {TRADESWIFT_COMPANY.state} – {TRADESWIFT_COMPANY.pincode}
              <br />
              GSTIN: <span className="font-mono text-white">{TRADESWIFT_COMPANY.gstin}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold uppercase tracking-widest">
              Contract Report
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Contract No.</dt>
                <dd className="font-mono font-semibold">{contract.contract_no}</dd>
              </div>
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Date</dt>
                <dd className="font-semibold">{formatDateDmy(contract.contract_date)}</dd>
              </div>
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Type</dt>
                <dd className="font-semibold">{contract.contract_type}</dd>
              </div>
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Status</dt>
                <dd className="font-semibold">{contract.status}</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div className="px-8 py-6">
        <div className="grid gap-6 border-b border-slate-200 pb-6 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Parties
            </h2>
            <Field label="Company" value={contract.company_name} />
            <Field label="Seller" value={contract.seller_name} />
            <Field label="Buyer" value={contract.buyer_name} />
            {contract.is_nominee && <Field label="Nominee" value="Yes" />}
          </section>
          <section>
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Commodity
            </h2>
            <Field label="Commodity" value={contract.commodity_name} />
            <Field label="Short Name" value={contract.commodity_short_name} />
            <Field label="Packing" value={contract.packing} />
            {contract.quality_allowance && (
              <Field label="Quality Allowance" value={contract.quality_allowance} />
            )}
          </section>
        </div>

        <div className="mt-6 grid gap-6 border-b border-slate-200 pb-6 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Quantity & Rate
            </h2>
            <Field label="Quantity Range" value={qtyRange} />
            <Field label="Final Quantity" value={finalQty} />
            <Field label="Rate" value={`${formatInr(contract.rate)} / ${contract.qty_unit}`} />
            <Field label="Currency" value={contract.currency} />
          </section>
          <section>
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Terms
            </h2>
            <Field label="Tax" value={contract.tax_name} />
            <Field label="Payment Term" value={contract.payment_term_name} />
            <Field
              label="Despatch Period"
              value={`${formatDateDmy(contract.despatch_from)} → ${formatDateDmy(contract.despatch_to)}`}
            />
            <Field
              label="Broker"
              value={
                contract.broker_name
                  ? `${contract.broker_name} @ ${contract.broker_rate}`
                  : null
              }
            />
          </section>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-6">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">Seller acknowledgement</p>
              <div className="mt-12 border-t border-slate-300 pt-1 text-xs text-slate-500">
                Authorised Signatory
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-slate-400">Buyer acknowledgement</p>
              <div className="mt-12 border-t border-slate-300 pt-1 text-xs text-slate-500 sm:ml-auto sm:w-48">
                Authorised Signatory
              </div>
            </div>
          </div>
          <p className="mt-8 text-center text-[10px] text-slate-400">
            Contract report generated by Tradeswift ERP · {TRADESWIFT_COMPANY.email} ·{' '}
            {TRADESWIFT_COMPANY.phone}
          </p>
        </footer>
      </div>
    </article>
  )
}

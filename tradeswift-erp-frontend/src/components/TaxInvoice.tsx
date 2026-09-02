import type { BillDetail } from '../types'
import { TRADESWIFT_COMPANY, formatDate, formatInr } from '../lib/invoice'

interface TaxInvoiceProps {
  bill: BillDetail
}

export function TaxInvoice({ bill }: TaxInvoiceProps) {
  const isIntra = bill.supply_type === 'INTRA_STATE'
  const supplyLabel = isIntra ? 'Intra-State Supply' : 'Inter-State Supply'
  const taxLabel = isIntra
    ? `CGST @ ${bill.cgst_percent}% + SGST @ ${bill.sgst_percent}%`
    : `IGST @ ${bill.igst_percent}%`

  return (
    <article
      id="tax-invoice"
      className="mx-auto max-w-[210mm] bg-white text-slate-900 shadow-lg ring-1 ring-slate-200 print:shadow-none print:ring-0"
    >
      {/* Header band */}
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
              Tax Invoice
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Invoice No.</dt>
                <dd className="font-mono font-semibold">{bill.bill_no}</dd>
              </div>
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Invoice Date</dt>
                <dd className="font-semibold">{formatDate(bill.bill_date)}</dd>
              </div>
              <div className="flex justify-end gap-3">
                <dt className="text-slate-400">Period</dt>
                <dd>
                  {formatDate(bill.from_date)} – {formatDate(bill.to_date)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div className="px-8 py-6">
        {/* Bill To + Supply info */}
        <div className="grid gap-6 border-b border-slate-200 pb-6 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Bill To
            </h2>
            <p className="text-lg font-semibold text-slate-900">{bill.party_name}</p>
            {bill.party_code && (
              <p className="text-xs text-slate-500">Code: {bill.party_code}</p>
            )}
            <address className="mt-2 not-italic text-sm leading-relaxed text-slate-600">
              {bill.party_address}
              <br />
              {bill.party_city}, {bill.party_state} – {bill.party_pincode}
            </address>
            {bill.party_gst_tin && (
              <p className="mt-2 text-sm">
                <span className="text-slate-500">GSTIN:</span>{' '}
                <span className="font-mono font-medium">{bill.party_gst_tin}</span>
              </p>
            )}
          </section>

          <section className="sm:text-right">
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Transaction Details
            </h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between sm:justify-end sm:gap-8">
                <dt className="text-slate-500">Supply Type</dt>
                <dd className="font-medium">{supplyLabel}</dd>
              </div>
              <div className="flex justify-between sm:justify-end sm:gap-8">
                <dt className="text-slate-500">Tax Schedule</dt>
                <dd className="font-medium">{bill.tax_name}</dd>
              </div>
              {bill.seller_name && (
                <div className="flex justify-between sm:justify-end sm:gap-8">
                  <dt className="text-slate-500">Seller</dt>
                  <dd>{bill.seller_name}</dd>
                </div>
              )}
              {bill.buyer_name && (
                <div className="flex justify-between sm:justify-end sm:gap-8">
                  <dt className="text-slate-500">Buyer</dt>
                  <dd>{bill.buyer_name}</dd>
                </div>
              )}
              {bill.seller_state && bill.buyer_state && (
                <div className="flex justify-between sm:justify-end sm:gap-8">
                  <dt className="text-slate-500">Place of Supply</dt>
                  <dd>
                    {bill.buyer_state} ({bill.seller_state} → {bill.buyer_state})
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* Line items */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-800 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Despatch</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Contract</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Rate</th>
                <th className="px-3 py-3 text-right">Taxable Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bill.line_items.map((line, idx) => (
                <tr key={line.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-3 text-slate-500">{idx + 1}</td>
                  <td className="px-3 py-3 font-mono text-xs font-medium">{line.despatch_no}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {line.despatch_date ? formatDate(line.despatch_date) : '—'}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">#{line.contract_no}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{line.commodity_name ?? line.commodity_short_name}</div>
                    {line.commodity_name && line.commodity_short_name && (
                      <div className="text-xs text-slate-500">{line.commodity_short_name}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {Number(line.quantity).toLocaleString('en-IN')}{' '}
                    <span className="text-xs text-slate-500">{line.qty_unit}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{formatInr(line.rate)}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                    {formatInr(line.line_base_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-sm space-y-2 border-t-2 border-slate-800 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Taxable Value</span>
              <span className="font-medium tabular-nums">{formatInr(bill.base_amount)}</span>
            </div>
            {Number(bill.cgst_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">CGST ({bill.cgst_percent}%)</span>
                <span className="tabular-nums">{formatInr(bill.cgst_amount)}</span>
              </div>
            )}
            {Number(bill.sgst_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">SGST ({bill.sgst_percent}%)</span>
                <span className="tabular-nums">{formatInr(bill.sgst_amount)}</span>
              </div>
            )}
            {Number(bill.igst_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">IGST ({bill.igst_percent}%)</span>
                <span className="tabular-nums">{formatInr(bill.igst_amount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold">
              <span>Grand Total</span>
              <span className="text-brand-700 tabular-nums">{formatInr(bill.gross_amount)}</span>
            </div>
            <p className="text-right text-[10px] text-slate-400">{taxLabel}</p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 border-t border-slate-200 pt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="text-xs text-slate-500">
              <p className="font-semibold uppercase tracking-wide text-slate-400">
                Brokerage (for internal reference)
              </p>
              <p className="mt-1 tabular-nums">{formatInr(bill.brokerage_amount)}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-slate-400">For {TRADESWIFT_COMPANY.name}</p>
              <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-500 sm:ml-auto sm:w-48">
                Authorised Signatory
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-[10px] text-slate-400">
            This is a computer-generated tax invoice · {TRADESWIFT_COMPANY.email} ·{' '}
            {TRADESWIFT_COMPANY.phone}
          </p>
        </footer>
      </div>
    </article>
  )
}

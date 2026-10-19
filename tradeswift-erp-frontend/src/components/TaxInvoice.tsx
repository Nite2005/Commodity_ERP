import type { BillDetail, BillLineItem } from '../types'
import {
  TRADESWIFT_COMPANY,
  amountInWords,
  formatDateDmyDot,
  formatNum,
} from '../lib/invoice'

interface TaxInvoiceProps {
  bill: BillDetail
}

export function TaxInvoice({ bill }: TaxInvoiceProps) {
  const pan = bill.company_pan || TRADESWIFT_COMPANY.pan
  const mobile = bill.company_phone || TRADESWIFT_COMPANY.phone
  const gstin = bill.company_gstin || TRADESWIFT_COMPANY.gstin
  const companyName = bill.company_name || TRADESWIFT_COMPANY.name
  const companyAddress =
    [bill.company_address, bill.company_city, bill.company_state]
      .filter(Boolean)
      .join(', ') ||
    `${TRADESWIFT_COMPANY.address}, ${TRADESWIFT_COMPANY.city} ${TRADESWIFT_COMPANY.state}`
  const devotionalHeading = TRADESWIFT_COMPANY.devotional_heading || 'Jai shri Shyam'

  const bankName = bill.company_bank_name || TRADESWIFT_COMPANY.bank_name
  const accountNo = bill.company_account_no || TRADESWIFT_COMPANY.account_no
  const ifscCode = bill.company_ifsc_code || TRADESWIFT_COMPANY.ifsc_code

  const partyName = bill.party_name || 'Party Name'
  const partyGstin = bill.party_gst_tin && bill.party_gst_tin.trim() !== '-' ? bill.party_gst_tin : '—'
  const partyAddress =
    [bill.party_address, bill.party_city].filter(Boolean).join(', ') || '—'
  const partyState = bill.party_state || '—'
  const partyStateCode =
    partyGstin && partyGstin !== '—' && partyGstin.length >= 2
      ? partyGstin.slice(0, 2)
      : '09'

  // Segregate lines by seller / buyer counterparty roles dynamically
  const sellerLines: BillLineItem[] = []
  const buyerLines: BillLineItem[] = []

  const normPartyId = (bill.party_id || '').replace(/-/g, '').toLowerCase()
  const partyNameLower = (bill.party_name || '').trim().toLowerCase()

  bill.line_items.forEach((item) => {
    const normSellerId = (item.seller_id || '').replace(/-/g, '').toLowerCase()
    const normBuyerId = (item.buyer_id || '').replace(/-/g, '').toLowerCase()
    const sellerNameLower = (item.seller_name || '').trim().toLowerCase()
    const buyerNameLower = (item.buyer_name || '').trim().toLowerCase()

    const isSeller =
      (normPartyId && normSellerId === normPartyId) ||
      (partyNameLower && sellerNameLower === partyNameLower)
    const isBuyer =
      (normPartyId && normBuyerId === normPartyId) ||
      (partyNameLower && buyerNameLower === partyNameLower)

    if (isSeller) {
      sellerLines.push(item)
    } else if (isBuyer) {
      buyerLines.push(item)
    } else {
      // If ambiguous, default to seller
      sellerLines.push(item)
    }
  })

  const getLineBrokerage = (item: BillLineItem): number => {
    if (item.line_brokerage_amount != null) {
      return Number(item.line_brokerage_amount)
    }
    const rate = Number(item.broker_rate ?? 0)
    if (item.broker_rate_type === 'PERCENTAGE') {
      return (Number(item.line_base_amount || 0) * rate) / 100
    }
    return Number(item.quantity || 0) * rate
  }

  const calcSubtotal = (items: BillLineItem[]) => {
    const bags = items.reduce((sum, i) => sum + (Number(i.bags) || 0), 0)
    const weight = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)
    const brokerage = items.reduce((sum, i) => sum + getLineBrokerage(i), 0)
    return { bags, weight, brokerage }
  }

  const sellerSubtotal = calcSubtotal(sellerLines)
  const buyerSubtotal = calcSubtotal(buyerLines)

  const hasSellerLines = sellerLines.length > 0
  const hasBuyerLines = buyerLines.length > 0

  const totalBags = sellerSubtotal.bags + buyerSubtotal.bags
  const totalWeight = sellerSubtotal.weight + buyerSubtotal.weight
  const hasLineItems = hasSellerLines || hasBuyerLines
  const totalBrokerage = hasLineItems
    ? sellerSubtotal.brokerage + buyerSubtotal.brokerage
    : Number(bill.brokerage_amount || 0)

  // Determine inter-state (IGST) vs intra-state (CGST+SGST)
  const companyState = (bill.company_state || TRADESWIFT_COMPANY.state || '').trim()
  const partyStateClean = (partyState || '').trim()

  const isInterState =
    partyStateClean && companyState
      ? partyStateClean.toLowerCase() !== companyState.toLowerCase()
      : bill.supply_type === 'INTER_STATE'

  const igstRate = Number(bill.igst_percent ?? (isInterState ? 18 : 0))
  const cgstRate = Number(bill.cgst_percent ?? (!isInterState ? (igstRate ? igstRate / 2 : 9) : 0))
  const sgstRate = Number(bill.sgst_percent ?? (!isInterState ? (igstRate ? igstRate / 2 : 9) : 0))

  let igstAmount = 0
  let cgstAmount = 0
  let sgstAmount = 0

  if (isInterState && igstRate > 0) {
    igstAmount = Math.round(totalBrokerage * igstRate) / 100
  } else if (!isInterState) {
    cgstAmount = Math.round(totalBrokerage * cgstRate) / 100
    sgstAmount = Math.round(totalBrokerage * sgstRate) / 100
  }

  const taxTotal = igstAmount + cgstAmount + sgstAmount
  const netAmount = Math.round((totalBrokerage + taxTotal) * 100) / 100

  const renderSectionRows = (items: BillLineItem[], isSellerSection: boolean) => {
    return items.map((line, idx) => {
      const counterparty = isSellerSection
        ? line.buyer_name || '—'
        : line.seller_name || '—'
      const commodity = line.commodity_short_name || line.commodity_name || '—'
      const weightUnit = line.qty_unit || 'M.T'
      const saudaRate = Number(line.rate || 0)
      const brokerRate = Number(line.broker_rate ?? 0)
      const isPct = line.broker_rate_type === 'PERCENTAGE'
      const lineBrokerage = getLineBrokerage(line)

      return (
        <tr key={line.id || idx}>
          <td className="py-0.5 px-1 whitespace-nowrap">
            {formatDateDmyDot(line.despatch_date || line.contract_date || bill.bill_date)}
          </td>
          <td className="py-0.5 px-1 whitespace-nowrap font-medium">
            {line.contract_no ? `${line.contract_no}` : '—'}
          </td>
          <td className="py-0.5 px-1 uppercase font-medium truncate max-w-[210px]" title={counterparty}>
            {counterparty}
          </td>
          <td className="py-0.5 px-1 whitespace-nowrap">{commodity}</td>
          <td className="py-0.5 px-1 text-right whitespace-nowrap">{line.bags ?? '0'}</td>
          <td className="py-0.5 px-1 text-right whitespace-nowrap font-medium">
            {formatNum(line.quantity, 3)} {weightUnit}
          </td>
          <td className="py-0.5 px-1 text-right whitespace-nowrap">
            {formatNum(saudaRate, 2)}/{weightUnit}
          </td>
          <td className="py-0.5 px-1 text-right whitespace-nowrap font-medium">
            {isPct ? `${formatNum(brokerRate, 2)}%` : `${formatNum(brokerRate, 2)}/${weightUnit}`}
          </td>
          <td className="py-0.5 px-1 text-right whitespace-nowrap font-semibold">
            {formatNum(lineBrokerage, 2)}
          </td>
        </tr>
      )
    })
  }

  return (
    <article
      id="tax-invoice"
      className="mx-auto max-w-[210mm] bg-white text-black p-8 font-mono text-[11px] leading-tight shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0 print:p-2"
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
    >
      {/* 1. TOP HEADER BAND */}
      <div className="pb-1 mb-1">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <div>PAN : {pan}</div>
          <div>{devotionalHeading}</div>
          <div>Mobile: {mobile}</div>
        </div>
        <div className="text-[11px] font-semibold mt-0.5">
          GSTIN: {gstin}
        </div>

        {/* Firm / Company Name & Address */}
        <div className="text-center mt-2">
          <h1 className="text-xl font-bold tracking-wider text-black uppercase">
            {companyName}
          </h1>
          <p className="text-[11px] text-black mt-0.5">
            {companyAddress}
          </p>
          <div className="mt-2 text-sm font-bold tracking-widest uppercase">
            GST  INVOICE
          </div>
        </div>
      </div>

      {/* 2. INVOICE META & COUNTERPARTY DETAILS */}
      <div className="grid grid-cols-2 gap-4 pb-2 text-[11px] pt-1">
        <div className="space-y-0.5">
          <div className="flex">
            <span className="w-20 font-bold">Bill No.</span>
            <span>: <strong className="font-bold">{bill.bill_no}</strong></span>
          </div>
          <div className="flex">
            <span className="w-20 font-semibold">Period</span>
            <span>
              : {formatDateDmyDot(bill.from_date)}-{formatDateDmyDot(bill.to_date)}
            </span>
          </div>
          <div className="flex pt-1">
            <span className="w-20 font-bold">Party</span>
            <span className="font-bold">
              : {partyName} {partyGstin && partyGstin !== '—' ? `(GSTIN: ${partyGstin})` : ''}
            </span>
          </div>
          <div className="flex">
            <span className="w-20 font-semibold">Address</span>
            <span>: {partyAddress}</span>
          </div>
          <div className="flex">
            <span className="w-20 font-semibold">GSTIN</span>
            <span className="font-bold">: {partyGstin}</span>
          </div>
          <div className="flex">
            <span className="w-20 font-semibold">State</span>
            <span>: {partyState} (Code: {partyStateCode})</span>
          </div>
          <div className="flex">
            <span className="w-20 font-semibold">SAC Code</span>
            <span>:</span>
          </div>
        </div>

        <div className="text-right flex flex-col justify-between space-y-0.5">
          <div>
            <div className="flex justify-end">
              <span className="font-bold mr-2">Bill Date :</span>
              <span className="font-bold">{formatDateDmyDot(bill.bill_date)}</span>
            </div>
          </div>
          <div className="mb-5">
            <div className="flex justify-end">
              <span className="font-semibold mr-2">Reverse Charge? :</span>
              <span className="font-semibold">No</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SAUDA & BROKERAGE TABLE */}
      <div className="my-1">
        {/* Top dashed divider */}
        <div className="border-t border-dashed border-black w-full my-1" />

        <table className="w-full text-left text-[11px] border-collapse font-mono">
          <thead>
            <tr className="font-semibold text-black">
              <th className="py-0 px-1 text-left"></th>
              <th className="py-0 px-1 text-left"></th>
              <th className="py-0 px-1 text-left"></th>
              <th className="py-0 px-1 text-left"></th>
              <th className="py-0 px-1 text-right"></th>
              <th className="py-0 px-1 text-right">Sauda</th>
              <th className="py-0 px-1 text-right">Sauda</th>
              <th className="py-0 px-1 text-right">Brokerage</th>
              <th className="py-0 px-1 text-right">Brokerage</th>
            </tr>
            <tr className="font-semibold text-black">
              <th className="pb-1 px-1 text-left">Date</th>
              <th className="pb-1 px-1 text-left">Sauda#</th>
              <th className="pb-1 px-1 text-left">Seller/Buyer</th>
              <th className="pb-1 px-1 text-left">Commodity</th>
              <th className="pb-1 px-1 text-right">Bags</th>
              <th className="pb-1 px-1 text-right">Weight</th>
              <th className="pb-1 px-1 text-right">Rate</th>
              <th className="pb-1 px-1 text-right">Rate</th>
              <th className="pb-1 px-1 text-right">Amount</th>
            </tr>
            <tr>
              <td colSpan={9} className="py-0">
                <div className="border-t border-dashed border-black w-full" />
              </td>
            </tr>
          </thead>

          <tbody>
            {/* SELLERS BROKERAGE SECTION (Only shown when seller items exist) */}
            {hasSellerLines && (
              <>
                <tr>
                  <td
                    colSpan={9}
                    className="pt-2 pb-0.5 px-1 font-bold tracking-wide text-black"
                  >
                    ** Sellers Brokerage **
                  </td>
                </tr>
                {renderSectionRows(sellerLines, true)}
                {/* Dashed line above subtotal */}
                <tr>
                  <td colSpan={4}></td>
                  <td className="text-right px-1 text-[10px]">------</td>
                  <td className="text-right px-1 text-[10px]">------------</td>
                  <td colSpan={2}></td>
                  <td className="text-right px-1 text-[10px]">---------</td>
                </tr>
                {/* Subtotal row */}
                <tr className="font-semibold text-black">
                  <td colSpan={4}></td>
                  <td className="py-0.5 px-1 text-right">{sellerSubtotal.bags}</td>
                  <td className="py-0.5 px-1 text-right">
                    {formatNum(sellerSubtotal.weight, 3)}
                  </td>
                  <td colSpan={2}></td>
                  <td className="py-0.5 px-1 text-right font-bold">
                    {formatNum(sellerSubtotal.brokerage, 2)}
                  </td>
                </tr>
              </>
            )}

            {/* BUYERS BROKERAGE SECTION (Only shown when buyer items exist) */}
            {hasBuyerLines && (
              <>
                <tr>
                  <td
                    colSpan={9}
                    className="pt-2 pb-0.5 px-1 font-bold tracking-wide text-black"
                  >
                    ** Buyer's Brokerage **
                  </td>
                </tr>
                {renderSectionRows(buyerLines, false)}
                {/* Dashed line above subtotal */}
                <tr>
                  <td colSpan={4}></td>
                  <td className="text-right px-1 text-[10px]">------</td>
                  <td className="text-right px-1 text-[10px]">------------</td>
                  <td colSpan={2}></td>
                  <td className="text-right px-1 text-[10px]">---------</td>
                </tr>
                {/* Subtotal row */}
                <tr className="font-semibold text-black">
                  <td colSpan={4}></td>
                  <td className="py-0.5 px-1 text-right">{buyerSubtotal.bags}</td>
                  <td className="py-0.5 px-1 text-right">
                    {formatNum(buyerSubtotal.weight, 3)}
                  </td>
                  <td colSpan={2}></td>
                  <td className="py-0.5 px-1 text-right font-bold">
                    {formatNum(buyerSubtotal.brokerage, 2)}
                  </td>
                </tr>
              </>
            )}

            {!hasSellerLines && !hasBuyerLines && (
              <tr>
                <td colSpan={9} className="py-4 text-center text-slate-500">
                  No brokerage line items recorded.
                </td>
              </tr>
            )}
          </tbody>

          {/* TABLE TOTAL ROW */}
          <tfoot>
            <tr>
              <td colSpan={9} className="py-1">
                <div className="border-t border-dashed border-black w-full" />
              </td>
            </tr>
            <tr className="font-bold text-black">
              <td colSpan={4} className="py-0.5 px-1">
                Total
              </td>
              <td className="py-0.5 px-1 text-right">{totalBags}</td>
              <td className="py-0.5 px-1 text-right font-bold">
                {formatNum(totalWeight, 3)}
              </td>
              <td colSpan={2} className="py-0.5 px-1 text-right">
                Total
              </td>
              <td className="py-0.5 px-1 text-right font-bold">
                {formatNum(totalBrokerage, 2)}
              </td>
            </tr>
            <tr>
              <td colSpan={9} className="py-1">
                <div className="border-t border-dashed border-black w-full" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 4. BANK DETAILS & TAX BREAKDOWN */}
      <div className="grid grid-cols-12 gap-2 py-1 text-[11px]">
        <div className="col-span-7 flex flex-col justify-start pt-1">
          <div className="font-semibold">
            Our Bank: {bankName}, Acc #: {accountNo}, IFSC: {ifscCode}
          </div>
        </div>
        <div className="col-span-5 text-right space-y-0.5">
          {isInterState && (
            <div className="flex justify-between font-bold">
              <span>IGST{igstRate}%</span>
              <span>{formatNum(igstAmount, 2)}</span>
            </div>
          )}
          {!isInterState && (
            <>
              <div className="flex justify-between font-bold">
                <span>CGST{cgstRate}%</span>
                <span>{formatNum(cgstAmount, 2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>SGST{sgstRate}%</span>
                <span>{formatNum(sgstAmount, 2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold">
            <span>Net Amount</span>
            <span>{formatNum(netAmount, 2)}</span>
          </div>
        </div>
      </div>

      {/* 5. AMOUNT IN WORDS */}
      <div className="border-t border-dashed border-black w-full my-1" />
      <div className="py-1 text-[11px] font-semibold">
        In Words: <span className="font-bold">{amountInWords(netAmount)}</span>
      </div>
      <div className="border-t border-dashed border-black w-full my-1" />

      {/* 6. SIGNATURES & FOOTER */}
      <div className="pt-2 text-[11px]">
        <div className="text-right font-bold mb-8">
          For {companyName}
        </div>
        <div className="flex items-center justify-between text-black pt-1">
          <div>E. & O. E.</div>
          <div>Receiver's Signature</div>
          <div className="font-semibold">Authorised Signatory</div>
        </div>
      </div>
    </article>
  )
}

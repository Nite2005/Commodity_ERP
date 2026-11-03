import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  FileText,
  Download,
} from 'lucide-react'
import { Button } from './Button'

export interface BulkImportResult {
  total: number
  inserted: number
  failed: number
  errors: string[]
}

interface BulkImportModalProps {
  open: boolean
  onClose: () => void
  title: string
  entityType: 'Party' | 'Rate'
  onImport: (rows: any[]) => Promise<BulkImportResult>
  onSuccess: () => void
}

function cleanKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizePartyRow(raw: Record<string, any>): Record<string, any> {
  const map: Record<string, any> = {}
  for (const [k, v] of Object.entries(raw)) {
    map[cleanKey(k)] = v
  }

  const name =
    map['partyname'] ||
    map['name'] ||
    map['party'] ||
    map['firmname'] ||
    map['firm'] ||
    map['client'] ||
    map['customer'] ||
    ''

  const short_name =
    map['shortname'] || map['short'] || map['alias'] || (name ? String(name).slice(0, 20).trim() : '')

  const gst_tin =
    map['gstno'] ||
    map['gstin'] ||
    map['gsttin'] ||
    map['gst'] ||
    map['taxid'] ||
    null

  const customer_type =
    map['customertype'] ||
    map['type'] ||
    (gst_tin ? 'REGISTERED' : 'UNREGISTERED')

  const mobile =
    map['contactno'] ||
    map['contact'] ||
    map['mobile'] ||
    map['phone'] ||
    map['cell']
      ? String(
          map['contactno'] ||
            map['contact'] ||
            map['mobile'] ||
            map['phone'] ||
            map['cell'],
        ).trim()
      : null

  const address =
    map['address'] || map['addressline'] || map['addr'] || 'N/A'

  const designation =
    map['designation'] || map['role'] ? String(map['designation'] || map['role']).trim() : null

  const bank_name =
    map['bankname'] || map['bank'] ? String(map['bankname'] || map['bank']).trim() : null

  const account_no =
    map['accountno'] || map['account'] || map['accno']
      ? String(map['accountno'] || map['account'] || map['accno']).trim()
      : null

  const ifsc_code =
    map['ifsc'] || map['ifsccode']
      ? String(map['ifsc'] || map['ifsccode']).trim().toUpperCase()
      : null

  return {
    name: String(name).trim(),
    short_name: String(short_name).trim(),
    customer_type: String(customer_type).trim().toUpperCase(),
    gst_tin: gst_tin ? String(gst_tin).trim().toUpperCase() : null,
    address_line: String(address).trim(),
    city: String(map['city'] || 'Jaipur').trim(),
    state: String(map['state'] || 'Rajasthan').trim(),
    pincode: String(map['pincode'] || map['pin'] || map['zip'] || '302001').trim().slice(0, 6),
    mobile: mobile,
    phone: map['landline'] || map['phone'] ? String(map['landline'] || map['phone']).trim() : null,
    email: map['email'] || map['mail'] ? String(map['email'] || map['mail']).trim() : null,
    contact_name: map['contactname'] || map['contactperson'] ? String(map['contactname'] || map['contactperson']).trim() : null,
    designation: designation,
    bank_name: bank_name,
    account_no: account_no,
    ifsc_code: ifsc_code,
    credit_limit: map['creditlimit'] || map['limit'] ? Number(map['creditlimit'] || map['limit']) : 5000000,
  }
}

function normalizeRateRow(raw: Record<string, any>): Record<string, any> {
  const map: Record<string, any> = {}
  for (const [k, v] of Object.entries(raw)) {
    map[cleanKey(k)] = v
  }

  const party = map['partyname'] || map['party'] || map['partycode'] || map['partyid'] || ''
  const commodity =
    map['commodity'] ||
    map['commodityname'] ||
    map['item'] ||
    map['commodityid'] ||
    map['commshortname'] ||
    ''

  const rawCustomerType = String(
    map['customertype'] || map['partytype'] || map['role'] || 'BOTH',
  )
    .toUpperCase()
    .trim()
  const customerType = rawCustomerType.includes('BUY')
    ? 'BUYER'
    : rawCustomerType.includes('SELL')
    ? 'SELLER'
    : 'BOTH'

  const rateVal = Number(map['rate'] || map['price'] || map['amount'] || 0)
  const rawRateType = String(map['ratetype'] || 'FIXED').toUpperCase().trim()
  const rateType = rawRateType.includes('PERCENT') ? 'PERCENTAGE' : 'FIXED'

  const rawUnit = String(map['unit'] || map['qtyunit'] || 'MT').toUpperCase().trim()
  const unit = ['MT', 'KGS', 'QUINTAL', 'BAGS'].includes(rawUnit) ? rawUnit : 'MT'

  const rawBrok =
    map['brokerage'] !== undefined && map['brokerage'] !== ''
      ? Number(map['brokerage'])
      : rateVal
  const brokerage = isNaN(rawBrok) ? rateVal : rawBrok
  const rawBrokType = map['brokeragetype']
    ? String(map['brokeragetype']).toUpperCase().trim()
    : rateType
  const brokerageType = rawBrokType.includes('PERCENT') ? 'PERCENTAGE' : 'FIXED'

  return {
    party_name: String(party).trim(),
    party_code: map['partycode'] ? String(map['partycode']).trim() : null,
    party_id: map['partyid'] ? String(map['partyid']).trim() : null,
    commodity_name: String(commodity).trim(),
    commodity_id: map['commodityid'] ? String(map['commodityid']).trim() : null,
    customer_type: customerType,
    rate_type: rateType,
    rate: rateVal,
    unit: unit,
    currency: 'INR',
    brokerage_type: brokerageType,
    brokerage: brokerage,
  }
}

export function downloadSampleTemplate(entityType: 'Party' | 'Rate') {
  const wb = XLSX.utils.book_new()
  if (entityType === 'Party') {
    const headers = [
      'PARTY NAME',
      'SHORT NAME',
      'GST NO.',
      'ADDRESS',
      'CONTACT NO.',
      'DESIGNATION',
      'BANK NAME',
      'ACCOUNT NO.',
      'IFSC',
    ]
    const sampleRows = [
      headers,
      [
        'Shree Shyam Trading Co',
        'Shree Shyam',
        '08AABCU9603R1ZM',
        'Sitapura Industrial Area, Jaipur',
        '9876543210',
        'Proprietor',
        'HDFC Bank',
        '50200012345678',
        'HDFC0001234',
      ],
    ]
    const ws = XLSX.utils.aoa_to_sheet(sampleRows)
    ws['!cols'] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 20 },
      { wch: 35 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Parties')
    XLSX.writeFile(wb, 'Party_Import_Template.xlsx')
  } else {
    const headers = [
      'PARTY NAME',
      'CUSTOMER TYPE',
      'COMMODITY',
      'RATE TYPE',
      'RATE',
      'UNIT',
    ]
    const sampleRows = [
      headers,
      [
        'Ravi Shankar Oil Mill',
        'Buyer',
        'Mustard Seed',
        'Fixed',
        10,
        'MT',
      ],
    ]
    const ws = XLSX.utils.aoa_to_sheet(sampleRows)
    ws['!cols'] = [
      { wch: 28 },
      { wch: 16 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Billing Rates')
    XLSX.writeFile(wb, 'Billing_Rate_Import_Template.xlsx')
  }
}

export function BulkImportModal({
  open,
  onClose,
  title,
  entityType,
  onImport,
  onSuccess,
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const resetState = () => {
    setFile(null)
    setParsedRows([])
    setParseError('')
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const parseFileContent = async (selectedFile: File) => {
    setParseError('')
    setResult(null)
    setFile(selectedFile)

    try {
      const fileName = selectedFile.name.toLowerCase()
      let rawData: any[] = []

      if (fileName.endsWith('.json')) {
        const text = await selectedFile.text()
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          rawData = parsed
        } else if (parsed && typeof parsed === 'object') {
          rawData = parsed.data || parsed.rows || parsed.records || parsed.items || [parsed]
        }
      } else {
        // Excel, CSV, TSV, TXT via SheetJS
        const buffer = await selectedFile.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) {
          throw new Error('The uploaded file does not contain any readable sheets.')
        }
        const worksheet = workbook.Sheets[firstSheetName]
        rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' })
      }

      if (!rawData || rawData.length === 0) {
        throw new Error('No data rows found in the selected file.')
      }

      // Normalize records according to entity type
      const normalized = rawData.map((row) =>
        entityType === 'Party' ? normalizePartyRow(row) : normalizeRateRow(row),
      )

      // Filter out completely blank rows
      const validRows = normalized.filter((r) =>
        entityType === 'Party' ? Boolean(r.name) : Boolean(r.party_name && r.commodity_name && r.rate > 0),
      )

      if (validRows.length === 0) {
        throw new Error(
          entityType === 'Party'
            ? 'No valid party rows found. Each party must have a "PARTY NAME" column.'
            : 'No valid rate rows found. Each rate must have PARTY NAME, COMMODITY, and RATE columns.',
        )
      }

      setParsedRows(validRows)
    } catch (err: any) {
      setParseError(err.message || 'Failed to read file. Please ensure it is a valid format.')
      setParsedRows([])
    }
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      parseFileContent(selected)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      parseFileContent(droppedFile)
    }
  }

  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    setParseError('')
    try {
      const res = await onImport(parsedRows)
      setResult(res)
      if (res.inserted > 0) {
        onSuccess()
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to import data.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">
              Supports Excel (.xlsx, .xls), CSV (.csv), TSV (.tsv), Text (.txt), and JSON (.json)
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Result view if completed */}
          {result ? (
            <div className="space-y-4">
              <div
                className={`rounded-xl border p-5 ${
                  result.failed === 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.failed === 0 ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                  )}
                  <div>
                    <h4 className="font-semibold text-base">
                      Import Finished: {result.inserted} of {result.total} Records Added
                    </h4>
                    {result.failed > 0 && (
                      <p className="text-sm mt-0.5 text-amber-800">
                        {result.failed} records could not be added due to validation or duplicate entries.
                      </p>
                    )}
                  </div>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div className="mt-4 max-h-48 overflow-y-auto rounded-lg bg-white/80 p-3 border border-amber-200 text-xs font-mono text-slate-700 space-y-1">
                    {result.errors.map((err, i) => (
                      <div key={i} className="text-red-600">
                        • {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={resetState}>
                  <RefreshCw size={15} /> Import Another File
                </Button>
                <Button onClick={handleClose}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Template Download Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3.5">
                <div>
                  <p className="text-xs font-semibold text-brand-900">
                    Need the format? Download the official Excel template:
                  </p>
                  <p className="text-[11px] text-brand-700 mt-0.5">
                    {entityType === 'Party'
                      ? 'Columns: PARTY NAME, SHORT NAME, GST NO., ADDRESS, CONTACT NO., DESIGNATION, BANK NAME, ACCOUNT NO., IFSC'
                      : 'Columns: PARTY NAME, CUSTOMER TYPE, COMMODITY, RATE TYPE, RATE, UNIT'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadSampleTemplate(entityType)}
                  className="shrink-0 bg-white hover:bg-brand-50 text-brand-700 border-brand-300 font-medium shadow-xs"
                >
                  <Download size={14} className="mr-1 text-brand-600" /> Download Template (.xlsx)
                </Button>
              </div>

              {/* Drag & Drop File Upload Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragOver
                    ? 'border-brand-500 bg-brand-50/50'
                    : file
                    ? 'border-brand-300 bg-slate-50'
                    : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt,.json"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="rounded-full bg-brand-100 p-3 text-brand-600">
                    {file ? <FileSpreadsheet size={28} /> : <Upload size={28} />}
                  </div>
                  {file ? (
                    <div>
                      <p className="font-semibold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB • {parsedRows.length} valid records detected
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-slate-700">
                        Click or drag & drop your Excel/CSV data file here
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Compatible with .xlsx, .xls, .csv, .tsv, .txt, .json
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                    >
                      <FileText size={15} /> {file ? 'Choose Different File' : 'Select File'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {parseError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <div>{parseError}</div>
                </div>
              )}

              {/* Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">
                      Data Preview (First {Math.min(parsedRows.length, 5)} of {parsedRows.length} rows):
                    </span>
                    <span className="text-emerald-700 font-semibold">✓ Ready to import</span>
                  </div>
                  <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 text-slate-700 font-semibold">
                        {entityType === 'Party' ? (
                          <tr>
                            <th className="px-3 py-2 whitespace-nowrap">Party Name</th>
                            <th className="px-3 py-2 whitespace-nowrap">Short Name</th>
                            <th className="px-3 py-2 whitespace-nowrap">GST No.</th>
                            <th className="px-3 py-2 whitespace-nowrap">Address</th>
                            <th className="px-3 py-2 whitespace-nowrap">Contact No.</th>
                            <th className="px-3 py-2 whitespace-nowrap">Designation</th>
                            <th className="px-3 py-2 whitespace-nowrap">Bank Name</th>
                            <th className="px-3 py-2 whitespace-nowrap">Account No.</th>
                            <th className="px-3 py-2 whitespace-nowrap">IFSC</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="px-3 py-2 whitespace-nowrap">Party Name</th>
                            <th className="px-3 py-2 whitespace-nowrap">Customer Type</th>
                            <th className="px-3 py-2 whitespace-nowrap">Commodity</th>
                            <th className="px-3 py-2 whitespace-nowrap">Rate Type</th>
                            <th className="px-3 py-2 whitespace-nowrap">Rate</th>
                            <th className="px-3 py-2 whitespace-nowrap">Unit</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {entityType === 'Party' ? (
                              <>
                                <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{row.name}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.short_name}</td>
                                <td className="px-3 py-2 text-slate-600 font-mono text-[11px] whitespace-nowrap">{row.gst_tin || '—'}</td>
                                <td className="px-3 py-2 text-slate-600 truncate max-w-[160px]" title={row.address_line}>{row.address_line}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.mobile || '—'}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.designation || '—'}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.bank_name || '—'}</td>
                                <td className="px-3 py-2 text-slate-600 font-mono text-[11px] whitespace-nowrap">{row.account_no || '—'}</td>
                                <td className="px-3 py-2 text-slate-600 font-mono text-[11px] whitespace-nowrap">{row.ifsc_code || '—'}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{row.party_name}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.customer_type}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.commodity_name}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.rate_type}</td>
                                <td className="px-3 py-2 text-slate-600 font-medium whitespace-nowrap">₹{row.rate}</td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.unit}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons in Modal */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button variant="secondary" onClick={handleClose} disabled={importing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImportSubmit}
                  disabled={parsedRows.length === 0 || importing}
                >
                  {importing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Importing…
                    </>
                  ) : (
                    <>
                      <Upload size={16} /> Import & Save {parsedRows.length > 0 ? `(${parsedRows.length})` : ''}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

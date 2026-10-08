import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Wallet,
  ArrowRight,
  FileCheck2,
  Calendar,
  Layers,
  Banknote,
  RefreshCw,
} from 'lucide-react'
import { contractsApi, ApiClientError } from '../../api/client'
import type { Contract, ContractDetail } from '../../types'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Modal'
import { Badge } from '../../components/Badge'
import { PartyLedgerPanel } from '../../components/PartyLedgerPanel'
import { formatDateDmy } from '../../lib/dates'

export function FinancialManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const contractIdParam = searchParams.get('contractId')

  const [contractsList, setContractsList] = useState<Contract[]>([])
  const [selectedContractId, setSelectedContractId] = useState<string>(contractIdParam || '')
  const [contractDetail, setContractDetail] = useState<ContractDetail | null>(null)

  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')

  // 1. Fetch available contracts list
  useEffect(() => {
    const fetchContracts = async () => {
      setLoadingList(true)
      try {
        const list = await contractsApi.list()
        setContractsList(list)
        if (contractIdParam) {
          setSelectedContractId(contractIdParam)
        } else if (list.length > 0) {
          setSelectedContractId(list[0].id)
          setSearchParams({ contractId: list[0].id }, { replace: true })
        }
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : 'Failed to load contracts')
      } finally {
        setLoadingList(false)
      }
    }
    fetchContracts()
  }, [])

  // 2. Load contract detail when selectedContractId changes
  useEffect(() => {
    if (!selectedContractId) return
    const fetchDetail = async () => {
      setLoadingDetail(true)
      setError('')
      try {
        const detail = await contractsApi.get(selectedContractId)
        setContractDetail(detail)
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : 'Failed to load contract financial details')
      } finally {
        setLoadingDetail(false)
      }
    }
    fetchDetail()
  }, [selectedContractId])

  const handleSelectContract = (id: string) => {
    setSelectedContractId(id)
    setSearchParams({ contractId: id })
  }

  const handleRefresh = async () => {
    setLoadingList(true)
    try {
      const list = await contractsApi.list()
      setContractsList(list)
      if (selectedContractId) {
        setLoadingDetail(true)
        const d = await contractsApi.get(selectedContractId)
        setContractDetail(d)
      }
    } catch {
      // ignore
    } finally {
      setLoadingList(false)
      setLoadingDetail(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 mt-1">
            <Wallet size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Financial Management</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                PARTY LEDGER & DEAL AUDIT
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review full-screen counterparty financial exposure, live credit limits, and contract breakdown.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={loadingList || loadingDetail}
            className="flex items-center gap-1.5 shadow-xs"
            title="Reload financial details and contracts"
          >
            <RefreshCw size={14} className={loadingList || loadingDetail ? 'animate-spin text-brand-600' : ''} />
            <span>Refresh</span>
          </Button>
          {contractDetail && (
            <Link to={`/contracts/${contractDetail.id}`}>
              <Button variant="secondary" size="sm" className="text-brand-600 hover:text-brand-700 flex items-center gap-1.5 shadow-xs">
                <span>View Contract #{contractDetail.contract_no}</span>
                <ArrowRight size={14} />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {error && <Alert message={error} />}

      {/* Contract Selector & Summary Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <FileCheck2 size={16} className="text-emerald-600" />
            Active Contract:
          </span>
          <select
            value={selectedContractId}
            onChange={(e) => handleSelectContract(e.target.value)}
            disabled={loadingList}
            className="w-full md:w-96 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
          >
            {contractsList.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.contract_no} ({c.contract_type} · {c.status})
              </option>
            ))}
          </select>
        </div>

        {contractDetail && (
          <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap justify-end">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              <span className="text-slate-400">Date:</span>
              <span className="font-semibold text-slate-800">
                {formatDateDmy(contractDetail.contract_date)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Banknote size={13} className="text-slate-400" />
              <span className="text-slate-400">Rate:</span>
              <span className="font-bold text-emerald-700 font-mono">
                ₹{contractDetail.rate}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers size={13} className="text-slate-400" />
              <span className="text-slate-400">Quantity:</span>
              <span className="font-semibold text-slate-800">
                {contractDetail.qty_low} – {contractDetail.qty_high} {contractDetail.qty_unit}
              </span>
            </div>
            <Badge label={contractDetail.status} />
          </div>
        )}
      </div>

      {loadingDetail && !contractDetail ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          Loading financial ledger data…
        </div>
      ) : contractDetail ? (
        <div className="w-full">
          <PartyLedgerPanel
            key={contractDetail.id}
            sellerId={contractDetail.seller_id}
            sellerName={contractDetail.seller_name || 'Seller'}
            buyerId={contractDetail.buyer_id}
            buyerName={contractDetail.buyer_name || 'Buyer'}
            currentContractNo={contractDetail.contract_no}
          />
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500 text-xs">
          No contract selected. Choose a contract above to inspect financial ledger data.
        </div>
      )}
    </div>
  )
}

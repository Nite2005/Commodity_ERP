import type { ContractDetail } from '../types'
import { ContractReport } from '../components/ContractReport'
import { componentToPdfBlob, triggerDownload } from './pdfDownload'

async function contractToPdfBlob(contract: ContractDetail): Promise<Blob> {
  return componentToPdfBlob(ContractReport, { contract }, '#contract-report')
}

export async function downloadContractReportPdf(contract: ContractDetail) {
  const blob = await contractToPdfBlob(contract)
  const safeNo = String(contract.contract_no).replace(/[^\w.-]+/g, '_')
  triggerDownload(blob, `contract-${safeNo}.pdf`)
}

export async function downloadContractReportsZip(
  contracts: ContractDetail[],
  zipName = 'contract-reports.zip',
  onProgress?: (done: number, total: number) => void,
) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const total = contracts.length
  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i]
    const blob = await contractToPdfBlob(contract)
    const safeNo = String(contract.contract_no).replace(/[^\w.-]+/g, '_')
    zip.file(`contract-${safeNo}.pdf`, blob)
    onProgress?.(i + 1, total)
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(zipBlob, zipName)
}

import { MasterCrud } from '../../components/MasterCrud'
import { mastersApi } from '../../api/client'
import type { Company } from '../../types'

export function CompaniesPage() {
  return (
    <MasterCrud<Company>
      title="Company"
      subtitle="Your own legal entities — each company can have multiple parties"
      fields={[
        { name: 'name', label: 'Company Name', required: true },
        { name: 'gst_tin', label: 'GST', placeholder: '15 char GSTIN' },
        { name: 'address', label: 'Address', type: 'textarea' },
        { name: 'account_no', label: 'A/c No' },
        { name: 'bank_name', label: 'Bank Name' },
        { name: 'ifsc_code', label: 'IFSC Code', placeholder: 'e.g. BDBL0001166' },
        { name: 'phone', label: 'Phone' },
      ]}
      columns={[
        { key: 'company_code', label: 'Code' },
        { key: 'name', label: 'Company Name' },
        { key: 'gst_tin', label: 'GST', render: (r) => r.gst_tin || '—' },
        { key: 'bank_name', label: 'Bank', render: (r) => r.bank_name || '—' },
        { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
      ]}
      listFn={mastersApi.companies.list}
      createFn={mastersApi.companies.create}
      updateFn={mastersApi.companies.update}
      deleteFn={mastersApi.companies.remove}
      toForm={(r) => ({
        name: r.name,
        gst_tin: r.gst_tin ?? '',
        address: r.address ?? '',
        account_no: r.account_no ?? '',
        bank_name: r.bank_name ?? '',
        ifsc_code: r.ifsc_code ?? '',
        phone: r.phone ?? '',
      })}
      fromForm={(f) => ({
        name: f.name,
        gst_tin: f.gst_tin || null,
        address: f.address || '',
        account_no: f.account_no || null,
        bank_name: f.bank_name || null,
        ifsc_code: f.ifsc_code || null,
        phone: f.phone || null,
      })}
    />
  )
}

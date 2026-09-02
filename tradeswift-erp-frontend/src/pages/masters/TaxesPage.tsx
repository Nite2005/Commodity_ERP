import { MasterCrud } from '../../components/MasterCrud'
import { mastersApi } from '../../api/client'
import type { Tax } from '../../types'

export function TaxesPage() {
  return (
    <MasterCrud<Tax>
      title="Tax"
      subtitle="GST tax schedules with IGST / CGST / SGST percentages"
      fields={[
        { name: 'tax_name', label: 'Tax Name', required: true, placeholder: 'GST 5%' },
        { name: 'igst_percent', label: 'IGST %', type: 'number', step: '0.01', required: true },
        { name: 'cgst_percent', label: 'CGST %', type: 'number', step: '0.01', required: true },
        { name: 'sgst_percent', label: 'SGST %', type: 'number', step: '0.01', required: true },
      ]}
      columns={[
        { key: 'tax_code', label: 'Code' },
        { key: 'tax_name', label: 'Name' },
        { key: 'igst_percent', label: 'IGST' },
        { key: 'cgst_percent', label: 'CGST' },
        { key: 'sgst_percent', label: 'SGST' },
      ]}
      listFn={mastersApi.taxes.list}
      createFn={mastersApi.taxes.create}
      updateFn={(id, data) =>
        mastersApi.taxes.update(id, {
          tax_name: data.tax_name,
          igst_percent: Number(data.igst_percent),
          cgst_percent: Number(data.cgst_percent),
          sgst_percent: Number(data.sgst_percent),
        })
      }
      deleteFn={mastersApi.taxes.remove}
      toForm={(r) => ({
        tax_name: r.tax_name,
        igst_percent: String(r.igst_percent),
        cgst_percent: String(r.cgst_percent),
        sgst_percent: String(r.sgst_percent),
      })}
      fromForm={(f) => ({
        tax_name: f.tax_name,
        igst_percent: Number(f.igst_percent),
        cgst_percent: Number(f.cgst_percent),
        sgst_percent: Number(f.sgst_percent),
      })}
    />
  )
}

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
      onFieldChange={(name, value, currentForm) => {
        const next = { ...currentForm, [name]: value }
        if (name === 'igst_percent') {
          const val = parseFloat(value)
          if (!isNaN(val) && val >= 0) {
            const half = (val / 2).toFixed(2).replace(/\.00$/, '')
            next.cgst_percent = half
            next.sgst_percent = half
          }
        } else if (name === 'cgst_percent') {
          next.sgst_percent = value
          const val = parseFloat(value)
          if (!isNaN(val) && val >= 0) {
            next.igst_percent = (val * 2).toFixed(2).replace(/\.00$/, '')
          }
        }
        return next
      }}
      validate={(form) => {
        const igst = Number(form.igst_percent || 0)
        const cgst = Number(form.cgst_percent || 0)
        const sgst = Number(form.sgst_percent || 0)
        const sum = Math.round((cgst + sgst) * 100) / 100
        const roundedIgst = Math.round(igst * 100) / 100

        if (sum !== roundedIgst) {
          return `GST Mismatch: CGST (${cgst}%) + SGST (${sgst}%) = ${sum}%, which does not equal IGST (${igst}%). Under GST rules, CGST + SGST must equal IGST.`
        }
        if (Math.round(cgst * 100) !== Math.round(sgst * 100)) {
          return `GST Mismatch: CGST (${cgst}%) and SGST (${sgst}%) must be equal (each exactly half of IGST).`
        }
        return null
      }}
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

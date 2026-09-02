import { MasterCrud } from '../../components/MasterCrud'
import { mastersApi } from '../../api/client'
import type { PaymentTerm, PaymentTermType } from '../../types'

export function PaymentTermsPage() {
  return (
    <MasterCrud<PaymentTerm>
      title="Payment Term"
      subtitle="Advance, Net 7, Net 30 and custom credit terms"
      fields={[
        { name: 'term_name', label: 'Term Name', required: true },
        {
          name: 'term_type',
          label: 'Type',
          type: 'select',
          required: true,
          options: [
            { value: 'ADVANCE', label: 'Advance' },
            { value: 'NET_DAYS', label: 'Net Days' },
          ],
        },
        { name: 'credit_days', label: 'Credit Days', type: 'number', required: true },
        { name: 'advance_percent', label: 'Advance %', type: 'number', step: '0.01' },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      columns={[
        { key: 'term_code', label: 'Code' },
        { key: 'term_name', label: 'Name' },
        { key: 'term_type', label: 'Type' },
        { key: 'credit_days', label: 'Days' },
        { key: 'advance_percent', label: 'Advance %' },
      ]}
      listFn={mastersApi.paymentTerms.list}
      createFn={mastersApi.paymentTerms.create}
      updateFn={mastersApi.paymentTerms.update}
      deleteFn={mastersApi.paymentTerms.remove}
      toForm={(r) => ({
        term_name: r.term_name,
        term_type: r.term_type,
        credit_days: String(r.credit_days),
        advance_percent: String(r.advance_percent),
        description: r.description ?? '',
      })}
      fromForm={(f) => ({
        term_name: f.term_name,
        term_type: f.term_type as PaymentTermType,
        credit_days: Number(f.credit_days),
        advance_percent: Number(f.advance_percent || 0),
        description: f.description || null,
      })}
    />
  )
}

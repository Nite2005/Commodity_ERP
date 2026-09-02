import { MasterCrud } from '../../components/MasterCrud'
import { mastersApi } from '../../api/client'
import type { Commodity } from '../../types'

export function CommoditiesPage() {
  return (
    <MasterCrud<Commodity>
      title="Commodity"
      subtitle="Physical goods traded by Tradeswift"
      fields={[
        { name: 'commodity_name', label: 'Commodity Name', required: true },
        { name: 'comm_short_name', label: 'Short Name', required: true, placeholder: 'e.g. MSD' },
        { name: 'quality_allowance', label: 'Quality Allowance', type: 'textarea' },
      ]}
      columns={[
        { key: 'commodity_name', label: 'Name' },
        { key: 'comm_short_name', label: 'Short' },
        {
          key: 'quality_allowance',
          label: 'Quality',
          render: (r) => (
            <span className="max-w-xs truncate block text-slate-500">
              {r.quality_allowance || '—'}
            </span>
          ),
        },
      ]}
      listFn={mastersApi.commodities.list}
      createFn={mastersApi.commodities.create}
      updateFn={mastersApi.commodities.update}
      deleteFn={mastersApi.commodities.remove}
      toForm={(r) => ({
        commodity_name: r.commodity_name,
        comm_short_name: r.comm_short_name,
        quality_allowance: r.quality_allowance ?? '',
      })}
      fromForm={(f) => ({
        commodity_name: f.commodity_name,
        comm_short_name: f.comm_short_name,
        quality_allowance: f.quality_allowance || null,
      })}
    />
  )
}

import { MasterCrud } from '../../components/MasterCrud'
import { mastersApi } from '../../api/client'
import type { Unit } from '../../types'

export function UnitsPage() {
  return (
    <MasterCrud<Unit>
      title="Weightment"
      subtitle="Weight verification terms (e.g. FINAL AT LOADING AT EX-GODAM)"
      fields={[
        {
          name: 'unit_name',
          label: 'Unit Name / Weightment Rule',
          required: true,
          placeholder: 'FINAL AT LOADING AT EX-GODAM',
        },
      ]}
      columns={[{ key: 'unit_name', label: 'Weightment Rule' }]}
      listFn={mastersApi.units.list}
      createFn={mastersApi.units.create}
      updateFn={mastersApi.units.update}
      deleteFn={mastersApi.units.remove}
      toForm={(r) => ({ unit_name: r.unit_name })}
      fromForm={(f) => ({ unit_name: f.unit_name })}
    />
  )
}

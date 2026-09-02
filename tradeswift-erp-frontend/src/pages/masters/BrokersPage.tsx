import { MasterCrud } from '../../components/MasterCrud'
import { mastersApi } from '../../api/client'
import type { Broker } from '../../types'

export function BrokersPage() {
  return (
    <MasterCrud<Broker>
      title="Broker"
      subtitle="Broker entities for commission tracking on contracts"
      fields={[{ name: 'broker_name', label: 'Broker Name', required: true }]}
      columns={[{ key: 'broker_name', label: 'Broker Name' }]}
      listFn={mastersApi.brokers.list}
      createFn={mastersApi.brokers.create}
      updateFn={mastersApi.brokers.update}
      deleteFn={mastersApi.brokers.remove}
      toForm={(r) => ({ broker_name: r.broker_name })}
      fromForm={(f) => ({ broker_name: f.broker_name })}
    />
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wheat,
  Building2,
  FileText,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import { Card, CardBody } from '../components/Card'
import { mastersApi, contractsApi, ApiClientError } from '../api/client'
import type { Contract } from '../types'
import { Badge } from '../components/Badge'

export function Dashboard() {
  const [stats, setStats] = useState({
    commodities: 0,
    parties: 0,
    contracts: 0,
    openContracts: 0,
  })
  const [recent, setRecent] = useState<Contract[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const [c, p, contracts] = await Promise.all([
          mastersApi.commodities.list(),
          mastersApi.parties.list(),
          contractsApi.list({ active_only: 'true' }),
        ])
        setStats({
          commodities: c.filter((x) => x.is_active).length,
          parties: p.filter((x) => x.is_active).length,
          contracts: contracts.length,
          openContracts: contracts.filter((x) => x.status === 'CONTRACT_OPEN').length,
        })
        setRecent(contracts.slice(0, 5))
      } catch (e) {
        if (e instanceof ApiClientError) console.error(e.message)
      }
    })()
  }, [])

  const tiles = [
    {
      label: 'Commodities',
      value: stats.commodities,
      icon: Wheat,
      to: '/masters/commodities',
      color: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Parties',
      value: stats.parties,
      icon: Building2,
      to: '/masters/parties',
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Open Contracts',
      value: stats.openContracts,
      icon: FileText,
      to: '/contracts',
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Total Contracts',
      value: stats.contracts,
      icon: TrendingUp,
      to: '/contracts',
      color: 'bg-violet-50 text-violet-700',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500">Overview of Tradeswift commodity trading operations</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardBody className="flex items-center gap-4">
                <div className={`rounded-xl p-3 ${t.color}`}>
                  <t.icon size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{t.value}</div>
                  <div className="text-sm text-slate-500">{t.label}</div>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-900">Recent Contracts</h3>
          <Link
            to="/contracts/new"
            className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            New Contract <ArrowRight size={16} />
          </Link>
        </div>
        <CardBody>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No contracts yet.{' '}
              <Link to="/contracts/new" className="text-brand-600 hover:underline">
                Create your first contract
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {recent.map((c) => (
                <Link
                  key={c.id}
                  to={`/contracts/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <span className="font-medium text-slate-900">#{c.contract_no}</span>
                    <span className="ml-3 text-sm text-slate-500">{c.contract_date}</span>
                  </div>
                  <Badge label={c.status} />
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

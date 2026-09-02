import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Scale,
  UserCircle,
  Receipt,
  Building2,
  Clock,
  Landmark,
  Contact,
  TrendingUp,
  FileText,
  Truck,
  Wheat,
} from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { section: 'Masters' },
  { to: '/masters/commodities', label: 'Commodities', icon: Wheat },
  { to: '/masters/units', label: 'Weightment', icon: Scale },
  { to: '/masters/brokers', label: 'Brokers', icon: UserCircle },
  { to: '/masters/taxes', label: 'Tax', icon: Receipt },
  { to: '/masters/parties', label: 'Parties', icon: Building2 },
  { to: '/masters/companies', label: 'Company', icon: Landmark },
  { to: '/masters/contacts', label: 'Contacts', icon: Contact },
  { to: '/masters/payment-terms', label: 'Payment Terms', icon: Clock },
  { to: '/masters/rates', label: 'Billing Rate', icon: TrendingUp },
  { section: 'Transactions' },
  { to: '/contracts', label: 'Contracts', icon: FileText },
  { to: '/despatches', label: 'Despatches', icon: Truck },
  { to: '/billing', label: 'Billing', icon: Receipt },
]

export function Layout() {
  return (
    <div className="flex h-full min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-slate-300">
        <div className="border-b border-slate-700/50 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Package size={22} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-white">TRADESWIFT</div>
              <div className="text-xs text-slate-400">Commodity ERP</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {nav.map((item, i) =>
            'section' in item ? (
              <div
                key={i}
                className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500"
              >
                {item.section}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600/20 text-brand-100'
                      : 'text-slate-400 hover:bg-sidebar-hover hover:text-white'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="border-t border-slate-700/50 px-5 py-4 text-xs text-slate-500">
          Jaipur, Rajasthan · Physical Trading
        </div>
      </aside>

      <main className="ml-64 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-8 py-4 backdrop-blur">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Tradeswift ERP</h1>
            <p className="text-sm text-slate-500">Physical commodity trading management</p>
          </div>
        </header>
        <div className="flex-1 p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

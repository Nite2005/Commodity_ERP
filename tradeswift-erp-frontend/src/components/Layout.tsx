import { useMemo } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
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
  Wheat,
  ShieldCheck,
  Users,
  Shield,
  User,
  LogOut,
  Wallet,
} from 'lucide-react'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useActiveUser } from '../context/UserContext'

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
  { to: '/billing', label: 'Bills', icon: Receipt },
  { to: '/financial-management', label: 'Financial Management', icon: Wallet },
  { section: 'Governance' },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/users', label: 'User Management', icon: Users, adminOnly: true },
]

export function Layout() {
  const navigate = useNavigate()
  const { company, loading: companyLoading } = useSelectedCompany()
  const { currentUser, logout } = useActiveUser()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const filteredNav = useMemo(() => {
    return nav.filter((item) => {
      if ('adminOnly' in item && item.adminOnly && currentUser?.role !== 'ADMIN') {
        return false
      }
      return true
    })
  }, [currentUser?.role])

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
          {filteredNav.map((item, i) =>
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
        <div className="border-t border-slate-700/50 p-3 space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out of Tradeswift ERP"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors"
          >
            <LogOut size={18} className="text-rose-400" />
            <span>Logout</span>
          </button>
          <div className="px-3 pt-1 text-[11px] text-slate-500">
            Jaipur, Rajasthan · Physical Trading
          </div>
        </div>
      </aside>

      <main className="ml-64 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-8 py-3.5 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Tradeswift ERP</h1>
              <p className="text-xs text-slate-500">Physical commodity trading management</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Active User Switcher / Profile Badge */}
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 shadow-xs">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  {currentUser?.role === 'ADMIN' ? (
                    <Shield size={16} className="text-indigo-600" />
                  ) : (
                    <User size={16} className="text-slate-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">
                      {currentUser?.full_name || 'Active User'}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                        currentUser?.role === 'ADMIN'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {currentUser?.role || 'USER'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium truncate max-w-[170px]" title={currentUser?.email || currentUser?.username}>
                    {currentUser?.email || currentUser?.username}
                  </div>
                </div>
              </div>

              {/* Working Company */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-1.5 text-right shadow-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Working Company
                </div>
                {companyLoading ? (
                  <div className="text-xs text-slate-400">Loading…</div>
                ) : company ? (
                  <div className="text-xs font-semibold text-slate-800">{company.name}</div>
                ) : (
                  <Link
                    to="/masters/companies"
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Select a company
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

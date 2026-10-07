import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { SelectedCompanyProvider } from './context/SelectedCompanyContext'
import { UserProvider, useActiveUser } from './context/UserContext'
import { LoginPage } from './pages/auth/LoginPage'
import { Dashboard } from './pages/Dashboard'
import { CommoditiesPage } from './pages/masters/CommoditiesPage'
import { UnitsPage } from './pages/masters/UnitsPage'
import { BrokersPage } from './pages/masters/BrokersPage'
import { TaxesPage } from './pages/masters/TaxesPage'
import { PartiesPage } from './pages/masters/PartiesPage'
import { CompaniesPage } from './pages/masters/CompaniesPage'
import { ContactsPage } from './pages/masters/ContactsPage'
import { PaymentTermsPage } from './pages/masters/PaymentTermsPage'
import { RatesPage } from './pages/masters/RatesPage'
import { ContractsPage } from './pages/contracts/ContractsPage'
import { ContractFormPage } from './pages/contracts/ContractFormPage'
import { ContractDetailPage } from './pages/contracts/ContractDetailPage'
import { ApprovalsPage } from './pages/approvals/ApprovalsPage'
import { BillsPage } from './pages/billing/BillsPage'
import { BillGeneratePage } from './pages/billing/BillGeneratePage'
import { BillDetailPage } from './pages/billing/BillDetailPage'
import { UsersPage } from './pages/users/UsersPage'
import { FinancialManagementPage } from './pages/finance/FinancialManagementPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useActiveUser()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300 text-xs">
        Loading Tradeswift ERP session…
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isAdmin, loading } = useActiveUser()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300 text-xs">
        Loading Tradeswift ERP session…
      </div>
    )
  }

  if (!currentUser || !isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <SelectedCompanyProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="masters/commodities" element={<CommoditiesPage />} />
              <Route path="masters/units" element={<UnitsPage />} />
              <Route path="masters/brokers" element={<BrokersPage />} />
              <Route path="masters/taxes" element={<TaxesPage />} />
              <Route path="masters/parties" element={<PartiesPage />} />
              <Route path="masters/companies" element={<CompaniesPage />} />
              <Route path="masters/contacts" element={<ContactsPage />} />
              <Route path="masters/payment-terms" element={<PaymentTermsPage />} />
              <Route path="masters/rates" element={<RatesPage />} />
              <Route path="contracts" element={<ContractsPage />} />
              <Route path="contracts/new" element={<ContractFormPage />} />
              <Route path="contracts/:id/edit" element={<ContractFormPage />} />
              <Route path="contracts/:id" element={<ContractDetailPage />} />
              <Route path="billing" element={<BillsPage />} />
              <Route path="billing/generate" element={<BillGeneratePage />} />
              <Route path="billing/:id" element={<BillDetailPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route
                path="users"
                element={
                  <AdminRoute>
                    <UsersPage />
                  </AdminRoute>
                }
              />
              <Route path="financial-management" element={<FinancialManagementPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SelectedCompanyProvider>
      </UserProvider>
    </BrowserRouter>
  )
}

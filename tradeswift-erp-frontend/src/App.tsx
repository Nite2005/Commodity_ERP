import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
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
import { DespatchesPage } from './pages/despatches/DespatchesPage'
import { DespatchFormPage } from './pages/despatches/DespatchFormPage'
import { DespatchDetailPage } from './pages/despatches/DespatchDetailPage'
import { BillsPage } from './pages/billing/BillsPage'
import { BillGeneratePage } from './pages/billing/BillGeneratePage'
import { BillDetailPage } from './pages/billing/BillDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
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
          <Route path="contracts/:id" element={<ContractDetailPage />} />
          <Route path="despatches" element={<DespatchesPage />} />
          <Route path="despatches/new" element={<DespatchFormPage />} />
          <Route path="despatches/:id" element={<DespatchDetailPage />} />
          <Route path="billing" element={<BillsPage />} />
          <Route path="billing/generate" element={<BillGeneratePage />} />
          <Route path="billing/:id" element={<BillDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

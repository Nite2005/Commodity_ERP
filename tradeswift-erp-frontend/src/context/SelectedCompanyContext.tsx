import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { mastersApi, ApiClientError } from '../api/client'
import type { Company } from '../types'

interface SelectedCompanyContextValue {
  company: Company | null
  companies: Company[]
  loading: boolean
  error: string
  refresh: () => Promise<void>
  selectCompany: (id: string) => Promise<void>
}

const SelectedCompanyContext = createContext<SelectedCompanyContextValue | null>(null)

export function SelectedCompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await mastersApi.companies.list()
      setCompanies(list.filter((c) => c.is_active))
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Failed to load companies')
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selectCompany = useCallback(
    async (id: string) => {
      await mastersApi.companies.select(id)
      await refresh()
    },
    [refresh],
  )

  const company = useMemo(
    () => companies.find((c) => c.is_selected) ?? companies[0] ?? null,
    [companies],
  )

  const value = useMemo(
    () => ({ company, companies, loading, error, refresh, selectCompany }),
    [company, companies, loading, error, refresh, selectCompany],
  )

  return (
    <SelectedCompanyContext.Provider value={value}>{children}</SelectedCompanyContext.Provider>
  )
}

export function useSelectedCompany() {
  const ctx = useContext(SelectedCompanyContext)
  if (!ctx) {
    throw new Error('useSelectedCompany must be used within SelectedCompanyProvider')
  }
  return ctx
}

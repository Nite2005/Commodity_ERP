import type { ApiError } from '../types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function parseError(status: number, body: ApiError): string {
  if (typeof body.detail === 'string') return body.detail
  if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join(', ')
  return `Request failed (${status})`
}

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('tradeswift_auth_user') : null
    if (raw) {
      const u = JSON.parse(raw)
      const headers: Record<string, string> = {}
      if (u.email || u.username) {
        headers['x-requested-by'] = u.email || u.username
      }
      if (u.role === 'ADMIN') {
        headers['x-supervisor-approval'] = u.username || 'ADMIN'
      }
      return headers
    }
  } catch {
    // ignore
  }
  return {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = getAuthHeaders()
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...options?.headers },
    ...options,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiClientError(parseError(res.status, body as ApiError), res.status)
  return body as T
}

function toQueryString(params?: Record<string, string | string[] | undefined>): string {
  if (!params) return ''
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item) usp.append(k, item)
      }
    } else {
      usp.set(k, v)
    }
  }
  const str = usp.toString()
  return str ? `?${str}` : ''
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}

export const mastersApi = {
  commodities: {
    list: () => api.get<import('../types').Commodity[]>('/masters/commodities?active_only=false'),
    create: (data: object) => api.post<import('../types').Commodity>('/masters/commodities', data),
    update: (id: string, data: object) =>
      api.put<import('../types').Commodity>(`/masters/commodities/${id}`, data),
    remove: (id: string) => api.delete(`/masters/commodities/${id}`),
  },
  units: {
    list: () => api.get<import('../types').Unit[]>('/masters/units?active_only=false'),
    create: (data: object) => api.post<import('../types').Unit>('/masters/units', data),
    update: (id: string, data: object) =>
      api.put<import('../types').Unit>(`/masters/units/${id}`, data),
    remove: (id: string) => api.delete(`/masters/units/${id}`),
  },
  brokers: {
    list: () => api.get<import('../types').Broker[]>('/masters/brokers?active_only=false'),
    create: (data: object) => api.post<import('../types').Broker>('/masters/brokers', data),
    update: (id: string, data: object) =>
      api.put<import('../types').Broker>(`/masters/brokers/${id}`, data),
    remove: (id: string) => api.delete(`/masters/brokers/${id}`),
  },
  taxes: {
    list: () => api.get<import('../types').Tax[]>('/masters/taxes?active_only=false'),
    create: (data: object) => api.post<import('../types').Tax>('/masters/taxes', data),
    update: (id: string, data: object) =>
      api.put<import('../types').Tax>(`/masters/taxes/${id}`, data),
    remove: (id: string) => api.delete(`/masters/taxes/${id}`),
  },
  parties: {
    list: (params?: { q?: string; companyId?: string }) => {
      const search = new URLSearchParams({ active_only: 'false' })
      if (params?.q) search.set('q', params.q)
      if (params?.companyId) search.set('company_id', params.companyId)
      return api.get<import('../types').Party[]>(`/masters/parties?${search}`)
    },
    create: (data: object) => api.post<import('../types').Party>('/masters/parties', data),
    bulkCreate: (companyId: string, items: any[]) =>
      api.post<{ total: number; inserted: number; failed: number; errors: string[] }>(
        `/masters/parties/bulk?company_id=${companyId}`,
        items,
      ),
    update: (id: string, data: object) =>
      api.put<import('../types').Party>(`/masters/parties/${id}`, data),
    remove: (id: string) => api.delete(`/masters/parties/${id}`),
    uploadCheque: async (id: string, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BASE}/masters/parties/${id}/cancelled-cheque`, {
        method: 'POST',
        headers: {
          'X-User-Role': 'ADMIN',
          ...getAuthHeaders(),
        },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Upload failed (${res.status})`)
      }
      return res.json()
    },
    downloadCheque: async (id: string, role = 'ADMIN') => {
      const res = await fetch(`${BASE}/masters/parties/${id}/cancelled-cheque`, {
        headers: {
          'X-User-Role': role,
          ...getAuthHeaders(),
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Access Denied: Restricted to authorized profiles only.')
      }
      return res.blob()
    },
    deleteCheque: async (id: string, role = 'ADMIN') => {
      const res = await fetch(`${BASE}/masters/parties/${id}/cancelled-cheque`, {
        method: 'DELETE',
        headers: {
          'X-User-Role': role,
          ...getAuthHeaders(),
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to delete cancelled cheque')
      }
      return res.json()
    },
  },
  companies: {
    list: (q?: string) =>
      api.get<import('../types').Company[]>(
        `/masters/companies?active_only=false${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
    create: (data: object) => api.post<import('../types').Company>('/masters/companies', data),
    update: (id: string, data: object) =>
      api.put<import('../types').Company>(`/masters/companies/${id}`, data),
    select: (id: string) =>
      api.post<import('../types').Company>(`/masters/companies/${id}/select`, {}),
    remove: (id: string) => api.delete(`/masters/companies/${id}`),
  },
  contacts: {
    list: (partyId?: string) =>
      api.get<import('../types').Contact[]>(
        `/masters/contacts?active_only=false${partyId ? `&party_id=${partyId}` : ''}`,
      ),
    create: (data: object) => api.post<import('../types').Contact>('/masters/contacts', data),
    update: (id: string, data: object) =>
      api.put<import('../types').Contact>(`/masters/contacts/${id}`, data),
    remove: (id: string) => api.delete(`/masters/contacts/${id}`),
  },
  paymentTerms: {
    list: () =>
      api.get<import('../types').PaymentTerm[]>('/masters/payment-terms?active_only=false'),
    create: (data: object) =>
      api.post<import('../types').PaymentTerm>('/masters/payment-terms', data),
    update: (id: string, data: object) =>
      api.put<import('../types').PaymentTerm>(`/masters/payment-terms/${id}`, data),
    remove: (id: string) => api.delete(`/masters/payment-terms/${id}`),
  },
  rates: {
    list: () => api.get<import('../types').RateMaster[]>('/masters/rates?active_only=false'),
    create: (data: object) => api.post<import('../types').RateMaster>('/masters/rates', data),
    bulkCreate: (items: any[]) =>
      api.post<{ total: number; inserted: number; failed: number; errors: string[] }>(
        '/masters/rates/bulk',
        items,
      ),
    update: (id: string, data: object) =>
      api.put<import('../types').RateMaster>(`/masters/rates/${id}`, data),
    remove: (id: string) => api.delete(`/masters/rates/${id}`),
  },
}

export const contractsApi = {
  list: (params?: Record<string, string | string[] | undefined>) => {
    const qs = toQueryString(params)
    return api.get<import('../types').Contract[]>(`/contracts${qs}`)
  },
  get: (id: string) => api.get<import('../types').ContractDetail>(`/contracts/${id}`),
  create: (data: object) =>
    api.post<{ contract_no: string; id: string; message: string }>('/contracts', data),
  update: (id: string, data: object) =>
    api.put<import('../types').ContractDetail>(`/contracts/${id}`, data),
  close: (id: string, final_qty: number) =>
    api.patch<import('../types').ContractDetail>(`/contracts/${id}/closure`, { final_qty }),
  balance: (id: string) => api.get<import('../types').ContractBalance>(`/contracts/${id}/balance`),
}

export const despatchesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<import('../types').Despatch[]>(`/despatches${qs}`)
  },
  get: (id: string) => api.get<import('../types').DespatchDetail>(`/despatches/${id}`),
  create: (data: object) =>
    api.post<{ despatch_no: string; id: string; message: string }>('/despatches', data),
  remove: (id: string) => api.delete(`/despatches/${id}`),
  unbilled: (partyId: string, fromDate: string, toDate: string) =>
    api.get<{ party_id: string; unbilled_records: import('../types').UnbilledDespatch[] }>(
      `/despatches/unbilled?party_id=${partyId}&fromDate=${fromDate}&toDate=${toDate}`,
    ),
}

export const billsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<import('../types').Bill[]>(`/bills${qs}`)
  },
  get: (id: string) => api.get<import('../types').BillDetail>(`/bills/${id}`),
  billableContracts: (params: {
    partyId: string
    fromDate?: string
    toDate?: string
    companyId?: string
  }) => {
    const search = new URLSearchParams({ party_id: params.partyId })
    if (params.fromDate) search.set('date_from', params.fromDate)
    if (params.toDate) search.set('date_to', params.toDate)
    if (params.companyId) search.set('company_id', params.companyId)
    return api.get<import('../types').BillableContract[]>(
      `/bills/billable-contracts?${search}`,
    )
  },
  create: (data: object) =>
    api.post<{ bill_no: string; id: string; message: string }>('/bills', data),
}

export const healthApi = {
  check: () => api.get<{ status: string }>('/health'),
}

async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiClientError(parseError(res.status, body as ApiError), res.status)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^"]+)"?/i.exec(disposition)
  const filename = match?.[1] ?? fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const reportsApi = {
  getPartyLedger: (partyId: string) =>
    api.get<import('../types').PartyLedgerResponse>(`/reports/party-ledger/${partyId}`),
  downloadContractRegister: (params?: Record<string, string | string[] | undefined>) => {
    const qs = params ? '?' + toQueryString(params) : ''
    return downloadFile(`/reports/contract-register/export${qs}`, 'contract-register.csv')
  },
  downloadSalesRegister: (params?: Record<string, string | string[] | undefined>) => {
    const qs = params ? '?' + toQueryString(params) : ''
    return downloadFile(`/reports/sales-register/export${qs}`, 'bills-report.csv')
  },
}

export const approvalsApi = {
  list: (statusOrParams?: string | { status?: string; entityId?: string; entityType?: string }) => {
    if (typeof statusOrParams === 'string') {
      return api.get<import('../types').ApprovalRequest[]>(`/approvals${statusOrParams ? `?status=${statusOrParams}` : ''}`)
    }
    const qs = new URLSearchParams()
    if (statusOrParams?.status) qs.set('status', statusOrParams.status)
    if (statusOrParams?.entityId) qs.set('entity_id', statusOrParams.entityId)
    if (statusOrParams?.entityType) qs.set('entity_type', statusOrParams.entityType)
    const qStr = qs.toString()
    return api.get<import('../types').ApprovalRequest[]>(`/approvals${qStr ? `?${qStr}` : ''}`)
  },
  getEntityHistory: (entityId: string) =>
    api.get<import('../types').ApprovalRequest[]>(`/approvals/entity/${entityId}/history`),
  pendingCount: () => api.get<{ pending_count: number }>('/approvals/pending-count'),
  approve: (id: string, reviewerName = 'Kannu') =>
    api.post<import('../types').ApprovalRequest>(`/approvals/${id}/approve`, {
      reviewer_name: reviewerName,
    }),
  reject: (id: string, reviewerName = 'Kannu', rejectionReason?: string) =>
    api.post<import('../types').ApprovalRequest>(`/approvals/${id}/reject`, {
      reviewer_name: reviewerName,
      rejection_reason: rejectionReason,
    }),
}

export const usersApi = {
  login: (data: import('../types').LoginPayload) =>
    api.post<import('../types').LoginResponse>('/users/login', data),
  list: (params?: { role?: string; active_only?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.role) qs.set('role', params.role)
    if (params?.active_only) qs.set('active_only', 'true')
    const qStr = qs.toString()
    return api.get<import('../types').User[]>(`/users${qStr ? `?${qStr}` : ''}`)
  },
  getSupervisors: () => api.get<import('../types').User[]>('/users/supervisors'),
  get: (id: string) => api.get<import('../types').User>(`/users/${id}`),
  create: (data: import('../types').UserCreatePayload) =>
    api.post<import('../types').User>('/users', data),
  update: (id: string, data: import('../types').UserUpdatePayload) =>
    api.put<import('../types').User>(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
}

export const authApi = {
  login: usersApi.login,
}


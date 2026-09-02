import type { ApiError } from '../types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiClientError(parseError(res.status, body as ApiError), res.status)
  return body as T
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
    update: (id: string, data: object) =>
      api.put<import('../types').Party>(`/masters/parties/${id}`, data),
    remove: (id: string) => api.delete(`/masters/parties/${id}`),
  },
  companies: {
    list: (q?: string) =>
      api.get<import('../types').Company[]>(
        `/masters/companies?active_only=false${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
    create: (data: object) => api.post<import('../types').Company>('/masters/companies', data),
    update: (id: string, data: object) =>
      api.put<import('../types').Company>(`/masters/companies/${id}`, data),
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
    update: (id: string, data: object) =>
      api.put<import('../types').RateMaster>(`/masters/rates/${id}`, data),
    remove: (id: string) => api.delete(`/masters/rates/${id}`),
  },
}

export const contractsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
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
  create: (data: object) =>
    api.post<{ bill_no: string; id: string; message: string }>('/bills', data),
}

export const healthApi = {
  check: () => api.get<{ status: string }>('/health'),
}

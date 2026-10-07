export type CustomerType =
  | 'REGISTERED'
  | 'UNREGISTERED'
  | 'COMPOSITION'
  | 'SEZ'
  | 'BUYER'
  | 'SELLER'
  | 'BOTH'

export type QtyUnit = 'MT' | 'KGS' | 'QUINTAL' | 'BAGS'
export type Currency = 'INR' | 'USD' | 'EUR'
export type RateType = 'FIXED' | 'PERCENTAGE'
export type PaymentTermType = 'ADVANCE' | 'NET_DAYS'
export type ContractType = 'NEW' | 'AMENDMENT' | 'CANCEL'
export type ContractStatus = 'CONTRACT_OPEN' | 'CLOSED' | 'CANCELLED'
export type BillingStatus = 'UNBILLED' | 'BILLED'
export type SupplyType = 'INTRA_STATE' | 'INTER_STATE'

export interface Commodity {
  id: string
  commodity_name: string
  comm_short_name: string
  quality_allowance: string | null
  is_active: boolean
  created_at: string
}

export interface Unit {
  id: string
  unit_name: string
  is_active: boolean
  created_at: string
}

export interface Broker {
  id: string
  broker_name: string
  is_active: boolean
  created_at: string
}

export interface Tax {
  id: string
  tax_code: string
  tax_name: string
  igst_percent: number
  cgst_percent: number
  sgst_percent: number
  is_active: boolean
  created_at: string
}

export interface Party {
  id: string
  party_code: string
  company_id: string | null
  name: string
  short_name: string
  customer_type: CustomerType
  gst_tin: string | null
  gst_apply_date: string | null
  address_line: string
  city: string
  state: string
  pincode: string
  account_no: string | null
  bank_name: string | null
  ifsc_code: string | null
  cancelled_cheque_filename?: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  contact_name: string | null
  designation: string | null
  credit_limit?: number | null
  has_pending_approval?: boolean
  is_active: boolean
  created_at: string
}

export interface Company {
  id: string
  company_code: string
  name: string
  gst_tin: string | null
  address: string
  account_no: string | null
  bank_name: string | null
  ifsc_code: string | null
  phone: string | null
  is_selected: boolean
  is_active: boolean
  created_at: string
}

export interface Contact {
  id: string
  party_id: string
  contact_name: string
  email: string | null
  phone: string | null
  designation: string | null
  is_active: boolean
  created_at: string
}

export interface PaymentTerm {
  id: string
  term_code: string
  term_name: string
  term_type: PaymentTermType
  credit_days: number
  advance_percent: number
  description: string | null
  is_active: boolean
  created_at: string
}

export interface RateMaster {
  id: string
  rate_code: string
  party_id: string
  customer_type: CustomerType
  commodity_id: string
  rate_type: RateType
  rate: number
  unit: QtyUnit
  currency: Currency
  brokerage_type?: RateType
  brokerage: number
  has_pending_approval?: boolean
  is_active: boolean
  created_at: string
}

export interface ContractBalance {
  contract_no: string
  billing_qty: number
  qty_low: number
  qty_high: number
  final_qty: number | null
  fulfilled_qty: number
  billed_qty: number
  remaining_qty: number
  remaining_billable: number
  max_allowed_qty: number
  tolerance_percent: number
  status: ContractStatus
}

export interface Despatch {
  id: string
  despatch_no: string
  despatch_date: string
  contract_id: string
  bags: number | null
  quantity: number
  delivery_type: string | null
  billing_status: BillingStatus
  bill_id: string | null
  is_active: boolean
  created_at: string
}

export interface DespatchDetail extends Despatch {
  contract_no?: string | null
  commodity_short_name?: string | null
  seller_name?: string | null
  buyer_name?: string | null
  qty_unit?: string | null
}

export interface Contract {
  id: string
  contract_no: string
  contract_type: ContractType
  contract_date: string
  company_id: string | null
  seller_id: string
  buyer_id: string
  is_nominee: boolean
  commodity_id: string
  quality_allowance: string | null
  notes?: string | null
  packing: string
  qty_low: number
  qty_high: number
  qty_unit: QtyUnit
  rate: number
  currency: Currency
  tax_id: string
  payment_term_id: string | null
  weightment_unit_id: string | null
  despatch_from: string
  despatch_to: string
  broker_id: string
  broker_rate: number
  broker_rate_type?: RateType
  final_qty: number | null
  tolerance_percent: number
  fulfilled_qty: number
  status: ContractStatus
  print_despatch_si: boolean
  print_tr_final_docs: boolean
  print_payment: boolean
  version: number
  is_active: boolean
  created_at: string
}

export interface ContractDetail extends Contract {
  company_name?: string | null
  seller_name?: string | null
  buyer_name?: string | null
  commodity_name?: string | null
  commodity_short_name?: string | null
  tax_name?: string | null
  broker_name?: string | null
  payment_term_name?: string | null
  weightment_unit_name?: string | null
}

export interface UnbilledDespatch {
  id: string
  despatch_no: string
  despatch_date: string
  contract_no: string
  contract_id: string
  commodity_short_name: string | null
  bags: number | null
  quantity: number
  qty_unit: string | null
  rate: number
  line_base_amount: number
  delivery_type: string | null
}

export interface BillableContract {
  id: string
  contract_no: string
  contract_date: string
  status: ContractStatus
  seller_name: string | null
  buyer_name: string | null
  commodity_short_name: string | null
  commodity_name: string | null
  qty_unit: string
  rate: number
  billing_qty: number
  billed_qty: number
  remaining_billable: number
  tax_id: string
}

export interface Bill {
  id: string
  bill_no: string
  bill_date: string
  party_id: string
  tax_id: string
  from_date: string
  to_date: string
  base_amount: number
  igst_amount: number
  cgst_amount: number
  sgst_amount: number
  gross_amount: number
  brokerage_amount: number
  supply_type: SupplyType
  is_active: boolean
  created_at: string
}

export interface BillLineItem {
  id: string
  despatch_id: string | null
  contract_id: string
  quantity: number
  rate: number
  line_base_amount: number
  despatch_no?: string | null
  despatch_date?: string | null
  contract_no?: string | null
  contract_date?: string | null
  commodity_short_name?: string | null
  commodity_name?: string | null
  qty_unit?: string | null
  seller_name?: string | null
  buyer_name?: string | null
  seller_id?: string | null
  buyer_id?: string | null
  bags?: number | null
  broker_rate?: number | null
  broker_rate_type?: string | null
  line_brokerage_amount?: number | null
}

export interface BillDetail extends Bill {
  party_name?: string | null
  party_code?: string | null
  party_address?: string | null
  party_city?: string | null
  party_state?: string | null
  party_pincode?: string | null
  party_gst_tin?: string | null
  tax_name?: string | null
  igst_percent?: number | null
  cgst_percent?: number | null
  sgst_percent?: number | null
  seller_name?: string | null
  buyer_name?: string | null
  seller_state?: string | null
  buyer_state?: string | null
  company_name?: string | null
  company_address?: string | null
  company_city?: string | null
  company_state?: string | null
  company_pincode?: string | null
  company_gstin?: string | null
  company_pan?: string | null
  company_phone?: string | null
  company_bank_name?: string | null
  company_account_no?: string | null
  company_ifsc_code?: string | null
  line_items: BillLineItem[]
}

export interface ApiError {
  detail: string | { msg: string }[]
}

export interface ContractLedgerItem {
  contract_id: string
  contract_no: string
  contract_date: string
  role: 'SELLER' | 'BUYER'
  commodity_name: string | null
  status: ContractStatus
  quantity: number
  qty_unit: QtyUnit
  rate: number
  total_value: number
  pending_payment: number
  adjustments: number
  net_due: number
}

export interface PartyLedgerResponse {
  party_id: string
  party_name: string
  party_code: string
  credit_limit: number
  total_outstanding: number
  total_contract_value: number
  total_billed_amount: number
  total_adjustments: number
  is_overdue: boolean
  status_label: string
  contracts_count: number
  contracts: ContractLedgerItem[]
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type EntityType =
  | 'PARTY'
  | 'RATE'
  | 'COMPANY'
  | 'CONTACT'
  | 'BROKER'
  | 'COMMODITY'
  | 'TAX'
  | 'UNIT'
  | 'PAYMENT_TERM'
  | 'CONTRACT'

export interface FieldDiffItem {
  old: string | number | null
  new: string | number | null
  label: string
}

export interface ApprovalRequest {
  id: string
  entity_type: EntityType
  entity_id: string
  entity_name: string
  change_summary: string
  changes_json: string
  status: ApprovalStatus
  requested_by: string
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

export type UserRole = 'ADMIN' | 'EMPLOYEE'

export interface User {
  id: string
  username: string
  full_name: string
  email: string | null
  role: UserRole
  designation: string | null
  is_active: boolean
  created_at: string | null
  modified_at: string | null
}

export interface UserCreatePayload {
  full_name: string
  email: string
  password: string
  username?: string | null
  role: UserRole
  designation?: string | null
}

export interface UserUpdatePayload {
  full_name?: string
  email?: string | null
  password?: string | null
  role?: UserRole
  designation?: string | null
  is_active?: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  token: string
  message: string
}



from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ContractStatus, ContractType, Currency, QtyUnit


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PrintOptions(BaseModel):
    despatch_si: bool = False
    tr_final_docs: bool = False
    payment: bool = False


class ContractCreate(BaseModel):
    contract_no: str | None = Field(default=None, max_length=20)
    contract_type: ContractType
    contract_date: date | None = None
    company_id: UUID
    seller_id: UUID
    buyer_id: UUID
    is_nominee: bool = False
    commodity_id: UUID
    quality_allowance: str | None = Field(default=None, max_length=1000)
    packing: str = Field(max_length=100)
    qty_low: Decimal = Field(gt=0)
    qty_high: Decimal = Field(gt=0)
    qty_unit: QtyUnit
    rate: Decimal = Field(gt=0)
    currency: Currency
    tax_id: UUID
    payment_term_id: UUID | None = None
    weightment_unit_id: UUID | None = None
    despatch_from: date
    despatch_to: date
    broker_id: UUID
    broker_rate: Decimal = Field(ge=0)
    print_options: PrintOptions | None = None

    @model_validator(mode="after")
    def validate_contract(self):
        if self.seller_id == self.buyer_id:
            raise ValueError("Seller & Buyer cannot be the same party.")
        if self.despatch_to < self.despatch_from:
            raise ValueError("Despatch To Date must be on or after From Date.")
        if self.qty_high < self.qty_low:
            raise ValueError("Qty High must be greater than or equal to Qty Low.")
        return self


class ContractUpdate(BaseModel):
    contract_no: str | None = Field(default=None, max_length=20)
    contract_type: ContractType | None = None
    contract_date: date | None = None
    company_id: UUID | None = None
    seller_id: UUID | None = None
    buyer_id: UUID | None = None
    is_nominee: bool | None = None
    commodity_id: UUID | None = None
    quality_allowance: str | None = Field(default=None, max_length=1000)
    packing: str | None = Field(default=None, max_length=100)
    qty_low: Decimal | None = Field(default=None, gt=0)
    qty_high: Decimal | None = Field(default=None, gt=0)
    qty_unit: QtyUnit | None = None
    rate: Decimal | None = Field(default=None, gt=0)
    currency: Currency | None = None
    tax_id: UUID | None = None
    payment_term_id: UUID | None = None
    weightment_unit_id: UUID | None = None
    despatch_from: date | None = None
    despatch_to: date | None = None
    broker_id: UUID | None = None
    broker_rate: Decimal | None = Field(default=None, ge=0)
    print_options: PrintOptions | None = None


class ContractClosure(BaseModel):
    final_qty: Decimal = Field(gt=0)


class ContractResponse(ORMModel):
    id: UUID
    contract_no: str
    contract_type: ContractType
    contract_date: date
    company_id: UUID | None
    seller_id: UUID
    buyer_id: UUID
    is_nominee: bool
    commodity_id: UUID
    quality_allowance: str | None
    packing: str
    qty_low: Decimal
    qty_high: Decimal
    qty_unit: QtyUnit
    rate: Decimal
    currency: Currency
    tax_id: UUID
    payment_term_id: UUID | None
    weightment_unit_id: UUID | None
    despatch_from: date
    despatch_to: date
    broker_id: UUID
    broker_rate: Decimal
    final_qty: Decimal | None
    tolerance_percent: Decimal
    fulfilled_qty: Decimal
    status: ContractStatus
    print_despatch_si: bool
    print_tr_final_docs: bool
    print_payment: bool
    version: int
    is_active: bool
    created_at: datetime


class ContractDetailResponse(ContractResponse):
    company_name: str | None = None
    seller_name: str | None = None
    buyer_name: str | None = None
    commodity_name: str | None = None
    commodity_short_name: str | None = None
    tax_name: str | None = None
    broker_name: str | None = None
    payment_term_name: str | None = None
    weightment_unit_name: str | None = None


class ContractCreateResponse(BaseModel):
    status: str = "SUCCESS"
    contract_no: str
    message: str = "Contract created successfully"
    id: UUID


class ContractBalanceResponse(BaseModel):
    contract_no: str
    billing_qty: Decimal
    qty_low: Decimal
    qty_high: Decimal
    final_qty: Decimal | None
    fulfilled_qty: Decimal
    remaining_qty: Decimal
    max_allowed_qty: Decimal
    tolerance_percent: Decimal
    status: ContractStatus

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import BillingStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DespatchCreate(BaseModel):
    contract_id: UUID
    despatch_date: date
    bags: int | None = Field(default=None, ge=0)
    quantity: Decimal = Field(gt=0)
    delivery_type: str | None = Field(default=None, max_length=20)


class DespatchResponse(ORMModel):
    id: UUID
    despatch_no: str
    despatch_date: date
    contract_id: UUID
    bags: int | None
    quantity: Decimal
    delivery_type: str | None
    billing_status: BillingStatus
    bill_id: UUID | None
    is_active: bool
    created_at: datetime


class DespatchDetailResponse(DespatchResponse):
    contract_no: str | None = None
    commodity_short_name: str | None = None
    seller_name: str | None = None
    buyer_name: str | None = None
    qty_unit: str | None = None


class DespatchCreateResponse(BaseModel):
    status: str = "SUCCESS"
    despatch_no: str
    message: str = "Despatch created successfully"
    id: UUID


class UnbilledDespatchItem(BaseModel):
    id: UUID
    despatch_no: str
    despatch_date: date
    contract_no: str
    contract_id: UUID
    commodity_short_name: str | None
    bags: int | None
    quantity: Decimal
    qty_unit: str | None
    rate: Decimal
    line_base_amount: Decimal
    delivery_type: str | None


class UnbilledDespatchResponse(BaseModel):
    party_id: UUID
    unbilled_records: list[UnbilledDespatchItem]

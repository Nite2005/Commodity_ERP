from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import SupplyType


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BillCreate(BaseModel):
    bill_date: date
    party_id: UUID
    tax_id: UUID
    from_date: date
    to_date: date
    despatch_ids: list[UUID] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.to_date < self.from_date:
            raise ValueError("To date must be on or after from date.")
        return self


class BillLineItemResponse(ORMModel):
    id: UUID
    despatch_id: UUID
    contract_id: UUID
    quantity: Decimal
    rate: Decimal
    line_base_amount: Decimal
    despatch_no: str | None = None
    despatch_date: date | None = None
    contract_no: str | None = None
    commodity_short_name: str | None = None
    commodity_name: str | None = None
    qty_unit: str | None = None


class BillResponse(ORMModel):
    id: UUID
    bill_no: str
    bill_date: date
    party_id: UUID
    tax_id: UUID
    from_date: date
    to_date: date
    base_amount: Decimal
    igst_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    gross_amount: Decimal
    brokerage_amount: Decimal
    supply_type: SupplyType
    is_active: bool
    created_at: datetime


class BillDetailResponse(BillResponse):
    party_name: str | None = None
    party_code: str | None = None
    party_address: str | None = None
    party_city: str | None = None
    party_state: str | None = None
    party_pincode: str | None = None
    party_gst_tin: str | None = None
    tax_name: str | None = None
    igst_percent: Decimal | None = None
    cgst_percent: Decimal | None = None
    sgst_percent: Decimal | None = None
    seller_name: str | None = None
    buyer_name: str | None = None
    seller_state: str | None = None
    buyer_state: str | None = None
    line_items: list[BillLineItemResponse] = []


class BillCreateResponse(BaseModel):
    status: str = "SUCCESS"
    bill_no: str
    message: str = "Bill generated successfully"
    id: UUID

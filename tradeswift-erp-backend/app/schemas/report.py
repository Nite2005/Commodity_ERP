from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import ContractStatus, ContractType, QtyUnit, SupplyType


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ContractRegisterRow(BaseModel):
    id: UUID
    contract_no: str
    contract_date: date
    contract_type: ContractType
    status: ContractStatus
    company_name: str | None = None
    seller_name: str | None = None
    buyer_name: str | None = None
    commodity_name: str | None = None
    commodity_short_name: str | None = None
    qty_low: Decimal
    qty_high: Decimal
    final_qty: Decimal | None = None
    qty_unit: QtyUnit
    rate: Decimal
    broker_name: str | None = None
    broker_rate: Decimal
    despatch_from: date
    despatch_to: date


class SalesRegisterRow(BaseModel):
    id: UUID
    bill_no: str
    bill_date: date
    party_name: str | None = None
    party_code: str | None = None
    from_date: date
    to_date: date
    base_amount: Decimal
    igst_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    gross_amount: Decimal
    brokerage_amount: Decimal
    supply_type: SupplyType
    tax_name: str | None = None

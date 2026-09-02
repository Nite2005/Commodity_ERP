from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Currency, CustomerType, PaymentTermType, QtyUnit
from app.utils.validators import validate_gst_tin, validate_ifsc, validate_pincode


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Commodity ---
class CommodityCreate(BaseModel):
    commodity_name: str = Field(max_length=100)
    comm_short_name: str = Field(max_length=30)
    quality_allowance: str | None = Field(default=None, max_length=1000)


class CommodityUpdate(BaseModel):
    commodity_name: str | None = Field(default=None, max_length=100)
    comm_short_name: str | None = Field(default=None, max_length=30)
    quality_allowance: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None


class CommodityResponse(ORMModel):
    id: UUID
    commodity_name: str
    comm_short_name: str
    quality_allowance: str | None
    is_active: bool
    created_at: datetime


# --- Unit ---
class UnitCreate(BaseModel):
    unit_name: str = Field(max_length=150)


class UnitUpdate(BaseModel):
    unit_name: str | None = Field(default=None, max_length=150)
    is_active: bool | None = None


class UnitResponse(ORMModel):
    id: UUID
    unit_name: str
    is_active: bool
    created_at: datetime


# --- Broker ---
class BrokerCreate(BaseModel):
    broker_name: str = Field(max_length=100)


class BrokerUpdate(BaseModel):
    broker_name: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


class BrokerResponse(ORMModel):
    id: UUID
    broker_name: str
    is_active: bool
    created_at: datetime


# --- Tax ---
class TaxCreate(BaseModel):
    tax_name: str = Field(max_length=50)
    igst_percent: Decimal = Field(ge=0, le=100)
    cgst_percent: Decimal = Field(ge=0, le=100)
    sgst_percent: Decimal = Field(ge=0, le=100)


class TaxUpdate(BaseModel):
    tax_name: str | None = Field(default=None, max_length=50)
    igst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    cgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    sgst_percent: Decimal | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class TaxResponse(ORMModel):
    id: UUID
    tax_code: str
    tax_name: str
    igst_percent: Decimal
    cgst_percent: Decimal
    sgst_percent: Decimal
    is_active: bool
    created_at: datetime


# --- Party ---
class PartyCreate(BaseModel):
    company_id: UUID
    name: str = Field(min_length=3, max_length=150)
    short_name: str = Field(min_length=2, max_length=50)
    customer_type: CustomerType
    gst_tin: str | None = Field(default=None, max_length=15)
    gst_apply_date: date | None = None
    address_line: str = Field(max_length=300)
    city: str = Field(max_length=50)
    state: str = Field(max_length=50)
    pincode: str = Field(max_length=6)
    account_no: str | None = Field(default=None, max_length=30)
    ifsc_code: str | None = Field(default=None, max_length=11)
    phone: str | None = Field(default=None, max_length=50)
    mobile: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=100)
    contact_name: str | None = Field(default=None, max_length=100)
    designation: str | None = Field(default=None, max_length=100)

    @field_validator("gst_tin")
    @classmethod
    def check_gst(cls, v: str | None) -> str | None:
        validate_gst_tin(v)
        return v

    @field_validator("ifsc_code")
    @classmethod
    def check_ifsc(cls, v: str | None) -> str | None:
        validate_ifsc(v)
        return v

    @field_validator("pincode")
    @classmethod
    def check_pincode(cls, v: str) -> str:
        validate_pincode(v)
        return v


class PartyUpdate(BaseModel):
    company_id: UUID | None = None
    name: str | None = Field(default=None, min_length=3, max_length=150)
    short_name: str | None = Field(default=None, min_length=2, max_length=50)
    customer_type: CustomerType | None = None
    gst_tin: str | None = None
    gst_apply_date: date | None = None
    address_line: str | None = Field(default=None, max_length=300)
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    account_no: str | None = None
    ifsc_code: str | None = None
    phone: str | None = None
    mobile: str | None = None
    email: str | None = None
    contact_name: str | None = None
    designation: str | None = None
    is_active: bool | None = None


class PartyResponse(ORMModel):
    id: UUID
    party_code: str
    company_id: UUID | None
    name: str
    short_name: str
    customer_type: CustomerType
    gst_tin: str | None
    gst_apply_date: date | None
    address_line: str
    city: str
    state: str
    pincode: str
    account_no: str | None
    ifsc_code: str | None
    phone: str | None
    mobile: str | None
    email: str | None
    contact_name: str | None
    designation: str | None
    is_active: bool
    created_at: datetime


# --- Company (own legal entities) ---
class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    gst_tin: str | None = Field(default=None, max_length=15)
    address: str = Field(default="", max_length=2000)
    account_no: str | None = Field(default=None, max_length=30)
    bank_name: str | None = Field(default=None, max_length=100)
    ifsc_code: str | None = Field(default=None, max_length=11)
    phone: str | None = Field(default=None, max_length=50)

    @field_validator("gst_tin")
    @classmethod
    def check_gst(cls, v: str | None) -> str | None:
        validate_gst_tin(v)
        return v

    @field_validator("ifsc_code")
    @classmethod
    def check_ifsc(cls, v: str | None) -> str | None:
        validate_ifsc(v)
        return v


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    gst_tin: str | None = None
    address: str | None = Field(default=None, max_length=2000)
    account_no: str | None = Field(default=None, max_length=30)
    bank_name: str | None = Field(default=None, max_length=100)
    ifsc_code: str | None = None
    phone: str | None = None
    is_active: bool | None = None

    @field_validator("ifsc_code")
    @classmethod
    def check_ifsc(cls, v: str | None) -> str | None:
        validate_ifsc(v)
        return v


class CompanyResponse(ORMModel):
    id: UUID
    company_code: str
    name: str
    gst_tin: str | None
    address: str
    account_no: str | None
    bank_name: str | None
    ifsc_code: str | None
    phone: str | None
    is_active: bool
    created_at: datetime


# --- Contact ---
class ContactCreate(BaseModel):
    party_id: UUID
    contact_name: str = Field(min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    designation: str | None = Field(default=None, max_length=100)


class ContactUpdate(BaseModel):
    party_id: UUID | None = None
    contact_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    designation: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


class ContactResponse(ORMModel):
    id: UUID
    party_id: UUID
    contact_name: str
    email: str | None
    phone: str | None
    designation: str | None
    is_active: bool
    created_at: datetime


# --- Payment Term ---
class PaymentTermCreate(BaseModel):
    term_name: str = Field(max_length=50)
    term_type: PaymentTermType
    credit_days: int = Field(ge=0)
    advance_percent: Decimal = Field(ge=0, le=100, default=0)
    description: str | None = Field(default=None, max_length=255)


class PaymentTermUpdate(BaseModel):
    term_name: str | None = None
    term_type: PaymentTermType | None = None
    credit_days: int | None = Field(default=None, ge=0)
    advance_percent: Decimal | None = Field(default=None, ge=0, le=100)
    description: str | None = None
    is_active: bool | None = None


class PaymentTermResponse(ORMModel):
    id: UUID
    term_code: str
    term_name: str
    term_type: PaymentTermType
    credit_days: int
    advance_percent: Decimal
    description: str | None
    is_active: bool
    created_at: datetime


# --- Rate Master ---
class RateMasterCreate(BaseModel):
    party_id: UUID
    customer_type: CustomerType
    commodity_id: UUID
    rate: Decimal = Field(gt=0)
    unit: QtyUnit
    currency: Currency = Currency.INR
    brokerage: Decimal = Field(ge=0, default=0)


class RateMasterUpdate(BaseModel):
    party_id: UUID | None = None
    customer_type: CustomerType | None = None
    commodity_id: UUID | None = None
    rate: Decimal | None = Field(default=None, gt=0)
    unit: QtyUnit | None = None
    currency: Currency | None = None
    brokerage: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class RateMasterResponse(ORMModel):
    id: UUID
    rate_code: str
    party_id: UUID
    customer_type: CustomerType
    commodity_id: UUID
    rate: Decimal
    unit: QtyUnit
    currency: Currency
    brokerage: Decimal
    is_active: bool
    created_at: datetime

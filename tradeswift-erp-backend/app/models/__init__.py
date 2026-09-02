import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.models.enums import (
    BillingStatus,
    ContractStatus,
    ContractType,
    Currency,
    CustomerType,
    PaymentTermType,
    QtyUnit,
    SupplyType,
)


def new_uuid() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class AuditMixin:
    created_by: Mapped[str] = mapped_column(String(100), default="SYSTEM")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    modified_by: Mapped[str | None] = mapped_column(String(100))
    modified_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Commodity(Base, AuditMixin):
    __tablename__ = "commodities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    commodity_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    comm_short_name: Mapped[str] = mapped_column(String(30), nullable=False)
    quality_allowance: Mapped[str | None] = mapped_column(String(1000))


class Unit(Base, AuditMixin):
    __tablename__ = "units"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    unit_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)


class Broker(Base, AuditMixin):
    __tablename__ = "brokers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    broker_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class Tax(Base, AuditMixin):
    __tablename__ = "taxes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    tax_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    tax_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    igst_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    cgst_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    sgst_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)


class Party(Base, AuditMixin):
    """Clients / counterparties linked to an owning company."""

    __tablename__ = "parties"
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_party_company_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    party_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    company_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    short_name: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_type: Mapped[CustomerType] = mapped_column(Enum(CustomerType), nullable=False)
    gst_tin: Mapped[str | None] = mapped_column(String(15))
    gst_apply_date: Mapped[date | None] = mapped_column(Date)
    address_line: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(String(50), nullable=False)
    state: Mapped[str] = mapped_column(String(50), nullable=False)
    pincode: Mapped[str] = mapped_column(String(6), nullable=False)
    account_no: Mapped[str | None] = mapped_column(String(30))
    ifsc_code: Mapped[str | None] = mapped_column(String(11))
    phone: Mapped[str | None] = mapped_column(String(50))
    mobile: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(100))
    contact_name: Mapped[str | None] = mapped_column(String(100))
    designation: Mapped[str | None] = mapped_column(String(100))

    company: Mapped["Company | None"] = relationship(back_populates="parties")
    rates: Mapped[list["RateMaster"]] = relationship(back_populates="party")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="party")


class Company(Base, AuditMixin):
    """Own legal entities — a trading group may operate multiple companies."""

    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    company_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    gst_tin: Mapped[str | None] = mapped_column(String(15))
    address: Mapped[str] = mapped_column(Text, nullable=False, default="")
    account_no: Mapped[str | None] = mapped_column(String(30))
    bank_name: Mapped[str | None] = mapped_column(String(100))
    ifsc_code: Mapped[str | None] = mapped_column(String(11))
    phone: Mapped[str | None] = mapped_column(String(50))

    parties: Mapped[list["Party"]] = relationship(back_populates="company")
    contracts: Mapped[list["Contract"]] = relationship(back_populates="company")


class Contact(Base, AuditMixin):
    __tablename__ = "contacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    party_id: Mapped[str] = mapped_column(String(36), ForeignKey("parties.id"), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))
    designation: Mapped[str | None] = mapped_column(String(100))

    party: Mapped[Party] = relationship(back_populates="contacts")


class PaymentTerm(Base, AuditMixin):
    __tablename__ = "payment_terms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    term_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    term_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    term_type: Mapped[PaymentTermType] = mapped_column(Enum(PaymentTermType), nullable=False)
    credit_days: Mapped[int] = mapped_column(default=0)
    advance_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    description: Mapped[str | None] = mapped_column(String(255))


class RateMaster(Base, AuditMixin):
    __tablename__ = "rate_masters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    rate_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    party_id: Mapped[str] = mapped_column(String(36), ForeignKey("parties.id"), nullable=False)
    customer_type: Mapped[CustomerType] = mapped_column(Enum(CustomerType), nullable=False)
    commodity_id: Mapped[str] = mapped_column(String(36), ForeignKey("commodities.id"), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[QtyUnit] = mapped_column(Enum(QtyUnit), nullable=False)
    currency: Mapped[Currency] = mapped_column(Enum(Currency), default=Currency.INR)
    brokerage: Mapped[float] = mapped_column(Numeric(8, 2), default=0)

    party: Mapped[Party] = relationship(back_populates="rates")
    commodity: Mapped[Commodity] = relationship()


class DocumentSequence(Base):
    __tablename__ = "document_sequences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    sequence_type: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    prefix: Mapped[str] = mapped_column(String(10), default="")
    current_value: Mapped[int] = mapped_column(default=0)
    pad_length: Mapped[int] = mapped_column(default=5)


class Contract(Base, AuditMixin):
    __tablename__ = "contracts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    contract_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    contract_type: Mapped[ContractType] = mapped_column(Enum(ContractType), nullable=False)
    contract_date: Mapped[date] = mapped_column(Date, nullable=False)
    company_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("companies.id"))
    seller_id: Mapped[str] = mapped_column(String(36), ForeignKey("parties.id"), nullable=False)
    buyer_id: Mapped[str] = mapped_column(String(36), ForeignKey("parties.id"), nullable=False)
    is_nominee: Mapped[bool] = mapped_column(Boolean, default=False)
    commodity_id: Mapped[str] = mapped_column(String(36), ForeignKey("commodities.id"), nullable=False)
    quality_allowance: Mapped[str | None] = mapped_column(String(1000))
    packing: Mapped[str] = mapped_column(String(100), nullable=False)
    qty_low: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    qty_high: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    qty_unit: Mapped[QtyUnit] = mapped_column(Enum(QtyUnit), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[Currency] = mapped_column(Enum(Currency), nullable=False)
    tax_id: Mapped[str] = mapped_column(String(36), ForeignKey("taxes.id"), nullable=False)
    payment_term_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("payment_terms.id"))
    weightment_unit_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("units.id"))
    despatch_from: Mapped[date] = mapped_column(Date, nullable=False)
    despatch_to: Mapped[date] = mapped_column(Date, nullable=False)
    broker_id: Mapped[str] = mapped_column(String(36), ForeignKey("brokers.id"), nullable=False)
    broker_rate: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    final_qty: Mapped[float | None] = mapped_column(Numeric(10, 2))
    tolerance_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=5)
    fulfilled_qty: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus), nullable=False, default=ContractStatus.CONTRACT_OPEN
    )
    print_despatch_si: Mapped[bool] = mapped_column(Boolean, default=False)
    print_tr_final_docs: Mapped[bool] = mapped_column(Boolean, default=False)
    print_payment: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    company: Mapped["Company | None"] = relationship(back_populates="contracts")
    seller: Mapped[Party] = relationship(foreign_keys=[seller_id])
    buyer: Mapped[Party] = relationship(foreign_keys=[buyer_id])
    commodity: Mapped[Commodity] = relationship()
    tax: Mapped[Tax] = relationship()
    broker: Mapped[Broker] = relationship()
    payment_term: Mapped["PaymentTerm | None"] = relationship()
    weightment_unit: Mapped["Unit | None"] = relationship()
    despatches: Mapped[list["Despatch"]] = relationship(back_populates="contract")


class Despatch(Base, AuditMixin):
    __tablename__ = "despatches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    despatch_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    despatch_date: Mapped[date] = mapped_column(Date, nullable=False)
    contract_id: Mapped[str] = mapped_column(String(36), ForeignKey("contracts.id"), nullable=False)
    bags: Mapped[int | None] = mapped_column(Integer)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_type: Mapped[str | None] = mapped_column(String(20))
    billing_status: Mapped[BillingStatus] = mapped_column(
        Enum(BillingStatus), nullable=False, default=BillingStatus.UNBILLED
    )
    bill_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("bills.id"))

    contract: Mapped[Contract] = relationship(back_populates="despatches")
    bill: Mapped["Bill | None"] = relationship(back_populates="despatches")


class Bill(Base, AuditMixin):
    __tablename__ = "bills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    bill_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    bill_date: Mapped[date] = mapped_column(Date, nullable=False)
    party_id: Mapped[str] = mapped_column(String(36), ForeignKey("parties.id"), nullable=False)
    tax_id: Mapped[str] = mapped_column(String(36), ForeignKey("taxes.id"), nullable=False)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    base_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    igst_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    cgst_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    sgst_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    gross_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    brokerage_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    supply_type: Mapped[SupplyType] = mapped_column(Enum(SupplyType), nullable=False)

    party: Mapped[Party] = relationship()
    tax: Mapped[Tax] = relationship()
    line_items: Mapped[list["BillLineItem"]] = relationship(back_populates="bill")
    despatches: Mapped[list["Despatch"]] = relationship(back_populates="bill")


class BillLineItem(Base, AuditMixin):
    __tablename__ = "bill_line_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    bill_id: Mapped[str] = mapped_column(String(36), ForeignKey("bills.id"), nullable=False)
    despatch_id: Mapped[str] = mapped_column(String(36), ForeignKey("despatches.id"), unique=True, nullable=False)
    contract_id: Mapped[str] = mapped_column(String(36), ForeignKey("contracts.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    line_base_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    bill: Mapped[Bill] = relationship(back_populates="line_items")
    despatch: Mapped[Despatch] = relationship()
    contract: Mapped[Contract] = relationship()

from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import Bill, BillLineItem, Contract, Despatch, Party, RateMaster, Tax
from app.models.enums import BillingStatus, ContractStatus, CustomerType, RateType
from app.schemas.bill import BillCreate
from app.services.contract_service import ContractService
from app.services.sequence_service import SequenceService
from app.services.tax_engine import TaxEngine
from app.utils.ids import as_db_id, db_get, uuid_variants


class BillingService:
    @staticmethod
    def get_unit_multiplier(qty_unit, rate_unit) -> Decimal:
        q_u = str(getattr(qty_unit, "value", qty_unit) or "MT").upper()
        r_u = str(getattr(rate_unit, "value", rate_unit) or q_u).upper()
        if q_u == r_u:
            return Decimal("1")
        if q_u == "MT" and r_u in ("KGS", "KG"):
            return Decimal("1000")
        if q_u == "MT" and r_u == "QUINTAL":
            return Decimal("10")
        if q_u == "QUINTAL" and r_u in ("KGS", "KG"):
            return Decimal("100")
        if q_u == "QUINTAL" and r_u == "MT":
            return Decimal("0.1")
        if q_u in ("KGS", "KG") and r_u == "MT":
            return Decimal("0.001")
        if q_u in ("KGS", "KG") and r_u == "QUINTAL":
            return Decimal("0.01")
        return Decimal("1")

    @classmethod
    def get_billing_rate(
        cls,
        db: Session,
        party_id: str,
        commodity_id: str,
        is_seller: bool,
        target_rate_type: RateType | None = None,
    ) -> tuple[Decimal, RateType, QtyUnit | None] | None:
        party_vars = uuid_variants(party_id)
        comm_vars = uuid_variants(commodity_id)
        role_types = [
            CustomerType.BOTH,
            CustomerType.SELLER if is_seller else CustomerType.BUYER,
        ]

        # 1. Match specific target_rate_type if specified
        if target_rate_type:
            rm = (
                db.query(RateMaster)
                .filter(
                    RateMaster.party_id.in_(party_vars),
                    RateMaster.commodity_id.in_(comm_vars),
                    RateMaster.customer_type.in_(role_types),
                    (RateMaster.rate_type == target_rate_type) | (RateMaster.brokerage_type == target_rate_type),
                    RateMaster.is_active.is_(True),
                )
                .order_by(RateMaster.created_at.desc())
                .first()
            )
            if not rm:
                rm = (
                    db.query(RateMaster)
                    .filter(
                        RateMaster.party_id.in_(party_vars),
                        RateMaster.commodity_id.in_(comm_vars),
                        (RateMaster.rate_type == target_rate_type) | (RateMaster.brokerage_type == target_rate_type),
                        RateMaster.is_active.is_(True),
                    )
                    .order_by(RateMaster.created_at.desc())
                    .first()
                )
            if rm:
                b_val = Decimal(str(rm.brokerage or 0))
                b_type = rm.brokerage_type or target_rate_type
                b_unit = rm.unit or (QtyUnit.MT if b_type == RateType.FIXED else None)
                if b_val > Decimal("0"):
                    return b_val, b_type, b_unit
                r_val = Decimal(str(rm.rate or 0))
                r_type = rm.rate_type or target_rate_type
                r_unit = rm.unit or (QtyUnit.MT if r_type == RateType.FIXED else None)
                if r_val > Decimal("0"):
                    return r_val, r_type, r_unit
                return b_val, target_rate_type, b_unit

        # 2. General lookup
        rm = (
            db.query(RateMaster)
            .filter(
                RateMaster.party_id.in_(party_vars),
                RateMaster.commodity_id.in_(comm_vars),
                RateMaster.customer_type.in_(role_types),
                RateMaster.is_active.is_(True),
            )
            .order_by(RateMaster.created_at.desc())
            .first()
        )
        if not rm:
            rm = (
                db.query(RateMaster)
                .filter(
                    RateMaster.party_id.in_(party_vars),
                    RateMaster.commodity_id.in_(comm_vars),
                    RateMaster.is_active.is_(True),
                )
                .order_by(RateMaster.created_at.desc())
                .first()
            )
        if not rm:
            return None

        b_val = Decimal(str(rm.brokerage or 0))
        b_type = rm.brokerage_type or RateType.FIXED
        b_unit = rm.unit or (QtyUnit.MT if b_type == RateType.FIXED else None)
        if b_val > Decimal("0"):
            return b_val, b_type, b_unit
        r_val = Decimal(str(rm.rate or 0))
        r_unit = rm.unit or (QtyUnit.MT if rm.rate_type == RateType.FIXED else None)
        if r_val > Decimal("0") and rm.rate_type == RateType.PERCENTAGE:
            return r_val, rm.rate_type, r_unit
        eff_type = rm.brokerage_type or rm.rate_type or RateType.FIXED
        eff_unit = rm.unit or (QtyUnit.MT if eff_type == RateType.FIXED else None)
        return b_val, eff_type, eff_unit
    @classmethod
    def list_billable_contracts(
        cls,
        db: Session,
        party_id: str,
        date_from: date | None = None,
        date_to: date | None = None,
        company_id: str | None = None,
    ) -> list[dict]:
        party = db_get(db, Party, party_id)
        if not party or not party.is_active:
            raise HTTPException(status_code=400, detail="Party not found or inactive.")

        party_vars = uuid_variants(party_id)
        party_vars_set = set(party_vars)
        q = (
            db.query(Contract)
            .options(
                joinedload(Contract.seller),
                joinedload(Contract.buyer),
                joinedload(Contract.commodity),
            )
            .filter(
                Contract.is_active.is_(True),
                Contract.status != ContractStatus.CANCELLED,
                (Contract.seller_id.in_(party_vars)) | (Contract.buyer_id.in_(party_vars)),
            )
        )
        if company_id:
            q = q.filter(Contract.company_id.in_(uuid_variants(company_id)))
        if date_from:
            q = q.filter(Contract.contract_date >= date_from)
        if date_to:
            q = q.filter(Contract.contract_date <= date_to)

        rows: list[dict] = []
        for contract in q.order_by(Contract.contract_date.desc(), Contract.contract_no.desc()):
            billing_qty = ContractService.billing_quantity(contract)
            # Calculate quantity already billed specifically to this party for this contract
            billed_for_party = (
                db.query(func.coalesce(func.sum(BillLineItem.quantity), 0))
                .join(Bill, Bill.id == BillLineItem.bill_id)
                .filter(
                    BillLineItem.contract_id.in_(uuid_variants(contract.id)),
                    Bill.party_id.in_(party_vars),
                )
                .scalar()
            ) or Decimal("0")

            billed = Decimal(str(billed_for_party))
            remaining = max(Decimal("0"), billing_qty - billed)
            if remaining <= 0:
                continue

            contract_seller_vars = set(uuid_variants(contract.seller_id))
            is_seller = bool(party_vars_set.intersection(contract_seller_vars))
            party_role = "Seller" if is_seller else "Buyer"

            target_type = getattr(contract, "broker_rate_type", None)
            rate_info = cls.get_billing_rate(
                db, party_id, str(contract.commodity_id), is_seller, target_rate_type=target_type
            )
            if rate_info is not None:
                effective_broker_rate, effective_broker_rate_type, effective_broker_unit = rate_info
            elif contract.broker_rate is not None:
                effective_broker_rate = Decimal(str(contract.broker_rate))
                effective_broker_rate_type = (
                    getattr(contract, "broker_rate_type", RateType.FIXED) or RateType.FIXED
                )
                effective_broker_unit = contract.qty_unit
            else:
                effective_broker_rate = Decimal("0")
                effective_broker_rate_type = RateType.FIXED
                effective_broker_unit = contract.qty_unit

            b_unit_str = (
                effective_broker_unit.value
                if hasattr(effective_broker_unit, "value")
                else str(effective_broker_unit)
            ) if effective_broker_unit else None

            rows.append(
                {
                    "id": contract.id,
                    "contract_no": contract.contract_no,
                    "contract_date": contract.contract_date,
                    "status": contract.status,
                    "seller_name": contract.seller.name if contract.seller else None,
                    "buyer_name": contract.buyer.name if contract.buyer else None,
                    "commodity_short_name": (
                        contract.commodity.comm_short_name if contract.commodity else None
                    ),
                    "commodity_name": (
                        contract.commodity.commodity_name if contract.commodity else None
                    ),
                    "qty_unit": contract.qty_unit,
                    "rate": Decimal(str(contract.rate)),
                    "billing_qty": billing_qty,
                    "billed_qty": billed,
                    "remaining_billable": remaining,
                    "tax_id": contract.tax_id,
                    "party_role": party_role,
                    "rate_unit": (contract.rate_unit.value if hasattr(contract.rate_unit, "value") else str(contract.rate_unit)) if getattr(contract, "rate_unit", None) else None,
                    "broker_rate": effective_broker_rate,
                    "broker_rate_type": (
                        effective_broker_rate_type.value
                        if hasattr(effective_broker_rate_type, "value")
                        else str(effective_broker_rate_type)
                    ),
                    "broker_rate_unit": b_unit_str,
                }
            )
        return rows

    @classmethod
    def generate(cls, db: Session, payload: BillCreate) -> Bill:
        party = db_get(db, Party, payload.party_id)
        if not party or not party.is_active:
            raise HTTPException(status_code=400, detail="Party not found or inactive.")

        tax = db_get(db, Tax, payload.tax_id)
        if not tax or not tax.is_active:
            raise HTTPException(status_code=400, detail="Tax not found or inactive.")

        party_vars = set(uuid_variants(payload.party_id))
        all_contract_vars: list[str] = []
        for line in payload.lines:
            all_contract_vars.extend(uuid_variants(line.contract_id))

        if len(payload.lines) != len({line.contract_id for line in payload.lines}):
            raise HTTPException(status_code=400, detail="Duplicate contracts in bill lines.")

        contracts = (
            db.query(Contract)
            .filter(Contract.id.in_(all_contract_vars))
            .options(
                joinedload(Contract.seller),
                joinedload(Contract.buyer),
                joinedload(Contract.commodity),
            )
            .with_for_update()
            .all()
        )
        by_id: dict[str, Contract] = {}
        for c in contracts:
            for v in uuid_variants(c.id):
                by_id[v] = c

        if len(contracts) < len(payload.lines):
            raise HTTPException(status_code=404, detail="One or more contracts not found.")

        line_data: list[dict] = []
        base_amount = Decimal("0")
        brokerage_amount = Decimal("0")
        first_contract: Contract | None = None

        for line in payload.lines:
            contract = by_id.get(str(line.contract_id)) or by_id.get(as_db_id(line.contract_id))
            if not contract:
                raise HTTPException(status_code=404, detail="One or more contracts not found.")
            if first_contract is None:
                first_contract = contract

            if not contract.is_active:
                raise HTTPException(
                    status_code=400, detail=f"Contract {contract.contract_no} is inactive."
                )
            if contract.status == ContractStatus.CANCELLED:
                raise HTTPException(
                    status_code=400, detail=f"Contract {contract.contract_no} is cancelled."
                )
            contract_party_vars = set(uuid_variants(contract.seller_id) + uuid_variants(contract.buyer_id))
            if not party_vars.intersection(contract_party_vars):
                raise HTTPException(
                    status_code=400,
                    detail=f"Contract {contract.contract_no} does not belong to the selected party.",
                )
            if payload.bill_date < contract.contract_date:
                raise HTTPException(
                    status_code=400,
                    detail=f"Bill date cannot be prior to contract {contract.contract_no} date.",
                )

            billing_qty = ContractService.billing_quantity(contract)
            party_vars_for_contract = set(uuid_variants(payload.party_id))
            billed_for_party = (
                db.query(func.coalesce(func.sum(BillLineItem.quantity), 0))
                .join(Bill, Bill.id == BillLineItem.bill_id)
                .filter(
                    BillLineItem.contract_id.in_(uuid_variants(contract.id)),
                    Bill.party_id.in_(party_vars_for_contract),
                )
                .scalar()
            ) or Decimal("0")

            billed = Decimal(str(billed_for_party))
            remaining = max(Decimal("0"), billing_qty - billed)
            qty = Decimal(str(line.quantity))
            if qty > remaining:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Contract {contract.contract_no}: qty {qty} exceeds "
                        f"remaining billable {remaining} for {party.name}."
                    ),
                )

            despatch = None
            despatch_id = None
            if line.despatch_id:
                despatch = (
                    db.query(Despatch)
                    .filter(Despatch.id.in_(uuid_variants(line.despatch_id)))
                    .with_for_update()
                    .first()
                )
                if not despatch or not despatch.is_active:
                    raise HTTPException(status_code=400, detail="Linked despatch not found.")
                if despatch.contract_id not in uuid_variants(contract.id):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Despatch {despatch.despatch_no} does not belong to contract "
                        f"{contract.contract_no}.",
                    )
                if despatch.billing_status != BillingStatus.UNBILLED:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Despatch {despatch.despatch_no} is already billed.",
                    )
                despatch_id = despatch.id

            rate = Decimal(str(contract.rate))
            r_unit = getattr(contract, "rate_unit", None) or contract.qty_unit
            multiplier = cls.get_unit_multiplier(contract.qty_unit, r_unit)
            converted_qty = qty * multiplier
            line_base = converted_qty * rate
            base_amount += line_base
            # Fetch rate from Billing Rate master
            contract_seller_vars = set(uuid_variants(contract.seller_id))
            line_is_seller = bool(party_vars.intersection(contract_seller_vars))
            target_type = getattr(contract, "broker_rate_type", None)
            rate_info = cls.get_billing_rate(
                db, str(party.id), str(contract.commodity_id), line_is_seller, target_rate_type=target_type
            )
            if rate_info is not None:
                broker_rate, broker_rate_type, broker_unit = rate_info
            elif contract.broker_rate is not None:
                broker_rate = Decimal(str(contract.broker_rate))
                broker_rate_type = getattr(contract, "broker_rate_type", RateType.FIXED) or RateType.FIXED
                broker_unit = contract.qty_unit
            else:
                broker_rate = Decimal("0")
                broker_rate_type = RateType.FIXED
                broker_unit = contract.qty_unit

            b_unit_str = (
                broker_unit.value
                if hasattr(broker_unit, "value")
                else str(broker_unit)
            ) if broker_unit else None

            if broker_rate_type == RateType.PERCENTAGE:
                # Percentage brokerage calculated on basis of transaction value: (line_base * broker_rate) / 100
                line_brokerage = (line_base * broker_rate) / Decimal("100")
            else:
                # Fixed brokerage calculated with unit multiplier:
                # If contract qty is in KGS and broker rate is in MT, convert KGS -> MT
                b_multiplier = cls.get_unit_multiplier(contract.qty_unit, broker_unit or contract.qty_unit)
                converted_broker_qty = qty * b_multiplier
                line_brokerage = converted_broker_qty * broker_rate

            brokerage_amount += line_brokerage
            line_data.append(
                {
                    "contract": contract,
                    "despatch": despatch,
                    "despatch_id": despatch_id,
                    "contract_id": contract.id,
                    "quantity": qty,
                    "rate": rate,
                    "line_base_amount": line_base,
                    "rate_unit": (r_unit.value if hasattr(r_unit, "value") else str(r_unit)) if r_unit else None,
                    "broker_rate": broker_rate,
                    "broker_rate_type": broker_rate_type,
                    "broker_rate_unit": b_unit_str,
                    "line_brokerage_amount": line_brokerage.quantize(Decimal("0.01")),
                }
            )

        assert first_contract is not None
        company = first_contract.company or party.company
        company_state = getattr(company, "state", None) or "Rajasthan"
        party_state = party.state or "Rajasthan"

        supply_type = TaxEngine.get_supply_type(
            company_state,
            party_state,
        )
        tax_amounts = TaxEngine.calculate(brokerage_amount, tax, supply_type)
        raw_gross = (
            brokerage_amount
            + tax_amounts["igst_amount"]
            + tax_amounts["cgst_amount"]
            + tax_amounts["sgst_amount"]
        )
        gross_amount = raw_gross.quantize(Decimal("1"), rounding="ROUND_HALF_UP").quantize(Decimal("0.01"))

        bill = Bill(
            bill_no=SequenceService.next_code(db, "BILL"),
            bill_date=payload.bill_date,
            party_id=str(party.id),
            tax_id=str(tax.id),
            from_date=payload.from_date,
            to_date=payload.to_date,
            base_amount=base_amount,
            igst_amount=tax_amounts["igst_amount"],
            cgst_amount=tax_amounts["cgst_amount"],
            sgst_amount=tax_amounts["sgst_amount"],
            gross_amount=gross_amount,
            brokerage_amount=brokerage_amount.quantize(Decimal("0.01")),
            supply_type=supply_type,
        )
        db.add(bill)
        db.flush()

        for item in line_data:
            db.add(
                BillLineItem(
                    bill_id=bill.id,
                    despatch_id=item["despatch_id"],
                    contract_id=item["contract_id"],
                    quantity=item["quantity"],
                    rate=item["rate"],
                    rate_unit=item.get("rate_unit"),
                    line_base_amount=item["line_base_amount"],
                    broker_rate=item["broker_rate"],
                    broker_rate_type=item["broker_rate_type"],
                    broker_rate_unit=item.get("broker_rate_unit"),
                    line_brokerage_amount=item["line_brokerage_amount"],
                )
            )
            despatch = item["despatch"]
            if despatch is not None:
                despatch.billing_status = BillingStatus.BILLED
                despatch.bill_id = bill.id

        db.flush()

        # Update contract.billed_qty to reflect the maximum billed volume across counterparties
        for item in line_data:
            contract = item["contract"]
            seller_vars = set(uuid_variants(contract.seller_id))
            buyer_vars = set(uuid_variants(contract.buyer_id))
            seller_billed = (
                db.query(func.coalesce(func.sum(BillLineItem.quantity), 0))
                .join(Bill, Bill.id == BillLineItem.bill_id)
                .filter(
                    BillLineItem.contract_id.in_(uuid_variants(contract.id)),
                    Bill.party_id.in_(seller_vars),
                )
                .scalar()
            ) or Decimal("0")
            buyer_billed = (
                db.query(func.coalesce(func.sum(BillLineItem.quantity), 0))
                .join(Bill, Bill.id == BillLineItem.bill_id)
                .filter(
                    BillLineItem.contract_id.in_(uuid_variants(contract.id)),
                    Bill.party_id.in_(buyer_vars),
                )
                .scalar()
            ) or Decimal("0")
            contract.billed_qty = max(Decimal(str(seller_billed)), Decimal(str(buyer_billed)))

        db.commit()
        db.refresh(bill)
        return bill

    @staticmethod
    def to_detail(bill: Bill) -> dict:
        db = Session.object_session(bill)
        lines = []
        first_contract = None
        for li in bill.line_items:
            despatch = li.despatch
            contract = li.contract
            if contract and first_contract is None:
                first_contract = contract

            # If snapshot exists on the line item, use it directly (immutable historical bill)
            broker_rate_unit = getattr(li, "broker_rate_unit", None)
            if getattr(li, "broker_rate", None) is not None and getattr(li, "line_brokerage_amount", None) is not None:
                broker_rate = Decimal(str(li.broker_rate))
                raw_type = getattr(li, "broker_rate_type", RateType.FIXED) or RateType.FIXED
                broker_rate_type = raw_type if isinstance(raw_type, RateType) else RateType(str(raw_type))
                line_brokerage = Decimal(str(li.line_brokerage_amount))
            elif contract and db:
                contract_seller_vars = set(uuid_variants(contract.seller_id))
                line_is_seller = bool(set(uuid_variants(bill.party_id)).intersection(contract_seller_vars))
                rate_info = BillingService.get_billing_rate(
                    db, str(bill.party_id), str(contract.commodity_id), line_is_seller
                )
                if rate_info is not None:
                    broker_rate, broker_rate_type, broker_unit = rate_info
                elif contract.broker_rate is not None:
                    broker_rate = Decimal(str(contract.broker_rate))
                    broker_rate_type = (
                        getattr(contract, "broker_rate_type", RateType.FIXED) or RateType.FIXED
                    )
                    broker_unit = contract.qty_unit
                else:
                    broker_rate = Decimal("0")
                    broker_rate_type = RateType.FIXED
                    broker_unit = contract.qty_unit
                if not broker_rate_unit:
                    broker_rate_unit = (
                        broker_unit.value if hasattr(broker_unit, "value") else str(broker_unit)
                    ) if broker_unit else None
                if broker_rate_type == RateType.PERCENTAGE:
                    line_brokerage = (Decimal(str(li.line_base_amount or 0)) * broker_rate) / Decimal("100")
                else:
                    b_multiplier = BillingService.get_unit_multiplier(contract.qty_unit, broker_unit or contract.qty_unit)
                    line_brokerage = (Decimal(str(li.quantity or 0)) * b_multiplier) * broker_rate
            elif contract and contract.broker_rate:
                broker_rate = Decimal(str(contract.broker_rate))
                broker_rate_type = (
                    getattr(contract, "broker_rate_type", RateType.FIXED) or RateType.FIXED
                )
                if not broker_rate_unit:
                    broker_rate_unit = (
                        contract.qty_unit.value if hasattr(contract.qty_unit, "value") else str(contract.qty_unit)
                    ) if contract.qty_unit else None
                if broker_rate_type == RateType.PERCENTAGE:
                    line_brokerage = (Decimal(str(li.line_base_amount or 0)) * broker_rate) / Decimal("100")
                else:
                    line_brokerage = Decimal(str(li.quantity or 0)) * broker_rate
            else:
                broker_rate = Decimal("0")
                broker_rate_type = RateType.FIXED
                broker_rate_unit = None
                line_brokerage = Decimal("0")

            lines.append(
                {
                    **{c.name: getattr(li, c.name) for c in li.__table__.columns},
                    "broker_rate_unit": broker_rate_unit,
                    "despatch_no": despatch.despatch_no if despatch else None,
                    "despatch_date": despatch.despatch_date if despatch else None,
                    "contract_no": contract.contract_no if contract else None,
                    "contract_date": contract.contract_date if contract else None,
                    "seller_name": contract.seller.name if contract and contract.seller else None,
                    "buyer_name": contract.buyer.name if contract and contract.buyer else None,
                    "seller_id": str(contract.seller_id) if contract else None,
                    "buyer_id": str(contract.buyer_id) if contract else None,
                    "bags": despatch.bags if despatch else None,
                    "broker_rate": broker_rate,
                    "broker_rate_type": broker_rate_type.value if hasattr(broker_rate_type, "value") else str(broker_rate_type),
                    "line_brokerage_amount": line_brokerage.quantize(Decimal("0.01")),
                    "commodity_short_name": (
                        contract.commodity.comm_short_name
                        if contract and contract.commodity
                        else None
                    ),
                    "commodity_name": (
                        contract.commodity.commodity_name
                        if contract and contract.commodity
                        else None
                    ),
                    "qty_unit": contract.qty_unit.value if contract else None,
                    "rate_unit": getattr(li, "rate_unit", None) or (contract.rate_unit.value if (contract and getattr(contract, "rate_unit", None)) else None) or (contract.qty_unit.value if contract else None),
                }
            )

        party = bill.party
        tax = bill.tax
        company = first_contract.company if first_contract and first_contract.company else None

        total_brokerage = sum((line["line_brokerage_amount"] for line in lines), Decimal("0"))
        exact_gross = (
            total_brokerage
            + Decimal(str(bill.igst_amount or 0))
            + Decimal(str(bill.cgst_amount or 0))
            + Decimal(str(bill.sgst_amount or 0))
        )
        rounded_gross = exact_gross.quantize(Decimal("1"), rounding="ROUND_HALF_UP").quantize(Decimal("0.01"))
        round_off_amount = (rounded_gross - exact_gross).quantize(Decimal("0.01"))

        return {
            **{c.name: getattr(bill, c.name) for c in bill.__table__.columns},
            "gross_amount": rounded_gross,
            "round_off_amount": round_off_amount,
            "party_name": party.name if party else None,
            "party_code": party.party_code if party else None,
            "party_address": party.address_line if party else None,
            "party_city": party.city if party else None,
            "party_state": party.state if party else None,
            "party_pincode": party.pincode if party else None,
            "party_gst_tin": party.gst_tin if party else None,
            "tax_name": tax.tax_name if tax else None,
            "igst_percent": tax.igst_percent if tax else None,
            "cgst_percent": tax.cgst_percent if tax else None,
            "sgst_percent": tax.sgst_percent if tax else None,
            "seller_name": first_contract.seller.name if first_contract and first_contract.seller else None,
            "buyer_name": first_contract.buyer.name if first_contract and first_contract.buyer else None,
            "seller_state": first_contract.seller.state if first_contract and first_contract.seller else None,
            "buyer_state": first_contract.buyer.state if first_contract and first_contract.buyer else None,
            "company_name": getattr(company, "name", None) if company else None,
            "company_address": getattr(company, "address", None) if company else None,
            "company_city": getattr(company, "city", None) if company else None,
            "company_state": getattr(company, "state", None) if company else None,
            "company_pincode": getattr(company, "pincode", None) if company else None,
            "company_gstin": getattr(company, "gst_tin", None) if company else None,
            "company_pan": getattr(company, "pan_no", None) if company else None,
            "company_phone": getattr(company, "phone", None) or getattr(company, "mobile", None) if company else None,
            "company_bank_name": getattr(company, "bank_name", None) if company else None,
            "company_account_no": getattr(company, "account_no", None) if company else None,
            "company_ifsc_code": getattr(company, "ifsc_code", None) if company else None,
            "line_items": lines,
        }

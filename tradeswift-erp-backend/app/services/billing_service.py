from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import Bill, BillLineItem, Contract, Despatch, Party, Tax
from app.models.enums import BillingStatus, ContractStatus, RateType
from app.schemas.bill import BillCreate
from app.services.contract_service import ContractService
from app.services.sequence_service import SequenceService
from app.services.tax_engine import TaxEngine
from app.utils.ids import as_db_id, db_get, uuid_variants


class BillingService:
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
                    .filter(Despatch.id == as_db_id(line.despatch_id))
                    .with_for_update()
                    .first()
                )
                if not despatch or not despatch.is_active:
                    raise HTTPException(status_code=400, detail="Linked despatch not found.")
                if despatch.contract_id != contract.id:
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
            line_base = qty * rate
            base_amount += line_base
            broker_rate = Decimal(str(contract.broker_rate or 0))
            broker_rate_type = getattr(contract, "broker_rate_type", RateType.FIXED) or RateType.FIXED
            if broker_rate_type == RateType.PERCENTAGE:
                # Percentage brokerage calculated on basis of transaction value: (line_base * broker_rate) / 100
                line_brokerage = (line_base * broker_rate) / Decimal("100")
            else:
                # Fixed brokerage calculated on basis of quantity unit: qty * broker_rate
                line_brokerage = qty * broker_rate
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
        gross_amount = TaxEngine.gross(brokerage_amount, tax_amounts)

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
                    line_base_amount=item["line_base_amount"],
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
        lines = []
        first_contract = None
        for li in bill.line_items:
            despatch = li.despatch
            contract = li.contract
            if contract and first_contract is None:
                first_contract = contract

            broker_rate = Decimal(str(contract.broker_rate or 0)) if contract else Decimal("0")
            broker_rate_type = getattr(contract, "broker_rate_type", RateType.FIXED) if contract else RateType.FIXED
            if broker_rate_type == RateType.PERCENTAGE:
                line_brokerage = (Decimal(str(li.line_base_amount or 0)) * broker_rate) / Decimal("100")
            else:
                line_brokerage = Decimal(str(li.quantity or 0)) * broker_rate

            lines.append(
                {
                    **{c.name: getattr(li, c.name) for c in li.__table__.columns},
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
                }
            )

        party = bill.party
        tax = bill.tax
        company = first_contract.company if first_contract and first_contract.company else None
        return {
            **{c.name: getattr(bill, c.name) for c in bill.__table__.columns},
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

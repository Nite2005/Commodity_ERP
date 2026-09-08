from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Bill, BillLineItem, Contract, Despatch, Party, Tax
from app.models.enums import BillingStatus, ContractStatus
from app.schemas.bill import BillCreate
from app.services.contract_service import ContractService
from app.services.sequence_service import SequenceService
from app.services.tax_engine import TaxEngine
from app.utils.ids import as_db_id, db_get


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
        party_key = as_db_id(party_id)
        party = db_get(db, Party, party_key)
        if not party or not party.is_active:
            raise HTTPException(status_code=400, detail="Party not found or inactive.")

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
                (Contract.seller_id == party_key) | (Contract.buyer_id == party_key),
            )
        )
        if company_id:
            q = q.filter(Contract.company_id == as_db_id(company_id))
        if date_from:
            q = q.filter(Contract.contract_date >= date_from)
        if date_to:
            q = q.filter(Contract.contract_date <= date_to)

        rows: list[dict] = []
        for contract in q.order_by(Contract.contract_date.desc(), Contract.contract_no.desc()):
            billing_qty = ContractService.billing_quantity(contract)
            billed = Decimal(str(contract.billed_qty or 0))
            remaining = max(Decimal("0"), billing_qty - billed)
            if remaining <= 0:
                continue
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

        party_key = as_db_id(payload.party_id)
        contract_ids = [as_db_id(line.contract_id) for line in payload.lines]
        if len(set(contract_ids)) != len(contract_ids):
            raise HTTPException(status_code=400, detail="Duplicate contracts in bill lines.")

        contracts = (
            db.query(Contract)
            .filter(Contract.id.in_(contract_ids))
            .options(
                joinedload(Contract.seller),
                joinedload(Contract.buyer),
                joinedload(Contract.commodity),
            )
            .with_for_update()
            .all()
        )
        by_id = {c.id: c for c in contracts}
        if len(by_id) != len(contract_ids):
            raise HTTPException(status_code=404, detail="One or more contracts not found.")

        line_data: list[dict] = []
        base_amount = Decimal("0")
        brokerage_amount = Decimal("0")
        first_contract: Contract | None = None

        for line in payload.lines:
            contract = by_id[as_db_id(line.contract_id)]
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
            if party_key not in (contract.seller_id, contract.buyer_id):
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
            billed = Decimal(str(contract.billed_qty or 0))
            remaining = max(Decimal("0"), billing_qty - billed)
            qty = Decimal(str(line.quantity))
            if qty > remaining:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Contract {contract.contract_no}: qty {qty} exceeds "
                        f"remaining billable {remaining}."
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
            brokerage_amount += qty * Decimal(str(contract.broker_rate))
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
        supply_type = TaxEngine.get_supply_type(
            first_contract.seller.state,
            first_contract.buyer.state,
        )
        tax_amounts = TaxEngine.calculate(base_amount, tax, supply_type)
        gross_amount = TaxEngine.gross(base_amount, tax_amounts)

        bill = Bill(
            bill_no=SequenceService.next_code(db, "BILL"),
            bill_date=payload.bill_date,
            party_id=party_key,
            tax_id=as_db_id(payload.tax_id),
            from_date=payload.from_date,
            to_date=payload.to_date,
            base_amount=base_amount,
            igst_amount=tax_amounts["igst_amount"],
            cgst_amount=tax_amounts["cgst_amount"],
            sgst_amount=tax_amounts["sgst_amount"],
            gross_amount=gross_amount,
            brokerage_amount=brokerage_amount,
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
            contract = item["contract"]
            contract.billed_qty = Decimal(str(contract.billed_qty or 0)) + item["quantity"]
            despatch = item["despatch"]
            if despatch is not None:
                despatch.billing_status = BillingStatus.BILLED
                despatch.bill_id = bill.id

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
            lines.append(
                {
                    **{c.name: getattr(li, c.name) for c in li.__table__.columns},
                    "despatch_no": despatch.despatch_no if despatch else None,
                    "despatch_date": despatch.despatch_date if despatch else None,
                    "contract_no": contract.contract_no if contract else None,
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
            "line_items": lines,
        }

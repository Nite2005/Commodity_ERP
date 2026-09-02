from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Bill, BillLineItem, Contract, Despatch, Party, Tax
from app.models.enums import BillingStatus
from app.schemas.bill import BillCreate
from app.services.sequence_service import SequenceService
from app.services.tax_engine import TaxEngine
from app.utils.ids import as_db_id, db_get


class BillingService:
    @classmethod
    def generate(cls, db: Session, payload: BillCreate) -> Bill:
        party = db_get(db, Party, payload.party_id)
        if not party or not party.is_active:
            raise HTTPException(status_code=400, detail="Party not found or inactive.")

        tax = db_get(db, Tax, payload.tax_id)
        if not tax or not tax.is_active:
            raise HTTPException(status_code=400, detail="Tax not found or inactive.")

        despatch_ids = [as_db_id(d) for d in payload.despatch_ids]
        despatches = (
            db.query(Despatch)
            .filter(Despatch.id.in_(despatch_ids))
            .options(
                joinedload(Despatch.contract).joinedload(Contract.seller),
                joinedload(Despatch.contract).joinedload(Contract.buyer),
                joinedload(Despatch.contract).joinedload(Contract.commodity),
            )
            .with_for_update()
            .all()
        )

        if len(despatches) != len(despatch_ids):
            raise HTTPException(status_code=404, detail="One or more despatches not found.")

        for d in despatches:
            if not d.is_active:
                raise HTTPException(status_code=400, detail=f"Despatch {d.despatch_no} is inactive.")
            if d.billing_status != BillingStatus.UNBILLED:
                raise HTTPException(
                    status_code=409,
                    detail=f"Despatch {d.despatch_no} is already billed.",
                )
            contract = d.contract
            if str(party.id) not in (contract.seller_id, contract.buyer_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Despatch {d.despatch_no} does not belong to the selected party.",
                )
            if d.despatch_date < payload.from_date or d.despatch_date > payload.to_date:
                raise HTTPException(
                    status_code=400,
                    detail=f"Despatch {d.despatch_no} is outside the selected date range.",
                )
            if payload.bill_date < contract.contract_date:
                raise HTTPException(
                    status_code=400,
                    detail="Bill date cannot be prior to contract date.",
                )

        first_contract = despatches[0].contract
        supply_type = TaxEngine.get_supply_type(
            first_contract.seller.state,
            first_contract.buyer.state,
        )

        base_amount = Decimal("0")
        brokerage_amount = Decimal("0")
        line_data: list[dict] = []

        for d in despatches:
            contract = d.contract
            qty = Decimal(str(d.quantity))
            rate = Decimal(str(contract.rate))
            line_base = qty * rate
            base_amount += line_base
            brokerage_amount += qty * Decimal(str(contract.broker_rate))
            line_data.append(
                {
                    "despatch_id": d.id,
                    "contract_id": contract.id,
                    "quantity": qty,
                    "rate": rate,
                    "line_base_amount": line_base,
                }
            )

        tax_amounts = TaxEngine.calculate(base_amount, tax, supply_type)
        gross_amount = TaxEngine.gross(base_amount, tax_amounts)

        bill = Bill(
            bill_no=SequenceService.next_code(db, "BILL"),
            bill_date=payload.bill_date,
            party_id=as_db_id(payload.party_id),
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

        for d in despatches:
            d.billing_status = BillingStatus.BILLED
            d.bill_id = bill.id

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

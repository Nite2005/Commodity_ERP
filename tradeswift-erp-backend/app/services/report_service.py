import csv
import io
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Bill, Contract, Party
from app.models.enums import ContractStatus
from app.utils.ids import as_db_id


class ReportService:
    @staticmethod
    def contract_register(
        db: Session,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        company_id: str | None = None,
        party_id: str | None = None,
        status: ContractStatus | None = None,
        active_only: bool = True,
    ) -> list[dict]:
        q = db.query(Contract).options(
            joinedload(Contract.company),
            joinedload(Contract.seller),
            joinedload(Contract.buyer),
            joinedload(Contract.commodity),
            joinedload(Contract.broker),
        )
        if active_only:
            q = q.filter(Contract.is_active.is_(True))
        if status:
            q = q.filter(Contract.status == status)
        if company_id:
            q = q.filter(Contract.company_id == as_db_id(company_id))
        if party_id:
            party_key = as_db_id(party_id)
            q = q.filter((Contract.seller_id == party_key) | (Contract.buyer_id == party_key))
        if date_from:
            q = q.filter(Contract.contract_date >= date_from)
        if date_to:
            q = q.filter(Contract.contract_date <= date_to)

        rows = q.order_by(Contract.contract_date.desc(), Contract.contract_no.desc()).all()
        return [
            {
                "id": row.id,
                "contract_no": row.contract_no,
                "contract_date": row.contract_date,
                "contract_type": row.contract_type,
                "status": row.status,
                "company_name": row.company.name if row.company else None,
                "seller_name": row.seller.name if row.seller else None,
                "buyer_name": row.buyer.name if row.buyer else None,
                "commodity_name": row.commodity.commodity_name if row.commodity else None,
                "commodity_short_name": (
                    row.commodity.comm_short_name if row.commodity else None
                ),
                "qty_low": row.qty_low,
                "qty_high": row.qty_high,
                "final_qty": row.final_qty,
                "qty_unit": row.qty_unit,
                "rate": row.rate,
                "broker_name": row.broker.broker_name if row.broker else None,
                "broker_rate": row.broker_rate,
                "despatch_from": row.despatch_from,
                "despatch_to": row.despatch_to,
            }
            for row in rows
        ]

    @staticmethod
    def sales_register(
        db: Session,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        party_id: str | None = None,
        company_id: str | None = None,
        active_only: bool = True,
    ) -> list[dict]:
        q = db.query(Bill).options(joinedload(Bill.party), joinedload(Bill.tax))
        if active_only:
            q = q.filter(Bill.is_active.is_(True))
        if party_id:
            q = q.filter(Bill.party_id == as_db_id(party_id))
        if company_id:
            q = q.join(Party, Bill.party_id == Party.id).filter(
                Party.company_id == as_db_id(company_id)
            )
        if date_from:
            q = q.filter(Bill.bill_date >= date_from)
        if date_to:
            q = q.filter(Bill.bill_date <= date_to)

        rows = q.order_by(Bill.bill_date.desc(), Bill.bill_no.desc()).all()
        return [
            {
                "id": row.id,
                "bill_no": row.bill_no,
                "bill_date": row.bill_date,
                "party_name": row.party.name if row.party else None,
                "party_code": row.party.party_code if row.party else None,
                "from_date": row.from_date,
                "to_date": row.to_date,
                "base_amount": row.base_amount,
                "igst_amount": row.igst_amount,
                "cgst_amount": row.cgst_amount,
                "sgst_amount": row.sgst_amount,
                "gross_amount": row.gross_amount,
                "brokerage_amount": row.brokerage_amount,
                "supply_type": row.supply_type,
                "tax_name": row.tax.tax_name if row.tax else None,
            }
            for row in rows
        ]

    @staticmethod
    def to_csv(headers: list[str], rows: list[dict], field_keys: list[str]) -> str:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(["" if row.get(k) is None else row.get(k) for k in field_keys])
        return buf.getvalue()

    @staticmethod
    def get_party_ledger(db: Session, party_id: str) -> dict:
        try:
            from uuid import UUID
            u = UUID(str(party_id))
            party_keys = [u.hex, str(u)]
        except Exception:
            party_keys = [str(party_id)]

        party = db.query(Party).filter(Party.id.in_(party_keys)).first()
        if not party:
            raise HTTPException(status_code=404, detail="Party not found.")

        credit_limit = Decimal(str(party.credit_limit or 5000000.00)).quantize(Decimal("0.01"))

        contracts = (
            db.query(Contract)
            .options(
                joinedload(Contract.commodity),
                joinedload(Contract.seller),
                joinedload(Contract.buyer),
            )
            .filter(
                Contract.is_active.is_(True),
                (Contract.seller_id.in_(party_keys)) | (Contract.buyer_id.in_(party_keys)),
            )
            .order_by(Contract.contract_date.desc(), Contract.contract_no.desc())
            .all()
        )

        bills = (
            db.query(Bill)
            .filter(Bill.party_id.in_(party_keys), Bill.is_active.is_(True))
            .all()
        )
        total_billed_amount = sum(
            (Decimal(str(b.gross_amount or 0)) for b in bills),
            Decimal("0.00"),
        ).quantize(Decimal("0.01"))

        items: list[dict] = []
        for c in contracts:
            role = "SELLER" if str(c.seller_id) in party_keys else "BUYER"
            qty = Decimal(str(c.final_qty if c.final_qty is not None else c.qty_high))
            rate = Decimal(str(c.rate))
            total_value = (qty * rate).quantize(Decimal("0.01"))

            billed_qty = Decimal(str(c.billed_qty or 0))
            billed_portion = (billed_qty * rate).quantize(Decimal("0.01"))

            if c.status == ContractStatus.CANCELLED:
                adjustments = total_value
                pending_payment = Decimal("0.00")
                net_due = Decimal("0.00")
            elif c.status == ContractStatus.CLOSED:
                adjustments = min(total_value, billed_portion)
                pending_payment = max(Decimal("0.00"), total_value - adjustments)
                net_due = pending_payment
            else:
                adjustments = min(total_value, billed_portion)
                pending_payment = max(Decimal("0.00"), total_value - adjustments)
                net_due = pending_payment

            items.append({
                "contract_id": c.id,
                "contract_no": c.contract_no,
                "contract_date": c.contract_date,
                "role": role,
                "commodity_name": c.commodity.commodity_name if c.commodity else None,
                "status": c.status,
                "quantity": qty,
                "qty_unit": c.qty_unit,
                "rate": rate,
                "total_value": total_value,
                "pending_payment": pending_payment,
                "adjustments": adjustments,
                "net_due": net_due,
            })

        total_contract_value = sum((i["total_value"] for i in items), Decimal("0.00")).quantize(Decimal("0.01"))
        total_adjustments = sum((i["adjustments"] for i in items), Decimal("0.00")).quantize(Decimal("0.01"))
        total_outstanding = sum((i["net_due"] for i in items), Decimal("0.00")).quantize(Decimal("0.01"))
        is_overdue = total_outstanding > credit_limit
        status_label = "Limit Exceeded / Overdue" if is_overdue else "Within Limit"

        return {
            "party_id": party.id,
            "party_name": party.name,
            "party_code": party.party_code,
            "credit_limit": credit_limit,
            "total_outstanding": total_outstanding,
            "total_contract_value": total_contract_value,
            "total_billed_amount": total_billed_amount,
            "total_adjustments": total_adjustments,
            "is_overdue": is_overdue,
            "status_label": status_label,
            "contracts_count": len(items),
            "contracts": items,
        }


import json
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Broker,
    Commodity,
    Company,
    Contact,
    Contract,
    MasterChangeRequest,
    Party,
    PaymentTerm,
    RateMaster,
    Tax,
    Unit,
)
from app.models.enums import ApprovalStatus, EntityType
from app.utils.ids import db_get, uuid_variants


class ApprovalService:
    @staticmethod
    def list_requests(
        db: Session,
        status: ApprovalStatus | None = None,
        entity_id: str | None = None,
        entity_type: EntityType | None = None,
    ) -> list[MasterChangeRequest]:
        q = db.query(MasterChangeRequest)
        if status:
            q = q.filter(MasterChangeRequest.status == status)
        if entity_type:
            q = q.filter(MasterChangeRequest.entity_type == entity_type)
        if entity_id:
            variants = uuid_variants(entity_id)
            q = q.filter(MasterChangeRequest.entity_id.in_(variants))
        return q.order_by(MasterChangeRequest.created_at.desc()).all()

    @staticmethod
    def get_pending_count(db: Session) -> int:
        return (
            db.query(MasterChangeRequest)
            .filter(MasterChangeRequest.status == ApprovalStatus.PENDING)
            .count()
        )

    @staticmethod
    def create_change_request(
        db: Session,
        entity_type: EntityType,
        entity_id: str,
        entity_name: str,
        change_summary: str,
        changes_dict: dict,
        requested_by: str = "Trader / User",
    ) -> MasterChangeRequest:
        # Serialize changes to JSON
        # Convert Decimal values to float/string for JSON serialization
        def serialize_val(v):
            if isinstance(v, Decimal):
                return str(v)
            if isinstance(v, (datetime,)):
                return v.isoformat()
            return v

        clean_dict = {}
        for field, diff in changes_dict.items():
            clean_dict[field] = {
                "old": serialize_val(diff.get("old")),
                "new": serialize_val(diff.get("new")),
                "label": diff.get("label", field.replace("_", " ").title()),
            }

        req = MasterChangeRequest(
            entity_type=entity_type,
            entity_id=str(entity_id),
            entity_name=entity_name,
            change_summary=change_summary,
            changes_json=json.dumps(clean_dict),
            status=ApprovalStatus.PENDING,
            requested_by=requested_by,
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def approve_request(
        db: Session, request_id: str, reviewer_name: str
    ) -> MasterChangeRequest:
        req = db_get(db, MasterChangeRequest, request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Approval request not found.")
        if req.status != ApprovalStatus.PENDING:
            raise HTTPException(
                status_code=400,
                detail=f"Request is already {req.status.value.lower()}.",
            )

        changes = json.loads(req.changes_json)

        # Apply staged changes to target entity
        et = str(req.entity_type)
        if et in (EntityType.PARTY, "PARTY"):
            party = db_get(db, Party, req.entity_id)
            if not party:
                raise HTTPException(status_code=404, detail="Target party not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(party, field):
                    if field == "company_id" and val:
                        c_row = db_get(db, Company, val)
                        if c_row:
                            val = str(c_row.id)
                    elif field == "credit_limit" and val is not None:
                        val = float(val) if str(val).strip() != "" else None
                    setattr(party, field, val)

        elif et in (EntityType.RATE, "RATE"):
            rate = db_get(db, RateMaster, req.entity_id)
            if not rate:
                raise HTTPException(status_code=404, detail="Target rate not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(rate, field):
                    if field == "party_id" and val:
                        p_row = db_get(db, Party, val)
                        if p_row:
                            val = str(p_row.id)
                    elif field == "commodity_id" and val:
                        c_row = db_get(db, Commodity, val)
                        if c_row:
                            val = str(c_row.id)
                    elif field in ("rate", "brokerage") and val is not None:
                        val = float(val) if str(val).strip() != "" else None
                    setattr(rate, field, val)

        elif et in (EntityType.COMPANY, "COMPANY"):
            company = db_get(db, Company, req.entity_id)
            if not company:
                raise HTTPException(status_code=404, detail="Target company not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(company, field):
                    setattr(company, field, val)

        elif et in (EntityType.CONTACT, "CONTACT"):
            contact = db_get(db, Contact, req.entity_id)
            if not contact:
                raise HTTPException(status_code=404, detail="Target contact not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(contact, field):
                    if field == "party_id" and val:
                        p_row = db_get(db, Party, val)
                        if p_row:
                            val = str(p_row.id)
                    elif field == "company_id" and val:
                        c_row = db_get(db, Company, val)
                        if c_row:
                            val = str(c_row.id)
                    setattr(contact, field, val)

        elif et in (EntityType.BROKER, "BROKER"):
            broker = db_get(db, Broker, req.entity_id)
            if not broker:
                raise HTTPException(status_code=404, detail="Target broker not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(broker, field):
                    setattr(broker, field, val)

        elif et in (EntityType.COMMODITY, "COMMODITY"):
            item = db_get(db, Commodity, req.entity_id)
            if not item:
                raise HTTPException(status_code=404, detail="Target commodity not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(item, field):
                    setattr(item, field, val)

        elif et in (EntityType.TAX, "TAX"):
            item = db_get(db, Tax, req.entity_id)
            if not item:
                raise HTTPException(status_code=404, detail="Target tax not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(item, field):
                    if field in ("igst_percent", "cgst_percent", "sgst_percent") and val is not None:
                        val = float(val) if str(val).strip() != "" else None
                    setattr(item, field, val)

        elif et in (EntityType.UNIT, "UNIT"):
            item = db_get(db, Unit, req.entity_id)
            if not item:
                raise HTTPException(status_code=404, detail="Target unit not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(item, field):
                    setattr(item, field, val)

        elif et in (EntityType.PAYMENT_TERM, "PAYMENT_TERM"):
            item = db_get(db, PaymentTerm, req.entity_id)
            if not item:
                raise HTTPException(status_code=404, detail="Target payment term not found.")
            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(item, field):
                    if field == "days" and val is not None:
                        val = int(val) if str(val).strip() != "" else 0
                    setattr(item, field, val)

        elif et in (EntityType.CONTRACT, "CONTRACT"):
            contract = db_get(db, Contract, req.entity_id)
            if not contract:
                raise HTTPException(status_code=404, detail="Target contract not found.")

            FK_MODELS = {
                "company_id": Company,
                "seller_id": Party,
                "buyer_id": Party,
                "commodity_id": Commodity,
                "tax_id": Tax,
                "broker_id": Broker,
                "payment_term_id": PaymentTerm,
                "weightment_unit_id": Unit,
            }

            for field, diff in changes.items():
                val = diff["new"]
                if hasattr(contract, field):
                    if field in FK_MODELS and val:
                        model = FK_MODELS[field]
                        fk_row = db_get(db, model, val)
                        if fk_row:
                            val = str(fk_row.id)
                    elif field in ("rate", "qty_low", "qty_high", "broker_rate", "final_qty") and val is not None:
                        val = float(val) if str(val).strip() != "" else None
                    elif field in ("contract_date", "despatch_from", "despatch_to") and val is not None:
                        if isinstance(val, str) and len(val) >= 10:
                            val = datetime.strptime(val[:10], "%Y-%m-%d").date()
                    setattr(contract, field, val)

        req.status = ApprovalStatus.APPROVED
        req.reviewed_by = reviewer_name or "Kannu"
        req.reviewed_at = datetime.utcnow()
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def reject_request(
        db: Session, request_id: str, reviewer_name: str, reason: str | None = None
    ) -> MasterChangeRequest:
        req = db_get(db, MasterChangeRequest, request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Approval request not found.")
        if req.status != ApprovalStatus.PENDING:
            raise HTTPException(
                status_code=400,
                detail=f"Request is already {req.status.value.lower()}.",
            )

        req.status = ApprovalStatus.REJECTED
        req.reviewed_by = reviewer_name or "Kannu"
        req.reviewed_at = datetime.utcnow()
        req.rejection_reason = reason or "Rejected by supervisor authorization"
        db.commit()
        db.refresh(req)
        return req

from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session, joinedload

from app.models import Contract, Despatch, Party
from app.models.enums import BillingStatus, ContractStatus
from app.schemas.despatch import DespatchCreate
from app.services.contract_service import ContractService
from app.services.sequence_service import SequenceService
from app.utils.ids import as_db_id, db_get


class DespatchService:
    @staticmethod
    def validate_despatch_tolerance(contract: Contract, new_qty: Decimal) -> None:
        balance = ContractService.balance(contract)
        projected = balance["fulfilled_qty"] + new_qty
        if projected > balance["max_allowed_qty"]:
            raise HTTPException(
                status_code=400,
                detail="Dispatch quantity exceeds contractual tolerance boundary.",
            )

    @staticmethod
    def _validate_contract_for_despatch(contract: Contract, despatch_date: date) -> None:
        if not contract.is_active:
            raise HTTPException(status_code=400, detail="Contract is inactive.")
        if contract.status == ContractStatus.CANCELLED:
            raise HTTPException(status_code=400, detail="Cannot despatch against a cancelled contract.")
        if despatch_date < contract.despatch_from or despatch_date > contract.despatch_to:
            raise HTTPException(
                status_code=400,
                detail="Despatch date must fall within the contract despatch period.",
            )

    @classmethod
    def create(cls, db: Session, payload: DespatchCreate) -> Despatch:
        contract = (
            db.query(Contract)
            .filter(Contract.id == as_db_id(payload.contract_id))
            .with_for_update()
            .first()
        )
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")

        cls._validate_contract_for_despatch(contract, payload.despatch_date)
        cls.validate_despatch_tolerance(contract, payload.quantity)

        current_version = contract.version
        new_fulfilled = Decimal(str(contract.fulfilled_qty)) + payload.quantity

        result = db.execute(
            update(Contract)
            .where(Contract.id == contract.id)
            .where(Contract.version == current_version)
            .values(
                fulfilled_qty=new_fulfilled,
                version=current_version + 1,
            )
        )
        if result.rowcount == 0:
            raise HTTPException(
                status_code=409,
                detail="Contract was modified by another user. Please retry.",
            )

        row = Despatch(
            despatch_no=SequenceService.next_code(db, "DESPATCH"),
            despatch_date=payload.despatch_date,
            contract_id=as_db_id(payload.contract_id),
            bags=payload.bags,
            quantity=payload.quantity,
            delivery_type=payload.delivery_type.strip().upper() if payload.delivery_type else None,
            billing_status=BillingStatus.UNBILLED,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def to_detail(despatch: Despatch) -> dict:
        contract = despatch.contract
        return {
            **{c.name: getattr(despatch, c.name) for c in despatch.__table__.columns},
            "contract_no": contract.contract_no if contract else None,
            "commodity_short_name": (
                contract.commodity.comm_short_name if contract and contract.commodity else None
            ),
            "seller_name": contract.seller.name if contract and contract.seller else None,
            "buyer_name": contract.buyer.name if contract and contract.buyer else None,
            "qty_unit": contract.qty_unit.value if contract else None,
        }

    @staticmethod
    def list_unbilled(
        db: Session,
        party_id: UUID,
        from_date: date,
        to_date: date,
    ) -> list[Despatch]:
        party = db_get(db, Party, party_id)
        if not party:
            raise HTTPException(status_code=404, detail="Party not found")

        party_key = as_db_id(party_id)
        return (
            db.query(Despatch)
            .join(Contract, Despatch.contract_id == Contract.id)
            .options(joinedload(Despatch.contract).joinedload(Contract.commodity))
            .filter(
                Despatch.is_active.is_(True),
                Despatch.billing_status == BillingStatus.UNBILLED,
                Despatch.despatch_date >= from_date,
                Despatch.despatch_date <= to_date,
                (Contract.seller_id == party_key) | (Contract.buyer_id == party_key),
            )
            .order_by(Despatch.despatch_date.desc(), Despatch.despatch_no.desc())
            .all()
        )

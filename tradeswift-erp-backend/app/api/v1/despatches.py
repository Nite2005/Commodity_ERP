from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Contract, Despatch
from app.models.enums import BillingStatus
from app.schemas.despatch import (
    DespatchCreate,
    DespatchCreateResponse,
    DespatchDetailResponse,
    DespatchResponse,
    UnbilledDespatchItem,
    UnbilledDespatchResponse,
)
from app.services.despatch_service import DespatchService
from app.utils.ids import as_db_id, db_get

router = APIRouter(prefix="/despatches", tags=["Despatches"])


def _load_despatch(db: Session, despatch_id: str) -> Despatch:
    row = (
        db.query(Despatch)
        .options(
            joinedload(Despatch.contract).joinedload(Contract.seller),
            joinedload(Despatch.contract).joinedload(Contract.buyer),
            joinedload(Despatch.contract).joinedload(Contract.commodity),
        )
        .filter(Despatch.id == as_db_id(despatch_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Despatch not found")
    return row


@router.get("", response_model=list[DespatchResponse])
def list_despatches(
    contract_id: str | None = None,
    billing_status: BillingStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(Despatch)
    if active_only:
        q = q.filter(Despatch.is_active.is_(True))
    if contract_id:
        q = q.filter(Despatch.contract_id == as_db_id(contract_id))
    if billing_status:
        q = q.filter(Despatch.billing_status == billing_status)
    if date_from:
        q = q.filter(Despatch.despatch_date >= date_from)
    if date_to:
        q = q.filter(Despatch.despatch_date <= date_to)
    return q.order_by(Despatch.despatch_date.desc(), Despatch.despatch_no.desc()).all()


@router.get("/unbilled", response_model=UnbilledDespatchResponse)
def list_unbilled_despatches(
    party_id: UUID = Query(..., description="Party UUID (seller or buyer on contract)"),
    from_date: date = Query(..., alias="fromDate"),
    to_date: date = Query(..., alias="toDate"),
    db: Session = Depends(get_db),
):
    if to_date < from_date:
        raise HTTPException(status_code=400, detail="To date must be on or after from date.")
    rows = DespatchService.list_unbilled(db, party_id, from_date, to_date)
    return UnbilledDespatchResponse(
        party_id=party_id,
        unbilled_records=[
            UnbilledDespatchItem(
                id=row.id,
                despatch_no=row.despatch_no,
                despatch_date=row.despatch_date,
                contract_no=row.contract.contract_no,
                contract_id=row.contract_id,
                commodity_short_name=(
                    row.contract.commodity.comm_short_name if row.contract.commodity else None
                ),
                bags=row.bags,
                quantity=row.quantity,
                qty_unit=row.contract.qty_unit.value,
                rate=row.contract.rate,
                line_base_amount=Decimal(str(row.quantity)) * Decimal(str(row.contract.rate)),
                delivery_type=row.delivery_type,
            )
            for row in rows
        ],
    )


@router.get("/{despatch_id}", response_model=DespatchDetailResponse)
def get_despatch(despatch_id: str, db: Session = Depends(get_db)):
    row = _load_despatch(db, despatch_id)
    return DespatchService.to_detail(row)


@router.post("", response_model=DespatchCreateResponse, status_code=201)
def create_despatch(payload: DespatchCreate, db: Session = Depends(get_db)):
    row = DespatchService.create(db, payload)
    return DespatchCreateResponse(despatch_no=row.despatch_no, id=row.id)


@router.delete("/{despatch_id}", status_code=204)
def deactivate_despatch(despatch_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Despatch, despatch_id)
    if not row:
        raise HTTPException(status_code=404, detail="Despatch not found")
    if row.billing_status == BillingStatus.BILLED:
        raise HTTPException(status_code=400, detail="Billed despatches cannot be deactivated.")
    if not row.is_active:
        return

    contract = (
        db.query(Contract)
        .filter(Contract.id == row.contract_id)
        .with_for_update()
        .first()
    )
    if contract:
        new_fulfilled = max(
            0,
            float(Decimal(str(contract.fulfilled_qty)) - Decimal(str(row.quantity))),
        )
        contract.fulfilled_qty = new_fulfilled
        contract.version += 1

    row.is_active = False
    db.commit()

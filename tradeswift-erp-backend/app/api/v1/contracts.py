from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Contract
from app.models.enums import ContractStatus
from app.schemas.contract import (
    ContractBalanceResponse,
    ContractClosure,
    ContractCreate,
    ContractCreateResponse,
    ContractDetailResponse,
    ContractResponse,
    ContractUpdate,
)
from app.services.contract_service import ContractService
from app.utils.ids import as_db_id, db_get

router = APIRouter(prefix="/contracts", tags=["Contracts"])


def _load_contract(db: Session, contract_id: str) -> Contract:
    row = (
        db.query(Contract)
        .options(
            joinedload(Contract.company),
            joinedload(Contract.seller),
            joinedload(Contract.buyer),
            joinedload(Contract.commodity),
            joinedload(Contract.tax),
            joinedload(Contract.broker),
            joinedload(Contract.payment_term),
            joinedload(Contract.weightment_unit),
        )
        .filter(Contract.id == as_db_id(contract_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    return row


@router.get("", response_model=list[ContractResponse])
def list_contracts(
    status: ContractStatus | None = None,
    company_id: str | None = Query(default=None, description="Filter by company"),
    party_id: str | None = Query(default=None, description="Filter by seller or buyer"),
    date_from: date | None = None,
    date_to: date | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(Contract)
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
    return q.order_by(Contract.contract_date.desc(), Contract.contract_no.desc()).all()


@router.get("/{contract_id}", response_model=ContractDetailResponse)
def get_contract(contract_id: str, db: Session = Depends(get_db)):
    row = _load_contract(db, contract_id)
    return ContractService.to_detail(row)


@router.post("", response_model=ContractCreateResponse, status_code=201)
def create_contract(payload: ContractCreate, db: Session = Depends(get_db)):
    row = ContractService.create(db, payload)
    return ContractCreateResponse(contract_no=row.contract_no, id=row.id)


@router.put("/{contract_id}", response_model=ContractDetailResponse)
def update_contract(
    contract_id: str, payload: ContractUpdate, db: Session = Depends(get_db)
):
    ContractService.update(db, contract_id, payload)
    row = _load_contract(db, contract_id)
    return ContractService.to_detail(row)


@router.patch("/{contract_id}/closure", response_model=ContractDetailResponse)
def close_contract(
    contract_id: str, payload: ContractClosure, db: Session = Depends(get_db)
):
    ContractService.close_contract(db, contract_id, payload.final_qty)
    row = _load_contract(db, contract_id)
    return ContractService.to_detail(row)


@router.get("/{contract_id}/balance", response_model=ContractBalanceResponse)
def contract_balance(contract_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Contract, contract_id)
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    return ContractService.balance(row)

from datetime import date, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Contract, MasterChangeRequest
from app.models.enums import ApprovalStatus, ContractStatus, EntityType
from app.schemas.contract import (
    ContractBalanceResponse,
    ContractClosure,
    ContractCreate,
    ContractCreateResponse,
    ContractDetailResponse,
    ContractResponse,
    ContractUpdate,
)
from app.services.approval_service import ApprovalService
from app.services.contract_service import ContractService
from app.api.v1.masters import is_admin_requester
from app.utils.ids import as_db_id, db_get, uuid_variants

router = APIRouter(prefix="/contracts", tags=["Contracts"])


def _load_contract(db: Session, contract_id: str) -> Contract:
    variants = uuid_variants(contract_id)
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
        .filter((Contract.id.in_(variants)) | (Contract.contract_no == contract_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Contract not found")
    return row


@router.get("", response_model=list[ContractResponse])
def list_contracts(
    status: ContractStatus | None = None,
    company_id: str | None = Query(default=None, description="Filter by company"),
    party_id: str | None = Query(default=None, description="Filter by seller or buyer (single or comma-separated)"),
    party_ids: list[str] | None = Query(default=None, description="Filter by multiple seller or buyer parties"),
    date_from: date | None = None,
    date_to: date | None = None,
    active_only: bool = True,
    sort_asc: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(Contract)
    if active_only:
        q = q.filter(Contract.is_active.is_(True))
    if status:
        q = q.filter(Contract.status == status)
    if company_id:
        q = q.filter(Contract.company_id.in_(uuid_variants(company_id)))

    # Collect all party IDs from both party_id and party_ids
    all_party_ids: list[str] = []
    if party_id:
        for p in party_id.split(","):
            p_clean = p.strip()
            if p_clean and p_clean not in all_party_ids:
                all_party_ids.append(p_clean)
    if party_ids:
        for item in party_ids:
            for p in item.split(","):
                p_clean = p.strip()
                if p_clean and p_clean not in all_party_ids:
                    all_party_ids.append(p_clean)

    if all_party_ids:
        party_variants: list[str] = []
        for p in all_party_ids:
            party_variants.extend(uuid_variants(p))
        q = q.filter((Contract.seller_id.in_(party_variants)) | (Contract.buyer_id.in_(party_variants)))

    if date_from:
        q = q.filter(Contract.contract_date >= date_from)
    if date_to:
        q = q.filter(Contract.contract_date <= date_to)

    if sort_asc:
        return q.order_by(Contract.contract_date.asc(), Contract.contract_no.asc()).all()
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
    contract_id: str,
    payload: ContractUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    row = _load_contract(db, contract_id)
    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)
    data = payload.model_dump(exclude_unset=True)

    FIELD_LABELS = {
        "contract_no": "Contract #",
        "contract_date": "Contract Date",
        "seller_id": "Seller",
        "buyer_id": "Buyer",
        "commodity_id": "Commodity",
        "qty_low": "Quantity Low",
        "qty_high": "Quantity High",
        "qty_unit": "Quantity Unit",
        "rate": "Trading Rate",
        "broker_id": "Broker",
        "broker_rate": "Brokerage Rate",
        "broker_rate_type": "Brokerage Type",
        "payment_term_id": "Payment Term",
        "tax_id": "Tax",
        "despatch_from": "Despatch From Date",
        "despatch_to": "Despatch To Date",
        "notes": "Notes / Terms",
    }
    diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            old_s = str(old_val or "").strip()
            new_s = str(new_val or "").strip()
            if f.endswith("_id") and old_s.replace("-", "").lower() == new_s.replace("-", "").lower():
                continue
            if old_s != new_s:
                diffs[f] = {
                    "old": str(old_val) if old_val is not None else "",
                    "new": str(new_val) if new_val is not None else "",
                    "label": FIELD_LABELS.get(f, f.replace("_", " ").title()),
                }

    if not is_supervisor:
        if diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.CONTRACT,
                entity_id=str(row.id),
                entity_name=f"Contract #{row.contract_no}",
                change_summary=f"Edit contract #{row.contract_no} ({', '.join(diffs.keys())})",
                changes_dict=diffs,
                requested_by=x_requested_by or "Employee",
            )
        return ContractService.to_detail(row)
    else:
        ContractService.update(db, contract_id, payload)
        existing_reqs = (
            db.query(MasterChangeRequest)
            .filter(
                MasterChangeRequest.entity_type == EntityType.CONTRACT,
                MasterChangeRequest.entity_id.in_([str(row.id), str(row.id).replace("-", "")]),
                MasterChangeRequest.status == ApprovalStatus.PENDING,
            )
            .all()
        )
        for req in existing_reqs:
            req.status = ApprovalStatus.APPROVED
            req.reviewed_by = x_requested_by or x_supervisor_approval or "Admin"
            req.reviewed_at = datetime.utcnow()
        db.commit()
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

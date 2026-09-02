from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Bill, BillLineItem, Contract
from app.schemas.bill import BillCreate, BillCreateResponse, BillDetailResponse, BillResponse
from app.services.billing_service import BillingService
from app.utils.ids import as_db_id

router = APIRouter(prefix="/bills", tags=["Bills"])


def _load_bill(db: Session, bill_id: str) -> Bill:
    row = (
        db.query(Bill)
        .options(
            joinedload(Bill.party),
            joinedload(Bill.tax),
            joinedload(Bill.line_items).joinedload(BillLineItem.despatch),
            joinedload(Bill.line_items).joinedload(BillLineItem.contract).joinedload(
                Contract.commodity
            ),
            joinedload(Bill.line_items).joinedload(BillLineItem.contract).joinedload(
                Contract.seller
            ),
            joinedload(Bill.line_items).joinedload(BillLineItem.contract).joinedload(
                Contract.buyer
            ),
        )
        .filter(Bill.id == as_db_id(bill_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Bill not found")
    return row


@router.get("", response_model=list[BillResponse])
def list_bills(
    party_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(Bill)
    if active_only:
        q = q.filter(Bill.is_active.is_(True))
    if party_id:
        q = q.filter(Bill.party_id == as_db_id(party_id))
    if date_from:
        q = q.filter(Bill.bill_date >= date_from)
    if date_to:
        q = q.filter(Bill.bill_date <= date_to)
    return q.order_by(Bill.bill_date.desc(), Bill.bill_no.desc()).all()


@router.get("/{bill_id}", response_model=BillDetailResponse)
def get_bill(bill_id: str, db: Session = Depends(get_db)):
    row = _load_bill(db, bill_id)
    return BillingService.to_detail(row)


@router.post("", response_model=BillCreateResponse, status_code=201)
def create_bill(payload: BillCreate, db: Session = Depends(get_db)):
    row = BillingService.generate(db, payload)
    return BillCreateResponse(bill_no=row.bill_no, id=row.id)

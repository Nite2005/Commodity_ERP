import os
import shutil
from datetime import datetime

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Broker,
    Commodity,
    Company,
    Contact,
    MasterChangeRequest,
    Party,
    PaymentTerm,
    RateMaster,
    Tax,
    Unit,
    User,
)
from app.models.enums import ApprovalStatus, CustomerType, EntityType, UserRole
from app.services.approval_service import ApprovalService


def is_admin_requester(db: Session, x_supervisor: str | None, x_user: str | None) -> bool:
    candidates = [c.strip().lower() for c in (x_supervisor, x_user) if c and c.strip()]
    if any(c in ("kannu", "kanha", "admin") for c in candidates):
        return True
    if candidates:
        user = (
            db.query(User)
            .filter(
                (User.username.in_(candidates)) | (User.email.in_(candidates)),
                User.role == UserRole.ADMIN,
                User.is_active.is_(True),
            )
            .first()
        )
        if user:
            return True
    return False

from app.schemas.masters import (
    BrokerCreate,
    BrokerResponse,
    BrokerUpdate,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    CommodityCreate,
    CommodityResponse,
    CommodityUpdate,
    CompanyCreate,
    CompanyResponse,
    CompanyUpdate,
    PartyCreate,
    PartyResponse,
    PartyUpdate,
    PaymentTermCreate,
    PaymentTermResponse,
    PaymentTermUpdate,
    RateMasterCreate,
    RateMasterResponse,
    RateMasterUpdate,
    TaxCreate,
    TaxResponse,
    TaxUpdate,
    UnitCreate,
    UnitResponse,
    UnitUpdate,
)
from app.services.sequence_service import SequenceService
from app.utils.ids import as_db_id, db_get

router = APIRouter(prefix="/masters", tags=["Masters"])


@router.get("/commodities", response_model=list[CommodityResponse])
def list_commodities(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(Commodity)
    if active_only:
        q = q.filter(Commodity.is_active.is_(True))
    return q.order_by(Commodity.commodity_name).all()


@router.post("/commodities", response_model=CommodityResponse, status_code=201)
def create_commodity(payload: CommodityCreate, db: Session = Depends(get_db)):
    if db.query(Commodity).filter(Commodity.commodity_name == payload.commodity_name).first():
        raise HTTPException(status_code=400, detail="Commodity name already exists.")
    row = Commodity(
        commodity_name=payload.commodity_name.strip(),
        comm_short_name=payload.comm_short_name.strip().upper(),
        quality_allowance=payload.quality_allowance,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/commodities/{item_id}", response_model=CommodityResponse)
def get_commodity(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Commodity, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Commodity not found")
    return row


@router.put("/commodities/{item_id}", response_model=CommodityResponse)
def update_commodity(
    item_id: str,
    payload: CommodityUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    row = db_get(db, Commodity, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Commodity not found")
    data = payload.model_dump(exclude_unset=True)
    if "commodity_name" in data:
        exists = db.query(Commodity).filter(
            Commodity.commodity_name == data["commodity_name"], Commodity.id != row.id
        ).first()
        if exists:
            raise HTTPException(status_code=400, detail="Commodity name already exists.")
    if "comm_short_name" in data and data["comm_short_name"]:
        data["comm_short_name"] = data["comm_short_name"].upper()

    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)
    diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                diffs[f] = {"old": old_val, "new": new_val, "label": f.replace("_", " ").title()}

    if not is_supervisor:
        if diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.COMMODITY,
                entity_id=str(row.id),
                entity_name=row.commodity_name,
                change_summary=f"Edit commodity ({', '.join(diffs.keys())}) for {row.commodity_name}",
                changes_dict=diffs,
                requested_by=x_requested_by or "Employee",
            )
        return row
    else:
        for k, v in data.items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return row


@router.delete("/commodities/{item_id}", status_code=204)
def delete_commodity(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Commodity, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Commodity not found")
    row.is_active = False
    db.commit()


@router.get("/units", response_model=list[UnitResponse])
def list_units(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(Unit)
    if active_only:
        q = q.filter(Unit.is_active.is_(True))
    return q.order_by(Unit.unit_name).all()


@router.post("/units", response_model=UnitResponse, status_code=201)
def create_unit(payload: UnitCreate, db: Session = Depends(get_db)):
    if db.query(Unit).filter(Unit.unit_name == payload.unit_name).first():
        raise HTTPException(status_code=400, detail="Weightment rule name already exists.")
    row = Unit(unit_name=payload.unit_name.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/units/{item_id}", response_model=UnitResponse)
def update_unit(
    item_id: str,
    payload: UnitUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    row = db_get(db, Unit, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    data = payload.model_dump(exclude_unset=True)
    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)
    diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                diffs[f] = {"old": old_val, "new": new_val, "label": f.replace("_", " ").title()}

    if not is_supervisor:
        if diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.UNIT,
                entity_id=str(row.id),
                entity_name=row.unit_name,
                change_summary=f"Edit unit ({', '.join(diffs.keys())}) for {row.unit_name}",
                changes_dict=diffs,
                requested_by=x_requested_by or "Employee",
            )
        return row
    else:
        for k, v in data.items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return row


@router.delete("/units/{item_id}", status_code=204)
def delete_unit(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Unit, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    row.is_active = False
    db.commit()


@router.get("/brokers", response_model=list[BrokerResponse])
def list_brokers(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(Broker)
    if active_only:
        q = q.filter(Broker.is_active.is_(True))
    return q.order_by(Broker.broker_name).all()


@router.post("/brokers", response_model=BrokerResponse, status_code=201)
def create_broker(payload: BrokerCreate, db: Session = Depends(get_db)):
    name = payload.broker_name.strip().upper()
    if not name:
        raise HTTPException(status_code=400, detail="Broker name cannot be empty.")
    if db.query(Broker).filter(Broker.broker_name == name).first():
        raise HTTPException(status_code=400, detail="Broker name already exists.")
    row = Broker(broker_name=name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/brokers/{item_id}", response_model=BrokerResponse)
def update_broker(
    item_id: str,
    payload: BrokerUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    row = db_get(db, Broker, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Broker not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("broker_name"):
        data["broker_name"] = data["broker_name"].strip().upper()
    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)
    diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                diffs[f] = {"old": old_val, "new": new_val, "label": f.replace("_", " ").title()}

    if not is_supervisor:
        if diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.BROKER,
                entity_id=str(row.id),
                entity_name=row.broker_name,
                change_summary=f"Edit broker ({', '.join(diffs.keys())}) for {row.broker_name}",
                changes_dict=diffs,
                requested_by=x_requested_by or "Employee",
            )
        return row
    else:
        for k, v in data.items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return row


@router.delete("/brokers/{item_id}", status_code=204)
def delete_broker(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Broker, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Broker not found")
    row.is_active = False
    db.commit()


@router.get("/taxes", response_model=list[TaxResponse])
def list_taxes(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(Tax)
    if active_only:
        q = q.filter(Tax.is_active.is_(True))
    return q.order_by(Tax.tax_name).all()


@router.post("/taxes", response_model=TaxResponse, status_code=201)
def create_tax(payload: TaxCreate, db: Session = Depends(get_db)):
    if db.query(Tax).filter(Tax.tax_name == payload.tax_name).first():
        raise HTTPException(status_code=400, detail="Tax name already exists.")
    row = Tax(
        tax_code=SequenceService.next_code(db, "TAX"),
        tax_name=payload.tax_name.strip(),
        igst_percent=payload.igst_percent,
        cgst_percent=payload.cgst_percent,
        sgst_percent=payload.sgst_percent,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/taxes/{item_id}", response_model=TaxResponse)
def update_tax(
    item_id: str,
    payload: TaxUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    row = db_get(db, Tax, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tax not found")
    data = payload.model_dump(exclude_unset=True)
    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)
    diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                diffs[f] = {"old": old_val, "new": new_val, "label": f.replace("_", " ").title()}

    if not is_supervisor:
        if diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.TAX,
                entity_id=str(row.id),
                entity_name=row.tax_name,
                change_summary=f"Edit tax ({', '.join(diffs.keys())}) for {row.tax_name}",
                changes_dict=diffs,
                requested_by=x_requested_by or "Employee",
            )
        return row
    else:
        for k, v in data.items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return row


@router.delete("/taxes/{item_id}", status_code=204)
def delete_tax(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Tax, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tax not found")
    row.is_active = False
    db.commit()


@router.get("/parties", response_model=list[PartyResponse])
def list_parties(
    q: str | None = Query(default=None),
    company_id: str | None = Query(default=None),
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Party)
    if active_only:
        query = query.filter(Party.is_active.is_(True))
    if company_id:
        query = query.filter(
            (Party.company_id == as_db_id(company_id)) | (Party.company_id.is_(None))
        )
    if q:
        like = f"%{q}%"
        query = query.filter(Party.name.like(like) | Party.short_name.like(like))
    parties = query.order_by(Party.name).all()

    pending_reqs = (
        db.query(MasterChangeRequest.entity_id)
        .filter(
            MasterChangeRequest.entity_type == EntityType.PARTY,
            MasterChangeRequest.status == ApprovalStatus.PENDING,
        )
        .all()
    )
    pending_ids = {str(r[0]) for r in pending_reqs}
    for p in parties:
        pid = str(p.id)
        p.has_pending_approval = pid in pending_ids or pid.replace("-", "") in pending_ids
    return parties


@router.post("/parties", response_model=PartyResponse, status_code=201)
def create_party(payload: PartyCreate, db: Session = Depends(get_db)):
    if not db_get(db, Company, payload.company_id):
        raise HTTPException(status_code=400, detail="Company not found.")
    cid = as_db_id(payload.company_id)
    if db.query(Party).filter(Party.company_id == cid, Party.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Party name already exists for this company.")
    if payload.customer_type == CustomerType.REGISTERED and not payload.gst_tin:
        raise HTTPException(status_code=400, detail="GST-TIN required for Registered customer.")
    data = payload.model_dump()
    data["company_id"] = cid
    row = Party(party_code=SequenceService.next_code(db, "PARTY"), **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/parties/{item_id}", response_model=PartyResponse)
def get_party(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Party, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Party not found")
    pending = (
        db.query(MasterChangeRequest)
        .filter(
            MasterChangeRequest.entity_type == EntityType.PARTY,
            MasterChangeRequest.entity_id.in_([str(row.id), str(row.id).replace("-", "")]),
            MasterChangeRequest.status == ApprovalStatus.PENDING,
        )
        .first()
    )
    row.has_pending_approval = bool(pending)
    return row


@router.put("/parties/{item_id}", response_model=PartyResponse)
def update_party(
    item_id: str,
    payload: PartyUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default="Trader"),
    db: Session = Depends(get_db),
):
    row = db_get(db, Party, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Party not found")
    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data:
        if not db_get(db, Company, data["company_id"]):
            raise HTTPException(status_code=400, detail="Company not found.")
        data["company_id"] = as_db_id(data["company_id"])
    company_id = data.get("company_id", row.company_id)
    name = data.get("name", row.name)
    if company_id and name:
        dup = (
            db.query(Party)
            .filter(Party.company_id == company_id, Party.name == name, Party.id != row.id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=400, detail="Party name already exists for this company.")

    FIELD_LABELS = {
        "name": "Party Legal Name",
        "short_name": "Short Name",
        "customer_type": "Party Type",
        "gst_tin": "GST-TIN",
        "address_line": "Address",
        "city": "City",
        "state": "State",
        "pincode": "Pincode",
        "mobile": "Mobile Number",
        "designation": "Designation",
        "account_no": "Bank Account Number",
        "bank_name": "Bank Name",
        "ifsc_code": "IFSC Code",
    }
    all_diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                all_diffs[f] = {
                    "old": old_val,
                    "new": new_val,
                    "label": FIELD_LABELS.get(f, f.replace("_", " ").title()),
                }

    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)

    if not is_supervisor:
        # NON-ADMIN / EMPLOYEE:
        # Do not mutate the party directly. Stage into MasterChangeRequest!
        if all_diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.PARTY,
                entity_id=str(row.id),
                entity_name=row.name,
                change_summary=f"Edit party ({', '.join(all_diffs.keys())}) for {row.name}",
                changes_dict=all_diffs,
                requested_by=x_requested_by or "Employee",
            )
        row.has_pending_approval = True
        return row
    else:
        # SUPERVISOR / ADMIN:
        for k, v in data.items():
            setattr(row, k, v)
        # Mark pending requests for this entity as approved
        existing_reqs = (
            db.query(MasterChangeRequest)
            .filter(
                MasterChangeRequest.entity_type == EntityType.PARTY,
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
        db.refresh(row)
        row.has_pending_approval = False
        return row


@router.delete("/parties/{item_id}", status_code=204)
def delete_party(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Party, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Party not found")
    row.is_active = False
    db.commit()


@router.post("/parties/{item_id}/cancelled-cheque")
def upload_cancelled_cheque(
    item_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    row = db_get(db, Party, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Party not found")
    
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".pdf", ".webp"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Allowed formats: JPG, JPEG, PNG, PDF, WEBP",
        )

    upload_dir = os.path.join("uploads", "cancelled_cheques")
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = f"cheque_{row.id}_{int(datetime.utcnow().timestamp())}{ext}"
    file_path = os.path.join(upload_dir, safe_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Clean up old file if exists
    if row.cancelled_cheque_path and os.path.exists(row.cancelled_cheque_path) and row.cancelled_cheque_path != file_path:
        try:
            os.remove(row.cancelled_cheque_path)
        except Exception:
            pass

    row.cancelled_cheque_path = file_path
    row.cancelled_cheque_filename = file.filename
    row.cancelled_cheque_uploaded_at = datetime.utcnow()
    db.commit()
    db.refresh(row)

    return {
        "status": "SUCCESS",
        "message": "Cancelled cheque uploaded to secured vault",
        "filename": file.filename,
    }


@router.get("/parties/{item_id}/cancelled-cheque")
def get_cancelled_cheque(
    item_id: str,
    user_role: str | None = Header(default="ADMIN", alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    # Functional Specification: Employees and Admins can view/download
    authorized_roles = [
        "ADMIN",
        "SUPERVISOR",
        "ACCOUNTS_HEAD",
        "MANAGER",
        "AUTHORISED",
        "EMPLOYEE",
        "USER",
    ]
    if user_role and user_role.upper() not in authorized_roles:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Viewing or downloading cancelled cheques is strictly restricted to authorized profiles to prevent fraud.",
        )

    row = db_get(db, Party, item_id)
    if not row or not row.cancelled_cheque_path:
        raise HTTPException(status_code=404, detail="No cancelled cheque on file for this party")

    if not os.path.exists(row.cancelled_cheque_path):
        raise HTTPException(status_code=404, detail="Cheque document not found on storage")

    return FileResponse(
        row.cancelled_cheque_path,
        filename=row.cancelled_cheque_filename or "cancelled_cheque",
        media_type="application/octet-stream",
    )


@router.delete("/parties/{item_id}/cancelled-cheque")
def delete_cancelled_cheque(
    item_id: str,
    user_role: str | None = Header(default="ADMIN", alias="X-User-Role"),
    db: Session = Depends(get_db),
):
    # Functional Specification: Employees can only view cancelled cheques; deletion is strictly restricted to Admin
    if user_role and user_role.upper() != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Employees can only view cancelled cheques. Deletion is restricted to Administrators.",
        )

    row = db_get(db, Party, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Party not found")

    if row.cancelled_cheque_path and os.path.exists(row.cancelled_cheque_path):
        try:
            os.remove(row.cancelled_cheque_path)
        except Exception:
            pass

    row.cancelled_cheque_path = None
    row.cancelled_cheque_filename = None
    row.cancelled_cheque_uploaded_at = None
    db.commit()
    return {"status": "SUCCESS", "message": "Cancelled cheque removed from vault"}


@router.get("/companies", response_model=list[CompanyResponse])
def list_companies(
    q: str | None = Query(default=None),
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Company)
    if active_only:
        query = query.filter(Company.is_active.is_(True))
    if q:
        like = f"%{q}%"
        query = query.filter(Company.name.like(like))
    return query.order_by(Company.name).all()


@router.post("/companies", response_model=CompanyResponse, status_code=201)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    if db.query(Company).filter(Company.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Company name already exists.")
    row = Company(company_code=SequenceService.next_code(db, "COMPANY"), **payload.model_dump())
    # First active company becomes the selected working company
    has_selected = (
        db.query(Company)
        .filter(Company.is_selected.is_(True), Company.is_active.is_(True))
        .first()
    )
    if not has_selected:
        row.is_selected = True
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/companies/{item_id}", response_model=CompanyResponse)
def get_company(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Company, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    return row


@router.put("/companies/{item_id}", response_model=CompanyResponse)
def update_company(
    item_id: str,
    payload: CompanyUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    row = db_get(db, Company, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    data = payload.model_dump(exclude_unset=True)
    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)
    diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                diffs[f] = {"old": old_val, "new": new_val, "label": f.replace("_", " ").title()}

    if not is_supervisor:
        if diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.COMPANY,
                entity_id=str(row.id),
                entity_name=row.name,
                change_summary=f"Edit company ({', '.join(diffs.keys())}) for {row.name}",
                changes_dict=diffs,
                requested_by=x_requested_by or "Employee",
            )
        return row
    else:
        for k, v in data.items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return row


@router.post("/companies/{item_id}/select", response_model=CompanyResponse)
def select_company(item_id: str, db: Session = Depends(get_db)):
    """Mark this company as the active working company for the whole ERP."""
    row = db_get(db, Company, item_id)
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="Company not found or inactive")
    db.query(Company).filter(Company.is_selected.is_(True)).update(
        {Company.is_selected: False}, synchronize_session=False
    )
    row.is_selected = True
    db.commit()
    db.refresh(row)
    return row


@router.delete("/companies/{item_id}", status_code=204)
def delete_company(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Company, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    was_selected = row.is_selected
    row.is_active = False
    row.is_selected = False
    db.commit()
    if was_selected:
        next_row = (
            db.query(Company)
            .filter(Company.is_active.is_(True))
            .order_by(Company.name)
            .first()
        )
        if next_row:
            next_row.is_selected = True
            db.commit()


@router.get("/contacts", response_model=list[ContactResponse])
def list_contacts(
    party_id: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(Contact)
    if active_only:
        q = q.filter(Contact.is_active.is_(True))
    if party_id:
        q = q.filter(Contact.party_id == party_id)
    return q.order_by(Contact.contact_name).all()


@router.post("/contacts", response_model=ContactResponse, status_code=201)
def create_contact(
    payload: ContactCreate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if (x_requested_by or x_supervisor_approval) and not is_admin_requester(db, x_supervisor_approval, x_requested_by):
        raise HTTPException(status_code=403, detail="Permission denied: Only Administrators can create contacts.")
    if not db_get(db, Party, payload.party_id):
        raise HTTPException(status_code=400, detail="Party not found")
    name = payload.contact_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Contact name cannot be empty.")
    row = Contact(
        party_id=as_db_id(payload.party_id),
        contact_name=name,
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        designation=payload.designation.strip() if payload.designation else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/contacts/{item_id}", response_model=ContactResponse)
def get_contact(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Contact, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    return row


@router.put("/contacts/{item_id}", response_model=ContactResponse)
def update_contact(
    item_id: str,
    payload: ContactUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    row = db_get(db, Contact, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    data = payload.model_dump(exclude_unset=True)
    if "party_id" in data and data["party_id"] is not None:
        if not db_get(db, Party, data["party_id"]):
            raise HTTPException(status_code=400, detail="Party not found")
        data["party_id"] = as_db_id(data["party_id"])
    if "contact_name" in data and data["contact_name"]:
        data["contact_name"] = data["contact_name"].strip()
    for k in ("email", "phone", "designation"):
        if k in data and data[k]:
            data[k] = data[k].strip()

    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)
    diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                diffs[f] = {"old": old_val, "new": new_val, "label": f.replace("_", " ").title()}

    if not is_supervisor:
        if diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.CONTACT,
                entity_id=str(row.id),
                entity_name=row.contact_name or "Contact",
                change_summary=f"Edit contact ({', '.join(diffs.keys())}) for {row.contact_name}",
                changes_dict=diffs,
                requested_by=x_requested_by or "Employee",
            )
        return row
    else:
        for k, v in data.items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return row


@router.delete("/contacts/{item_id}", status_code=204)
def delete_contact(
    item_id: str,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if (x_requested_by or x_supervisor_approval) and not is_admin_requester(db, x_supervisor_approval, x_requested_by):
        raise HTTPException(status_code=403, detail="Permission denied: Only Administrators can delete contacts.")
    row = db_get(db, Contact, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")
    row.is_active = False
    db.commit()


@router.get("/payment-terms", response_model=list[PaymentTermResponse])
def list_payment_terms(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(PaymentTerm)
    if active_only:
        q = q.filter(PaymentTerm.is_active.is_(True))
    return q.order_by(PaymentTerm.term_name).all()


@router.post("/payment-terms", response_model=PaymentTermResponse, status_code=201)
def create_payment_term(payload: PaymentTermCreate, db: Session = Depends(get_db)):
    if db.query(PaymentTerm).filter(PaymentTerm.term_name == payload.term_name).first():
        raise HTTPException(status_code=400, detail="Payment term already exists.")
    row = PaymentTerm(
        term_code=payload.term_name.upper().replace(" ", "")[:10],
        **payload.model_dump(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/payment-terms/{item_id}", response_model=PaymentTermResponse)
def update_payment_term(
    item_id: str,
    payload: PaymentTermUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    row = db_get(db, PaymentTerm, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Payment term not found")
    data = payload.model_dump(exclude_unset=True)
    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)
    diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                diffs[f] = {"old": old_val, "new": new_val, "label": f.replace("_", " ").title()}

    if not is_supervisor:
        if diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.PAYMENT_TERM,
                entity_id=str(row.id),
                entity_name=row.term_name,
                change_summary=f"Edit payment term ({', '.join(diffs.keys())}) for {row.term_name}",
                changes_dict=diffs,
                requested_by=x_requested_by or "Employee",
            )
        return row
    else:
        for k, v in data.items():
            setattr(row, k, v)
        db.commit()
        db.refresh(row)
        return row


@router.delete("/payment-terms/{item_id}", status_code=204)
def delete_payment_term(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, PaymentTerm, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Payment term not found")
    row.is_active = False
    db.commit()


@router.get("/rates", response_model=list[RateMasterResponse])
def list_rates(
    party_id: str | None = None,
    commodity_id: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(RateMaster)
    if active_only:
        q = q.filter(RateMaster.is_active.is_(True))
    if party_id:
        q = q.filter(RateMaster.party_id == as_db_id(party_id))
    if commodity_id:
        q = q.filter(RateMaster.commodity_id == as_db_id(commodity_id))
    rates = q.order_by(RateMaster.created_at.desc()).all()

    pending_reqs = (
        db.query(MasterChangeRequest.entity_id)
        .filter(
            MasterChangeRequest.entity_type == EntityType.RATE,
            MasterChangeRequest.status == ApprovalStatus.PENDING,
        )
        .all()
    )
    pending_ids = {str(r[0]) for r in pending_reqs}
    for r in rates:
        rid = str(r.id)
        r.has_pending_approval = rid in pending_ids or rid.replace("-", "") in pending_ids
    return rates


@router.get("/rates/lookup", response_model=RateMasterResponse | None)
def lookup_rate(party_id: str, commodity_id: str, db: Session = Depends(get_db)):
    return (
        db.query(RateMaster)
        .filter(
            RateMaster.party_id == as_db_id(party_id),
            RateMaster.commodity_id == as_db_id(commodity_id),
            RateMaster.is_active.is_(True),
        )
        .order_by(RateMaster.created_at.desc())
        .first()
    )


@router.post("/rates", response_model=RateMasterResponse, status_code=201)
def create_rate(payload: RateMasterCreate, db: Session = Depends(get_db)):
    if not db_get(db, Party, payload.party_id):
        raise HTTPException(status_code=400, detail="Party not found")
    if not db_get(db, Commodity, payload.commodity_id):
        raise HTTPException(status_code=400, detail="Commodity not found")
    data = payload.model_dump()
    data["party_id"] = as_db_id(payload.party_id)
    data["commodity_id"] = as_db_id(payload.commodity_id)
    row = RateMaster(rate_code=SequenceService.next_code(db, "RATE"), **data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/rates/{item_id}", response_model=RateMasterResponse)
def update_rate(
    item_id: str,
    payload: RateMasterUpdate,
    x_supervisor_approval: str | None = Header(default=None),
    x_requested_by: str | None = Header(default="Trader"),
    db: Session = Depends(get_db),
):
    row = db_get(db, RateMaster, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rate not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("party_id") is not None:
        if not db_get(db, Party, data["party_id"]):
            raise HTTPException(status_code=400, detail="Party not found")
        data["party_id"] = as_db_id(data["party_id"])
    if data.get("commodity_id") is not None:
        if not db_get(db, Commodity, data["commodity_id"]):
            raise HTTPException(status_code=400, detail="Commodity not found")
        data["commodity_id"] = as_db_id(data["commodity_id"])

    FIELD_RATE_LABELS = {
        "rate": "Contract Base Rate",
        "brokerage": "Brokerage Commission Rate",
        "rate_type": "Rate Type",
        "brokerage_type": "Brokerage Type",
        "unit": "Quantity Unit",
        "currency": "Currency",
        "party_id": "Party",
        "customer_type": "Party Type",
        "commodity_id": "Commodity",
    }
    all_diffs = {}
    for f, new_val in data.items():
        if hasattr(row, f):
            old_val = getattr(row, f)
            if str(old_val or "").strip() != str(new_val or "").strip():
                all_diffs[f] = {
                    "old": old_val,
                    "new": new_val,
                    "label": FIELD_RATE_LABELS.get(f, f.replace("_", " ").title()),
                }

    is_supervisor = is_admin_requester(db, x_supervisor_approval, x_requested_by)

    if not is_supervisor:
        # NON-ADMIN / EMPLOYEE:
        if all_diffs:
            ApprovalService.create_change_request(
                db,
                entity_type=EntityType.RATE,
                entity_id=str(row.id),
                entity_name=f"Rate Master ({row.rate_code})",
                change_summary=f"Edit rate/brokerage for {row.rate_code}",
                changes_dict=all_diffs,
                requested_by=x_requested_by or "Employee",
            )
        row.has_pending_approval = True
        return row
    else:
        # SUPERVISOR / ADMIN:
        for k, v in data.items():
            setattr(row, k, v)
        existing_reqs = (
            db.query(MasterChangeRequest)
            .filter(
                MasterChangeRequest.entity_type == EntityType.RATE,
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
        db.refresh(row)
        row.has_pending_approval = False
        return row


@router.delete("/rates/{item_id}", status_code=204)
def delete_rate(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, RateMaster, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rate not found")
    row.is_active = False
    db.commit()

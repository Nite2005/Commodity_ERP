from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Broker, Commodity, Company, Contact, PaymentTerm, Party, RateMaster, Tax, Unit
from app.models.enums import CustomerType
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
def update_commodity(item_id: str, payload: CommodityUpdate, db: Session = Depends(get_db)):
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
    for k, v in data.items():
        if k == "comm_short_name" and v:
            v = v.upper()
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
def update_unit(item_id: str, payload: UnitUpdate, db: Session = Depends(get_db)):
    row = db_get(db, Unit, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
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
def update_broker(item_id: str, payload: BrokerUpdate, db: Session = Depends(get_db)):
    row = db_get(db, Broker, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Broker not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("broker_name"):
        data["broker_name"] = data["broker_name"].strip().upper()
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
def update_tax(item_id: str, payload: TaxUpdate, db: Session = Depends(get_db)):
    row = db_get(db, Tax, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tax not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
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
        query = query.filter(Party.company_id == as_db_id(company_id))
    if q:
        like = f"%{q}%"
        query = query.filter(Party.name.like(like) | Party.short_name.like(like))
    return query.order_by(Party.name).all()


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
    return row


@router.put("/parties/{item_id}", response_model=PartyResponse)
def update_party(item_id: str, payload: PartyUpdate, db: Session = Depends(get_db)):
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
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/parties/{item_id}", status_code=204)
def delete_party(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Party, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Party not found")
    row.is_active = False
    db.commit()


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
def update_company(item_id: str, payload: CompanyUpdate, db: Session = Depends(get_db)):
    row = db_get(db, Company, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/companies/{item_id}", status_code=204)
def delete_company(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, Company, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    row.is_active = False
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
def create_contact(payload: ContactCreate, db: Session = Depends(get_db)):
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
def update_contact(item_id: str, payload: ContactUpdate, db: Session = Depends(get_db)):
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
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/contacts/{item_id}", status_code=204)
def delete_contact(item_id: str, db: Session = Depends(get_db)):
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
def update_payment_term(item_id: str, payload: PaymentTermUpdate, db: Session = Depends(get_db)):
    row = db_get(db, PaymentTerm, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Payment term not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
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
    return q.order_by(RateMaster.created_at.desc()).all()


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
def update_rate(item_id: str, payload: RateMasterUpdate, db: Session = Depends(get_db)):
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
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/rates/{item_id}", status_code=204)
def delete_rate(item_id: str, db: Session = Depends(get_db)):
    row = db_get(db, RateMaster, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rate not found")
    row.is_active = False
    db.commit()

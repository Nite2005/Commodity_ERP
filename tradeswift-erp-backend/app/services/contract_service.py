from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Broker, Commodity, Company, Contract, Party, PaymentTerm, Tax, Unit
from app.models.enums import ContractStatus, ContractType
from app.schemas.contract import ContractCreate, ContractUpdate, PrintOptions
from app.services.sequence_service import SequenceService
from app.utils.ids import as_db_id, db_get


class ContractService:
    @staticmethod
    def _require_active_party(db: Session, party_id: UUID, label: str) -> Party:
        row = db_get(db, Party, party_id)
        if not row or not row.is_active:
            raise HTTPException(status_code=400, detail=f"{label} not found or inactive.")
        return row

    @staticmethod
    def _require_active_fk(db: Session, model, entity_id: UUID, label: str):
        row = db_get(db, model, entity_id)
        if not row or not getattr(row, "is_active", True):
            raise HTTPException(status_code=400, detail=f"{label} not found or inactive.")
        return row

    @staticmethod
    def _require_party_for_company(party: Party, company_id: str, label: str) -> None:
        if party.company_id != company_id:
            raise HTTPException(
                status_code=400,
                detail=f"{label} does not belong to the selected company.",
            )

    @staticmethod
    def _validate_parties_for_company(
        seller: Party, buyer: Party, company_id: str
    ) -> None:
        ContractService._require_party_for_company(seller, company_id, "Seller")
        ContractService._require_party_for_company(buyer, company_id, "Buyer")

    @staticmethod
    def _resolve_contract_no(db: Session, contract_no: str | None) -> str:
        if contract_no:
            no = contract_no.strip()
            if db.query(Contract).filter(Contract.contract_no == no).first():
                raise HTTPException(status_code=400, detail="Contract number already exists.")
            return no
        return SequenceService.next_code(db, "CONTRACT")

    @staticmethod
    def _initial_status(contract_type: ContractType) -> ContractStatus:
        if contract_type == ContractType.CANCEL:
            return ContractStatus.CANCELLED
        return ContractStatus.CONTRACT_OPEN

    @staticmethod
    def _apply_print_options(row: Contract, options: PrintOptions | None) -> None:
        if not options:
            return
        row.print_despatch_si = options.despatch_si
        row.print_tr_final_docs = options.tr_final_docs
        row.print_payment = options.payment

    @classmethod
    def create(cls, db: Session, payload: ContractCreate) -> Contract:
        company = cls._require_active_fk(db, Company, payload.company_id, "Company")
        company_id = as_db_id(payload.company_id)
        seller = cls._require_active_party(db, payload.seller_id, "Seller")
        buyer = cls._require_active_party(db, payload.buyer_id, "Buyer")
        cls._validate_parties_for_company(seller, buyer, company_id)
        cls._require_active_fk(db, Commodity, payload.commodity_id, "Commodity")
        cls._require_active_fk(db, Tax, payload.tax_id, "Tax")
        cls._require_active_fk(db, Broker, payload.broker_id, "Broker")
        if payload.payment_term_id:
            cls._require_active_fk(db, PaymentTerm, payload.payment_term_id, "Payment term")
        if payload.weightment_unit_id:
            cls._require_active_fk(db, Unit, payload.weightment_unit_id, "Weightment unit")

        commodity = db_get(db, Commodity, payload.commodity_id)
        quality = payload.quality_allowance
        if quality is None and commodity:
            quality = commodity.quality_allowance

        contract_no = cls._resolve_contract_no(db, payload.contract_no)
        contract_date = payload.contract_date or date.today()

        row = Contract(
            contract_no=contract_no,
            contract_type=payload.contract_type,
            contract_date=contract_date,
            company_id=company_id,
            seller_id=as_db_id(payload.seller_id),
            buyer_id=as_db_id(payload.buyer_id),
            is_nominee=payload.is_nominee,
            commodity_id=as_db_id(payload.commodity_id),
            quality_allowance=quality,
            packing=payload.packing.strip(),
            qty_low=payload.qty_low,
            qty_high=payload.qty_high,
            qty_unit=payload.qty_unit,
            rate=payload.rate,
            currency=payload.currency,
            tax_id=as_db_id(payload.tax_id),
            payment_term_id=as_db_id(payload.payment_term_id) if payload.payment_term_id else None,
            weightment_unit_id=as_db_id(payload.weightment_unit_id) if payload.weightment_unit_id else None,
            despatch_from=payload.despatch_from,
            despatch_to=payload.despatch_to,
            broker_id=as_db_id(payload.broker_id),
            broker_rate=payload.broker_rate,
            status=cls._initial_status(payload.contract_type),
        )
        cls._apply_print_options(row, payload.print_options)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @classmethod
    def update(cls, db: Session, contract_id: str, payload: ContractUpdate) -> Contract:
        row = db_get(db, Contract, contract_id)
        if not row:
            raise HTTPException(status_code=404, detail="Contract not found")
        if row.status != ContractStatus.CONTRACT_OPEN:
            raise HTTPException(status_code=400, detail="Only open contracts can be updated.")

        data = payload.model_dump(exclude_unset=True)
        print_options = data.pop("print_options", None)

        seller_id = data.get("seller_id", row.seller_id)
        buyer_id = data.get("buyer_id", row.buyer_id)
        if str(seller_id) == str(buyer_id):
            raise HTTPException(status_code=400, detail="Seller & Buyer cannot be the same party.")

        company_id = as_db_id(data["company_id"]) if "company_id" in data else row.company_id
        if "company_id" in data:
            cls._require_active_fk(db, Company, data["company_id"], "Company")
            data["company_id"] = company_id

        if company_id:
            seller = db_get(db, Party, seller_id)
            buyer = db_get(db, Party, buyer_id)
            if not seller or not seller.is_active:
                raise HTTPException(status_code=400, detail="Seller not found or inactive.")
            if not buyer or not buyer.is_active:
                raise HTTPException(status_code=400, detail="Buyer not found or inactive.")
            cls._validate_parties_for_company(seller, buyer, company_id)

        despatch_from = data.get("despatch_from", row.despatch_from)
        despatch_to = data.get("despatch_to", row.despatch_to)
        if despatch_to < despatch_from:
            raise HTTPException(
                status_code=400, detail="Despatch To Date must be on or after From Date."
            )

        qty_low = data.get("qty_low", row.qty_low)
        qty_high = data.get("qty_high", row.qty_high)
        if Decimal(str(qty_high)) < Decimal(str(qty_low)):
            raise HTTPException(status_code=400, detail="Qty High must be >= Qty Low.")

        if "contract_no" in data and data["contract_no"]:
            no = data["contract_no"].strip()
            exists = db.query(Contract).filter(
                Contract.contract_no == no, Contract.id != row.id
            ).first()
            if exists:
                raise HTTPException(status_code=400, detail="Contract number already exists.")
            data["contract_no"] = no

        fk_map = {
            "seller_id": ("Seller", Party),
            "buyer_id": ("Buyer", Party),
            "commodity_id": ("Commodity", Commodity),
            "tax_id": ("Tax", Tax),
            "broker_id": ("Broker", Broker),
            "payment_term_id": ("Payment term", PaymentTerm),
            "weightment_unit_id": ("Weightment unit", Unit),
        }
        for field, (label, model) in fk_map.items():
            if field in data and data[field] is not None:
                if field not in ("seller_id", "buyer_id"):
                    cls._require_active_fk(db, model, data[field], label)
                data[field] = as_db_id(data[field])

        if "contract_type" in data:
            row.status = cls._initial_status(data["contract_type"])

        for key, value in data.items():
            setattr(row, key, value)

        if print_options:
            cls._apply_print_options(row, PrintOptions(**print_options))

        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def close_contract(db: Session, contract_id: str, final_qty: Decimal) -> Contract:
        row = db_get(db, Contract, contract_id)
        if not row:
            raise HTTPException(status_code=404, detail="Contract not found")
        if row.status == ContractStatus.CANCELLED:
            raise HTTPException(status_code=400, detail="Cancelled contract cannot be closed.")
        row.final_qty = final_qty
        row.status = ContractStatus.CLOSED
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def billing_quantity(contract: Contract) -> Decimal:
        if contract.final_qty is not None:
            return Decimal(str(contract.final_qty))
        return Decimal(str(contract.qty_high))

    @classmethod
    def balance(cls, contract: Contract) -> dict:
        billing_qty = cls.billing_quantity(contract)
        fulfilled = Decimal(str(contract.fulfilled_qty))
        tolerance = Decimal(str(contract.tolerance_percent))
        max_allowed = billing_qty + (billing_qty * tolerance / Decimal("100"))
        remaining = max(Decimal("0"), billing_qty - fulfilled)
        return {
            "contract_no": contract.contract_no,
            "billing_qty": billing_qty,
            "qty_low": Decimal(str(contract.qty_low)),
            "qty_high": Decimal(str(contract.qty_high)),
            "final_qty": Decimal(str(contract.final_qty)) if contract.final_qty is not None else None,
            "fulfilled_qty": fulfilled,
            "remaining_qty": remaining,
            "max_allowed_qty": max_allowed,
            "tolerance_percent": tolerance,
            "status": contract.status,
        }

    @staticmethod
    def to_detail(contract: Contract) -> dict:
        return {
            **{c.name: getattr(contract, c.name) for c in contract.__table__.columns},
            "seller_name": contract.seller.name if contract.seller else None,
            "buyer_name": contract.buyer.name if contract.buyer else None,
            "company_name": contract.company.name if contract.company else None,
            "commodity_name": contract.commodity.commodity_name if contract.commodity else None,
            "commodity_short_name": (
                contract.commodity.comm_short_name if contract.commodity else None
            ),
            "tax_name": contract.tax.tax_name if contract.tax else None,
            "broker_name": contract.broker.broker_name if contract.broker else None,
            "payment_term_name": (
                contract.payment_term.term_name if contract.payment_term else None
            ),
            "weightment_unit_name": (
                contract.weightment_unit.unit_name if contract.weightment_unit else None
            ),
        }

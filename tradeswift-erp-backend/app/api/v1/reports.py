from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import ContractStatus
from app.schemas.report import ContractRegisterRow, SalesRegisterRow
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])

CONTRACT_CSV_HEADERS = [
    "Contract No",
    "Date",
    "Type",
    "Status",
    "Company",
    "Seller",
    "Buyer",
    "Commodity",
    "Qty Low",
    "Qty High",
    "Final Qty",
    "Unit",
    "Rate",
    "Broker",
    "Broker Rate",
    "Despatch From",
    "Despatch To",
]
CONTRACT_CSV_KEYS = [
    "contract_no",
    "contract_date",
    "contract_type",
    "status",
    "company_name",
    "seller_name",
    "buyer_name",
    "commodity_name",
    "qty_low",
    "qty_high",
    "final_qty",
    "qty_unit",
    "rate",
    "broker_name",
    "broker_rate",
    "despatch_from",
    "despatch_to",
]

SALES_CSV_HEADERS = [
    "Bill No",
    "Bill Date",
    "Party",
    "Party Code",
    "From Date",
    "To Date",
    "Base Amount",
    "IGST",
    "CGST",
    "SGST",
    "Gross Amount",
    "Brokerage",
    "Supply Type",
    "Tax",
]
SALES_CSV_KEYS = [
    "bill_no",
    "bill_date",
    "party_name",
    "party_code",
    "from_date",
    "to_date",
    "base_amount",
    "igst_amount",
    "cgst_amount",
    "sgst_amount",
    "gross_amount",
    "brokerage_amount",
    "supply_type",
    "tax_name",
]


def _csv_response(content: str, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/contract-register", response_model=list[ContractRegisterRow])
def contract_register(
    date_from: date | None = None,
    date_to: date | None = None,
    company_id: str | None = None,
    party_id: str | None = None,
    status: ContractStatus | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    return ReportService.contract_register(
        db,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
        party_id=party_id,
        status=status,
        active_only=active_only,
    )


@router.get("/contract-register/export")
def export_contract_register(
    date_from: date | None = None,
    date_to: date | None = None,
    company_id: str | None = None,
    party_id: str | None = None,
    status: ContractStatus | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    rows = ReportService.contract_register(
        db,
        date_from=date_from,
        date_to=date_to,
        company_id=company_id,
        party_id=party_id,
        status=status,
        active_only=active_only,
    )
    csv_text = ReportService.to_csv(CONTRACT_CSV_HEADERS, rows, CONTRACT_CSV_KEYS)
    return _csv_response(csv_text, "contract-register.csv")


@router.get("/sales-register", response_model=list[SalesRegisterRow])
def sales_register(
    date_from: date | None = None,
    date_to: date | None = None,
    party_id: str | None = None,
    company_id: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    return ReportService.sales_register(
        db,
        date_from=date_from,
        date_to=date_to,
        party_id=party_id,
        company_id=company_id,
        active_only=active_only,
    )


@router.get("/sales-register/export")
def export_sales_register(
    date_from: date | None = None,
    date_to: date | None = None,
    party_id: str | None = None,
    company_id: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    rows = ReportService.sales_register(
        db,
        date_from=date_from,
        date_to=date_to,
        party_id=party_id,
        company_id=company_id,
        active_only=active_only,
    )
    csv_text = ReportService.to_csv(SALES_CSV_HEADERS, rows, SALES_CSV_KEYS)
    return _csv_response(csv_text, "bills-report.csv")

from decimal import ROUND_HALF_UP, Decimal

from app.models import Tax
from app.models.enums import SupplyType


def round_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class TaxEngine:
    @staticmethod
    def get_supply_type(seller_state: str, buyer_state: str) -> SupplyType:
        if seller_state.strip().upper() == buyer_state.strip().upper():
            return SupplyType.INTRA_STATE
        return SupplyType.INTER_STATE

    @staticmethod
    def calculate(base_amount: Decimal, tax: Tax, supply_type: SupplyType) -> dict[str, Decimal]:
        igst = cgst = sgst = Decimal("0")
        if supply_type == SupplyType.INTRA_STATE:
            cgst = round_money(base_amount * Decimal(str(tax.cgst_percent)) / Decimal("100"))
            sgst = round_money(base_amount * Decimal(str(tax.sgst_percent)) / Decimal("100"))
        else:
            igst = round_money(base_amount * Decimal(str(tax.igst_percent)) / Decimal("100"))
        return {
            "igst_amount": igst,
            "cgst_amount": cgst,
            "sgst_amount": sgst,
        }

    @staticmethod
    def gross(base_amount: Decimal, tax_amounts: dict[str, Decimal]) -> Decimal:
        return round_money(
            base_amount
            + tax_amounts["igst_amount"]
            + tax_amounts["cgst_amount"]
            + tax_amounts["sgst_amount"]
        )

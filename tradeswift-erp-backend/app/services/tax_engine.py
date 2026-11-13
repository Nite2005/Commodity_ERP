from decimal import ROUND_HALF_UP, Decimal

from app.models import Tax
from app.models.enums import SupplyType


def round_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


GST_STATE_CODE_MAP: dict[str, str] = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra",
    "28": "Andhra Pradesh",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh",
    "38": "Ladakh",
}


class TaxEngine:
    @classmethod
    def resolve_state(cls, entity: object | None) -> str | None:
        if not entity:
            return None
        direct_state = getattr(entity, "state", None)
        if direct_state and str(direct_state).strip():
            return str(direct_state).strip()

        gst = getattr(entity, "gst_tin", None)
        if gst and len(str(gst).strip()) >= 2:
            code = str(gst).strip()[:2]
            if code in GST_STATE_CODE_MAP:
                return GST_STATE_CODE_MAP[code]

        address = getattr(entity, "address", None) or getattr(entity, "address_line", None)
        if address:
            addr_lower = str(address).lower()
            for s_name in GST_STATE_CODE_MAP.values():
                if s_name.lower() in addr_lower:
                    return s_name

        return None

    @staticmethod
    def get_supply_type(seller_state: str | None, buyer_state: str | None) -> SupplyType:
        s1 = (seller_state or "").strip().upper()
        s2 = (buyer_state or "").strip().upper()
        if s1 and s2 and s1 == s2:
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

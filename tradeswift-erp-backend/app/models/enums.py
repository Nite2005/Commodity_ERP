import enum


class CustomerType(str, enum.Enum):
    REGISTERED = "REGISTERED"
    UNREGISTERED = "UNREGISTERED"
    COMPOSITION = "COMPOSITION"
    SEZ = "SEZ"
    BUYER = "BUYER"
    SELLER = "SELLER"
    BOTH = "BOTH"


class QtyUnit(str, enum.Enum):
    MT = "MT"
    KGS = "KGS"
    QUINTAL = "QUINTAL"
    BAGS = "BAGS"


class Currency(str, enum.Enum):
    INR = "INR"
    USD = "USD"
    EUR = "EUR"


class PaymentTermType(str, enum.Enum):
    ADVANCE = "ADVANCE"
    NET_DAYS = "NET_DAYS"


class ContractType(str, enum.Enum):
    NEW = "NEW"
    AMENDMENT = "AMENDMENT"
    CANCEL = "CANCEL"


class ContractStatus(str, enum.Enum):
    CONTRACT_OPEN = "CONTRACT_OPEN"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class BillingStatus(str, enum.Enum):
    UNBILLED = "UNBILLED"
    BILLED = "BILLED"


class SupplyType(str, enum.Enum):
    INTRA_STATE = "INTRA_STATE"
    INTER_STATE = "INTER_STATE"

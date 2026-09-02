"""Seed document sequences and default payment terms."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import DocumentSequence, PaymentTerm
from app.models.enums import PaymentTermType


def seed_sequences(db: Session) -> None:
    sequences = [
        ("TAX", "TAX-", 0, 3),
        ("PARTY", "ACC-", 10000, 5),
        ("COMPANY", "CO-", 1000, 5),
        ("RATE", "RT-", 0, 5),
        ("CONTRACT", "", 0, 5),
        ("DESPATCH", "DSP-", 0, 5),
        ("BILL", "INV-", 0, 5),
    ]
    for seq_type, prefix, start, pad in sequences:
        if not db.query(DocumentSequence).filter_by(sequence_type=seq_type).first():
            db.add(
                DocumentSequence(
                    sequence_type=seq_type,
                    prefix=prefix,
                    current_value=start,
                    pad_length=pad,
                )
            )


def seed_payment_terms(db: Session) -> None:
    terms = [
        ("ADV", "Advance", PaymentTermType.ADVANCE, 0, Decimal("100"), "100% payment in advance"),
        ("NET7", "Net 7", PaymentTermType.NET_DAYS, 7, Decimal("0"), "Payment within 7 days of invoice"),
        ("NET30", "Net 30", PaymentTermType.NET_DAYS, 30, Decimal("0"), "Payment within 30 days of invoice"),
    ]
    for code, name, ttype, days, adv, desc in terms:
        if not db.query(PaymentTerm).filter_by(term_code=code).first():
            db.add(
                PaymentTerm(
                    term_code=code,
                    term_name=name,
                    term_type=ttype,
                    credit_days=days,
                    advance_percent=adv,
                    description=desc,
                )
            )


def seed_masters(db: Session) -> None:
    seed_sequences(db)
    seed_payment_terms(db)
    db.commit()

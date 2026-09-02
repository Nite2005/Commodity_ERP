from sqlalchemy.orm import Session

from app.models import DocumentSequence


class SequenceService:
    @staticmethod
    def next_code(db: Session, sequence_type: str) -> str:
        seq = (
            db.query(DocumentSequence)
            .filter(DocumentSequence.sequence_type == sequence_type)
            .with_for_update()
            .one()
        )
        seq.current_value += 1
        db.flush()
        padded = str(seq.current_value).zfill(seq.pad_length)
        return f"{seq.prefix}{padded}"

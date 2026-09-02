from uuid import UUID


def as_db_id(value: str | UUID) -> str:
    """Normalize UUID values for char(32) database keys."""
    return UUID(str(value)).hex


def db_get(db, model, entity_id: str | UUID):
    """Load a row by UUID, accepting hyphenated or hex input."""
    return db.get(model, as_db_id(entity_id))

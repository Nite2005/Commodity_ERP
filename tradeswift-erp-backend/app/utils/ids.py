from uuid import UUID


def as_db_id(value: str | UUID) -> str:
    """Normalize UUID values for char(32) database keys."""
    return UUID(str(value)).hex


def db_get(db, model, entity_id: str | UUID):
    """Load a row by UUID, accepting hyphenated or hex input."""
    try:
        u = UUID(str(entity_id))
        return db.get(model, u.hex) or db.get(model, str(u))
    except (ValueError, TypeError):
        return db.get(model, str(entity_id))


def uuid_variants(value: str | UUID | None) -> list[str]:
    """Return both hyphenated and hex representations of a UUID."""
    if not value:
        return []
    try:
        u = UUID(str(value))
        return list({str(u), u.hex})
    except (ValueError, TypeError):
        return [str(value)]



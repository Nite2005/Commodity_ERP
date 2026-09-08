"""
Run database migrations manually.

Usage (from tradeswift-erp-backend):
    python migrate.py
"""

from __future__ import annotations

from sqlalchemy import inspect, text

from app.config import settings
from app.database import engine, init_db


def _is_sqlite() -> bool:
    return settings.database_url.startswith("sqlite")


def _table_columns(conn, table: str) -> set[str]:
    if _is_sqlite():
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return {row[1] for row in rows}
    rows = conn.execute(
        text(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table"
        ),
        {"table": table},
    ).fetchall()
    return {row[0] for row in rows}


def add_party_bank_name(conn) -> str:
    inspector = inspect(conn)
    if "parties" not in inspector.get_table_names():
        return "SKIP  parties table missing (create tables first)"

    cols = _table_columns(conn, "parties")
    if "bank_name" in cols:
        return "SKIP  parties.bank_name already exists"
    conn.execute(text("ALTER TABLE parties ADD COLUMN bank_name VARCHAR(100)"))
    return "OK    added parties.bank_name"


def add_company_is_selected(conn) -> str:
    inspector = inspect(conn)
    if "companies" not in inspector.get_table_names():
        return "SKIP  companies table missing (create tables first)"

    cols = _table_columns(conn, "companies")
    if "is_selected" in cols:
        return "SKIP  companies.is_selected already exists"
    if _is_sqlite():
        conn.execute(text("ALTER TABLE companies ADD COLUMN is_selected BOOLEAN DEFAULT 0"))
    else:
        conn.execute(
            text("ALTER TABLE companies ADD COLUMN is_selected TINYINT(1) NOT NULL DEFAULT 0")
        )
    return "OK    added companies.is_selected"


def add_contract_billed_qty(conn) -> str:
    inspector = inspect(conn)
    if "contracts" not in inspector.get_table_names():
        return "SKIP  contracts table missing"

    cols = _table_columns(conn, "contracts")
    if "billed_qty" in cols:
        return "SKIP  contracts.billed_qty already exists"
    if _is_sqlite():
        conn.execute(text("ALTER TABLE contracts ADD COLUMN billed_qty NUMERIC(10,2) DEFAULT 0"))
    else:
        conn.execute(
            text("ALTER TABLE contracts ADD COLUMN billed_qty DECIMAL(10,2) NOT NULL DEFAULT 0")
        )
    try:
        conn.execute(
            text(
                "UPDATE contracts c SET billed_qty = COALESCE(("
                "  SELECT SUM(bli.quantity) FROM bill_line_items bli "
                "  WHERE bli.contract_id = c.id"
                "), 0)"
            )
        )
    except Exception:
        pass
    return "OK    added contracts.billed_qty"


def nullable_bill_line_despatch(conn) -> str:
    inspector = inspect(conn)
    if "bill_line_items" not in inspector.get_table_names():
        return "SKIP  bill_line_items missing"
    if _is_sqlite():
        return "SKIP  sqlite cannot alter despatch_id nullability"
    try:
        conn.execute(text("ALTER TABLE bill_line_items MODIFY despatch_id VARCHAR(36) NULL"))
        return "OK    bill_line_items.despatch_id nullable"
    except Exception as exc:
        return f"SKIP  {exc}"


def add_rate_master_rate_type(conn) -> str:
    inspector = inspect(conn)
    if "rate_masters" not in inspector.get_table_names():
        return "SKIP  rate_masters table missing"

    cols = _table_columns(conn, "rate_masters")
    if "rate_type" in cols:
        return "SKIP  rate_masters.rate_type already exists"
    if _is_sqlite():
        conn.execute(
            text("ALTER TABLE rate_masters ADD COLUMN rate_type VARCHAR(20) DEFAULT 'FIXED'")
        )
    else:
        try:
            conn.execute(
                text(
                    "ALTER TABLE rate_masters ADD COLUMN rate_type "
                    "ENUM('FIXED','PERCENTAGE') NOT NULL DEFAULT 'FIXED'"
                )
            )
        except Exception:
            conn.execute(
                text(
                    "ALTER TABLE rate_masters ADD COLUMN rate_type "
                    "VARCHAR(20) NOT NULL DEFAULT 'FIXED'"
                )
            )
    return "OK    added rate_masters.rate_type"


MIGRATIONS = [
    ("001_add_party_bank_name", add_party_bank_name),
    ("002_add_company_is_selected", add_company_is_selected),
    ("003_add_contract_billed_qty", add_contract_billed_qty),
    ("004_nullable_bill_line_despatch", nullable_bill_line_despatch),
    ("005_add_rate_master_rate_type", add_rate_master_rate_type),
]


def main() -> None:
    print(f"Database: {settings.database_url}")
    print("Creating missing tables (if any)...")
    init_db()
    print("Tables ready.\n")

    print(f"Running {len(MIGRATIONS)} migration(s)...\n")
    with engine.begin() as conn:
        for name, fn in MIGRATIONS:
            try:
                result = fn(conn)
                print(f"[{name}] {result}")
            except Exception as exc:
                print(f"[{name}] FAIL  {exc}")
                raise

    print("\nDone.")


if __name__ == "__main__":
    main()

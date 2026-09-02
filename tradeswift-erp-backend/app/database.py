from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models import (  # noqa: F401
        Base,
        Broker,
        Commodity,
        Company,
        Contract,
        DocumentSequence,
        Party,
        PaymentTerm,
        RateMaster,
        Tax,
        Unit,
    )

    Base.metadata.create_all(bind=engine)
    _migrate_parties_table()
    _migrate_companies_table()
    _migrate_contracts_table()


def _party_columns(conn) -> set[str]:
    from sqlalchemy import text

    if settings.database_url.startswith("sqlite"):
        return {row[1] for row in conn.execute(text("PRAGMA table_info(parties)")).fetchall()}
    return {
        row[0]
        for row in conn.execute(
            text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parties'"
            )
        ).fetchall()
    }


def _migrate_parties_table() -> None:
    """Add company_id and fix party name uniqueness for company-scoped parties."""
    from sqlalchemy import text

    with engine.begin() as conn:
        try:
            cols = _party_columns(conn)
        except Exception:
            return
        if not cols:
            return

        if "company_id" not in cols:
            if settings.database_url.startswith("sqlite"):
                conn.execute(text("ALTER TABLE parties ADD COLUMN company_id VARCHAR(36)"))
            else:
                conn.execute(text("ALTER TABLE parties ADD COLUMN company_id VARCHAR(36) NULL"))
                try:
                    conn.execute(
                        text(
                            "ALTER TABLE parties ADD CONSTRAINT fk_parties_company "
                            "FOREIGN KEY (company_id) REFERENCES companies(id)"
                        )
                    )
                except Exception:
                    pass

        _migrate_party_unique_constraints(conn)


def _migrate_party_unique_constraints(conn) -> None:
    """Drop global unique on party name; enforce unique per (company_id, name)."""
    from sqlalchemy import text

    if settings.database_url.startswith("sqlite"):
        indexes = conn.execute(text("PRAGMA index_list(parties)")).fetchall()
        for index in indexes:
            index_name = index[1]
            is_unique = index[2]
            if not is_unique:
                continue
            cols = [
                row[2]
                for row in conn.execute(text(f"PRAGMA index_info({index_name})")).fetchall()
            ]
            if cols == ["name"] and index_name != "sqlite_autoindex_parties_1":
                try:
                    conn.execute(text(f"DROP INDEX {index_name}"))
                except Exception:
                    pass
        try:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_party_company_name "
                    "ON parties (company_id, name)"
                )
            )
        except Exception:
            pass
        return

    rows = conn.execute(
        text(
            "SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols, "
            "MAX(NON_UNIQUE) AS non_unique "
            "FROM INFORMATION_SCHEMA.STATISTICS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parties' "
            "GROUP BY INDEX_NAME"
        )
    ).fetchall()

    has_company_name_unique = False
    for index_name, cols, non_unique in rows:
        if non_unique == 0 and cols == "name" and index_name != "PRIMARY":
            conn.execute(text(f"ALTER TABLE parties DROP INDEX `{index_name}`"))
        if non_unique == 0 and cols in ("company_id,name", "company_id, name"):
            has_company_name_unique = True

    if not has_company_name_unique:
        try:
            conn.execute(
                text(
                    "ALTER TABLE parties ADD CONSTRAINT uq_party_company_name "
                    "UNIQUE (company_id, name)"
                )
            )
        except Exception:
            try:
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX uq_party_company_name "
                        "ON parties (company_id, name)"
                    )
                )
            except Exception:
                pass



def _company_columns(conn) -> set[str]:
    from sqlalchemy import text

    if settings.database_url.startswith("sqlite"):
        return {row[1] for row in conn.execute(text("PRAGMA table_info(companies)")).fetchall()}
    return {
        row[0]
        for row in conn.execute(
            text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies'"
            )
        ).fetchall()
    }


def _migrate_companies_table() -> None:
    """Align companies table with simplified Company master fields."""
    from sqlalchemy import text

    with engine.begin() as conn:
        try:
            cols = _company_columns(conn)
        except Exception:
            return
        if not cols:
            return

        if "address" not in cols:
            conn.execute(text("ALTER TABLE companies ADD COLUMN address TEXT"))
            cols.add("address")

        bank_cols = {
            "account_no": "VARCHAR(30)",
            "bank_name": "VARCHAR(100)",
            "ifsc_code": "VARCHAR(11)",
        }
        for col_name, col_type in bank_cols.items():
            if col_name not in cols:
                conn.execute(text(f"ALTER TABLE companies ADD COLUMN {col_name} {col_type}"))
                cols.add(col_name)

        if "address_line" in cols and "address" in cols:
            conn.execute(
                text(
                    "UPDATE companies SET address = TRIM(CONCAT_WS(', ', "
                    "NULLIF(address_line, ''), NULLIF(city, ''), NULLIF(state, ''), NULLIF(pincode, ''))) "
                    "WHERE (address IS NULL OR address = '') "
                    "AND address_line IS NOT NULL AND address_line != ''"
                )
            )

        if settings.database_url.startswith("mysql"):
            legacy_nullable = [
                "short_name VARCHAR(50) NULL",
                "customer_type VARCHAR(50) NULL",
                "address_line TEXT NULL",
                "city VARCHAR(50) NULL",
                "state VARCHAR(50) NULL",
                "pincode VARCHAR(6) NULL",
            ]
            for col_def in legacy_nullable:
                col_name = col_def.split()[0]
                if col_name in cols:
                    try:
                        conn.execute(text(f"ALTER TABLE companies MODIFY {col_def}"))
                    except Exception:
                        pass


def _contract_columns(conn) -> set[str]:
    from sqlalchemy import text

    if settings.database_url.startswith("sqlite"):
        return {row[1] for row in conn.execute(text("PRAGMA table_info(contracts)")).fetchall()}
    return {
        row[0]
        for row in conn.execute(
            text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts'"
            )
        ).fetchall()
    }


def _migrate_contracts_table() -> None:
    """Add company_id to contracts."""
    from sqlalchemy import text

    with engine.begin() as conn:
        try:
            cols = _contract_columns(conn)
        except Exception:
            return
        if not cols:
            return

        if "company_id" not in cols:
            if settings.database_url.startswith("sqlite"):
                conn.execute(text("ALTER TABLE contracts ADD COLUMN company_id VARCHAR(36)"))
            else:
                conn.execute(text("ALTER TABLE contracts ADD COLUMN company_id VARCHAR(36) NULL"))
                try:
                    conn.execute(
                        text(
                            "ALTER TABLE contracts ADD CONSTRAINT fk_contracts_company "
                            "FOREIGN KEY (company_id) REFERENCES companies(id)"
                        )
                    )
                except Exception:
                    pass

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
        MasterChangeRequest,
        Party,
        PaymentTerm,
        RateMaster,
        Tax,
        Unit,
        User,
    )

    Base.metadata.create_all(bind=engine)
    _migrate_parties_table()
    _migrate_companies_table()
    _migrate_contracts_table()
    _migrate_rate_masters_table()
    _migrate_users_table()


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

        if "bank_name" not in cols:
            conn.execute(text("ALTER TABLE parties ADD COLUMN bank_name VARCHAR(100)"))
            cols.add("bank_name")

        cheque_cols = {
            "cancelled_cheque_path": "VARCHAR(255)",
            "cancelled_cheque_filename": "VARCHAR(255)",
            "cancelled_cheque_uploaded_at": "DATETIME",
        }
        for col_name, col_type in cheque_cols.items():
            if col_name not in cols:
                conn.execute(text(f"ALTER TABLE parties ADD COLUMN {col_name} {col_type}"))
                cols.add(col_name)

        if "credit_limit" not in cols:
            conn.execute(text("ALTER TABLE parties ADD COLUMN credit_limit NUMERIC(14, 2) DEFAULT 5000000.0"))
            cols.add("credit_limit")

        try:
            conn.execute(
                text(
                    "UPDATE parties SET company_id = (SELECT id FROM companies LIMIT 1) "
                    "WHERE company_id IS NULL AND (SELECT COUNT(*) FROM companies) > 0"
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
            "is_selected": (
                "BOOLEAN DEFAULT 0"
                if settings.database_url.startswith("sqlite")
                else "TINYINT(1) NOT NULL DEFAULT 0"
            ),
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

        if "billed_qty" not in cols:
            if settings.database_url.startswith("sqlite"):
                conn.execute(text("ALTER TABLE contracts ADD COLUMN billed_qty NUMERIC(10,2) DEFAULT 0"))
            else:
                conn.execute(
                    text(
                        "ALTER TABLE contracts ADD COLUMN billed_qty DECIMAL(10,2) NOT NULL DEFAULT 0"
                    )
                )
            cols.add("billed_qty")
            try:
                conn.execute(
                    text(
                        "UPDATE contracts c SET billed_qty = COALESCE(("
                        "  SELECT SUM(bli.quantity) FROM bill_line_items bli "
                        "  WHERE bli.contract_id = c.id AND bli.is_active = 1"
                        "), 0)"
                    )
                )
            except Exception:
                pass

        if "notes" not in cols:
            conn.execute(text("ALTER TABLE contracts ADD COLUMN notes TEXT"))
            cols.add("notes")

        if "broker_rate_type" not in cols:
            conn.execute(text("ALTER TABLE contracts ADD COLUMN broker_rate_type VARCHAR(20) DEFAULT 'FIXED'"))
            cols.add("broker_rate_type")

    _migrate_bill_line_items_table()


def _migrate_bill_line_items_table() -> None:
    """Allow contract-only bill lines (despatch optional)."""
    from sqlalchemy import text

    with engine.begin() as conn:
        try:
            if settings.database_url.startswith("sqlite"):
                cols = {
                    row[1]
                    for row in conn.execute(text("PRAGMA table_info(bill_line_items)")).fetchall()
                }
            else:
                cols = {
                    row[0]
                    for row in conn.execute(
                        text(
                            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_line_items'"
                        )
                    ).fetchall()
                }
        except Exception:
            return
        if not cols or "despatch_id" not in cols:
            return

        if settings.database_url.startswith("sqlite"):
            # SQLite cannot easily alter nullability; new DBs use model definition.
            return

        try:
            conn.execute(
                text("ALTER TABLE bill_line_items MODIFY despatch_id VARCHAR(36) NULL")
            )
        except Exception:
            pass


def _migrate_rate_masters_table() -> None:
    """Add rate_type (FIXED / PERCENTAGE) for commodity billing rates."""
    from sqlalchemy import text

    with engine.begin() as conn:
        try:
            if settings.database_url.startswith("sqlite"):
                cols = {
                    row[1]
                    for row in conn.execute(text("PRAGMA table_info(rate_masters)")).fetchall()
                }
            else:
                cols = {
                    row[0]
                    for row in conn.execute(
                        text(
                            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rate_masters'"
                        )
                    ).fetchall()
                }
        except Exception:
            return
        if not cols:
            return

        if "rate_type" not in cols:
            if settings.database_url.startswith("sqlite"):
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
            cols.add("rate_type")

        if "brokerage_type" not in cols:
            conn.execute(text("ALTER TABLE rate_masters ADD COLUMN brokerage_type VARCHAR(20) DEFAULT 'FIXED'"))
            cols.add("brokerage_type")


def _migrate_users_table() -> None:
    """Seed initial Admin and Employee users and ensure password column exists."""
    from sqlalchemy import text
    from sqlalchemy.orm import Session
    from app.models import User
    from app.models.enums import UserRole

    # 1. Add password column if missing
    try:
        with engine.connect() as conn:
            if settings.database_url.startswith("sqlite"):
                cols = {
                    row[1]
                    for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
                }
            else:
                cols = {
                    row[0]
                    for row in conn.execute(
                        text(
                            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
                        )
                    ).fetchall()
                }
            if cols and "password" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN password VARCHAR(255) DEFAULT 'admin123'"))
                conn.commit()
    except Exception:
        pass

    # 2. Seed or update default users with exact passwords
    with Session(bind=engine) as session:
        try:
            count = session.query(User).count()
            if count == 0:
                default_users = [
                    User(
                        username="kannu",
                        full_name="Kannu",
                        email="kannu@tradeswift.com",
                        password="admin123",
                        role=UserRole.ADMIN,
                        designation="Chief Supervisor / Admin",
                    ),
                    User(
                        username="kanha",
                        full_name="Kanha",
                        email="kanha@tradeswift.com",
                        password="admin123",
                        role=UserRole.ADMIN,
                        designation="Senior Supervisor / Admin",
                    ),
                    User(
                        username="trader_ops",
                        full_name="Trader Operations",
                        email="ops@tradeswift.com",
                        password="employee123",
                        role=UserRole.EMPLOYEE,
                        designation="Desk Trader / Operator",
                    ),
                ]
                session.add_all(default_users)
                session.commit()
            else:
                kannu = session.query(User).filter((User.username == "kannu") | (User.email == "kannu@tradeswift.com")).first()
                if kannu:
                    kannu.email = "kannu@tradeswift.com"
                    kannu.password = "admin123"
                kanha = session.query(User).filter((User.username == "kanha") | (User.email == "kanha@tradeswift.com")).first()
                if kanha:
                    kanha.email = "kanha@tradeswift.com"
                    kanha.password = "admin123"
                ops = session.query(User).filter((User.username == "trader_ops") | (User.email == "ops@tradeswift.com")).first()
                if ops:
                    ops.email = "ops@tradeswift.com"
                    ops.password = "employee123"
                session.commit()
        except Exception:
            session.rollback()


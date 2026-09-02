from app.database import SessionLocal, init_db
from app.services.seed_service import seed_masters


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed_masters(db)
        print("Seed completed: sequences + payment terms (Advance, Net 7, Net 30)")
    finally:
        db.close()


if __name__ == "__main__":
    main()

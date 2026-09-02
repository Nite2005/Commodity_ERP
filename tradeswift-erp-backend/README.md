# Tradeswift ERP — Masters API

Backend-only FastAPI service for **Tradeswift** commodity trading ERP (physical commodities).

## Masters (7)

| Master | Endpoint |
|--------|----------|
| Commodity | `/api/v1/masters/commodities` |
| Units (Weightment) | `/api/v1/masters/units` |
| Broker | `/api/v1/masters/brokers` |
| Tax | `/api/v1/masters/taxes` |
| Party (Company) | `/api/v1/masters/parties` |
| Payment Term | `/api/v1/masters/payment-terms` |
| Rate Master | `/api/v1/masters/rates` |

Rate lookup: `GET /api/v1/masters/rates/lookup?party_id=&commodity_id=`

## Contracts

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/contracts` | List (filters: status, party_id, date) |
| `GET /api/v1/contracts/{id}` | Detail with master names |
| `POST /api/v1/contracts` | Create contract → status `CONTRACT_OPEN` |
| `PUT /api/v1/contracts/{id}` | Update open contract |
| `PATCH /api/v1/contracts/{id}/closure` | Set final billing qty |
| `GET /api/v1/contracts/{id}/balance` | Remaining qty & tolerance |

Contract links all masters: seller/buyer (Party), commodity, tax, broker, optional payment term & weightment unit. Broker rate is per contract.

## Quick start

```bash
cd tradeswift-erp-backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env
docker compose up -d
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs** for Swagger UI.

On startup the app creates tables and seeds:
- Document sequences (TAX, PARTY, RATE codes)
- Payment terms: **Advance**, **Net 7**, **Net 30**

### MySQL schema reset (if needed)

If tables were created with an older model and startup fails on UUID columns, reset the database once:

```bash
docker compose down -v
docker compose up -d
```

### Local dev without Docker (SQLite)

```bash
set DATABASE_URL=sqlite:///./tradeswift_dev.db
uvicorn app.main:app --reload
```

Manual seed (optional):

```bash
python scripts/seed_masters.py
```

## Stack

Python 3.11+ · FastAPI · SQLAlchemy · MySQL 8.0 · PyMySQL

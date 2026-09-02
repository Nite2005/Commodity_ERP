# Tradeswift ERP — 12-Day Implementation Plan
## Backend Only (No Frontend)

| Field | Value |
|-------|-------|
| **Client** | Tradeswift |
| **Scope** | Physical commodities — Contract → Despatch → Bill |
| **Stack** | Python 3.11+ · FastAPI · SQLAlchemy · Alembic · MySQL 8.0 |
| **Duration** | 12 working days (1 developer, full-time, AI-assisted) |
| **Deliverable** | REST API + Swagger `/docs` + pytest |
| **NOT in scope** | ❌ Frontend · ❌ React · ❌ Mobile · ❌ E-Invoice · ❌ Tally |

---

| ✅ Backend MVP | ⏳ Baad mein |
|---------------|-------------|
| Saari REST APIs | E-Invoice |
| JWT login + roles | Tally export |
| GST engine (IGST/CGST/SGST) | Email service |
| Despatch tolerance + lock | Amendment/Cancel logic |
| Bill generation (DB transaction) | Production deploy |
| PDF invoice API (ReportLab) | Data migration |
| 3 Report APIs | Redis cache |
| pytest unit + integration | Rate limiting |
| Demo seed script | — |
| Swagger documentation | — |

**Demo:** Swagger UI (`http://localhost:8000/docs`) se poora flow test hoga — **frontend ki zaroorat nahi**.

---

## Phase Overview

```
Phase 1   Day 1–2    Foundation         DB · Auth · Sequences
Phase 2   Day 3–4    Masters & Party    CRUD APIs
Phase 3   Day 5–6    Contracts          Rules · Closure · Balance
Phase 4   Day 7–8    Despatch           Tolerance · Unbilled query
Phase 5   Day 9–10   Billing & GST      TaxEngine · Bill API
Phase 6   Day 11     Reports & PDF      3 registers · invoice PDF
Phase 7   Day 12     Tests & Hardening  E2E · README · Swagger demo
```

---

## Project Structure

```
tradeswift-erp-backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── api/v1/          ← routers (auth, masters, party, contract…)
│   ├── models/          ← SQLAlchemy ORM
│   ├── schemas/         ← Pydantic validation
│   ├── services/        ← business logic
│   ├── core/            ← security, audit, exceptions
│   └── utils/           ← validators, pdf_generator
├── alembic/
├── tests/unit/
├── tests/integration/
├── scripts/seed_demo.py
├── requirements.txt
├── docker-compose.yml
└── .env.example
```

---

## Day-by-Day Plan

### Day 1 — Setup + Database (8h)

| Task | Output |
|------|--------|
| FastAPI project + config + MySQL Docker | App runs |
| SQLAlchemy models — 13 tables | ORM ready |
| Alembic migration | Tables in MySQL |
| `GET /api/v1/health` | Health check |
| Seed document_sequences + company_settings | Auto numbers |

**Checklist:**
- [ ] `uvicorn app.main:app --reload` on port 8000
- [ ] `alembic upgrade head` success
- [ ] All tables in `tradeswift_erp` DB

---

### Day 2 — Auth + Core (8h)

| Task | Output |
|------|--------|
| User model + admin seed | Login user |
| JWT login `POST /auth/login` | Token |
| `get_current_user` + `require_role` | Protected routes |
| Audit middleware (created_by/modified_by) | Auto audit |
| SequenceService (contract/bill/despatch nos) | Auto IDs |
| Global exception handler | Clean errors |

**Checklist:**
- [ ] Login returns JWT
- [ ] Without token → 401
- [ ] Sequence generates `00001`, `TAX-001`

---

### Day 3 — Master APIs (8h)

| Task | Output |
|------|--------|
| Commodity CRUD `/masters/commodities` | + validations |
| Units CRUD `/masters/units` | |
| Broker CRUD `/masters/brokers` | uppercase name |
| Tax CRUD `/masters/taxes` | auto tax_code, 0–100% |
| Unit tests for validators | pytest green |
| Swagger tags | `/docs` organized |

**Checklist:**
- [ ] All 4 masters CRUD via Swagger
- [ ] Duplicate commodity name → error

---

### Day 4 — Party API (8h)

| Task | Output |
|------|--------|
| Party + nested addresses schemas | Pydantic |
| GST-TIN, IFSC, pincode validators | Regex |
| Party CRUD + address sub-routes | Full COA API |
| Search `GET /parties?q=` | Filter |
| Integration tests | pytest |

**Endpoints:**
```
GET/POST/PUT  /api/v1/parties
POST/PUT/DELETE  /api/v1/parties/{id}/addresses/{address_id}
```

**Checklist:**
- [ ] Party with 2 addresses created via API
- [ ] Invalid GST-TIN rejected

---

### Day 5 — Contract API — Create (8h)

| Task | Output |
|------|--------|
| ContractCreate schema + validators | seller ≠ buyer |
| ContractService.create() | auto contract_no |
| Quality from commodity FK | auto populate |
| Status = CONTRACT_OPEN | on save |
| POST + GET list + GET detail | APIs |
| Integration tests | seller=buyer fail |

**Checklist:**
- [ ] `POST /contracts` → contractNo `00001`
- [ ] Same seller+buyer → 400

---

### Day 6 — Contract — Closure & Balance (8h)

| Task | Output |
|------|--------|
| PUT update contract | edit open contract |
| PATCH `/contracts/{id}/closure` | final_qty |
| GET `/contracts/{id}/balance` | remaining qty |
| Print flags on model | stored |
| Tests | closure + balance |

**Checklist:**
- [ ] Balance shows fulfilled vs remaining qty

---

### Day 7 — Despatch API (8h)

| Task | Output |
|------|--------|
| ToleranceValidator | ±% check |
| Optimistic lock (version column) | concurrent safe |
| DespatchService.create() | transaction |
| POST + GET `/despatches` | APIs |
| Unit tests tolerance | exceed → 400 |

**Checklist:**
- [ ] Over-tolerance → `"Dispatch quantity exceeds contractual tolerance boundary."`

---

### Day 8 — Unbilled Despatch API (8h)

| Task | Output |
|------|--------|
| GET `/despatches/unbilled` | per TDD spec |
| Filter: partyId, fromDate, toDate | |
| Join commodity short name | in response |
| GET `/despatches/{id}` | detail |
| Integration + lock tests | pytest |

**Checklist:**
- [ ] Unbilled returns only UNBILLED records
- [ ] Billed despatch not in list

---

### Day 9 — GST Tax Engine (8h)

| Task | Output |
|------|--------|
| TaxEngine — supply type (intra/inter) | |
| calculate() — IGST or CGST+SGST | |
| BrokerageService — qty × rate | |
| State from party billing address | |
| 6+ unit tests | all green |

**Test cases:**
```
✓ Inter-state → IGST only
✓ Intra-state → CGST + SGST
✓ Rajasthan → Haryana = INTER_STATE
✓ Brokerage = qty × rate
```

---

### Day 10 — Billing API (8h)

| Task | Output |
|------|--------|
| BillingService.generate_bill() | DB transaction |
| SELECT FOR UPDATE unbilled despatches | no double bill |
| Create bill + line items | |
| Mark despatches BILLED | |
| POST + GET `/bills` | APIs |
| Integration test full flow | pytest |

**Checklist:**
- [ ] Bill created with correct GST
- [ ] Same despatch twice → 409

---

### Day 11 — Reports + PDF (8h)

| Task | Output |
|------|--------|
| GET `/reports/contract-register` | |
| GET `/reports/sales-register` | |
| GET `/reports/brokerage` | |
| GET `/company/settings` | Tradeswift profile |
| GET `/bills/{id}/pdf` | ReportLab PDF |

**Checklist:**
- [ ] PDF downloads with GST breakdown
- [ ] All 3 reports return JSON data

---

### Day 12 — E2E + Hardening (8h)

| Task | Output |
|------|--------|
| `scripts/seed_demo.py` — full demo data | |
| E2E test: master → contract → despatch → bill | |
| Fix failing tests | all green |
| Pagination on list APIs | page, limit |
| README (setup + run + test) | |
| OpenAPI descriptions polish | |
| Swagger demo rehearsal | CEO ready |

**Swagger demo flow:**
```
1. POST /auth/login
2. POST /parties
3. POST /masters/commodities + /masters/taxes
4. POST /contracts
5. POST /despatches (×2)
6. GET  /despatches/unbilled
7. POST /bills
8. GET  /bills/{id}/pdf
9. GET  /reports/sales-register
```

**Checklist:**
- [ ] `pytest tests/ -v` all pass
- [ ] Demo flow works in Swagger without errors

---

## All API Endpoints (Day 12)

| Method | Endpoint |
|--------|----------|
| GET | `/api/v1/health` |
| POST | `/api/v1/auth/login` |
| CRUD | `/api/v1/masters/commodities` |
| CRUD | `/api/v1/masters/units` |
| CRUD | `/api/v1/masters/brokers` |
| CRUD | `/api/v1/masters/taxes` |
| CRUD | `/api/v1/parties` (+ address routes) |
| POST/GET/PUT | `/api/v1/contracts` |
| PATCH | `/api/v1/contracts/{id}/closure` |
| GET | `/api/v1/contracts/{id}/balance` |
| POST/GET | `/api/v1/despatches` |
| GET | `/api/v1/despatches/unbilled` |
| POST/GET | `/api/v1/bills` |
| GET | `/api/v1/bills/{id}/pdf` |
| GET | `/api/v1/reports/contract-register` |
| GET | `/api/v1/reports/sales-register` |
| GET | `/api/v1/reports/brokerage` |
| GET | `/api/v1/company/settings` |

---

## Stack (Backend Only)

```txt
Python 3.11 + FastAPI + Uvicorn
SQLAlchemy 2.0 + Alembic
MySQL 8.0 + PyMySQL
JWT (python-jose) + bcrypt (passlib)
Pydantic v2
ReportLab (PDF)
pytest + httpx
```

---

---

## Git Milestones

```
Day 2  → v0.1-backend-foundation
Day 4  → v0.2-masters-party-api
Day 6  → v0.3-contract-api
Day 8  → v0.4-despatch-api
Day 10 → v0.5-billing-api
Day 12 → v0.6-backend-mvp
```

---

**Note:** Frontend (React/UI) is a separate future phase — not part of this 12-day plan.

*End of Plan*

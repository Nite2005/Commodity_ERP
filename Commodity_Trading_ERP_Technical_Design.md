# Technical Design Document (TDD)
## Tradeswift — Commodity Trading & ERP Management System

| Field | Value |
|-------|-------|
| **Document Version** | 1.4 |
| **Date** | 01 September 2026 |
| **Status** | Draft — Scope confirmed |
| **Client** | **Tradeswift** (Tradeswift Commodities Pvt. Ltd. / Tradeswift Group) |
| **Business Line** | **Physical commodities only** *(confirmed)* |
| **Backend** | Python 3.11+ (FastAPI) |
| **Database** | MySQL 8.0+ |
| **Related Documents** | Commodity_Trading_ERP_Requirements.md (SRD v1.2) |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Database Design](#4-database-design)
5. [API Design](#5-api-design)
6. [Application Layer Design](#6-application-layer-design)
7. [Screen Technical Specifications](#7-screen-technical-specifications)
8. [Business Logic Implementation](#8-business-logic-implementation)
9. [Security Design](#9-security-design)
10. [Concurrency & Transactions](#10-concurrency--transactions)
11. [Audit Trail Design](#11-audit-trail-design)
12. [Reporting & Document Generation](#12-reporting--document-generation)
13. [Error Handling](#13-error-handling)
14. [Deployment Architecture](#14-deployment-architecture)
15. [Testing Strategy](#15-testing-strategy)
16. [Appendices](#16-appendices)

---

## 1. Introduction

### 1.1 Purpose

This Technical Design Document (TDD) describes the technical architecture, database schema, API contracts, service layer design, and implementation approach for the **Tradeswift Commodity Trading & ERP System** — a single-tenant application built exclusively for **Tradeswift** internal operations.

### 1.2 Scope

This document covers:

- High-level and component-level architecture
- Relational database schema with constraints and indexes
- REST API endpoints and payloads
- Service/module decomposition
- GST calculation engine, billing workflow, and despatch tolerance logic
- Audit trail, optimistic locking, and reporting infrastructure

### 1.3 Audience

- Backend and frontend developers
- Database administrators
- DevOps engineers
- QA / test engineers
- Tradeswift business stakeholders (Traders, Accounts, Management)

### 1.4 Client Context — Tradeswift

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRADESWIFT (Client Organization)              │
│  Physical commodity trading — Jaipur, Rajasthan                 │
│  Internal users: Traders, Operations, Accounts, Managers         │
└────────────────────────────┬────────────────────────────────────┘
                             │ uses
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Tradeswift ERP System (this project)                │
│  Masters → Contracts → Despatch → Billing → Reports             │
└────────────────────────────┬────────────────────────────────────┘
                             │ manages data for
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         External Parties (NOT system users by default)           │
│  Buyers (Shiv Shankar Oil Mill) | Sellers | Brokers (Amit)    │
└─────────────────────────────────────────────────────────────────┘
```

| Setting | Value |
|---------|-------|
| **Application Name** | Tradeswift ERP |
| **API Title** | Tradeswift Commodity ERP API |
| **Database Name** | `tradeswift_erp` |
| **Deployment** | Single-tenant (Tradeswift only) |
| **Invoice Header** | Tradeswift legal name + GSTIN *(client to confirm)* |
| **Default State** | Rajasthan (Jaipur) — for Tradeswift HQ GST context |

**REQ-ORG-001:** System shall include a `company_settings` table storing Tradeswift's legal name, address, GSTIN, logo path, and invoice footer — used on all PDF outputs.

### 1.5 Business Scope Boundary *(Confirmed)*

```
┌──────────────────────── IN SCOPE ────────────────────────────┐
│  PHYSICAL COMMODITIES                                         │
│  • Spot buyer–seller contracts (mustard cake, grains, etc.)  │
│  • Despatch / challan / godown / bags / MT / quintal         │
│  • GST invoice on physical goods                             │
│  • Brokerage on physical deal fulfillment                    │
└──────────────────────────────────────────────────────────────┘

┌────────────────────── OUT OF SCOPE ──────────────────────────┐
│  EXCHANGE / FINANCIAL TRADING                                 │
│  • MCX/NCDEX gold, silver, agri futures                      │
│  • NSE/BSE equity & F&O                                      │
│  • Trading terminal, demat, margin, SEBI reporting           │
└──────────────────────────────────────────────────────────────┘
```

| Requirement ID | Rule |
|----------------|------|
| **REQ-SCOPE-001** | All modules shall implement physical commodity workflows only |
| **REQ-SCOPE-002** | No exchange order, demat, or market data integration in this release |
| **REQ-SCOPE-003** | Commodity master shall store physical goods (not exchange instrument codes as primary key) |

> **Note:** Tradeswift as a group may operate exchange brokerage as a separate business line. That line requires a different system architecture and is not covered by this TDD.

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENT TIER                                     │
│  Web Application (React / Next.js)                                       │
│  - Master Screens  - Transaction Screens  - Reports  - Print/PDF UI    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTPS / REST (JSON)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           API TIER                                        │
│  Python Backend (FastAPI + Uvicorn)                                      │
│  - Auth Dependencies  - Pydantic Schemas  - Routers  - Middleware       │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         SERVICE TIER                                        │
│  master_service | party_service | contract_service | despatch_service      │
│  billing_service | tax_engine | brokerage_service | report_service       │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      DATA ACCESS TIER                                       │
│  Repository Layer (SQLAlchemy 2.0 ORM + Alembic migrations)              │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      PERSISTENCE TIER                                       │
│  MySQL 8.0 (Primary DB)  |  File Storage (PDF/Reports)                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        1. MASTER MANAGEMENT                             │
│   [Commodity] [Units/Weightment] [Broker] [Tax]                         │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     2. PARTY & ACCOUNT MANAGEMENT                       │
│                     [Chart of Accounts / Party Master]                  │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        3. TRANSACTION PROCESSING                        │
│   [Contract Entry] ──> [Despatch Entry] ──> [Bill Generation]           │
│         │                      │                      │                  │
│         └── [Contract Closure] ┘                      │                  │
└────────────────────┬────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      4. REPORTING & ANALYTICS                           │
│   [Contract Register] [Sales Register] [Brokerage Report] [PDF Export]  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Component Interaction — Billing Flow

```
┌──────────┐    GET unbilled     ┌─────────────────┐
│ Bill UI  │ ──────────────────> │ BillingService  │
└──────────┘                     └────────┬────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
            ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
            │ DespatchRepo │      │  TaxEngine   │      │ ContractRepo │
            └──────────────┘      └──────────────┘      └──────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │  Bill + Lines   │
                                 │  (DB Transaction)│
                                 └─────────────────┘
```

### 2.4 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Layered architecture** | Router → Service → Repository → DB |
| **Single source of truth** | All validations enforced server-side |
| **Idempotent billing** | Unique constraint on despatch billing status |
| **Audit by default** | Base entity mixin for all tables |
| **Optimistic concurrency** | `@Version` on contract fulfillment tracking |
| **Domain-driven modules** | Separate services per bounded context |

---

## 3. Technology Stack

### 3.1 Recommended Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React 18 + TypeScript | Rich forms, grids, component reuse |
| **UI Framework** | Ant Design / MUI | Tables, date pickers, forms |
| **State Management** | React Query (TanStack Query) | Server state, caching, mutations |
| **Backend** | **Python 3.11+ + FastAPI** | High performance, auto OpenAPI, async support |
| **ASGI Server** | Uvicorn (+ Gunicorn in production) | Production-grade Python HTTP server |
| **ORM** | **SQLAlchemy 2.0** | Mature Python ORM, full MySQL 8 support |
| **Migrations** | **Alembic** | Version-controlled DB schema migrations |
| **Database** | **MySQL 8.0+** (InnoDB) | ACID, CHECK constraints (8.0.16+), JSON type |
| **DB Driver** | **PyMySQL** or mysqlclient | Python MySQL connectors for SQLAlchemy |
| **Auth** | JWT + python-jose + passlib/bcrypt | Role-based access (Admin, Trader, Accounts) |
| **PDF/Reports** | **ReportLab** or WeasyPrint | Invoice and register PDF generation |
| **Backend Validation** | **Pydantic v2** | Request/response schemas, field validators |
| **Frontend Validation** | Zod | Client-side validation |
| **API Docs** | OpenAPI 3.0 (auto-generated by FastAPI) | Swagger UI at `/docs` |
| **Testing** | pytest + pytest-asyncio + httpx | Unit and integration tests |
| **Containerization** | Docker + Docker Compose | Local dev and deployment |

### 3.2 Python Backend Dependencies (`requirements.txt`)

```txt
# Core
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9

# Database
sqlalchemy==2.0.35
alembic==1.13.2
pymysql==1.1.1
cryptography==43.0.0

# Auth & Security
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.1

# Validation & Utils
pydantic==2.9.0
pydantic-settings==2.5.0
email-validator==2.2.0

# PDF & Reports
reportlab==4.2.2

# Testing
pytest==8.3.0
pytest-asyncio==0.24.0
httpx==0.27.0
factory-boy==3.3.0
```

### 3.3 Alternative Stack

| Layer | Alternative |
|-------|-------------|
| Backend framework | Django REST Framework (DRF) |
| DB Driver | mysqlclient (C extension, faster than PyMySQL) |
| PDF | xhtml2pdf / JasperReports via Java bridge |

### 3.4 MySQL Configuration Notes

| Setting | Value | Reason |
|---------|-------|--------|
| **Engine** | InnoDB | Row-level locking, transactions, FK support |
| **Charset** | `utf8mb4` | Full Unicode (Hindi party names, symbols) |
| **Collation** | `utf8mb4_unicode_ci` | Case-insensitive string comparison |
| **SQL Mode** | `STRICT_TRANS_TABLES,NO_ZERO_DATE` | Reject invalid data at DB level |
| **UUID storage** | `CHAR(36)` via SQLAlchemy `Uuid` | Native UUID type not available in MySQL |
| **Decimals** | `DECIMAL(14,2)` | Exact financial calculations (no float) |
| **Timestamps** | `DATETIME(6)` | Microsecond precision; timezone in app layer (UTC) |

**Connection string format:**
```
mysql+pymysql://user:password@localhost:3306/tradeswift_erp?charset=utf8mb4
```

**SQLAlchemy engine config (`app/database.py`):**
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

---

## 4. Database Design

### 4.1 Entity Relationship Diagram (Logical)

```
commodities ─────────────┐
units ───────────────────┤
brokers ─────────────────┤
taxes ───────────────────┤
                         ▼
parties ──< party_addresses
   │              │
   │              └── (state used for GST)
   │
   ├──< contracts >── commodities
   │        │    >── taxes
   │        │    >── brokers
   │        │    >── parties (seller)
   │        │    >── parties (buyer)
   │        │
   │        └──< despatches
   │                 │
   │                 └──< bill_line_items >── bills >── parties
   │
   └── (referenced on bills)
```

### 4.2 Base Audit Mixin

All transactional and master tables inherit:

```sql
created_by       VARCHAR(100) NOT NULL,
created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
modified_by      VARCHAR(100),
modified_at      DATETIME(6),
is_active        TINYINT(1)   NOT NULL DEFAULT 1
```

> **MySQL note:** Use `TINYINT(1)` for boolean columns. Store all timestamps in UTC; convert to IST (DD-MM-YYYY) in the API/UI layer.

### 4.3 Table Definitions

#### 4.3.1 `commodities`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| commodity_name | VARCHAR(100) | NOT NULL, UNIQUE |
| comm_short_name | VARCHAR(30) | NOT NULL |
| quality_allowance | VARCHAR(1000) | NULL |
| + audit fields | | |

**Indexes:** `UNIQUE(commodity_name)`, `INDEX(comm_short_name)`

---

#### 4.3.2 `units`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| unit_name | VARCHAR(150) | NOT NULL, UNIQUE |
| + audit fields | | |

---

#### 4.3.3 `brokers`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| broker_name | VARCHAR(100) | NOT NULL, UNIQUE |
| + audit fields | | |

---

#### 4.3.4 `taxes`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| tax_code | VARCHAR(10) | NOT NULL, UNIQUE, auto-generated |
| tax_name | VARCHAR(50) | NOT NULL, UNIQUE |
| igst_percent | DECIMAL(5,2) | NOT NULL, CHECK 0–100 |
| cgst_percent | DECIMAL(5,2) | NOT NULL, CHECK 0–100 |
| sgst_percent | DECIMAL(5,2) | NOT NULL, CHECK 0–100 |
| + audit fields | | |

**Sequence:** `tax_code` generated as `TAX-001`, `TAX-002`, etc.

---

#### 4.3.5 `parties`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| party_code | VARCHAR(20) | NOT NULL, UNIQUE, auto-generated |
| name | VARCHAR(150) | NOT NULL, UNIQUE |
| short_name | VARCHAR(50) | NOT NULL |
| customer_type | ENUM | NOT NULL: REGISTERED, UNREGISTERED, COMPOSITION, SEZ |
| gst_tin | VARCHAR(15) | NULL, validated by regex |
| gst_apply_date | DATE | NULL |
| account_no | VARCHAR(30) | NULL |
| ifsc_code | VARCHAR(11) | NULL |
| + audit fields | | |

**Indexes:** `UNIQUE(name)`, `INDEX(party_code)`, `INDEX(gst_tin)`

---

#### 4.3.6 `party_addresses`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| party_id | CHAR(36) | FK → parties.id, NOT NULL |
| contact_person | VARCHAR(100) | NULL |
| location_type | ENUM | NOT NULL: BILLING, SHIPPING, BRANCH |
| phone | VARCHAR(50) | NULL |
| fax | VARCHAR(50) | NULL |
| email | VARCHAR(100) | NULL |
| address_line | TEXT | NOT NULL, max 300 chars |
| city | VARCHAR(50) | NOT NULL |
| pincode | CHAR(6) | NOT NULL, regex `^[0-9]{6}$` |
| state | VARCHAR(50) | NOT NULL |
| mobile | VARCHAR(50) | NULL |
| is_primary | TINYINT(1) | DEFAULT 0 |
| + audit fields | | |

**Indexes:** `INDEX(party_id)`, `INDEX(state)`

---

#### 4.3.7 `contracts`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| contract_no | VARCHAR(20) | NOT NULL, UNIQUE |
| contract_type | ENUM | NOT NULL: NEW, AMENDMENT, CANCEL |
| contract_date | DATE | NOT NULL |
| seller_id | CHAR(36) | FK → parties.id, NOT NULL |
| buyer_id | CHAR(36) | FK → parties.id, NOT NULL |
| is_nominee | TINYINT(1) | DEFAULT 0 |
| commodity_id | CHAR(36) | FK → commodities.id, NOT NULL |
| quality_allowance | VARCHAR(1000) | NULL |
| packing | VARCHAR(100) | NOT NULL |
| qty_low | DECIMAL(10,2) | NOT NULL, CHECK > 0 |
| qty_high | DECIMAL(10,2) | NOT NULL, CHECK > 0 |
| qty_unit | ENUM | NOT NULL: MT, KGS, QUINTAL, BAGS |
| rate | DECIMAL(12,2) | NOT NULL, CHECK > 0 |
| currency | ENUM | NOT NULL: RUPEE, DOLLAR, EURO |
| tax_id | CHAR(36) | FK → taxes.id, NOT NULL |
| despatch_from | DATE | NOT NULL |
| despatch_to | DATE | NOT NULL, CHECK >= despatch_from |
| broker_id | CHAR(36) | FK → brokers.id, NOT NULL |
| broker_rate | DECIMAL(8,2) | NOT NULL |
| final_qty | DECIMAL(10,2) | NULL |
| tolerance_percent | DECIMAL(5,2) | DEFAULT 5.00 |
| fulfilled_qty | DECIMAL(10,2) | DEFAULT 0.00 |
| status | ENUM | NOT NULL: CONTRACT_OPEN, CLOSED, CANCELLED |
| print_despatch_si | TINYINT(1) | DEFAULT 0 |
| print_tr_final_docs | TINYINT(1) | DEFAULT 0 |
| print_payment | TINYINT(1) | DEFAULT 0 |
| version | INTEGER | NOT NULL DEFAULT 0 |
| + audit fields | | |

**Constraints:**
```sql
CHECK (seller_id <> buyer_id)
CHECK (qty_high >= qty_low)
```

**Indexes:** `UNIQUE(contract_no)`, `INDEX(seller_id)`, `INDEX(buyer_id)`, `INDEX(status)`, `INDEX(contract_date)`

---

#### 4.3.8 `despatches`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| despatch_no | VARCHAR(20) | NOT NULL, UNIQUE |
| despatch_date | DATE | NOT NULL |
| contract_id | CHAR(36) | FK → contracts.id, NOT NULL |
| bags | INTEGER | NULL |
| quantity | DECIMAL(10,2) | NOT NULL, CHECK > 0 |
| delivery_type | VARCHAR(20) | NULL (e.g., FOR) |
| billing_status | ENUM | NOT NULL: UNBILLED, BILLED |
| bill_id | CHAR(36) | FK → bills.id, NULL |
| + audit fields | | |

**Indexes:** `UNIQUE(despatch_no)`, `INDEX(contract_id)`, `INDEX(billing_status)`, `INDEX(despatch_date)`

---

#### 4.3.9 `bills`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| bill_no | VARCHAR(20) | NOT NULL, UNIQUE |
| bill_date | DATE | NOT NULL |
| party_id | CHAR(36) | FK → parties.id, NOT NULL |
| tax_id | CHAR(36) | FK → taxes.id, NOT NULL |
| from_date | DATE | NOT NULL |
| to_date | DATE | NOT NULL |
| base_amount | DECIMAL(14,2) | NOT NULL |
| igst_amount | DECIMAL(14,2) | NOT NULL DEFAULT 0 |
| cgst_amount | DECIMAL(14,2) | NOT NULL DEFAULT 0 |
| sgst_amount | DECIMAL(14,2) | NOT NULL DEFAULT 0 |
| gross_amount | DECIMAL(14,2) | NOT NULL |
| brokerage_amount | DECIMAL(14,2) | NOT NULL DEFAULT 0 |
| supply_type | ENUM | NOT NULL: INTRA_STATE, INTER_STATE |
| + audit fields | | |

**Indexes:** `UNIQUE(bill_no)`, `INDEX(party_id)`, `INDEX(bill_date)`

---

#### 4.3.10 `bill_line_items`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| bill_id | CHAR(36) | FK → bills.id, NOT NULL |
| despatch_id | CHAR(36) | FK → despatches.id, NOT NULL, UNIQUE |
| contract_id | CHAR(36) | FK → contracts.id, NOT NULL |
| quantity | DECIMAL(10,2) | NOT NULL |
| rate | DECIMAL(12,2) | NOT NULL |
| line_base_amount | DECIMAL(14,2) | NOT NULL |
| + audit fields | | |

**Constraint:** `UNIQUE(despatch_id)` — prevents duplicate billing of same despatch.

---

#### 4.3.11 `users` *(recommended — not in source TDD)*

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| username | VARCHAR(50) | NOT NULL, UNIQUE |
| email | VARCHAR(100) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL |
| role | ENUM | ADMIN, TRADER, OPERATIONS, ACCOUNTS, MANAGER |
| is_active | TINYINT(1) | DEFAULT 1 |
| + audit fields | | |

---

#### 4.3.13 `company_settings` *(Tradeswift organization profile)*

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) | PK |
| company_name | VARCHAR(200) | NOT NULL — e.g., "TRADESWIFT COMMODITIES PVT. LTD." |
| short_name | VARCHAR(50) | NOT NULL — e.g., "TRADESWIFT" |
| address_line | TEXT | NOT NULL |
| city | VARCHAR(50) | NOT NULL |
| state | VARCHAR(50) | NOT NULL — default: RAJASTHAN |
| pincode | CHAR(6) | NOT NULL |
| gst_tin | VARCHAR(15) | NOT NULL |
| phone | VARCHAR(50) | NULL |
| email | VARCHAR(100) | NULL |
| logo_path | VARCHAR(255) | NULL |
| invoice_footer | TEXT | NULL |
| + audit fields | | |

> Single row table — seeded at deployment with Tradeswift's official details. Used on tax invoices, contract prints, and report headers.

---

#### 4.3.14 `document_sequences`

| Column | Type | Constraints |
|--------|------|-------------|
| id | CHAR(36) / UUID | PK |
| sequence_type | VARCHAR(30) | NOT NULL, UNIQUE |
| prefix | VARCHAR(10) | NOT NULL |
| current_value | INTEGER | NOT NULL DEFAULT 0 |
| pad_length | INTEGER | NOT NULL DEFAULT 5 |

Used for auto-generating: `contract_no`, `bill_no`, `despatch_no`, `tax_code`, `party_code`.

---

### 4.4 MySQL-Specific Design Rules

| Rule | Detail |
|------|--------|
| **Storage engine** | All tables use `ENGINE=InnoDB` |
| **Charset** | `utf8mb4` on database and all tables |
| **Primary keys** | `CHAR(36)` storing UUID strings |
| **Boolean columns** | `TINYINT(1)` — 0 = false, 1 = true |
| **Money columns** | `DECIMAL` — never use FLOAT/DOUBLE |
| **CHECK constraints** | Supported in MySQL 8.0.16+ (qty > 0, seller ≠ buyer) |
| **Row locking** | `SELECT ... FOR UPDATE` supported in InnoDB (used in billing) |
| **Optimistic lock** | Manual `version INT` column with conditional UPDATE |
| **JSON columns** | MySQL native `JSON` type for audit_logs |
| **Enum columns** | SQLAlchemy `Enum` mapped to MySQL ENUM or VARCHAR (prefer VARCHAR for easier migrations) |
| **Foreign keys** | Explicit FK constraints with `ON DELETE RESTRICT` |
| **Timestamps** | Store UTC in `DATETIME(6)`; display IST in UI |

**Table creation template:**
```sql
CREATE TABLE commodities (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  commodity_name    VARCHAR(100) NOT NULL,
  comm_short_name   VARCHAR(30)  NOT NULL,
  quality_allowance VARCHAR(1000),
  created_by        VARCHAR(100) NOT NULL,
  created_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  modified_by       VARCHAR(100),
  modified_at       DATETIME(6),
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_commodity_name (commodity_name),
  KEY idx_comm_short_name (comm_short_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 4.5 Enum Definitions (Python)

```python
# app/models/enums.py
import enum

class ContractType(str, enum.Enum):
    NEW = "NEW"
    AMENDMENT = "AMENDMENT"
    CANCEL = "CANCEL"

class ContractStatus(str, enum.Enum):
    CONTRACT_OPEN = "CONTRACT_OPEN"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"

class QtyUnit(str, enum.Enum):
    MT = "MT"
    KGS = "KGS"
    QUINTAL = "QUINTAL"
    BAGS = "BAGS"

class Currency(str, enum.Enum):
    RUPEE = "RUPEE"
    DOLLAR = "DOLLAR"
    EURO = "EURO"

class CustomerType(str, enum.Enum):
    REGISTERED = "REGISTERED"
    UNREGISTERED = "UNREGISTERED"
    COMPOSITION = "COMPOSITION"
    SEZ = "SEZ"

class LocationType(str, enum.Enum):
    BILLING = "BILLING"
    SHIPPING = "SHIPPING"
    BRANCH = "BRANCH"

class BillingStatus(str, enum.Enum):
    UNBILLED = "UNBILLED"
    BILLED = "BILLED"

class SupplyType(str, enum.Enum):
    INTRA_STATE = "INTRA_STATE"
    INTER_STATE = "INTER_STATE"

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    TRADER = "TRADER"
    OPERATIONS = "OPERATIONS"
    ACCOUNTS = "ACCOUNTS"
    MANAGER = "MANAGER"
```

### 4.6 SQLAlchemy Base Model Example

```python
# app/models/base.py
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class AuditMixin:
    created_by: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=datetime.utcnow)
    modified_by: Mapped[str | None] = mapped_column(String(100))
    modified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Commodity(Base, AuditMixin):
    __tablename__ = "commodities"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=uuid.uuid4)
    commodity_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    comm_short_name: Mapped[str] = mapped_column(String(30), nullable=False)
    quality_allowance: Mapped[str | None] = mapped_column(String(1000))
```

---

## 5. API Design

### 5.1 API Conventions

| Convention | Value |
|------------|-------|
| Base URL | `/api/v1` |
| Format | JSON |
| Auth | Bearer JWT |
| Date format | ISO 8601 (`YYYY-MM-DD`) in API; DD-MM-YYYY in UI |
| Pagination | `?page=1&limit=20` |
| Sorting | `?sort=createdAt&order=desc` |
| Errors | RFC 7807 Problem Details |

### 5.2 Standard Error Response

```json
{
  "type": "VALIDATION_ERROR",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Seller & Buyer cannot be the same party.",
  "errors": [
    { "field": "sellerId", "message": "Seller & Buyer cannot be the same party." }
  ],
  "timestamp": "2026-04-01T10:15:30Z"
}
```

### 5.3 Master APIs

#### Commodities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/masters/commodities` | List all commodities |
| GET | `/masters/commodities/:id` | Get by ID |
| POST | `/masters/commodities` | Create commodity |
| PUT | `/masters/commodities/:id` | Update commodity |
| DELETE | `/masters/commodities/:id` | Soft delete (is_active=false) |

**POST Request:**
```json
{
  "commodityName": "Mustard Oil Cake",
  "commShortName": "MOC",
  "qualityAllowance": "MOISTURE - 8%, OIL - 7.50%"
}
```

#### Units, Brokers, Taxes — same CRUD pattern

**POST `/masters/taxes`:**
```json
{
  "taxName": "GST 5%",
  "igstPercent": 5.00,
  "cgstPercent": 2.50,
  "sgstPercent": 2.50
}
```

---

### 5.4 Party (COA) APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/parties` | List parties (search: `?q=shiv`) |
| GET | `/parties/:id` | Get party with addresses |
| POST | `/parties` | Create party + addresses |
| PUT | `/parties/:id` | Update party |
| POST | `/parties/:id/addresses` | Add address |
| PUT | `/parties/:id/addresses/:addressId` | Update address |
| DELETE | `/parties/:id/addresses/:addressId` | Remove address |

**POST `/parties`:**
```json
{
  "name": "SHIV SHANKAR OIL MILL (BHIWANI) (HARYANA)",
  "shortName": "SHIV SHANKAR OIL MILL (BHIWANI) (HR)",
  "customerType": "REGISTERED",
  "gstTin": "06COIPN0560E1Z6",
  "gstApplyDate": "2026-07-10",
  "accountNo": "1234567890",
  "ifscCode": "SBIN0001234",
  "addresses": [
    {
      "contactPerson": "Mr. Amit",
      "locationType": "BILLING",
      "phone": "7015581040",
      "email": "dalmiasumit225@gmail.com",
      "addressLine": "Near Tosham Road, Tehsil Tosham, Kairu",
      "city": "Bhiwani",
      "pincode": "127029",
      "state": "HARYANA",
      "mobile": "7015581040",
      "isPrimary": true
    }
  ]
}
```

---

### 5.5 Contract APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/contracts` | List contracts (filters: status, date, party) |
| GET | `/contracts/:id` | Get contract detail |
| POST | `/contracts` | Create contract |
| PUT | `/contracts/:id` | Update contract |
| PATCH | `/contracts/:id/closure` | Set final quantity |
| GET | `/contracts/:id/balance` | Remaining qty & fulfillment |

**POST `/contracts`** *(from TDD)*:
```json
{
  "type": "NEW",
  "date": "2026-04-01",
  "sellerId": "ACC-10029",
  "buyerId": "ACC-40912",
  "commodityId": "COMM-003",
  "qualityAllowance": "SS - 0.50%, MOISTURE - 8%, OIL - 7.50%",
  "packing": "IN OLD JUTE BAGS",
  "qtyLow": 100.00,
  "qtyHigh": 106.07,
  "unit": "MT",
  "rate": 29811.00,
  "currency": "INR",
  "taxId": "TAX-005",
  "despatchFrom": "2026-04-01",
  "despatchTo": "2026-04-30",
  "brokerId": "BRK-0012",
  "brokerageRate": 0.00,
  "printOptions": {
    "despatchSi": true,
    "trFinalDocs": false,
    "payment": true
  }
}
```

**Response (201):**
```json
{
  "status": "SUCCESS",
  "contractNo": "00002",
  "message": "Contract created successfully",
  "timestamp": "2026-04-01T10:15:30Z"
}
```

**PATCH `/contracts/:id/closure`:**
```json
{
  "finalQty": 106.00
}
```

---

### 5.6 Despatch APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/despatches` | List despatches |
| GET | `/despatches/unbilled` | Unbilled despatches for billing |
| POST | `/despatches` | Create despatch |
| GET | `/despatches/:id` | Get despatch detail |

**GET `/despatches/unbilled?partyId=ACC-40912&fromDate=2026-07-01&toDate=2026-07-20`** *(from TDD)*:

**Response (200):**
```json
{
  "partyId": "ACC-40912",
  "unbilledRecords": [
    {
      "despatchNo": "DSP-00891",
      "date": "2026-07-20",
      "contractNo": "00002",
      "commShort": "MUSTARD OIL CAKE",
      "bags": 680,
      "quantity": 34.025,
      "deliveryType": "FOR"
    }
  ]
}
```

**POST `/despatches`:**
```json
{
  "contractId": "uuid",
  "despatchDate": "2026-07-20",
  "bags": 680,
  "quantity": 34.025,
  "deliveryType": "FOR"
}
```

**Error (400) — tolerance exceeded:**
```json
{
  "type": "TOLERANCE_EXCEEDED",
  "title": "Dispatch Validation Failed",
  "status": 400,
  "detail": "Dispatch quantity exceeds contractual tolerance boundary."
}
```

---

### 5.7 Billing APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bills` | List bills |
| GET | `/bills/:id` | Get bill with line items |
| POST | `/bills` | Generate bill from selected despatches |
| GET | `/bills/:id/pdf` | Download invoice PDF |

**POST `/bills`:**
```json
{
  "billDate": "2026-07-20",
  "partyId": "ACC-40912",
  "taxId": "TAX-005",
  "fromDate": "2026-07-01",
  "toDate": "2026-07-20",
  "despatchIds": ["uuid-1", "uuid-2"]
}
```

**Response (201):**
```json
{
  "billNo": "INV-00001",
  "billDate": "2026-07-20",
  "partyId": "ACC-40912",
  "baseAmount": 1014567.75,
  "igstAmount": 50728.39,
  "cgstAmount": 0.00,
  "sgstAmount": 0.00,
  "grossAmount": 1065296.14,
  "brokerageAmount": 0.00,
  "supplyType": "INTER_STATE",
  "lineItems": [ ... ]
}
```

---

### 5.8 Report APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports/contract-register` | Contract register |
| GET | `/reports/sales-register` | Sales register |
| GET | `/reports/brokerage` | Brokerage report |
| GET | `/reports/*/export?format=pdf` | PDF export |

**Query params (all reports):** `fromDate`, `toDate`, `partyId`, `brokerId`

---

## 6. Application Layer Design

### 6.1 Project Structure (Python / FastAPI)

```
commodity-erp-backend/
├── app/
│   ├── main.py                      # FastAPI app entry point
│   ├── config.py                    # Settings via pydantic-settings
│   ├── database.py                  # SQLAlchemy engine & session
│   │
│   ├── api/
│   │   ├── deps.py                  # DB session, current user dependencies
│   │   └── v1/
│   │       ├── router.py            # Aggregates all v1 routes
│   │       ├── auth.py
│   │       ├── commodities.py
│   │       ├── units.py
│   │       ├── brokers.py
│   │       ├── taxes.py
│   │       ├── parties.py
│   │       ├── contracts.py
│   │       ├── despatches.py
│   │       ├── bills.py
│   │       └── reports.py
│   │
│   ├── models/                      # SQLAlchemy ORM models
│   │   ├── base.py
│   │   ├── enums.py
│   │   ├── commodity.py
│   │   ├── party.py
│   │   ├── contract.py
│   │   ├── despatch.py
│   │   └── bill.py
│   │
│   ├── schemas/                     # Pydantic request/response schemas
│   │   ├── commodity.py
│   │   ├── party.py
│   │   ├── contract.py
│   │   ├── despatch.py
│   │   ├── bill.py
│   │   └── common.py
│   │
│   ├── services/
│   │   ├── sequence_service.py
│   │   ├── party_service.py
│   │   ├── contract_service.py
│   │   ├── despatch_service.py
│   │   ├── billing_service.py
│   │   ├── tax_engine.py
│   │   ├── brokerage_service.py
│   │   └── report_service.py
│   │
│   ├── repositories/                # DB query layer (optional)
│   │   ├── contract_repo.py
│   │   └── despatch_repo.py
│   │
│   ├── core/
│   │   ├── security.py              # JWT encode/decode, password hash
│   │   ├── exceptions.py            # Custom HTTP exceptions
│   │   ├── permissions.py           # RBAC checks
│   │   └── audit.py                 # Audit context middleware
│   │
│   └── utils/
│       ├── validators.py            # GST-TIN, IFSC, pincode regex
│       └── pdf_generator.py         # ReportLab invoice PDF
│
├── alembic/                         # DB migrations
│   ├── versions/
│   └── env.py
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
├── requirements.txt
├── Dockerfile
└── .env
```

### 6.2 FastAPI Application Entry

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
from app.core.audit import AuditMiddleware

app = FastAPI(
    title="Tradeswift Commodity ERP API",
    description="Internal ERP for Tradeswift — commodity contracts, despatch & billing",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)
app.include_router(api_router, prefix="/api/v1")
```

### 6.3 Key Service Responsibilities

| Service | File | Responsibility |
|---------|------|----------------|
| **SequenceService** | `sequence_service.py` | Auto-generate contract_no, bill_no, despatch_no, tax_code |
| **PartyService** | `party_service.py` | CRUD + GST-TIN/IFSC validation |
| **ContractService** | `contract_service.py` | Create/update; seller ≠ buyer; set CONTRACT_OPEN |
| **DespatchService** | `despatch_service.py` | Tolerance check + optimistic lock on contract |
| **TaxEngine** | `tax_engine.py` | Supply type detection; IGST/CGST/SGST calculation |
| **BillingService** | `billing_service.py` | Bill creation in DB transaction |
| **BrokerageService** | `brokerage_service.py` | Commission per bill line |
| **ReportService** | `report_service.py` | Register queries + PDF export |
| **PdfGenerator** | `pdf_generator.py` | ReportLab invoice rendering |

### 6.4 BillingService — Python Implementation

```python
# app/services/billing_service.py
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.despatch import Despatch
from app.models.enums import BillingStatus
from app.services.tax_engine import TaxEngine
from app.services.brokerage_service import BrokerageService
from app.core.exceptions import DespatchAlreadyBilledError

class BillingService:
    def __init__(self, db: Session):
        self.db = db
        self.tax_engine = TaxEngine()
        self.brokerage_service = BrokerageService()

    def generate_bill(self, dto: CreateBillDTO, user_id: str) -> Bill:
        with self.db.begin():
            # 1. Lock unbilled despatches
            despatches = (
                self.db.execute(
                    select(Despatch)
                    .where(Despatch.id.in_(dto.despatch_ids))
                    .where(Despatch.billing_status == BillingStatus.UNBILLED)
                    .with_for_update()
                )
                .scalars()
                .all()
            )

            if len(despatches) != len(dto.despatch_ids):
                raise DespatchAlreadyBilledError(
                    "One or more despatches already billed"
                )

            # 2. Load contracts with seller/buyer states
            contracts = self._load_contracts_with_parties(despatches)
            tax = self.db.get(Tax, dto.tax_id)

            # 3. Compute line amounts
            line_items = []
            base_amount = Decimal("0")
            for d in despatches:
                contract = contracts[d.contract_id]
                line_base = d.quantity * contract.rate
                base_amount += line_base
                line_items.append({
                    "despatch_id": d.id,
                    "quantity": d.quantity,
                    "rate": contract.rate,
                    "line_base_amount": line_base,
                })

            # 4. GST calculation
            seller_state = contracts[despatches[0].contract_id].seller_state
            buyer_state = contracts[despatches[0].contract_id].buyer_state
            supply_type = self.tax_engine.get_supply_type(seller_state, buyer_state)
            tax_amounts = self.tax_engine.calculate(base_amount, tax, supply_type)

            # 5. Brokerage
            brokerage = self.brokerage_service.calculate(despatches, contracts)

            # 6. Create bill + line items
            bill = Bill(
                bill_no=SequenceService.next("BILL"),
                bill_date=dto.bill_date,
                party_id=dto.party_id,
                base_amount=base_amount,
                **tax_amounts,
                gross_amount=self.tax_engine.gross(base_amount, tax_amounts),
                brokerage_amount=brokerage,
                supply_type=supply_type,
                created_by=user_id,
            )
            self.db.add(bill)
            self.db.flush()

            for item in line_items:
                self.db.add(BillLineItem(bill_id=bill.id, **item, created_by=user_id))

            # 7. Mark despatches as BILLED
            for d in despatches:
                d.billing_status = BillingStatus.BILLED
                d.bill_id = bill.id

            return bill
```

### 6.5 Pydantic Schema Example

```python
# app/schemas/contract.py
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import date
from uuid import UUID
from decimal import Decimal

class ContractCreate(BaseModel):
    type: ContractType
    date: date
    seller_id: UUID
    buyer_id: UUID
    commodity_id: UUID
    packing: str = Field(max_length=100)
    qty_low: Decimal = Field(gt=0)
    qty_high: Decimal = Field(gt=0)
    unit: QtyUnit
    rate: Decimal = Field(gt=0)
    currency: Currency
    tax_id: UUID
    despatch_from: date
    despatch_to: date
    broker_id: UUID
    brokerage_rate: Decimal

    @model_validator(mode="after")
    def validate_parties_and_dates(self):
        if self.seller_id == self.buyer_id:
            raise ValueError("Seller & Buyer cannot be the same party.")
        if self.despatch_to < self.despatch_from:
            raise ValueError("Despatch To Date must be on or after From Date.")
        return self
```

---

## 7. Screen Technical Specifications

### 7.1 Screen Index

| Screen ID | Route | Component | API Dependencies |
|-----------|-------|-----------|------------------|
| SCR-COMM-01 | `/masters/commodities` | CommodityMasterPage | `/masters/commodities` |
| SCR-WGHT-02 | `/masters/units` | UnitsMasterPage | `/masters/units` |
| SCR-BRK-03 | `/masters/brokers` | BrokerMasterPage | `/masters/brokers` |
| SCR-TAX-04 | `/masters/taxes` | TaxMasterPage | `/masters/taxes` |
| SCR-COA-05 | `/parties` | PartyMasterPage | `/parties` |
| SCR-CNT-06 | `/contracts/new` | ContractEntryPage | `/contracts`, `/parties`, `/masters/*` |
| SCR-CNT-07 | `/contracts/:id/closure` | ContractClosurePage | `/contracts/:id/closure` |
| SCR-DSP-07 | `/despatches/new` | DespatchEntryPage | `/despatches`, `/contracts` |
| SCR-BIL-08 | `/billing/generate` | BillGenerationPage | `/despatches/unbilled`, `/bills` |

### 7.2 UI Component Patterns

| Pattern | Usage |
|---------|-------|
| **MasterListPage** | Reusable CRUD list + modal form for simple masters |
| **SearchSelect** | Async dropdown for Party, Commodity, Broker, Tax FK fields |
| **DateRangePicker** | Despatch range, bill filter range |
| **AddressCarousel** | Prev/Next navigation for multiple party addresses |
| **SelectableGrid** | Bill generation — checkbox column + Select All |
| **ReadOnlyTaxPanel** | IGST/CGST/SGST auto-computed display on bill screen |

### 7.3 Validation Strategy

| Layer | Tool | Purpose |
|-------|------|---------|
| **Backend (API)** | Pydantic v2 | Request/response validation, auto OpenAPI docs |
| **Frontend (UI)** | Zod | Client-side instant feedback before API call |
| **Database** | MySQL CHECK constraints (8.0.16+) + FK constraints | Last line of defense |

**Backend — Pydantic validators (`app/schemas/party.py`):**

```python
import re
from pydantic import BaseModel, field_validator

GST_TIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")

class PartyCreate(BaseModel):
    name: str
    gst_tin: str | None = None
    ifsc_code: str | None = None
    pincode: str

    @field_validator("gst_tin")
    @classmethod
    def validate_gst_tin(cls, v):
        if v and not GST_TIN_REGEX.match(v):
            raise ValueError("Invalid GST-TIN format")
        return v

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v):
        if v and not IFSC_REGEX.match(v):
            raise ValueError("Enter valid 11-character IFSC code.")
        return v

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, v):
        if not re.match(r"^[0-9]{6}$", v):
            raise ValueError("City & valid 6-digit Pincode required.")
        return v
```

**Frontend — Zod (unchanged, for React UI):**

```typescript
const gstTinSchema = z.string().regex(
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  'Invalid GST-TIN format'
);

const ifscSchema = z.string().regex(
  /^[A-Z]{4}0[A-Z0-9]{6}$/,
  'Enter valid 11-character IFSC code.'
);

const contractSchema = z.object({
  sellerId: z.string().uuid(),
  buyerId: z.string().uuid(),
  qtyLow: z.number().positive(),
  qtyHigh: z.number().positive(),
  despatchFrom: z.date(),
  despatchTo: z.date(),
}).refine(d => d.sellerId !== d.buyerId, {
  message: 'Seller & Buyer cannot be the same party.',
  path: ['sellerId']
}).refine(d => d.despatchTo >= d.despatchFrom, {
  message: 'Despatch To Date must be on or after From Date.',
  path: ['despatchTo']
});
```

### 7.4 SCR-COA-05 — Party Master UI Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ Chart Of Account                                                       │
├────────────────────────────────────────────────────────────────────────┤
│ Name:  [ SHIV SHANKAR OIL MILL (BHIWANI) (HARYANA)                   ] │
│ Short: [ SHIV SHANKAR OIL MILL (BHIWANI) (HR)                        ] │
│ ┌─ Address(es) [◄] 1 of 1 [►] ───────────────────────────────────────┐ │
│ │ Contact: [ Mr. Amit ]             Location: [ Billing ▼          ] │ │
│ │ Phone:   [ 7015581040 ]           Fax:      [                    ] │ │
│ │ Email:   [ dalmiasumit225@gmail.com                               ] │ │
│ │ Address: [ Near Tosham Road, Tehsil Tosham, Kairu                  ] │ │
│ │ City:    [ Bhiwani ]              Pincode:  [ 127029             ] │ │
│ │ State:   [ HARYANA ▼              ] Mobile: [ 7015581040         ] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ GST Detail ───────────────────────────────────────────────────────┐ │
│ │ GST-TIN: [ 06COIPN0560E1Z6 ] Date: [ 10-07-2026 ] Type: [Reg. ▼  ]│ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ ┌─ Banking ────────────────────────────────────────────────────────────┐ │
│ │ A/c No:  [              ]         IFSC:   [ SBIN0001234           ] │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                              [Save]  [Cancel]                          │
└────────────────────────────────────────────────────────────────────────┘
```

**State management:** `addresses[]` array in form state; carousel index for current address.

---

## 8. Business Logic Implementation

### 8.1 GST Tax Engine

```python
# app/services/tax_engine.py
from decimal import Decimal, ROUND_HALF_UP
from app.models.enums import SupplyType
from app.models.tax import Tax

def round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

class TaxEngine:
    def get_supply_type(self, seller_state: str, buyer_state: str) -> SupplyType:
        if seller_state.strip().upper() == buyer_state.strip().upper():
            return SupplyType.INTRA_STATE
        return SupplyType.INTER_STATE

    def calculate(
        self, base_amount: Decimal, tax: Tax, supply_type: SupplyType
    ) -> dict:
        if supply_type == SupplyType.INTRA_STATE:
            return {
                "igst_amount": Decimal("0"),
                "cgst_amount": round2(base_amount * tax.cgst_percent / 100),
                "sgst_amount": round2(base_amount * tax.sgst_percent / 100),
            }
        return {
            "igst_amount": round2(base_amount * tax.igst_percent / 100),
            "cgst_amount": Decimal("0"),
            "sgst_amount": Decimal("0"),
        }

    def gross(self, base: Decimal, tax_amounts: dict) -> Decimal:
        return round2(
            base
            + tax_amounts["igst_amount"]
            + tax_amounts["cgst_amount"]
            + tax_amounts["sgst_amount"]
        )
```

**State resolution:** Use primary billing address state for seller and buyer parties.

### 8.2 Despatch Tolerance Validation

```python
# app/services/despatch_service.py
from decimal import Decimal
from app.core.exceptions import ToleranceExceededError

def validate_despatch_tolerance(contract: Contract, new_qty: Decimal) -> None:
    max_allowed = contract.final_qty or contract.qty_high
    tolerance_qty = max_allowed * (contract.tolerance_percent / 100)
    upper_bound = max_allowed + tolerance_qty
    projected_total = contract.fulfilled_qty + new_qty

    if projected_total > upper_bound:
        raise ToleranceExceededError(
            "Dispatch quantity exceeds contractual tolerance boundary."
        )
```

### 8.3 Contract Final Quantity Default

```python
def get_billing_quantity(contract: Contract) -> Decimal:
    return contract.final_qty or contract.qty_high
```

### 8.4 Brokerage Calculation

```python
def calculate_brokerage(fulfilled_qty: Decimal, broker_rate: Decimal) -> Decimal:
    return round2(fulfilled_qty * broker_rate)
```

Applied per bill line using contract's `broker_rate` and despatch quantity.

### 8.5 Auto-Number Generation

```python
# app/services/sequence_service.py
from sqlalchemy.orm import Session
from app.models.document_sequence import DocumentSequence

class SequenceService:
    @staticmethod
    def next(db: Session, sequence_type: str) -> str:
        seq = (
            db.query(DocumentSequence)
            .filter_by(sequence_type=sequence_type)
            .with_for_update()
            .one()
        )
        seq.current_value += 1
        db.flush()
        padded = str(seq.current_value).zfill(seq.pad_length)
        return f"{seq.prefix}{padded}"

# Examples:
# CONTRACT → 00001, 00002
# DESPATCH → DSP-00001
# BILL     → INV-00001
# TAX      → TAX-001
# PARTY    → ACC-10029
```

---

## 9. Security Design

### 9.1 Authentication

- JWT-based authentication via `python-jose`
- Access token (15 min) and refresh token (7 days)
- Passwords hashed with `passlib` + bcrypt (cost factor 12)

```python
# app/core/security.py
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_minutes: int = 15) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=expires_minutes)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
```

### 9.2 FastAPI Auth Dependency

```python
# app/api/deps.py
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        user = db.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Unauthorized")

def require_role(*roles: UserRole):
    def checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker
```

### 9.2 Role-Based Access Control (RBAC)

| Role | Masters | Contracts | Despatch | Billing | Reports |
|------|---------|-----------|----------|---------|---------|
| ADMIN | CRUD | CRUD | CRUD | CRUD | Read/Export |
| TRADER | Read | CRUD | Read | Read | Read |
| OPERATIONS | Read | Read | CRUD | — | — |
| ACCOUNTS | Read | Read | Read | CRUD | Read/Export |
| MANAGER | Read | Read | Read | Read | Read/Export |

### 9.3 API Security

- HTTPS only in production
- Rate limiting: 100 req/min per user
- Input sanitization on all string fields
- SQL injection prevention via ORM parameterized queries
- CORS restricted to frontend origin

---

## 10. Concurrency & Transactions

### 10.1 Optimistic Locking — Contract Fulfillment

```python
# app/services/despatch_service.py
from sqlalchemy import update
from app.core.exceptions import OptimisticLockError

def create_despatch(db: Session, dto: DespatchCreate, user_id: str):
    with db.begin():
        contract = db.get(Contract, dto.contract_id)
        validate_despatch_tolerance(contract, dto.quantity)

        # Optimistic lock: update only if version matches
        result = db.execute(
            update(Contract)
            .where(Contract.id == dto.contract_id)
            .where(Contract.version == contract.version)
            .values(
                fulfilled_qty=Contract.fulfilled_qty + dto.quantity,
                version=Contract.version + 1,
                modified_by=user_id,
            )
        )

        if result.rowcount == 0:
            raise OptimisticLockError(
                "Contract was modified by another user. Please retry."
            )

        despatch = Despatch(
            despatch_no=SequenceService.next(db, "DESPATCH"),
            **dto.model_dump(),
            billing_status=BillingStatus.UNBILLED,
            created_by=user_id,
        )
        db.add(despatch)
        return despatch
```

**SQLAlchemy:** Uses manual `version` column with conditional `UPDATE ... WHERE version = :current`.

### 10.2 Bill Generation — Pessimistic Lock

During bill creation, despatch rows are locked within a DB transaction:

```sql
SELECT * FROM despatches
WHERE id IN (...)
  AND billing_status = 'UNBILLED'
FOR UPDATE;
```

Prevents duplicate billing under concurrent requests.

### 10.3 Transaction Boundaries

| Operation | Transaction Scope |
|-----------|-------------------|
| Create despatch | Update despatch + increment contract.fulfilled_qty + version check |
| Generate bill | Create bill + line items + update all despatches to BILLED |
| Create contract | Single insert (no cross-entity) |

---

## 11. Audit Trail Design

### 11.1 Audit Middleware (FastAPI)

```python
# app/core/audit.py
from starlette.middleware.base import BaseHTTPMiddleware
from contextvars import ContextVar

current_user_id: ContextVar[str] = ContextVar("current_user_id", default="SYSTEM")

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Set from JWT after auth; default SYSTEM for unauthenticated
        token_user = getattr(request.state, "user_id", None)
        current_user_id.set(token_user or "SYSTEM")
        return await call_next(request)

def get_audit_user() -> str:
    return current_user_id.get()
```

### 11.2 SQLAlchemy Event Listener (auto audit on insert/update)

```python
# app/models/base.py
from sqlalchemy import event
from app.core.audit import get_audit_user

@event.listens_for(AuditMixin, "before_insert", propagate=True)
def set_created(mapper, connection, target):
    target.created_by = get_audit_user()
    target.created_at = datetime.utcnow()

@event.listens_for(AuditMixin, "before_update", propagate=True)
def set_modified(mapper, connection, target):
    target.modified_by = get_audit_user()
    target.modified_at = datetime.utcnow()
```

### 11.2 Audit Log Table *(optional extension)*

```sql
CREATE TABLE audit_logs (
  id           CHAR(36) PRIMARY KEY,
  entity_type  VARCHAR(50) NOT NULL,
  entity_id    CHAR(36) NOT NULL,
  action       ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  old_values   JSON,
  new_values   JSON,
  performed_by VARCHAR(100) NOT NULL,
  performed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 12. Reporting & Document Generation

### 12.1 Report Queries

#### Contract Register
```sql
SELECT c.contract_no, c.contract_date, c.contract_type, c.status,
       s.name AS seller, b.name AS buyer,
       com.comm_short_name, c.qty_high, c.rate, c.fulfilled_qty
FROM contracts c
JOIN parties s ON c.seller_id = s.id
JOIN parties b ON c.buyer_id = b.id
JOIN commodities com ON c.commodity_id = com.id
WHERE c.contract_date BETWEEN :fromDate AND :toDate
ORDER BY c.contract_date DESC;
```

#### Sales Register
```sql
SELECT b.bill_no, b.bill_date, p.name AS party,
       b.base_amount, b.igst_amount, b.cgst_amount, b.sgst_amount, b.gross_amount
FROM bills b
JOIN parties p ON b.party_id = p.id
WHERE b.bill_date BETWEEN :fromDate AND :toDate
ORDER BY b.bill_date DESC;
```

#### Brokerage Report
```sql
SELECT br.broker_name, c.contract_no,
       SUM(d.quantity) AS fulfilled_qty, c.broker_rate,
       SUM(d.quantity * c.broker_rate) AS brokerage_amount
FROM despatches d
JOIN contracts c ON d.contract_id = c.id
JOIN brokers br ON c.broker_id = br.id
WHERE d.despatch_date BETWEEN :fromDate AND :toDate
GROUP BY br.broker_name, c.contract_no, c.broker_rate;
```

### 12.2 PDF Generation

| Document | Trigger | Library |
|----------|---------|---------|
| Tax Invoice | Bill Generation → Print | **ReportLab** |
| Contract Print | Contract Entry → Print | **ReportLab** |
| Despatch/SI | Contract print flags | **ReportLab** |
| Register Export | Report page → Export PDF | **ReportLab** |

```python
# app/utils/pdf_generator.py
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, Paragraph
from io import BytesIO

def generate_invoice_pdf(bill: Bill) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = [
        Paragraph(f"Tax Invoice: {bill.bill_no}", style=title_style),
        Paragraph(f"Party: {bill.party.name}", style=normal_style),
        build_line_items_table(bill.line_items),
        build_tax_summary(bill),
    ]
    doc.build(elements)
    return buffer.getvalue()
```

**Invoice PDF sections:**
1. **Tradeswift company header** — name, address, GSTIN, logo (from `company_settings`)
2. Bill To (party name, address, GSTIN)
3. Line items table (despatch no, date, commodity, qty, rate, amount)
4. Tax breakdown (IGST/CGST/SGST)
5. Gross total in words + Tradeswift invoice footer

---

## 13. Error Handling

### 13.1 Error Code Catalog

| Code | HTTP | Message |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Field validation failed |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violation |
| `SELLER_BUYER_SAME` | 400 | Seller & Buyer cannot be the same party. |
| `TOLERANCE_EXCEEDED` | 400 | Dispatch quantity exceeds contractual tolerance boundary. |
| `DESPATCH_ALREADY_BILLED` | 409 | Despatch already included in a bill |
| `OPTIMISTIC_LOCK_FAILURE` | 409 | Record modified by another user |
| `PARTY_INACTIVE` | 400 | Selected party is not active |
| `BILL_DATE_INVALID` | 400 | Bill date cannot be prior to contract date |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |

### 13.2 Validation Error Messages (from TDD)

| Field | Error Message |
|-------|---------------|
| Commodity Name duplicate | Commodity name already exists. |
| Comm Short Name missing | Short name required for reports. |
| Unit Name missing | Weightment rule name required. |
| Broker Name empty | Broker name cannot be empty. |
| Tax % invalid | Must be valid percentage. |
| Party Name invalid | Enter valid full legal entity name. |
| IFSC invalid | Enter valid 11-character IFSC code. |
| Despatch range invalid | Despatch To Date must be on or after From Date. |

---

## 14. Deployment Architecture

### 14.1 Environment Topology

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐
│   Browser   │────>│   Nginx     │────>│  FastAPI (Uvicorn)  │
│  (React UI) │     │  (Reverse   │     │  Python 3.11+       │
└─────────────┘     │   Proxy)    │     └──────────┬──────────┘
                    └─────────────┘                │
                                                   ▼
                                            ┌─────────────┐
                                            │ MySQL 8.0   │
                                            └─────────────┘
```

**Production:** Gunicorn with Uvicorn workers:
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 14.2 Environment Configuration

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string (`mysql+pymysql://user:pass@host:3306/tradeswift_erp?charset=utf8mb4`) |
| `JWT_SECRET` | JWT signing key |
| `JWT_EXPIRES_MINUTES` | Access token expiry (default 15) |
| `JWT_REFRESH_DAYS` | Refresh token expiry (default 7) |
| `PORT` | API server port (default 8000) |
| `CORS_ORIGINS` | Comma-separated frontend URLs |
| `ENVIRONMENT` | development / production |

### 14.3 Docker Compose (Development)

```yaml
services:
  api:
    build: ./backend
    ports: ["8000:8000"]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: mysql+pymysql://user:pass@db:3306/tradeswift_erp?charset=utf8mb4
      JWT_SECRET: dev-secret-change-in-prod
    volumes:
      - ./backend:/app
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    depends_on: [api]

  db:
    image: mysql:8.0
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --default-authentication-plugin=mysql_native_password
    environment:
      MYSQL_DATABASE: tradeswift_erp
      MYSQL_USER: user
      MYSQL_PASSWORD: pass
      MYSQL_ROOT_PASSWORD: rootpass
    ports: ["3306:3306"]
    volumes: [mysql_data:/var/lib/mysql]
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mysql_data:
```

### 14.4 Backend Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

---

## 15. Testing Strategy

### 15.1 Test Pyramid

| Level | Focus | Tools |
|-------|-------|-------|
| **Unit** | TaxEngine, tolerance, brokerage | **pytest** |
| **Integration** | API endpoints + DB | **pytest + httpx AsyncClient + test DB** |
| **E2E** | Full contract → despatch → bill flow | Playwright / Cypress (frontend) |

### 15.2 pytest Configuration

```ini
# pytest.ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import get_db, Base, engine

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

### 15.2 Critical Test Cases

| ID | Scenario | Expected |
|----|----------|----------|
| TC-001 | Create contract with same seller and buyer | 400 error |
| TC-002 | Despatch within tolerance | Success; fulfilled_qty updated |
| TC-003 | Despatch exceeding tolerance | 400 TOLERANCE_EXCEEDED |
| TC-004 | Intra-state bill (same state) | CGST + SGST applied, IGST = 0 |
| TC-005 | Inter-state bill (different states) | IGST applied, CGST/SGST = 0 |
| TC-006 | Bill same despatch twice | 409 DESPATCH_ALREADY_BILLED |
| TC-007 | Concurrent despatch on same contract | One succeeds; other gets OPTIMISTIC_LOCK_FAILURE |
| TC-008 | Contract closure with no finalQty | Billing uses qtyHigh |
| TC-009 | GST-TIN invalid format | 400 validation error |
| TC-010 | Unbilled query after billing | Despatch not returned |

### 15.3 Sample Unit Test — Tax Engine

```python
# tests/unit/test_tax_engine.py
from decimal import Decimal
import pytest
from app.services.tax_engine import TaxEngine
from app.models.enums import SupplyType

@pytest.fixture
def tax_engine():
    return TaxEngine()

@pytest.fixture
def tax_5_percent():
    return Tax(igst_percent=Decimal("5"), cgst_percent=Decimal("2.5"), sgst_percent=Decimal("2.5"))

def test_inter_state_applies_igst_only(tax_engine, tax_5_percent):
    result = tax_engine.calculate(Decimal("100000"), tax_5_percent, SupplyType.INTER_STATE)
    assert result["igst_amount"] == Decimal("5000.00")
    assert result["cgst_amount"] == Decimal("0")
    assert result["sgst_amount"] == Decimal("0")

def test_intra_state_applies_cgst_sgst(tax_engine, tax_5_percent):
    result = tax_engine.calculate(Decimal("100000"), tax_5_percent, SupplyType.INTRA_STATE)
    assert result["igst_amount"] == Decimal("0")
    assert result["cgst_amount"] == Decimal("2500.00")
    assert result["sgst_amount"] == Decimal("2500.00")
```

### 15.4 Sample Integration Test — Contract API

```python
# tests/integration/test_contracts.py
import pytest

@pytest.mark.asyncio
async def test_create_contract_same_seller_buyer_fails(client, auth_headers):
    payload = {
        "sellerId": "same-uuid",
        "buyerId": "same-uuid",
        ...
    }
    response = await client.post("/api/v1/contracts", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert "same party" in response.json()["detail"][0]["msg"].lower()
```

---

## 16. Appendices

### Appendix A — Indian States List (GST State Codes)

Used in Party Master state dropdown. Store as reference table `indian_states`:

| State | GST Code |
|-------|----------|
| HARYANA | 06 |
| RAJASTHAN | 08 |
| DELHI | 07 |
| ... | ... |

*(Full 36 states + UTs to be loaded from standard GST state code list)*

### Appendix B — Sequence Prefix Configuration

| Sequence Type | Prefix | Example |
|---------------|--------|---------|
| CONTRACT | *(none)* | 00001 |
| DESPATCH | DSP- | DSP-00891 |
| BILL | INV- | INV-00001 |
| TAX | TAX- | TAX-005 |
| PARTY | ACC- | ACC-10029 |

### Appendix C — API Endpoint Summary

| Module | Endpoints |
|--------|-----------|
| Auth | POST `/auth/login`, POST `/auth/refresh` |
| Commodities | CRUD `/masters/commodities` |
| Units | CRUD `/masters/units` |
| Brokers | CRUD `/masters/brokers` |
| Taxes | CRUD `/masters/taxes` |
| Parties | CRUD `/parties`, address sub-routes |
| Contracts | CRUD `/contracts`, PATCH `/contracts/:id/closure` |
| Despatches | CRUD `/despatches`, GET `/despatches/unbilled` |
| Bills | CRUD `/bills`, GET `/bills/:id/pdf` |
| Reports | GET `/reports/contract-register`, `/sales-register`, `/brokerage` |

### Appendix D — Requirement Traceability

| SRD Requirement | TDD Section |
|-----------------|-------------|
| REQ-COMM-* | §4.3.1, §5.3, §7.1 SCR-COMM-01 |
| REQ-COA-* | §4.3.5–6, §5.4, §7.4 |
| REQ-CNT-* | §4.3.7, §5.5, §8.3 |
| REQ-DSP-* | §4.3.8, §5.6, §8.2, §10.1 |
| REQ-BIL-* | §4.3.9–10, §5.7, §6.3, §8.1 |
| REQ-CALC-* | §8.1–8.5 |
| REQ-NFR-002 | §10.1 Optimistic Locking |
| REQ-NFR-004 | §11 Audit Trail |
| REQ-API-001–003 | §5.5, §5.6 |

### Appendix E — Implementation Phases

| Phase | Deliverables | Duration (Solo + AI) |
|-------|-------------|----------------------|
| Phase 1 | DB schema, auth, 4 masters + party | 2 weeks |
| Phase 2 | Contract + despatch + tolerance | 2 weeks |
| Phase 3 | Billing + tax engine + PDF | 2 weeks |
| Phase 4 | Reports + E2E tests + deploy | 1–2 weeks |

### Appendix F — FastAPI Router Example

```python
# app/api/v1/contracts.py
from fastapi import APIRouter, Depends, status
from app.schemas.contract import ContractCreate, ContractResponse
from app.services.contract_service import ContractService
from app.api.deps import get_db, get_current_user, require_role
from app.models.enums import UserRole

router = APIRouter(prefix="/contracts", tags=["Contracts"])

@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(
    dto: ContractCreate,
    db=Depends(get_db),
    user=Depends(require_role(UserRole.ADMIN, UserRole.TRADER)),
):
    service = ContractService(db)
    contract = service.create(dto, user_id=str(user.id))
    return ContractResponse(
        status="SUCCESS",
        contract_no=contract.contract_no,
        message="Contract created successfully",
    )
```

### Appendix G — Alembic Migration Commands

```bash
# Initialize migrations
alembic init alembic

# Generate migration from model changes
alembic revision --autogenerate -m "create initial tables"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

### Appendix H — Alembic MySQL Configuration

```python
# alembic/env.py (key settings)
config.set_main_option(
    "sqlalchemy.url",
    settings.DATABASE_URL  # mysql+pymysql://...
)

# When generating migrations, ensure all models import:
# from app.models import *  # so autogenerate detects all tables
```

```ini
# alembic.ini
sqlalchemy.url = mysql+pymysql://user:pass@localhost:3306/tradeswift_erp?charset=utf8mb4
```

**Initial database setup:**
```sql
CREATE DATABASE tradeswift_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

---

*End of Document*

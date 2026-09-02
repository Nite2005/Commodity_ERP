# Software Requirements Document (SRD)
## Tradeswift — Commodity Trading & ERP Management System

| Field | Value |
|-------|-------|
| **Document Version** | 1.2 |
| **Date** | 01 September 2026 |
| **Status** | Draft — Scope confirmed |
| **Client / Organization** | **Tradeswift** (Tradeswift Commodities Pvt. Ltd. / Tradeswift Group) |
| **Business Line** | **Physical commodities only** *(confirmed)* |
| **Source** | Technical Design Document (TDD) — Commodity Trading & ERP System |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Business Context](#2-business-context)
3. [Scope](#3-scope)
4. [User Roles & Personas](#4-user-roles--personas)
5. [System Architecture Overview](#5-system-architecture-overview)
6. [Functional Requirements](#6-functional-requirements)
7. [Business Rules & Calculations](#7-business-rules--calculations)
8. [Workflow Requirements](#8-workflow-requirements)
9. [API Requirements](#9-api-requirements)
10. [Reporting & Printing Requirements](#10-reporting--printing-requirements)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Data Requirements](#12-data-requirements)
13. [Assumptions & Constraints](#13-assumptions--constraints)
14. [Out of Scope / Open Items](#14-out-of-scope--open-items)
15. [Acceptance Criteria Summary](#15-acceptance-criteria-summary)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Document (SRD) defines the functional and non-functional requirements for the **Tradeswift Commodity Trading & ERP Management System** — a dedicated business application being built for **Tradeswift** to manage physical commodity trade operations, billing, and compliance.

### 1.2 Intended Audience

- Product owners and business stakeholders
- Developers and QA engineers
- Project managers

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| **Commodity** | Physical goods traded (e.g., mustard oil cake, grains) |
| **COA** | Chart of Accounts — party master for buyers, sellers, and counterparties |
| **Contract** | Legally binding purchase/sales agreement between buyer and seller |
| **Despatch** | Shipment/delivery of goods linked to a contract (challan entry) |
| **GST** | Goods and Services Tax (India) |
| **IGST** | Integrated GST — applicable on inter-state supplies |
| **CGST / SGST** | Central / State GST — applicable on intra-state supplies |
| **Brokerage** | Commission payable to a broker per fulfilled quantity |
| **Unbilled** | Despatch records not yet included in a tax invoice |
| **MT** | Metric Ton |
| **FK** | Foreign Key — reference to another master record |

---

## 2. Business Context

### 2.0 Client Organization — Tradeswift

| Attribute | Detail |
|-----------|--------|
| **Client Name** | Tradeswift (Tradeswift Commodities Private Limited / Tradeswift Group) |
| **Business Type** | **Physical commodity trading** (spot/physical goods — not exchange trading) |
| **Location** | Jaipur, Rajasthan, India |
| **System Purpose** | Internal ERP for Tradeswift staff to manage **physical** commodity contracts, despatch/challan, GST billing, and reports |
| **Deployment Model** | Single-tenant — built exclusively for Tradeswift (not multi-company SaaS) |
| **Scope Confirmed** | 01 September 2026 — Physical commodities line only |

> **Note:** Tradeswift's end customers (buyers like Shiv Shankar Oil Mill, sellers, brokers) are stored as **Party Master** records inside the system. They are **not** separate system users unless explicitly onboarded later.

### 2.1 Problem Statement

**Tradeswift** currently manages multiple parties, contracts, shipments, tax invoices, and broker commissions using manual registers and spreadsheets. This leads to data inconsistency, billing errors, incorrect GST application, duplicate invoicing, and poor visibility into open contracts and unbilled despatches.

### 2.2 Business Objectives

1. Centralize master data for commodities, parties, taxes, brokers, and weightment terms.
2. Digitize contract creation and track contract lifecycle status.
3. Record despatches against contracts with quantity tolerance enforcement.
4. Generate GST-compliant bills from unbilled despatches.
5. Automate tax split (IGST vs CGST+SGST) based on seller/buyer state.
6. Calculate and report brokerage commissions.
7. Provide audit-ready registers and printable documents.

### 2.3 Primary Users

**Tradeswift internal team** — staff of the trading company who:

| Role | Tradeswift Team Member | Activities |
|------|------------------------|------------|
| Admin | IT / senior ops | Masters setup, party configuration |
| Trader | Deal desk | Contract create/amend/cancel |
| Operations | Godown / logistics | Despatch entry |
| Accounts | Billing team | Bill generation, GST invoices |
| Manager | Management | Registers, brokerage reports |

External parties (buyers, sellers, brokers) interact with Tradeswift **offline** — their data lives in Party/Broker Master; they do not log into this system by default.

---

## 3. Scope

### 3.0 Business Scope Boundary *(Confirmed with Client)*

> **This system is for PHYSICAL COMMODITY TRADING only** — real goods moved by truck/rail, stored in godowns, measured in MT/quintal/bags, and billed with GST invoices.

| In Scope — Physical Commodities | Out of Scope — Exchange / Financial Trading |
|----------------------------------|---------------------------------------------|
| Agri commodities (mustard oil cake, grains, pulses, etc.) | MCX/NCDEX/NSE/BSE exchange trading |
| Buyer–seller spot contracts | Gold, silver, equity **futures/options on exchange** |
| Despatch, challan, bags, godown weightment | Online trading terminal / order placement |
| GST tax invoice on physical goods | Demat accounts, margin, SPAN |
| Truck/logistics fulfillment tracking | SEBI contract notes, exchange settlements |
| Broker commission on physical deals | Client brokerage ledger for exchange clients |

**REQ-SCOPE-001:** The system shall support only physical commodity trade workflows (Contract → Despatch → Bill).

**REQ-SCOPE-002:** Exchange-traded products and financial market operations shall be explicitly excluded from this release.

### 3.1 In Scope

| Module | Description |
|--------|-------------|
| Master Management | Commodity, Units/Weightment, Broker, Tax masters |
| Party Management | Chart of Accounts with multi-address, banking, and GST details |
| Contract Management | Contract entry, amendment/cancel types, contract closure |
| Despatch Management | Shipment/challan entries linked to contracts |
| Billing | Batch bill generation from unbilled despatches |
| Reporting | Contract register, sales register, brokerage reports |
| REST APIs | Contract creation and unbilled despatch retrieval (minimum) |

### 3.2 Out of Scope (Initial Release)

See [Section 14](#14-out-of-scope--open-items).

**Explicitly excluded — not part of this project:**

- MCX / NCDEX / NSE / BSE trading platform or order management
- Exchange-traded gold, silver, crude, equity, currency derivatives
- Demat account management and exchange client onboarding
- Margin calculation, SPAN, mark-to-market for exchange positions
- SEBI regulatory reporting for exchange brokerage
- Real-time market data feeds and trading terminals

---

## 4. User Roles & Personas

> **Note:** User authentication and role-based access are not specified in the source TDD. The following roles are inferred from workflow.

| Role | Persona | Responsibilities |
|------|---------|------------------|
| **System Admin** | Admin user | Configure masters (commodity, tax, broker, units), manage parties |
| **Trader** | Business operator | Create/amend/cancel contracts, contract closure |
| **Operations** | Godown/ logistics staff | Record despatch/challan entries |
| **Accounts / Billing** | Billing clerk | Generate bills, apply GST, print invoices |
| **Manager** | Management | View registers and brokerage reports |

**REQ-UR-001:** The system shall support distinct user roles with access appropriate to their responsibilities. *(Inferred — to be confirmed)*

---

## 5. System Architecture Overview

The system comprises four logical layers executed in sequence:

```
Master Management
       ↓
Party & Account Management (Chart of Accounts)
       ↓
Transaction Processing (Contract → Despatch → Bill)
       ↓
Reporting & Analytics
```

### 5.1 Module Dependency Rules

**REQ-ARCH-001:** Contract entry shall require active records in Commodity Master, Tax Master, Broker Master, and Party Master (COA).

**REQ-ARCH-002:** Despatch entry shall require an existing open contract.

**REQ-ARCH-003:** Bill generation shall require fulfilled despatch records with status unbilled.

---

## 6. Functional Requirements

### 6.1 Master Management Module

#### 6.1.1 Commodity Master (SCR-COMM-01)

**Objective:** Define base physical commodities and default quality specifications.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-COMM-001 | The system shall allow create, read, update, and delete of commodity records. | Must |
| REQ-COMM-002 | Commodity Name shall be mandatory, unique, max 100 characters, alphanumeric and spaces only. | Must |
| REQ-COMM-003 | On duplicate Commodity Name, the system shall display: "Commodity name already exists." | Must |
| REQ-COMM-004 | Comm Short Name shall be mandatory, max 30 characters, auto-converted to upper case. | Must |
| REQ-COMM-005 | On missing Short Name, the system shall display: "Short name required for reports." | Must |
| REQ-COMM-006 | Quality Allowance shall be optional, max 1000 characters (free text for specs such as ICUMSA, Moisture %, Oil %). | Should |
| REQ-COMM-007 | Quality Allowance shall auto-populate into contracts when a commodity is selected. | Must |

#### 6.1.2 Units Master / Weightment Master (SCR-WGHT-02)

**Objective:** Standardize terms for weight verification locations and conditions.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-UNIT-001 | The system shall allow CRUD operations on unit/weightment records. | Must |
| REQ-UNIT-002 | Unit Name shall be mandatory, unique, max 150 characters. | Must |
| REQ-UNIT-003 | Example values include: "FINAL AT LOADING AT EX-GODAM". | Should |
| REQ-UNIT-004 | On missing Unit Name, the system shall display: "Weightment rule name required." | Must |

#### 6.1.3 Broker Master (SCR-BRK-03)

**Objective:** Store broker entities for trade commission tracking (internal use).

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-BRK-001 | The system shall allow CRUD operations on broker records. | Must |
| REQ-BRK-002 | Broker Name shall be mandatory, unique, max 100 characters, auto-converted to upper case. | Must |
| REQ-BRK-003 | On empty Broker Name, the system shall display: "Broker name cannot be empty." | Must |
| REQ-BRK-004 | Broker records shall be selectable on contract entry. | Must |

#### 6.1.4 Tax Master (SCR-TAX-04)

**Objective:** Configure tax codes and applicable GST rate percentages.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-TAX-001 | The system shall allow CRUD operations on tax records. | Must |
| REQ-TAX-002 | Tax Code shall be auto-generated, read-only primary key, max 10 characters. | Must |
| REQ-TAX-003 | Tax Name shall be mandatory, unique, max 50 characters (e.g., "TAX FREE", "GST 5%"). | Must |
| REQ-TAX-004 | IGST %, CGST %, and SGST % shall each be mandatory, decimal (5,2), range 0.00 to 100.00. | Must |
| REQ-TAX-005 | On invalid percentage, the system shall display: "Must be valid percentage." | Must |

---

### 6.2 Party & Account Management — Chart of Accounts (SCR-COA-05)

**Objective:** Maintain buyer, seller, and counterparty business details, multiple address locations, banking parameters, and statutory GST information.

#### 6.2.1 Party Header Fields

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-COA-001 | The system shall allow CRUD operations on party (COA) records. | Must |
| REQ-COA-002 | Name shall be mandatory, unique, 3–150 characters. | Must |
| REQ-COA-003 | Short shall be mandatory, 2–50 characters. | Must |
| REQ-COA-004 | On invalid Name, display: "Enter valid full legal entity name." | Must |
| REQ-COA-005 | On invalid Short, display: "Enter short name for reports." | Must |

#### 6.2.2 Address Management (Multiple Addresses per Party)

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-COA-006 | The system shall support multiple addresses per party with navigation (e.g., 1 of N). | Must |
| REQ-COA-007 | Location shall be mandatory — options: Billing, Shipping, Branch. | Must |
| REQ-COA-008 | Contact Person — optional, alphabetic and spaces, max 100 characters. | Should |
| REQ-COA-009 | Phone — optional, max 50 characters, standard phone formatting validation. | Should |
| REQ-COA-010 | Email — optional, max 100 characters, RFC 5322 email validation. | Should |
| REQ-COA-011 | Address — mandatory, multi-line, max 3 lines, total 300 characters. | Must |
| REQ-COA-012 | City — mandatory, max 50 characters. | Must |
| REQ-COA-013 | Pincode — mandatory, exactly 6 digits (India). | Must |
| REQ-COA-014 | State — mandatory, dropdown from standard Indian State list (for GST state-code mapping). | Must |
| REQ-COA-015 | Mobile — optional. | Should |
| REQ-COA-016 | Fax — optional. | Could |

#### 6.2.3 Banking Fields

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-COA-017 | A/c No — optional, max 30 characters, numeric/alphanumeric. | Should |
| REQ-COA-018 | IFSC — optional, 11 characters, regex: `^[A-Z]{4}0[A-Z0-9]{6}$`. | Should |
| REQ-COA-019 | On invalid IFSC, display: "Enter valid 11-character IFSC code." | Must |

#### 6.2.4 GST Fields

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-COA-020 | Customer Type shall be mandatory — enum: Registered, Unregistered, Composition, SEZ. | Must |
| REQ-COA-021 | GST-TIN No — conditional mandatory if Customer Type is Registered; 15 characters; regex: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`. | Must |
| REQ-COA-022 | GST Apply Date — conditional mandatory for Registered customers; format DD-MM-YYYY. | Must |
| REQ-COA-023 | Party records shall be searchable/selectable as Seller or Buyer on contracts. | Must |
| REQ-COA-024 | Only active parties shall be selectable on transactions. | Must |

---

### 6.3 Contract Management

#### 6.3.1 Contract Entry (SCR-CNT-06)

**Objective:** Capture legally binding purchase/sales trade contracts including quantity, payment terms, and brokerage rates.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-CNT-001 | The system shall allow create, read, update of contract records. | Must |
| REQ-CNT-002 | Contract # shall be system auto-generated but editable, max 20 characters. | Must |
| REQ-CNT-003 | Type shall be mandatory — enum: NEW, AMENDMENT, CANCEL. | Must |
| REQ-CNT-004 | Date shall be mandatory, default system date, format DD-MM-YYYY. | Must |
| REQ-CNT-005 | Seller shall be mandatory, FK to active COA party; shall not equal Buyer. | Must |
| REQ-CNT-006 | Buyer shall be mandatory, FK to active COA party; shall not equal Seller. | Must |
| REQ-CNT-007 | On Seller = Buyer, display: "Seller & Buyer cannot be the same party." | Must |
| REQ-CNT-008 | Nominee — optional boolean checkbox, default false. | Should |
| REQ-CNT-009 | Commodity shall be mandatory, FK to Commodity Master; auto-populates Quality Allowance. | Must |
| REQ-CNT-010 | Quality Allowance — optional, max 1000 characters; editable; updates on commodity change. | Must |
| REQ-CNT-011 | Packing shall be mandatory, max 100 characters (e.g., "IN OLD JUTE BAGS"). | Must |
| REQ-CNT-012 | Qty Low shall be mandatory, decimal (10,2), must be > 0.00. | Must |
| REQ-CNT-013 | Qty High shall be mandatory, decimal (10,2), must be > 0.00. | Must |
| REQ-CNT-014 | Quantity unit shall be mandatory — enum: M.T., KGS, QUINTAL, BAGS. | Must |
| REQ-CNT-015 | Rate shall be mandatory, decimal (12,2), must be > 0.00. | Must |
| REQ-CNT-016 | Currency shall be mandatory — enum: RUPEE, DOLLAR, EURO. | Must |
| REQ-CNT-017 | Tax shall be mandatory, FK to Tax Master. | Must |
| REQ-CNT-018 | Despatch Range (From/To dates) shall be mandatory; To Date ≥ From Date. | Must |
| REQ-CNT-019 | On invalid despatch range, display: "Despatch To Date must be on or after From Date." | Must |
| REQ-CNT-020 | Broker Name shall be mandatory, FK to Broker Master. | Must |
| REQ-CNT-021 | Broker Rate shall be mandatory, decimal (8,2), per metric unit or flat commission. | Must |
| REQ-CNT-022 | Print Options — optional checkboxes: DESPATCH/SI, TR/FINAL DOCS, PAYMENT. | Should |
| REQ-CNT-023 | On successful submit, contract status shall be set to `CONTRACT_OPEN`. | Must |
| REQ-CNT-024 | The system shall validate credit limits on contract submission. *(Mentioned in TDD flow — rules TBD)* | Should |

#### 6.3.2 Contract Closure (SCR-CNT-07)

**Objective:** Capture final quantity used for billing.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-CLS-001 | The system shall allow entry of final quantity for billing on a contract. | Must |
| REQ-CLS-002 | If final quantity is not entered, billing shall use Qty High as default. | Must |
| REQ-CLS-003 | Final quantity entry shall be used exclusively for billing calculations. | Must |

---

### 6.4 Despatch Management (SCR-DSP-07)

**Objective:** Record goods shipment/challan entries mapped to contracts and update fulfillment balance.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-DSP-001 | The system shall allow create, read, update of despatch records linked to a Contract No. | Must |
| REQ-DSP-002 | Each despatch shall reference a valid open contract. | Must |
| REQ-DSP-003 | Despatch shall capture at minimum: despatch number, date, contract reference, commodity short name, bags, quantity, delivery type. | Must |
| REQ-DSP-004 | The system shall update remaining contractual balance quantity on each despatch. | Must |
| REQ-DSP-005 | Despatches shall be allowed up to contract limit plus defined quantity tolerance (e.g., ±5%). | Must |
| REQ-DSP-006 | If despatch exceeds tolerance, the system shall reject with: "Dispatch quantity exceeds contractual tolerance boundary." | Must |
| REQ-DSP-007 | Unfulfilled despatches shall remain in unbilled status until included in a bill. | Must |
| REQ-DSP-008 | Database rows for contract quantity fulfillment shall use optimistic locking (@Version) to prevent double-allocation during concurrent despatch entries. | Must |

---

### 6.5 Bill Generation (SCR-BIL-08)

**Objective:** Aggregate unbilled despatches within a date range to generate sales invoices and calculate tax/brokerage liabilities.

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-BIL-001 | The system shall allow generation of bills from unbilled despatch records. | Must |
| REQ-BIL-002 | Bill No shall be auto-generated, unique, max 20 characters (tax invoice number). | Must |
| REQ-BIL-003 | Bill Date shall be mandatory, default current date; shall not be prior to Contract Date. | Must |
| REQ-BIL-004 | From/To Date range shall be mandatory to filter pending dispatches. | Must |
| REQ-BIL-005 | Party Name shall be mandatory, FK to active COA; filters grid by party. | Must |
| REQ-BIL-006 | Tax shall be mandatory, FK to Tax Master; auto-populates IGST, CGST, SGST %. | Must |
| REQ-BIL-007 | IGST/CGST/SGST amount fields shall be read-only; computed based on intra-state vs inter-state supply. | Must |
| REQ-BIL-008 | The system shall display a grid of unbilled despatch records for selection. | Must |
| REQ-BIL-009 | Select All control shall toggle check state of all pending grid rows. | Must |
| REQ-BIL-010 | On bill submission, the system shall create an Invoicing Event, calculate applicable tax, and update selected despatches to `STATUS_BILLED`. | Must |
| REQ-BIL-011 | The system shall post to ledgers upon bill creation. *(Mentioned in TDD — accounting detail TBD)* | Should |
| REQ-BIL-012 | Billed despatches shall not appear again in unbilled queries. | Must |

---

## 7. Business Rules & Calculations

### 7.1 Base Contract Value

```
V_base = Q × R
```

Where:
- **Q** = Total contract quantity (in M.T., Quintals, or applicable unit)
- **R** = Agreed rate per unit currency

**REQ-CALC-001:** The system shall compute base transaction value as quantity multiplied by rate.

### 7.2 GST Tax Application

**REQ-CALC-002:** Tax application shall depend on supply type:

| Supply Type | Condition | Tax Applied |
|-------------|-----------|-------------|
| **Intra-State** | Seller State = Buyer State | CGST + SGST; IGST = 0 |
| **Inter-State** | Seller State ≠ Buyer State | IGST; CGST = 0, SGST = 0 |

**Formulas:**

Intra-State:
```
CGST Amount = V_base × (r_CGST / 100)
SGST Amount = V_base × (r_SGST / 100)
IGST Amount = 0.00
```

Inter-State:
```
IGST Amount = V_base × (r_IGST / 100)
CGST Amount = 0.00
SGST Amount = 0.00
```

**REQ-CALC-003:** Seller and Buyer state shall be derived from Party Master (COA) address/state records.

### 7.3 Gross Bill Amount

```
A_total = V_base + IGST Amount + CGST Amount + SGST Amount
```

**REQ-CALC-004:** The system shall compute gross bill amount as base value plus all applicable tax amounts.

### 7.4 Brokerage Commission

```
B_amount = Q_fulfilled × R_brokerage
```

Where:
- **Q_fulfilled** = Actual fulfilled/despatched quantity
- **R_brokerage** = Brokerage commission rate per unit (from contract)

**REQ-CALC-005:** The system shall compute brokerage per contract/bill based on fulfilled quantity and broker rate.

---

## 8. Workflow Requirements

### 8.1 End-to-End Process Flow

| Step | Activity | Screen/Module | Output |
|------|----------|---------------|--------|
| 1 | Entity master configuration | Masters + COA | Configured reference data |
| 2 | Contract execution | SCR-CNT-06 | Contract with status `CONTRACT_OPEN` |
| 3 | Dispatch & fulfillment | SCR-DSP-07 | Despatch records; updated contract balance |
| 4 | Contract closure (optional) | SCR-CNT-07 | Final billing quantity set |
| 5 | Invoicing & billing | SCR-BIL-08 | Bill created; despatches `STATUS_BILLED` |
| 6 | Audit & reporting | Reports module | Updated registers and brokerage reports |

### 8.2 Contract Initialization Workflow

**REQ-WF-001:** User navigates to Contract Entry and selects trade parameters.

**REQ-WF-002:** System validates Seller ID ≠ Buyer ID before save.

**REQ-WF-003:** On successful submit, contract status = `CONTRACT_OPEN`.

**REQ-WF-004:** Contract Registry shall be updated upon contract creation.

### 8.3 Fulfillment Workflow

**REQ-WF-005:** Despatches recorded in Despatch Entry link directly to primary Contract No.

**REQ-WF-006:** System enforces quantity tolerance rule on each despatch.

**REQ-WF-007:** On tolerance breach, inline exception prevents save.

### 8.4 Invoicing Workflow

**REQ-WF-008:** User selects Party and date range on Bill Generation screen.

**REQ-WF-009:** System fetches all fulfilled, unbilled challan records within date window.

**REQ-WF-010:** User selects rows (or Select All) and submits.

**REQ-WF-011:** System creates Invoicing Event, calculates tax, updates despatches to `STATUS_BILLED`.

---

## 9. API Requirements

### 9.1 Contract Creation

| Attribute | Value |
|-----------|-------|
| **Endpoint** | `POST /api/v1/contracts` |
| **Purpose** | Create a new trade contract |
| **Auth** | TBD |

**Request Body (JSON):**

```json
{
  "type": "NEW",
  "date": "2026-04-01",
  "sellerId": "ACC-10029",
  "buyerId": "ACC-40912",
  "commodityId": "COMM-003",
  "qualityAllowance": "SS - 0.50%, MOISTURE - 8%, OIL - 7.50%",
  "packing": "IN OLD JUTE BAGS",
  "quantity": 106.07,
  "unit": "MT",
  "rate": 29811.00,
  "currency": "INR",
  "taxId": "TAX-005",
  "despatchFrom": "2026-04-01",
  "despatchTo": "2026-04-30",
  "brokerId": "BRK-0012",
  "brokerageRate": 0.00
}
```

**Response (HTTP 201 Created):**

```json
{
  "status": "SUCCESS",
  "contractNo": "00002",
  "message": "Contract created successfully",
  "timestamp": "2026-04-01T10:15:30Z"
}
```

**REQ-API-001:** API shall validate all contract field rules defined in REQ-CNT-* before creation.

**REQ-API-002:** API shall return appropriate error responses for validation failures.

### 9.2 Fetch Unbilled Despatches

| Attribute | Value |
|-----------|-------|
| **Endpoint** | `GET /api/v1/despatches/unbilled?partyId={id}&fromDate={date}&toDate={date}` |
| **Purpose** | Retrieve unbilled despatch records for billing |
| **Auth** | TBD |

**Response (HTTP 200 OK):**

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

**REQ-API-003:** API shall return only despatches with unbilled status for the specified party and date range.

### 9.3 Implied Additional APIs

| Req ID | Endpoint (Suggested) | Purpose | Priority |
|--------|---------------------|---------|----------|
| REQ-API-004 | CRUD `/api/v1/masters/commodities` | Commodity master management | Must |
| REQ-API-005 | CRUD `/api/v1/masters/units` | Units master management | Must |
| REQ-API-006 | CRUD `/api/v1/masters/brokers` | Broker master management | Must |
| REQ-API-007 | CRUD `/api/v1/masters/taxes` | Tax master management | Must |
| REQ-API-008 | CRUD `/api/v1/parties` | Party/COA management | Must |
| REQ-API-009 | POST `/api/v1/despatches` | Create despatch entry | Must |
| REQ-API-010 | POST `/api/v1/bills` | Generate bill from selected despatches | Must |
| REQ-API-011 | GET `/api/v1/reports/*` | Contract, sales, brokerage reports | Must |

---

## 10. Reporting & Printing Requirements

### 10.1 Standard Reports

| Req ID | Report | Description | Priority |
|--------|--------|-------------|----------|
| REQ-RPT-001 | Contract Register | List of all contracts with key attributes and status | Must |
| REQ-RPT-002 | Sales Register | List of generated bills/sales invoices | Must |
| REQ-RPT-003 | Brokerage Report | Broker-wise commission summary | Must |

### 10.2 Print Documents

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-PRT-001 | System shall support integrated report generation (e.g., JasperReports / PDFkit). | Must |
| REQ-PRT-002 | Print/E-Mail actions shall render: Despatch/SI, TR/Final Docs, Payment documents based on contract print flags. | Should |
| REQ-PRT-003 | Generated tax invoices shall be printable and emailable from Bill Generation screen. | Must |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-NFR-001 | Bill generation query for unbilled despatches shall return results within acceptable response time for typical monthly volume. *(Target TBD)* | Should |

### 11.2 Concurrency & Data Integrity

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-NFR-002 | Contract quantity fulfillment rows shall implement optimistic locking (@Version field) to prevent double-allocation during concurrent despatch entries. | Must |
| REQ-NFR-003 | Bill generation shall prevent duplicate billing of the same despatch record. | Must |

### 11.3 Audit & Compliance

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-NFR-004 | Every CRUD action across all screens shall record: CreatedBy, CreatedTimestamp, ModifiedBy, ModifiedTimestamp. | Must |
| REQ-NFR-005 | GST calculations shall comply with intra-state and inter-state Indian GST rules as defined in Section 7.2. | Must |

### 11.4 Validation

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-NFR-006 | All field validations defined in this document shall be enforced on both client and server side. | Must |

### 11.5 Usability

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-NFR-007 | Party and master record selection on transaction screens shall use search/select controls (not free-text entry for FK fields). | Must |
| REQ-NFR-008 | Date fields shall use date picker with DD-MM-YYYY format display. | Must |

### 11.6 Security

| Req ID | Requirement | Priority |
|--------|-------------|----------|
| REQ-NFR-009 | System shall require user authentication. *(Not in source TDD — recommended)* | Must |
| REQ-NFR-010 | Role-based access control shall restrict master configuration vs transaction entry vs billing. *(Inferred)* | Should |

---

## 12. Data Requirements

### 12.1 Core Entities

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| Commodity | Physical goods master | Referenced by Contract |
| Unit | Weightment terms | Referenced by Contract *(implied)* |
| Broker | Broker master | Referenced by Contract |
| Tax | Tax schedule with IGST/CGST/SGST % | Referenced by Contract, Bill |
| Party (COA) | Buyer/Seller/Counterparty | Has multiple Addresses; referenced by Contract, Bill |
| PartyAddress | Address line items per party | Belongs to Party |
| Contract | Trade agreement | Links Seller, Buyer, Commodity, Tax, Broker |
| Despatch | Shipment/challan | Belongs to Contract; linked to Bill line items |
| Bill | Tax invoice | Belongs to Party; contains Despatch line items |
| BillLineItem | Individual despatch on a bill | Links Bill and Despatch |

### 12.2 Key Status Values

| Entity | Status Values |
|--------|---------------|
| Contract | `CONTRACT_OPEN`, *(AMENDMENT/CANCEL types defined; additional statuses TBD)* |
| Despatch | Unbilled, `STATUS_BILLED` |

### 12.3 Audit Fields (All Entities)

- `createdBy`
- `createdTimestamp`
- `modifiedBy`
- `modifiedTimestamp`

---

## 13. Assumptions & Constraints

### 13.1 Assumptions

1. Users operate within Indian GST regulatory framework.
2. Pincode validation follows 6-digit Indian postal code format.
3. State list corresponds to Indian states for GST state-code mapping.
4. **Single-tenant deployment for Tradeswift only** — one company, one database, one set of masters.
5. Currency conversion is not required beyond storing currency enum on contract.
6. Quantity tolerance percentage (e.g., ±5%) is configurable or defined at contract level *(TBD)*.
7. Tradeswift company profile (legal name, GSTIN, address, logo) is configured once and appears on all printed invoices and reports *(details TBD with client)*.

### 13.2 Constraints

1. All validations must be enforced server-side regardless of client validation.
2. Tax invoice numbers (Bill No) must be unique.
3. Seller and Buyer must be distinct parties on every contract.
4. Bill Date cannot precede Contract Date.

---

## 14. Out of Scope / Open Items

### 14.1 Permanently Out of Scope (Physical ERP vs Exchange Business)

The following are **not part of this project** — Tradeswift may operate exchange brokerage separately, but this ERP does not cover it:

| # | Excluded Item | Reason |
|---|---------------|--------|
| E1 | MCX/NCDEX/NSE/BSE order placement | Exchange trading — different system |
| E2 | Gold/Silver/Equity futures & options on exchange | Financial instruments, not physical despatch |
| E3 | Demat, margin, SPAN, MTM | Exchange client infrastructure |
| E4 | SEBI contract notes & exchange settlements | Regulatory/exchange workflow |
| E5 | Online trading portal for retail clients | Out of physical ERP scope |

### 14.2 Open Items — Require Clarification Before Implementation

The following items are **not fully specified** in the source TDD and require clarification before implementation:

| # | Open Item | Impact |
|---|-----------|--------|
| 1 | User authentication and role-based permissions | Security module |
| 2 | Despatch Entry (SCR-DSP-07) field-level screen specification | Despatch UI/API design |
| 3 | AMENDMENT and CANCEL contract business logic | Contract lifecycle |
| 4 | Credit limit validation rules | Contract validation |
| 5 | Quantity tolerance percentage configuration | Despatch validation |
| 6 | Ledger posting / accounting integration detail | Bill generation backend |
| 7 | Payment tracking and receivables | Accounts module |
| 8 | Multi-tenant / multi-company support | Architecture — **Out of scope; Tradeswift-only** |
| 9 | Email delivery infrastructure | Print/email feature |
| 10 | Data migration from legacy registers | Deployment |

---

## 15. Acceptance Criteria Summary

### 15.1 Master Module — Done When:

- [ ] All four masters (Commodity, Units, Broker, Tax) support CRUD with specified validations
- [ ] Party Master supports multiple addresses with GST and banking fields
- [ ] Duplicate and format validations show specified error messages

### 15.2 Transaction Module — Done When:

- [ ] Contract can be created with all mandatory fields; Seller ≠ Buyer enforced
- [ ] Contract saves with status `CONTRACT_OPEN`
- [ ] Despatch links to contract and updates remaining quantity
- [ ] Despatch exceeding tolerance is rejected with specified error message
- [ ] Contract closure sets final billing quantity (defaults to Qty High)
- [ ] Bill generates from unbilled despatches; despatches marked `STATUS_BILLED`
- [ ] GST split correctly applied for intra-state and inter-state supplies

### 15.3 Integration — Done When:

- [ ] `POST /api/v1/contracts` creates contract per specification
- [ ] `GET /api/v1/despatches/unbilled` returns correct unbilled records

### 15.4 Reporting — Done When:

- [ ] Contract Register, Sales Register, and Brokerage Report are available
- [ ] Print/PDF generation works for invoice and configured print options

### 15.5 Non-Functional — Done When:

- [ ] Audit fields populated on all CRUD operations
- [ ] Optimistic locking prevents concurrent despatch double-allocation
- [ ] Client and server validations are consistent

---

## Appendix A — Screen Index

| Screen ID | Screen Name | Module |
|-----------|-------------|--------|
| SCR-COMM-01 | Commodity Master | Master Management |
| SCR-WGHT-02 | Units Master | Master Management |
| SCR-BRK-03 | Broker Master | Master Management |
| SCR-TAX-04 | Tax Master | Master Management |
| SCR-COA-05 | Chart of Accounts / Party Master | Party Management |
| SCR-CNT-06 | Contract Entry | Transaction Processing |
| SCR-CNT-07 | Contract Closure | Transaction Processing |
| SCR-DSP-07 | Despatch Entry | Transaction Processing |
| SCR-BIL-08 | Bill Generation | Transaction Processing |

---

## Appendix B — Requirement Traceability

| Business Objective | Requirements |
|--------------------|--------------|
| Centralize master data | REQ-COMM-*, REQ-UNIT-*, REQ-BRK-*, REQ-TAX-*, REQ-COA-* |
| Digitize contracts | REQ-CNT-*, REQ-CLS-*, REQ-WF-001–004 |
| Track despatches | REQ-DSP-*, REQ-WF-005–007 |
| Generate GST bills | REQ-BIL-*, REQ-CALC-*, REQ-WF-008–011 |
| Brokerage reporting | REQ-CALC-005, REQ-RPT-003 |
| Audit compliance | REQ-NFR-004 |
| API integration | REQ-API-* |

---

*End of Document*

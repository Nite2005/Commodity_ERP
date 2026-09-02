# Tradeswift ERP — Frontend

Professional React UI for Tradeswift commodity trading ERP.

## Stack

React 19 · Vite · TypeScript · Tailwind CSS · React Router · Lucide icons

## Run (both servers)

**Terminal 1 — Backend** (port 8000):

```powershell
cd tradeswift-erp-backend
$env:DATABASE_URL="sqlite:///./tradeswift_dev.db"
.\.venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend** (port 5173):

```powershell
cd tradeswift-erp-frontend
npm run dev
```

Open **http://localhost:5173**

API calls proxy to `http://127.0.0.1:8000` via Vite.

## Screens

| Route | Screen |
|-------|--------|
| `/` | Dashboard |
| `/masters/commodities` | Commodity Master |
| `/masters/units` | Weightment Master |
| `/masters/brokers` | Broker Master |
| `/masters/taxes` | Tax Master |
| `/masters/parties` | Party / Company Master |
| `/masters/payment-terms` | Payment Terms |
| `/masters/rates` | Rate Master |
| `/contracts` | Contract list |
| `/contracts/new` | New contract entry |
| `/contracts/:id` | Contract detail + closure |

## Build for production

```powershell
npm run build
```

Output in `dist/` — serve with any static host; configure API proxy or set API base URL.

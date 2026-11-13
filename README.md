# RetailOS — Backend API

Multi-tenant retail inventory, POS and business management SaaS backend.

## Stack

- **Node.js** + **Express** — HTTP API
- **PostgreSQL** — central source of truth (per PRD §11)
- **Prisma** ORM
- **TypeScript** (strict)
- **JWT** access + refresh tokens (rotation)
- **Zod** input validation
- **Swagger** / OpenAPI docs

## Architecture

Modular monolith (per PRD §7.1). Each business domain lives under `src/modules/<domain>/` with its own `routes.ts`. Cross-module logic is exposed via `service.ts` files (e.g. `inventory/service.ts#applyMovement` is reused by sales, purchases, branches, and sync).

```
src/
  app.ts                     # express app + middleware chain
  server.ts                  # bootstrap (db connect, seed, listen)
  config/index.ts            # env-driven config
  db/index.ts                # prisma client singleton
  swagger.ts                  # OpenAPI spec
  middleware/
    auth.ts                  # JWT bearer auth + requirePermission + requireAdmin
    tenant.ts                # tenantContext (active business + subscription state) + enforceEntitlement
    validate.ts              # Zod body/query/params
    error.ts                 # 404 + central error handler
    audit.ts                 # post-response audit hook
  utils/
    errors.ts                # AppError + Errors factory + sendSuccess/sendError
    money.ts                 # toMinor/toMajor + computeWac (Weighted Average Cost)
    jwt.ts                   # sign/verify access + refresh tokens
    password.ts              # argon2id (preferred) / bcrypt hashing
    tokens.ts                # opaque token generation + hashing
    refs.ts                  # receipt / PO / refund / transfer / payment refs (ULID-based)
    rbac.ts                  # permission codes + role templates + seedRbac
    pagination.ts            # PaginationSchema + paginate() helper
  modules/
    auth/                    # register, login, refresh, logout, forgot/reset password, sessions, me
    businesses/              # business onboarding, list, dashboard metrics
    staff/                   # invitations, roles, permissions, suspend/reactivate
    products/                # products, categories, units of measure, barcodes, import/export
    inventory/               # stock-in, stock-out, adjustments, movements, balances, valuation + service.ts
    sales/                   # POS checkout, sales history, refunds, cancel, receipt payload
    purchases/               # purchase orders, receive goods (atomic stock-in), supplier payments
    expenses/                # expense categories, expenses CRUD
    customers/               # customers CRUD, payments, statements, credit history
    suppliers/               # suppliers CRUD, payments, statements
    branches/                # branches CRUD, stock transfers (atomic stock-out + stock-in)
    reports/                 # 12 report endpoints + CSV export
    subscriptions/           # plans, current subscription, change plan, payment submissions, cancel + seed.ts
    sync/                    # offline sync push/pull (idempotent, conflict-safe)
    notifications/           # user notifications
    support/                 # support tickets + messages
    settings/                # business settings (profile, tax, receipt, alerts, data export, closure)
    admin/                   # admin portal: auth, dashboard, businesses, users, plans, payment verification, audit, support, config + seed.ts
```

## Quick start

### 1. Prerequisites

- Node.js ≥ 20
- PostgreSQL 16+ (or use the bundled docker-compose)

### 2. Install + run Postgres

```bash
npm install
docker compose up -d postgres   # spins up Postgres on localhost:5432
```

### 3. Configure env

```bash
cp .env.example .env
# edit .env: set DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (use `openssl rand -hex 32`)
```

### 4. Migrate + seed

```bash
npm run prisma:migrate         # create initial schema
npm run seed                   # RBAC + plans + default admin user
```

### 5. Run dev server

```bash
npm run dev
# API: http://localhost:4000/api/v1
# Docs: http://localhost:4000/docs
```

## Default credentials

After `npm run seed`:

- **Admin**: `admin@retailos.local` / `ChangeMe!2025` (override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars)
- **First retailer**: register via `POST /api/v1/auth/register`

## Core concepts

### Multi-tenancy

Every business-owned record carries `businessId` (and optionally `branchId`). The `tenantContext` middleware enforces:

- Active business exists and is not suspended
- Requesting user is an active member of that business
- Subscription is valid (or read-only mode if expired)

Client passes the active business via `X-Business-Id` header. The business ID in the request **body is never trusted** — it is always taken from this header.

### Money

All monetary amounts are stored as **integer minor units** (kobo for NGN, cents for USD). Example: ₦1,250.50 → `125050` in the database.

- API accepts decimal strings: `"1250.50"`
- API returns minor-unit integers as strings (because BigInt is not JSON-serializable): `"125050"`
- The `toMinor()` and `toMajor()` helpers in `src/utils/money.ts` handle conversion.

### Inventory valuation — Weighted Average Cost (WAC)

Per PRD §4.8, inventory is valued using WAC. Each `InventoryBalance` row carries the current `wacCostMinor`. On every stock-in:

```
newWac = (currentQty × currentWac + inQty × inUnitCost) / (currentQty + inQty)
```

Stock-out uses the current WAC as the cost basis (without changing it). The cost basis at sale time is **preserved** on each `SaleItem.unitCostMinor` so historical COGS remains accurate even if later receipts change the WAC.

### Inventory movements are immutable

`InventoryMovement` is an append-only ledger. Corrections happen via new adjustment movements, never updates or deletes. The current `InventoryBalance` is a transactionally-maintained projection.

### Atomic sales

`POST /sales` runs entirely inside `prisma.$transaction`: validates products, captures WAC as cost basis, decrements stock via `applyMovement`, creates sale + items + payments + (optionally) customer credit. If any step fails, the whole transaction rolls back.

### Idempotency

Every sale, stock movement, expense, and sync submission accepts a `syncId` (client-generated UUID). Re-submitting the same `syncId` returns the original record instead of creating a duplicate.

## API documentation

OpenAPI 3 spec is auto-generated from `@openapi` JSDoc blocks in each module's `routes.ts`. Browse at `/docs` after starting the server.

## Testing

```bash
npm test            # vitest
npm run typecheck   # tsc --noEmit
```

## Production deployment

See PRD §15. Suggested production components:

- Nginx reverse proxy (HTTPS termination)
- Node.js / Express app (this repo)
- PostgreSQL 16
- Redis (optional, for rate limiting / queues)
- File storage for product images / receipts
- Centralized logging + error monitoring

Suggested domains (illustrative):

- `api.retailos.com` — this backend
- `app.retailos.com` — web application
- `admin.retailos.com` — admin portal
- `www.retailos.com` — marketing site

## License

Proprietary — © RetailOS

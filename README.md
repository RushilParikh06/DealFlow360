# DealFlow360 — B2 Intelligence Engine

> **Owner: Aaryan (B2)**
> Branch: `aaryan`
> Stack: NestJS · TypeScript · Prisma · PostgreSQL · pnpm Workspaces

---

## What This Is

DealFlow360 is a B2B deal-flow management platform built as a multi-owner monorepo. This branch contains **B2's contribution: the Intelligence Engine** — the core business-logic layer that drives discount governance, risk scoring, approval routing, inventory allocation, upsell recommendations, and deal health monitoring.

The intelligence engine is **pure TypeScript with zero framework dependencies**. It imports nothing from NestJS or Prisma. The NestJS layer is a thin adapter that reads from the database and hands data to the engine.

---

## Monorepo Structure

```
dealflow360/
+-- apps/
¦   +-- api/                        # NestJS backend (B2 owned)
¦       +-- src/
¦           +-- main.ts              # Entrypoint — port 3001
¦           +-- app.module.ts        # Root module
¦           +-- modules/
¦               +-- shared/          # Auth guard, Prisma service, error handling, interceptors
¦               +-- intelligence/    # B2 core domain
¦                   +-- controllers/ # HTTP layer — 7 controllers
¦                   +-- dto/         # Validated request/response shapes
¦                   +-- engine/      # Pure business logic (no Nest, no Prisma)
¦                   +-- services/    # Orchestration — reads DB, calls engine, writes results
+-- packages/
¦   +-- contracts/                  # Shared TypeScript types & enums (@dealflow/contracts)
¦       +-- src/
¦           +-- enums.ts             # UserRole, QuotationStatus, ApprovalStatus, RiskLevel, etc.
¦           +-- errors.ts            # ErrorCode enum + HTTP status map
¦           +-- intelligence.ts      # EvaluationResponse, ApprovalListItem, AuditEntry, etc.
¦           +-- money.ts             # Integer minor-unit helpers (asBps, roundHalfUp, sum, etc.)
¦           +-- ports.ts             # QUOTE_STATE_PORT injection token
+-- prisma/
¦   +-- schema/
¦   ¦   +-- base.prisma              # Shared enums + Intelligence-owned tables
¦   ¦   +-- sales.prisma             # Stub — B1 owns & overwrites
¦   ¦   +-- operations.prisma        # Stub — B3 owns & overwrites
¦   +-- seed/                        # Seed scripts (tiers, categories, policies, demo quotes)
+-- pnpm-workspace.yaml
+-- tsconfig.base.json
+-- package.json
```

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 22 |
| pnpm | 9.12.0 |
| Docker | for PostgreSQL |

### 1. Install dependencies

```powershell
pnpm install
```

### 2. Start the database

```powershell
pnpm db:up
```

### 3. Set up environment

```powershell
Copy-Item .env.example .env
```

Default `.env` values work out of the box for local development:

```env
DATABASE_URL="postgresql://dealflow:dealflow@localhost:5432/dealflow?schema=public"
API_PORT=3001
API_PREFIX="api/v1"
AUTH_MODE="dev"
```

### 4. Run migrations & seed

```powershell
pnpm prisma migrate dev --name init
pnpm prisma generate
pnpm db:seed
```

### 5. Build the contracts package

```powershell
pnpm --filter @dealflow/contracts build
```

### 6. Start the API

```powershell
pnpm --filter api start:dev
```

Expected output:

```
[NestApplication] Nest application successfully started
```

API is live at: **http://localhost:3001**

---

## Authentication (Dev Mode)

All routes are guarded. In `AUTH_MODE=dev`, pass two headers with every request:

| Header | Example |
|--------|---------|
| `x-dev-user-id` | `usr_admin` |
| `x-dev-role` | `ADMIN` / `SALES_MANAGER` / `SALES_REP` / `FINANCE` / `CUSTOMER` |

Optional: `x-dev-customer-id` for customer-scoped requests.

> When B1 ships real JWT auth, set `AUTH_MODE=jwt` in `.env`. No other code changes needed.

---

## API Endpoints

All routes are prefixed with `/api/v1`.

Every successful response:
```json
{ "success": true, "data": { ... } }
```

Every error:
```json
{ "success": false, "error": { "code": "...", "message": "..." } }
```

### Quote Evaluation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/quotes/:id/evaluate` | Run the full intelligence evaluation on a quote |
| `GET` | `/quotes/:id/risk` | Get the latest risk score |
| `GET` | `/quotes/:id/risk/history` | Full evaluation history |
| `GET` | `/quotes/:id/audit-trail` | Audit trail for all actions on a quote |
| `GET` | `/quotes/:id/upsell` | Upsell suggestions |

### Approvals

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/approvals` | List all pending approvals (paginated) |
| `GET` | `/approvals/:id` | Get approval detail with steps |
| `PATCH` | `/approvals/:id` | Take an action (approve / reject / return) |

### Discount Policies

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/discount-policies` | List all active policies (12 seeded: BRONZE/SILVER/GOLD) |
| `PATCH` | `/discount-policies/:id` | Update a ceiling live — no redeploy needed |

### Inventory & Allocation

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/orders/:id/allocation-plan` | Compute warehouse allocation |
| `POST` | `/orders/:id/reserve` | Reserve stock |
| `POST` | `/orders/:id/release` | Release a reservation |

### Deal Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/deal-health` | All active deal health flags |
| `GET` | `/deal-health/quote/:id` | Flags for a specific quote |
| `POST` | `/deal-health/refresh` | Re-sweep all open deals |
| `POST` | `/deal-health/:eventId/nudge` | Dismiss or snooze a flag |

### Audit

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit` | Global audit log (admin only) |

---

## Quick Endpoint Test (PowerShell)

```powershell
$h = @{ "x-dev-user-id" = "usr_admin"; "x-dev-role" = "ADMIN" }

# Seeded discount policies
Invoke-RestMethod http://localhost:3001/api/v1/discount-policies -Headers $h | ConvertTo-Json -Depth 4

# Approvals queue
Invoke-RestMethod http://localhost:3001/api/v1/approvals -Headers $h | ConvertTo-Json -Depth 4

# Deal health flags
Invoke-RestMethod http://localhost:3001/api/v1/deal-health -Headers $h | ConvertTo-Json -Depth 4
```

---

## The Intelligence Engine

Located at `apps/api/src/modules/intelligence/engine/`.
**Pure TypeScript — no NestJS imports, no Prisma imports.**

### How evaluation works

```
resolve each line's own ceiling
  ? blend the excesses, weighted by line value
    ? score out of 100 across four named risk factors
      ? route using thresholds that live in the database (never in code)
```

### Engine modules

| File | Responsibility |
|------|---------------|
| `evaluate.ts` | Composition root — orchestrates all steps |
| `ceilings.ts` | Resolves per-line discount ceilings from policy DB |
| `risk.ts` | Computes blend, factors (discount depth, margin, deal size, volume), score |
| `risk-model.ts` | Score shape constants — display only, not thresholds |
| `routing.ts` | Routes approvals by score — thresholds live in DB, no literals |
| `allocation.ts` | Warehouse split (nearest-first, capacity-aware) |
| `upsell.ts` | Ranks upsell candidates by attach rate x margin |
| `deal-health.ts` | Flags stalled deals, discount anomalies, delivery slippage, low margin |
| `hash.ts` | SHA-256 of evaluation inputs — enables idempotent re-evaluation |

### Key invariants

1. **No floats.** Money is integer minor units. Percentages are basis points (`packages/contracts/src/money.ts`).
2. **No approval threshold is a literal in code.** `routing.ts` contains no numbers. All thresholds live in the database.
3. **The engine never imports from NestJS or Prisma.** Data is passed in, never fetched inside the engine.
4. **Evaluation is idempotent.** Same inputs ? same SHA-256 hash ? same DB row, never duplicated.
5. **Audit writes share the transaction with the change** — enforced by the TypeScript compiler via `Prisma.TransactionClient`.
6. **B2 never writes `quotations.status` directly.** All transitions go through `QuoteStatePort`.

---

## Running Tests

```powershell
# All tests
pnpm --filter api test

# Engine unit tests only (fast — no DB, no Nest)
pnpm --filter api test:engine
```

Engine tests cover: risk scoring, ceiling resolution, approval routing, allocation splits, upsell ranking, deal health detection, hash idempotency, and full demo scenarios.

---

## Build Commands

```powershell
# Type-check all packages
pnpm typecheck

# Build contracts (must run before API build)
pnpm --filter @dealflow/contracts build

# Build the API
pnpm --filter api build

# Verify entrypoint location
Get-ChildItem apps\api\dist -Filter main.js -Recurse
# Expected: apps\api\dist\main.js  (NOT apps\api\dist\apps\api\src\main.js)
```

---

## Workspace Configuration

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Declares `apps/*` and `packages/*` as workspace members |
| `tsconfig.base.json` | Shared TS config — strict mode, decorators, path alias for `@dealflow/contracts` |
| `apps/api/tsconfig.json` | API overrides — `rootDir: "src"`, `outDir: "dist"` |
| `packages/contracts/tsconfig.json` | Contracts build config — outputs to `dist/` |
| `apps/api/nest-cli.json` | NestJS CLI — `sourceRoot: "src"`, `deleteOutDir: true` |

**Important:** `@dealflow/contracts` resolves to source during type-checking (via path aliases) and to compiled `dist/` at runtime (via pnpm workspace `main` field). Always build contracts before the API.

---

## Integration Notes

### For B1 (Sales module)

- `QuotationLine.costMinor` is a **unit** cost — line total = `costMinor x qty`. If seeded as a line total, every margin number is wrong by a factor of qty.
- When `QuoteStateService` is ready, swap into `intelligence.module.ts` (one-line change). `quote-state.adapter.ts` is deleted then.
- Overwrite `sales.prisma` wholesale. Only `quote-reader.service.ts` reads those tables.

### For B3 (Operations module)

- Available stock = `onHand` minus `inventory_reservations` rows, computed at read time. No denormalised `reserved` column.
- Overwrite `operations.prisma` wholesale. Only `ops-reader.service.ts` reads those tables.

### For Frontend (F)

- All responses are `{ success: true, data: ... }` — handle the envelope once in your API client, not per screen.
- Every error is `{ success: false, error: { code, message, details } }`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://dealflow:dealflow@localhost:5432/dealflow` | Postgres connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis (future BullMQ sweep job) |
| `API_PORT` | `3001` | HTTP port |
| `API_PREFIX` | `api/v1` | Global route prefix |
| `AUTH_MODE` | `dev` | `dev` = header-based auth, `jwt` = B1 real guard |
| `JWT_SECRET` | `dev-only-change-me` | JWT signing secret (jwt mode only) |

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm --filter api start:dev` | Start API in watch mode |
| `pnpm --filter api build` | Production build |
| `pnpm --filter api test` | All tests |
| `pnpm --filter api test:engine` | Engine unit tests only |
| `pnpm typecheck` | Type-check all packages |
| `pnpm db:up` | Start Docker Postgres |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm generate` | Re-generate Prisma client |

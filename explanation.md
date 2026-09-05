# DealFlow360 — B2 Intelligence Engine: Complete Technical Explanation

**Owner:** Aaryan (B2) | **Branch:** `aaryan`

---

## 1. Technologies Used

| Category | Technology | Why |
|----------|-----------|-----|
| **Runtime** | Node.js v22 | LTS, fast startup |
| **Language** | TypeScript 5.6 (strict) | Full type safety, decorators, `noImplicitAny` |
| **Framework** | NestJS 10 | DI, guards, interceptors, watch mode |
| **ORM** | Prisma 6 | Type-safe DB client, schema-first, migrations |
| **Database** | PostgreSQL (Docker) | ACID transactions, JSON columns for audit |
| **Package Manager** | pnpm 9 (workspace) | Fast installs, `--filter` per-package commands |
| **Build Tool** | NestJS CLI (`nest build`) | TS compilation, `outDir: dist/`, watch mode |
| **Testing** | Jest + ts-jest | Unit tests — no DB, no Nest, pure engine |
| **Shared Types** | `@dealflow/contracts` (internal pkg) | Single source of truth for all enums + types |
| **Money Math** | Custom integer helpers (`money.ts`) | No floats — minor units + basis points |
| **Validation** | `class-validator` + `class-transformer` | DTO-level input validation |
| **HTTP** | Express (via `@nestjs/platform-express`) | Standard HTTP under NestJS |
| **Containerization** | Docker Compose | Local PostgreSQL + Redis |

---

## 2. Complete Folder Structure

```
dealflow360/                              <- Monorepo root
|
+-- apps/
|   +-- api/                             <- NestJS backend (B2 owns everything here)
|       +-- dist/                        <- Compiled output (DO NOT EDIT)
|       |   +-- main.js                  <- Entrypoint after build
|       +-- src/
|       |   +-- main.ts                  <- Bootstrap: port, CORS, pipes, guards, prefix
|       |   +-- app.module.ts            <- Root module (PrismaModule + IntelligenceModule)
|       |   |
|       |   +-- modules/
|       |       |
|       |       +-- shared/              <- Cross-cutting concerns, no business logic
|       |       |   +-- auth.guard.ts       <- x-dev-user-id/x-dev-role in dev mode
|       |       |   +-- roles.guard.ts      <- Role-based access control
|       |       |   +-- current-user.ts     <- @CurrentUser() param decorator
|       |       |   +-- prisma.module.ts    <- Makes PrismaService globally available
|       |       |   +-- prisma.service.ts   <- PrismaClient lifecycle
|       |       |   +-- app-error.ts        <- Typed AppError with code + HTTP status
|       |       |   +-- all-exceptions.filter.ts  <- Global error -> {success:false,...}
|       |       |   +-- response.interceptor.ts   <- Wraps all responses -> {success:true,...}
|       |       |
|       |       +-- intelligence/        <- B2 core domain
|       |           +-- intelligence.module.ts   <- Wires all services and controllers
|       |           |
|       |           +-- controllers/     <- HTTP layer, one file per resource
|       |           |   +-- evaluation.controller.ts
|       |           |   +-- approval.controller.ts
|       |           |   +-- policy.controller.ts
|       |           |   +-- audit.controller.ts
|       |           |   +-- upsell.controller.ts
|       |           |   +-- allocation.controller.ts
|       |           |   +-- deal-health.controller.ts
|       |           |
|       |           +-- dto/             <- Validated request shapes (class-validator)
|       |           |   +-- evaluate.dto.ts
|       |           |   +-- approval.dto.ts
|       |           |   +-- policy.dto.ts
|       |           |   +-- audit.dto.ts
|       |           |   +-- upsell.dto.ts
|       |           |   +-- deal-health.dto.ts
|       |           |   +-- index.ts
|       |           |
|       |           +-- services/        <- Orchestration: DB reads + engine + DB writes
|       |           |   +-- evaluation.service.ts    <- Core: evaluate+route+audit in 1 tx
|       |           |   +-- approval.service.ts      <- List/detail/act on approval queue
|       |           |   +-- policy.service.ts        <- Read and update discount policies
|       |           |   +-- audit.service.ts         <- Write and read audit trail
|       |           |   +-- deal-health.service.ts   <- Sweep + upsert findings
|       |           |   +-- allocation.service.ts    <- Plan + reserve/release stock
|       |           |   +-- upsell.service.ts        <- Fetch candidates, call engine
|       |           |   +-- quote-reader.service.ts  <- Reads B1 tables (quotations, lines)
|       |           |   +-- ops-reader.service.ts    <- Reads B3 tables (warehouses, inventory)
|       |           |   +-- quote-state.adapter.ts   <- TEMP: transitions quotation.status
|       |           |
|       |           +-- engine/          <- Pure TypeScript. Zero Nest. Zero Prisma.
|       |               +-- evaluate.ts          <- Composition root of all engine steps
|       |               +-- ceilings.ts          <- Per-line discount ceiling lookup
|       |               +-- risk.ts              <- Blend + 4 factors + score 0-100
|       |               +-- risk-model.ts        <- Score shape constants (weights only)
|       |               +-- routing.ts           <- Who must approve (no literals in code)
|       |               +-- allocation.ts        <- Greedy warehouse split algorithm
|       |               +-- upsell.ts            <- Rank candidates by expected margin
|       |               +-- deal-health.ts       <- 4 anomaly detectors
|       |               +-- hash.ts              <- SHA-256 for idempotency
|       |               +-- types.ts             <- Engine-internal interfaces
|       |               +-- index.ts             <- Barrel export
|       |               +-- __tests__/           <- Unit tests (no DB, no Nest)
|       |                   +-- fixtures.ts
|       |                   +-- risk.spec.ts
|       |                   +-- routing.spec.ts
|       |                   +-- ceilings.spec.ts
|       |                   +-- allocation.spec.ts
|       |                   +-- upsell.spec.ts
|       |                   +-- deal-health.spec.ts
|       |                   +-- hash.spec.ts
|       |                   +-- demo-scenarios.spec.ts
|       |
|       +-- nest-cli.json        <- sourceRoot: src, deleteOutDir: true
|       +-- tsconfig.json        <- rootDir: src, outDir: dist
|       +-- package.json         <- @dealflow/api, scripts, dependencies
|       +-- jest.config.js
|
+-- packages/
|   +-- contracts/               <- Shared types (imported as @dealflow/contracts)
|       +-- src/
|       |   +-- index.ts         <- Barrel -- exports everything below
|       |   +-- enums.ts         <- UserRole, QuotationStatus, RiskLevel, ApprovalStatus...
|       |   +-- errors.ts        <- ErrorCode enum + HTTP status map + ApiErrorBody type
|       |   +-- intelligence.ts  <- EvaluationResponse, ApprovalDetail, AuditEntry...
|       |   +-- money.ts         <- Money interface + roundHalfUp, asBps, sum, clamp
|       |   +-- ports.ts         <- QUOTE_STATE_PORT injection token
|       +-- dist/                <- Compiled output (build contracts before API)
|       +-- tsconfig.json
|       +-- package.json         <- main: dist/index.js, types: dist/index.d.ts
|
+-- prisma/
|   +-- schema/
|   |   +-- base.prisma          <- B2-owned DB tables (policies, evaluations, approvals...)
|   |   +-- sales.prisma         <- STUB owned by B1 (customers, quotations, lines)
|   |   +-- operations.prisma    <- STUB owned by B3 (products, warehouses, inventory)
|   +-- seed/
|       +-- index.ts             <- Entry: runs all seeds in order
|       +-- base.seed.ts         <- Tiers, categories, users, products, warehouses
|       +-- policy.seed.ts       <- 12 discount policy rows (BRONZE/SILVER/GOLD)
|       +-- demo.seed.ts         <- Demo quotes QT-1001, QT-1002 and order ORD-2001
|
+-- .env.example                 <- DB URL, Redis, JWT, API port, AUTH_MODE
+-- .gitignore
+-- package.json                 <- Root scripts: dev:api, db:*, typecheck, test
+-- pnpm-workspace.yaml          <- Declares apps/* and packages/* as workspace members
+-- tsconfig.base.json           <- Shared TS config + @dealflow/contracts path alias
+-- B2-BUILD-ORDER.md            <- Aaryan's build sequence + team coordination notes
+-- README.md                    <- Quick start + API reference
+-- explanation.md               <- THIS FILE
```

---

## 3. Complete Project Flow

### The NestJS Request Pipeline

Every HTTP request travels through this exact sequence:

```
HTTP Request
     |
     v
  AuthGuard            <- Reads x-dev-user-id + x-dev-role (dev mode)
                          Attaches { id, role, customerId } to req.user
     |
     v
  RolesGuard           <- Checks @Roles() decorator on the handler
     |
     v
  ValidationPipe       <- Validates DTO body with class-validator
                          Strips extra fields (whitelist: true)
     |
     v
  Controller           <- Extracts params/body/user, calls service
     |
     v
  Service              <- Business logic, DB reads, engine call, DB writes
     |
     v
  ResponseInterceptor  <- Wraps result in { success: true, data: ... }
     |
     v
HTTP Response

On any error:
     |
     v
  AllExceptionsFilter  <- Returns { success: false, error: { code, message, details } }
```

---

### Core Flow: Quote Evaluation (the main business mechanic)

`POST /api/v1/quotes/:id/evaluate`

```
EvaluationController.evaluate()
     |
     v
EvaluationService.evaluate()   -- everything inside ONE Prisma transaction
     |
     +-- QuoteReaderService.read(quotationId)
     |       Reads B1 tables: quotation, quotation_lines, customer, tier, policies
     |       Builds EvaluationInput { lines[], policies[], currency, ... }
     |
     +-- engine.evaluate(input)        PURE FUNCTION -- no DB inside
     |       |
     |       +-- resolveLineCeilings()
     |       |       For each line: find matching policy (category-specific > tier default)
     |       |       overBps = max(0, actual_discount_bps - allowed_discount_bps)
     |       |
     |       +-- computeBlend()
     |       |       weightedExcessBps = sum(overBps x lineTotal) / totalNet
     |       |       worstLineExcessBps = max excess of any single line
     |       |
     |       +-- computeFactors()     -- 4 named contributors, points add to 0-100
     |       |       BLENDED_EXCESS:    weighted discount depth (37 pts max)
     |       |       WORST_LINE_EXCESS: worst single line offender (24 pts max)
     |       |       MARGIN_PRESSURE:   how close to zero margin (24 pts max)
     |       |       VIOLATION_SPREAD:  % of lines over ceiling (15 pts max)
     |       |
     |       +-- scoreFromFactors()   -- sum clamped 0-100
     |       +-- levelFromScore()     -- LOW / MEDIUM / HIGH
     |       +-- governingThresholds()-- strictest threshold among touched policies
     |       +-- routeApprovals()     -- who must sign (reads DB thresholds, no literals)
     |       +-- hashEvaluationInput()-- SHA-256 of all inputs
     |
     +-- (same hash in DB?) --> return cached row, skip all writes
     |
     +-- prisma.riskEvaluation.create()
     +-- audit.record(tx, QUOTE_EVALUATED)
     |
     +-- applyRouting()
             |
             +-- approvalRequired = false
             |       Supersede any open approval chain
             |       Transition quote to AUTO_APPROVED (or CONFIRMED if NEGOTIATING)
             |
             +-- approvalRequired = true
                     Same chain open? Do nothing.
                     Different chain? Supersede old, create new.
                     prisma.approvalRequest.create() with steps[]
                     audit.record(APPROVAL_REQUESTED)
                     quoteState.transition(PENDING_MANAGER)
```

---

### Approval Workflow Flow

```
GET  /approvals        -> ApprovalService.list()    Paginated queue with quote headers
GET  /approvals/:id    -> ApprovalService.detail()  Full record + evaluation snapshot
PATCH /approvals/:id   -> ApprovalService.act(APPROVE | REJECT | RETURN)

act() -- all inside one transaction:
     |
     +-- find current step by currentSequence
     +-- check: actor.role must match step.approverRole (or ADMIN bypasses)
     +-- create ApprovalAction record
     +-- update ApprovalStep status
     +-- audit.record(STEP_APPROVED / STEP_REJECTED / STEP_RETURNED)
     |
     +-- APPROVE + next step exists --> advance currentSequence
     +-- APPROVE + final step       --> close as APPROVED, skip remaining steps
     +-- REJECT                     --> close as REJECTED, skip remaining steps
     +-- RETURN                     --> close as RETURNED, skip remaining steps
         |
         +-- quoteState.transition(APPROVED | REJECTED | RETURNED)
         +-- audit.record(STATUS_CHANGED)
```

---

### Discount Policies (Live Governance)

```
GET  /discount-policies       -> PolicyService.list()     All active policy rows
PATCH /discount-policies/:id  -> PolicyService.update()   Change maxDiscountBps

Key insight:
  Approval thresholds live in the database.
  routing.ts has ZERO numeric literals.
  Admin changes a policy in the UI -> next evaluate() reads the new threshold.
  No code change. No redeploy. Routing changes in real-time.
  This is the signature demo moment of the product.
```

---

### Inventory Allocation Flow

```
GET  /orders/:id/allocation-plan
     -> AllocationService.plan(orderId)
         -> OpsReaderService reads warehouses + stock per product
         -> available = onHand - reserved (computed at read time, never stored)
         -> engine.chooseAllocation()
               Sort warehouses: available DESC, cost ASC
               Greedy fill: take max from biggest source first
               Unmet demand -> backorder line with explanation
         -> Returns: allocations[], backorder[], totalShipments, totalShippingCost

POST /orders/:id/reserve
     -> Creates inventory_reservation rows
     -> Next plan call shows reduced available

POST /orders/:id/release
     -> Deletes reservation rows, stock restored instantly
```

---

### Upsell Recommendations Flow

```
GET /quotes/:id/upsell
     -> UpsellService.suggest(quoteId)
         -> Read quote lines (what's already on the quote)
         -> OpsReaderService reads product_relationships
         -> Filter out items already on quote
         -> engine.rankUpsell(candidates)
               For each: expectedMargin = (marginDelta x attachRate) / 10000
               Sort: expectedMargin DESC, attachRate DESC, productId ASC (deterministic)
               Top 5 returned
         -> Each priced at safeDiscountBps (won't trigger approval by itself)
```

---

### Deal Health Monitoring Flow

```
GET  /deal-health             -> list all active flags
GET  /deal-health/quote/:id   -> flags for one quote
POST /deal-health/refresh     -> DealHealthService.sweep() -- re-check all open quotes
POST /deal-health/:id/nudge   -> dismiss or snooze a flag

sweep():
     -> Load all quotations in OPEN statuses (DRAFT, SUBMITTED, PENDING_*, RETURNED, NEGOTIATING)
     -> For each quote, engine.detectDealHealth() runs 4 checks:
           1. STALLED          no activity 7+ days (WARN) or 14+ days (CRITICAL)
           2. DISCOUNT_ANOMALY  discount > rep's own avg + 500 bps
           3. DELIVERY_SLIPPAGE projected delivery > promised delivery
           4. LOW_MARGIN        margin < 15% (WARN), < 8% (CRITICAL)
     -> Upsert findings by (quotationId, type, dedupeKey)
           Same condition on next sweep = row updated, NOT a new row
           Fully idempotent
```

---

### Audit Trail

```
Every write operation calls AuditService.record(prismaTransactionClient, payload)
The transaction client is passed in -- the TypeScript compiler enforces this.
If the main write succeeds -> audit row commits atomically.
If the main write fails    -> audit row rolls back too.

Columns: entityType, entityId, action, actorUserId, actorRole,
         fromValue, toValue, metadata (JSON), createdAt

GET /audit              -> full log (ADMIN only)
GET /quotes/:id/audit-trail -> all actions on one quotation
```

---

## 4. Every File Explained

### `apps/api/src/main.ts`
Bootstrap. Creates the Nest app, sets global prefix `api/v1`, enables CORS, registers `AllExceptionsFilter`, `ResponseInterceptor`, and `ValidationPipe` (whitelist + transform). Listens on `process.env.API_PORT` (default 3001).

### `apps/api/src/app.module.ts`
Root module. Imports `PrismaModule` and `IntelligenceModule`. Comments reserve slots for B1's `SalesModule` and B3's `OperationsModule`/`BillingModule`.

---

### Shared (`modules/shared/`)

**`auth.guard.ts`** — Global guard. In `AUTH_MODE=dev`: reads `x-dev-user-id` and `x-dev-role` headers, validates role against `UserRole` enum, attaches `{ id, role, customerId }` to `req.user`. In `AUTH_MODE=jwt`: B1 replaces this branch. Nothing else in the codebase changes.

**`roles.guard.ts`** — Reads `@Roles()` decorator metadata from the route handler. Compares against `req.user.role`. ADMIN bypasses all role checks.

**`current-user.ts`** — `@CurrentUser()` parameter decorator. Extracts `req.user` from execution context. All controllers use this — none touch `req` directly.

**`prisma.service.ts`** — Extends `PrismaClient`. Connects on `onModuleInit`, disconnects on `onModuleDestroy`. Exported globally via `PrismaModule`.

**`app-error.ts`** — Typed error class. Constructor takes `ErrorCode` + message + optional details. Looks up HTTP status from `ERROR_HTTP_STATUS` map. Used everywhere instead of `HttpException`.

**`all-exceptions.filter.ts`** — `@Catch()` global filter. Three branches: `AppError` (typed business error), `HttpException` (Nest built-in), unknown. Always returns `{ success: false, error: { code, message, details } }`.

**`response.interceptor.ts`** — Global interceptor. Controllers return raw data. This wraps it: `{ success: true, data: ... }`. Controllers never build the envelope.

---

### Controllers (`modules/intelligence/controllers/`)

All controllers are thin: authenticate, extract params, call service, return data.

**`evaluation.controller.ts`**
- `POST /quotes/:id/evaluate` -> `EvaluationService.evaluate()`
- `GET /quotes/:id/risk` -> `EvaluationService.latest()`
- `GET /quotes/:id/risk/history` -> `EvaluationService.history()`
- `GET /quotes/:id/audit-trail` -> `AuditService.trailForQuotation()`
- `GET /quotes/:id/upsell` -> `UpsellService.suggest()`

**`approval.controller.ts`**
- `GET /approvals` -> `ApprovalService.list()` (paginated)
- `GET /approvals/:id` -> `ApprovalService.detail()`
- `PATCH /approvals/:id` -> `ApprovalService.act(action, reason)`

**`policy.controller.ts`**
- `GET /discount-policies` -> `PolicyService.list()`
- `PATCH /discount-policies/:id` -> `PolicyService.update(id, dto)`

**`allocation.controller.ts`**
- `GET /orders/:id/allocation-plan` -> `AllocationService.plan()`
- `POST /orders/:id/reserve` -> `AllocationService.reserve()`
- `POST /orders/:id/release` -> `AllocationService.release()`

**`deal-health.controller.ts`**
- `GET /deal-health` -> `DealHealthService.list()`
- `POST /deal-health/refresh` -> `DealHealthService.sweep()`
- `GET /deal-health/quote/:id` -> `DealHealthService.forQuote()`
- `POST /deal-health/:eventId/nudge` -> `DealHealthService.nudge()`

**`audit.controller.ts`**
- `GET /audit` -> `AuditService.list()` (ADMIN only)

---

### Services (`modules/intelligence/services/`)

**`evaluation.service.ts`** — The most important file in B2. Runs the entire evaluation inside one Prisma transaction: read quote data, call engine, check hash for idempotency, save RiskEvaluation row, write audit, apply routing (open/supersede approval chain), transition quote status via QuoteStatePort.

**`approval.service.ts`** — `list()` paginates pending requests with quote headers from B1's tables. `detail()` returns full record including the evaluation snapshot AS IT WAS JUDGED (not a fresh recompute — reviewers must see what they were asked to sign). `act()` runs APPROVE/REJECT/RETURN in a transaction: creates action, updates step, advances or closes request, skips unreached steps, transitions quote status.

**`policy.service.ts`** — Reads and updates `discount_policies`. Updates only `maxDiscountBps` and `isActive`. Any change takes effect on the next evaluate() call — no deploy needed.

**`audit.service.ts`** — `record()` takes `Prisma.TransactionClient`, not `PrismaService`. The TypeScript compiler enforces that audit writes are always inside the same transaction as the change they record. `trailForQuotation()` returns all audit rows for a quote.

**`deal-health.service.ts`** — `sweep()` loads all open quotations, computes margin from lines, compares against rep's average discount, checks delivery dates, calls `engine.detectDealHealth()`. Upserts findings using the unique `(quotationId, type, dedupeKey)` index — identical findings from repeated sweeps produce one row, not many.

**`allocation.service.ts`** — `plan()` reads warehouse stock, computes `available = onHand - reserved`, calls `engine.chooseAllocation()`, returns the plan without writing to DB. `reserve()` creates `inventory_reservation` rows. `release()` deletes them.

**`upsell.service.ts`** — Reads product relationships from B3's tables, filters candidates already on the quote, calls `engine.rankUpsell()` with the ceiling-safe discount for each candidate's category.

**`quote-reader.service.ts`** — Reads B1's tables: `quotation`, `quotation_lines`, `customer`, `customer_tier`, and matching discount policies. Assembles `EvaluationInput`. THE ONLY B2 file that reads B1's schema.

**`ops-reader.service.ts`** — Reads B3's tables: warehouses, inventory, product relationships. THE ONLY B2 file that reads B3's schema.

**`quote-state.adapter.ts`** — TEMPORARY. Implements `QuoteStatePort` with Prisma directly. Contains the quotation status transition table from the plan. When B1 ships `QuoteStateService`, this file is deleted and the module wires B1's service instead. Nothing else changes.

---

### Engine (`modules/intelligence/engine/`)

The engine is the core of B2. **Imports nothing from NestJS or Prisma.** Data comes in as plain TypeScript objects, plain objects come out. This is why 53 unit tests run in under a second.

**`evaluate.ts`** — Composition root. Calls every engine step in sequence. Describes the whole governance mechanic in 30 lines. Read this file first to understand how everything connects.

**`ceilings.ts`**
- `resolveLineCeilings()`: For each line, find matching policy (category-specific wins over tier default). Compute `overBps = max(0, actual - allowed)`. Every line gets a ceiling row even if clean — so the UI can badge all lines.
- `governingThresholds()`: Finds the strictest thresholds among the policies the quote's lines actually touched. Multi-category quotes are governed by the tightest policy, not the average.

**`risk.ts`**
- `computeBlend()`: Weighted average of per-line excess. Weight = line's share of total order value. A 40% overage on a Rs.500 accessory doesn't sink an order. A 2% overage on a Rs.4L hardware line does.
- `computeFactors()`: Returns 4 named `RiskFactor` objects with points + detail strings:
  - BLENDED_EXCESS (37 pts max): weighted discount depth across all lines
  - WORST_LINE_EXCESS (24 pts max): single worst line
  - MARGIN_PRESSURE (24 pts max): how close to zero margin
  - VIOLATION_SPREAD (15 pts max): what percentage of lines are over ceiling
- `scoreFromFactors()`: Sum of all 4, clamped 0-100.
- `levelFromScore()`: LOW / MEDIUM / HIGH from configurable bands.

**`risk-model.ts`** — Weight constants (`blendedMaxPoints: 37`, `hardMaxPoints: 24`, margin floors). These are DISPLAY CONSTANTS ONLY. They shape the score, they do NOT control who approves. Approval thresholds live in the database.

**`routing.ts`** — `routeApprovals()`: Takes `weightedExcessBps`, `worstLineExcessBps`, and DB thresholds. Contains ZERO numeric literals. Returns: nobody / SALES_MANAGER / SALES_MANAGER + FINANCE. Governing excess = `max(blended, worst)` — either metric alone leaves a security hole.

**`allocation.ts`** — `chooseAllocation()`: Greedy warehouse split. Sorts warehouses by available stock DESC, then cost ASC. Takes as much as possible from the biggest source first (provably optimal for minimising number of shipments). Unmet demand becomes a backorder line with an explanation.

**`upsell.ts`** — `rankUpsell()`: Filters items already on the quote. Computes `expectedMargin = marginDelta x attachRate` for each candidate. Sorts deterministically (same inputs = same order every run). Returns top 5.

**`deal-health.ts`** — `detectDealHealth()`: 4 anomaly detectors:
1. STALLED — no activity 7+ days (WARN) / 14+ days (CRITICAL)
2. DISCOUNT_ANOMALY — current discount > this rep's own average + 500 bps
3. DELIVERY_SLIPPAGE — projected delivery slipped past promised date
4. LOW_MARGIN — margin < 15% (WARN) / < 8% (CRITICAL)
Each finding has a `dedupeKey` so upsert = idempotent.

**`hash.ts`** — SHA-256 of the serialised evaluation input. If the same hash already exists in `risk_evaluations`, the service returns the cached row without writing anything. Evaluate can be called on every keystroke with no data duplication.

**`types.ts`** — Engine-internal interfaces: `EngineLine`, `EnginePolicy`, `LineCeiling`, `EvaluationInput`. Not exported from the barrel — internal only.

---

### `packages/contracts/src/`

**`enums.ts`** — All string-enum constants agreed across the whole team:
- `UserRole`: SALES_REP, SALES_MANAGER, FINANCE, ADMIN, CUSTOMER
- `QuotationStatus`: DRAFT -> SUBMITTED -> AUTO_APPROVED / PENDING_MANAGER -> PENDING_FINANCE -> APPROVED -> ... -> COMPLETED
- `ApprovalStatus`, `ApprovalActionType`, `RiskLevel`, `LineType`, `DealHealthType`, `DealHealthSeverity`

**`money.ts`** — All math helpers. No floats:
- `money(amountMinor, currency)` -> `Money` object
- `roundHalfUp(value)` -> integer, correct for negative values
- `asBps(part, whole)` -> basis points (18% = 1800)
- `applyBps(amount, bps)` -> apply a rate to an amount, stay integer
- `clamp(value, min, max)`, `sum(values[])`

**`errors.ts`**
- `ErrorCode` enum — all possible error codes across the system
- `ERROR_HTTP_STATUS` — maps each code to an HTTP status number
- `ApiErrorBody` / `ApiSuccessBody` / `Paginated` — shared response shapes

**`intelligence.ts`** — All response types for B2 endpoints: `EvaluationResponse`, `ApprovalDetail`, `ApprovalStepView`, `DiscountPolicyView`, `AuditEntry`, `UpsellSuggestion`, `AllocationResponse`, `DealHealthItem`.

**`ports.ts`** — `QUOTE_STATE_PORT` injection token. Allows B2 to inject either the temporary adapter or B1's real service without changing any other code.

---

### `prisma/`

**`schema/base.prisma`** — B2-owned database tables:
- `discount_policies` — ceiling per (tier, category) + approval thresholds
- `risk_evaluations` — every result, with JSON columns for violations + factors
- `approval_requests` — approval chain header (status, currentSequence)
- `approval_steps` — one row per approver in the chain
- `approval_actions` — one row per APPROVE/REJECT/RETURN action
- `inventory_reservations` — stock holds (a set of rows, not a counter)
- `deal_health_events` — active and dismissed health flags
- `audit_log` — immutable event log

**`schema/sales.prisma`** — STUB (B1 owns). Minimum schema for `Customer`, `CustomerTier`, `Quotation`, `QuotationLine` so B2's migrations run standalone.

**`schema/operations.prisma`** — STUB (B3 owns). Minimum schema for `Product`, `ProductCategory`, `Warehouse`, `InventoryItem`, `ProductRelationship`.

**`seed/base.seed.ts`** — Seeds: BRONZE/SILVER/GOLD tiers, 3 categories (Hardware, Services, Subscriptions), 5 users (one per role), 3 products, 2 warehouses with inventory.

**`seed/policy.seed.ts`** — Seeds 12 discount policy rows (4 per tier: 3 category rows + 1 tier default). Ceiling values match unit test fixtures exactly — "the number on screen is the number in the test."

**`seed/demo.seed.ts`** — Seeds demo quotations (QT-1001, QT-1002) and order (ORD-2001) with realistic line items matching the demo scenarios in `B2-BUILD-ORDER.md`.

---

## 5. Data Flow Diagram

```
HTTP Request
     |
     v
+--------------------------------------------+
|  NestJS HTTP Layer                         |
|  AuthGuard -> RolesGuard -> ValidationPipe |
|  Controller -> Service                     |
+-------+------------------------------------+
        |
   +----+---------------------------+
   |                               |
   v                               v
+------------------+    +---------------------------+
|  Prisma ORM      |    |  Intelligence Engine      |
|  PostgreSQL      |    |  (pure computation)       |
|  ─────────────── |    |  ───────────────────────  |
|  B2 owns:        |    |  ceilings.ts              |
|  • policies      +--->+  risk.ts                  |
|  • evaluations   |    |  routing.ts               |
|  • approvals     |    |  allocation.ts            |
|  • reservations  +<---+  upsell.ts                |
|  • health events |    |  deal-health.ts           |
|  • audit_log     |    |  hash.ts                  |
|  ─────────────── |    +---------------------------+
|  B1 tables (R):  |
|  • quotations    |
|  • customers     |
|  ─────────────── |
|  B3 tables (R):  |
|  • warehouses    |
|  • inventory     |
+------------------+
        |
        v
+--------------------------------------------+
|  ResponseInterceptor: { success:true, ..}  |
|  AllExceptionsFilter: { success:false, ..} |
+--------------------------------------------+
        |
        v
HTTP Response
```

---

## 6. Key Design Decisions

### No floats anywhere
Money = integer minor units. Percentages = basis points (18% = 1800 bps). Eliminates floating-point rounding errors in all financial calculations. All helpers in `packages/contracts/src/money.ts`.

### No approval threshold is a literal in code
`routing.ts` has zero numeric literals. Both thresholds come from the database. Change a policy row in the admin screen -> routing changes instantly. No deploy required. This is the live governance demo moment.

### Engine imports nothing from Nest or Prisma
`engine/` is pure TypeScript. Data is assembled by services and passed as plain objects. This is why unit tests run in under a second — no DB setup, no Nest bootstrapping, no mocking framework needed.

### Evaluation is idempotent
SHA-256 hash of all inputs. Same inputs -> same hash -> cached row returned -> no duplicate DB writes. The UI can call evaluate on every keystroke safely.

### Audit is transactional
`AuditService.record()` takes `Prisma.TransactionClient`, not `PrismaService`. The TypeScript compiler enforces that audit writes always happen inside the same transaction as the change they record. If the write fails, the audit rolls back too.

### B2 never writes `quotations.status` directly
All status transitions go through `QuoteStatePort`. Currently bound to a temporary adapter. When B1 ships their service, one line in `intelligence.module.ts` changes. All controllers, services, and engine files are untouched.

---

## 7. Commands Reference

```powershell
# Full setup from scratch
pnpm install
pnpm db:up
Copy-Item .env.example .env
pnpm prisma migrate dev --name init
pnpm prisma generate
pnpm db:seed
pnpm --filter @dealflow/contracts build
pnpm --filter api start:dev

# Development checks
pnpm typecheck                       # type-check all packages
pnpm --filter api test:engine        # engine unit tests only (fast, no DB)
pnpm --filter api test               # all tests

# Build
pnpm --filter @dealflow/contracts build  # build contracts first
pnpm --filter api build                  # build API

# Database
pnpm db:migrate     # run pending migrations
pnpm db:seed        # re-seed (idempotent)
pnpm db:studio      # open Prisma Studio
pnpm generate       # re-generate Prisma client after schema change

# Git
git add .
git commit -m "your message"
git push origin aaryan
```

---

## 8. Quick Endpoint Test

API runs on port **3001**, prefix **`/api/v1`**.
Always pass `x-dev-user-id` and `x-dev-role` in dev mode.

```powershell
# PowerShell
$h = @{ "x-dev-user-id" = "usr_admin"; "x-dev-role" = "ADMIN" }
Invoke-RestMethod http://localhost:3001/api/v1/discount-policies -Headers $h | ConvertTo-Json -Depth 4
Invoke-RestMethod http://localhost:3001/api/v1/approvals -Headers $h | ConvertTo-Json -Depth 4
Invoke-RestMethod http://localhost:3001/api/v1/deal-health -Headers $h | ConvertTo-Json -Depth 4
```

```bash
# curl
curl -s http://localhost:3001/api/v1/discount-policies \
  -H "x-dev-user-id: usr_admin" -H "x-dev-role: ADMIN" | jq .
```

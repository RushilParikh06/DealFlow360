# DealFlow360 — B3 Operations & Billing: Complete Technical Explanation

**Owner:** Panav (B3) | **Branch:** `panav`

---

## 1. Technologies Used

| Category | Technology | Why |
|----------|-----------|-----|
| **Runtime** | Node.js v22 | LTS, fast startup, native `node:test` runner |
| **Language** | TypeScript 5.6 (strict) | Full type safety, `noImplicitAny`, interfaces |
| **ORM** | Prisma 6 | Type-safe DB client, schema-first, migrations |
| **Database** | PostgreSQL (Docker) | ACID transactions, relational integrity |
| **Package Manager** | pnpm 9 (workspace) | Monorepo-aware installs, `--filter` per-package |
| **Testing** | Node.js built-in `node:test` + `assert` | Zero-dependency unit tests, pure functions only |
| **Money Math** | Custom integer helpers (`types.ts`) | No floats anywhere — minor units + basis points |
| **Schema** | `operations.prisma` + `billing.prisma` | B3-owned DB tables separate from B1/B2 schemas |
| **Seed** | `catalog.seed.ts` (duck-typed client) | Works before full workspace exists, no @prisma/client dep |

> **Note:** Panav's branch is focused on **pure business logic services** — no NestJS controllers or HTTP layer yet. All services are plain TypeScript functions that will be wired into the NestJS `OperationsModule` and `BillingModule` (reserved in `app.module.ts` by B2).

---

## 2. Complete Folder Structure

```
dealflow360/                                   <- Monorepo root (panav branch)
|
+-- apps/
|   +-- api/
|       +-- src/
|           +-- modules/
|               |
|               +-- operations/                <- B3 operations domain
|               |   +-- types.ts              <- Shared: Money, applyBps, addMoney, AppError
|               |   |
|               |   +-- allocation/
|               |   |   +-- allocation.service.ts       <- Greedy warehouse split logic
|               |   |   +-- allocation.service.test.ts  <- Unit tests (node:test)
|               |   |
|               |   +-- inventory/
|               |   |   +-- inventory-state.service.ts      <- Reservation state machine
|               |   |   +-- inventory-state.service.test.ts <- Unit tests
|               |   |
|               |   +-- pricing/
|               |       +-- price-resolution.service.ts      <- Tier-aware price lookup
|               |       +-- price-resolution.service.test.ts <- Unit tests
|               |       +-- tax.service.ts                   <- Category-based tax calc
|               |       +-- tax.service.test.ts              <- Unit tests
|               |
|               +-- billing/                   <- B3 billing domain
|                   |
|                   +-- fulfillment/
|                   |   +-- fulfillment-state.service.ts      <- Fulfillment state machine
|                   |   +-- fulfillment-state.service.test.ts <- Unit tests
|                   |
|                   +-- invoice/
|                   |   +-- invoice.service.ts               <- Invoice state machine + line builder
|                   |   +-- invoice.service.test.ts          <- Unit tests
|                   |
|                   +-- payment/
|                   |   +-- payment.service.ts               <- Payment application logic
|                   |   +-- payment.service.test.ts          <- Unit tests
|                   |
|                   +-- subscription/
|                       +-- subscription.service.ts          <- Subscription state + billing dates
|                       +-- subscription.service.test.ts     <- Unit tests
|
+-- prisma/
|   +-- schema/
|   |   +-- operations.prisma    <- B3-owned: Category, Product, Warehouse, Inventory,
|   |   |                           InventoryMovement, PriceList, PriceListItem,
|   |   |                           TaxRule, ProductVariant, ProductRelationship
|   |   +-- billing.prisma       <- B3-owned: Fulfillment, Subscription, BillingSchedule,
|   |                               Invoice, InvoiceLine, Payment, Negotiation,
|   |                               NegotiationMessage
|   +-- seed/
|       +-- catalog.seed.ts      <- Categories, products, warehouses, inventory
|       +-- catalog.seed.test.ts <- Validates seed referential integrity
|
+-- README.md                    <- Full project plan (all teams reference this)
+-- .env                         <- Local environment
```

---

## 3. What B3 Owns

Panav's branch owns two domains:

### Operations Domain
Everything that tracks **physical goods and pricing**:
- Products, categories, variants
- Warehouses and inventory levels
- Inventory reservations (stock holds)
- Price lists (tier-specific and default)
- Tax rules per category

### Billing Domain
Everything that tracks **money flow after an order is confirmed**:
- Fulfillment lifecycle (ORDER_CONFIRMED → DELIVERED)
- Invoice creation and state transitions
- Payment application
- Subscription management and billing schedules
- Customer negotiations (portal counter-offers)

---

## 4. Complete Project Flow

### The key rule: all services are pure functions

Every file in Panav's branch exports **plain TypeScript functions** that take data in and return data out. No database calls inside the functions — the caller (future NestJS service) reads from DB, passes the data in, and writes the result back.

This is the same architectural pattern B2 uses for its engine. Benefits:
- Tests run in milliseconds with no DB setup
- Logic is readable without tracing through Prisma calls
- The NestJS layer stays as a thin adapter

---

### Flow 1: Inventory Reservation State Machine

The inventory system tracks stock using a **state machine on each reservation**, never a single decrementing counter.

```
ReservationStatus: AVAILABLE -> RESERVED -> ALLOCATED -> SHIPPED
                                    |             |
                                    +-> RELEASED <-+
                                    |
                                    RELEASED -> RESERVED (re-reserve after release)

transitionReservation(from, to):
  Validates the transition against the allowed table
  Throws AppError('QUOTE_INVALID_STATE') for illegal moves
  Returns the new status

availableQty(onHand, reserved):
  available = onHand - reserved
  Derived at read time, NEVER stored in a column

reserveStock(onHand, reserved, qty):
  Checks qty <= availableQty(onHand, reserved)
  Throws AppError('INSUFFICIENT_STOCK') if not enough
  Returns: reserved + qty (new reserved count)
```

**Key design decision:** `available` is computed on every read (`onHand - reserved`), never stored as its own column. This means two simultaneous reads of the same inventory row always see the same truth — there is no stale denormalised field to get out of sync.

---

### Flow 2: Allocation (Warehouse Split)

When an order is confirmed, B3 recommends which warehouse(s) should fulfill each product line.

```
recommendAllocation(lines, stock):
  |
  +-- For each product line:
  |       Filter stock rows for that product
  |       Sort by shippingCostMinor ASC (cheapest first)
  |
  +-- Greedy fill per warehouse:
  |       Take as much as available, track remaining locally
  |       Move to next warehouse if first can't cover all
  |
  +-- Any unmet demand -> backorder[]
  |
  +-- Return: allocations[], backorder[], totalShipments

This is a RECOMMENDATION only. It reserves nothing.
The actual reservation is a separate step (inventory-state.service).
```

**Example from tests:** 24 units needed, East Depot has 5 (cheaper), Main Warehouse has 22. Result: East Depot supplies 5, Main Warehouse supplies 19. Two shipments total.

---

### Flow 3: Price Resolution

B3 owns price lists. A customer's tier may have a special price; otherwise the default list applies.

```
resolvePrice(priceLists, items, productId, customerTierId):
  |
  +-- Find the tier-specific list (customerTierId matches)
  +-- Find the default list (customerTierId is null)
  |
  +-- Look for item in tier list first (tier-specific price wins)
  +-- Fall back to default list if not found in tier list
  |
  +-- If neither has the product -> throw AppError('NOT_FOUND')
      Never return a silent zero price
```

**Key rule:** Missing price = hard error, not zero. A zero-price sale would be undetectable corruption.

---

### Flow 4: Tax Calculation

```
findTaxRule(rules, categoryId):
  Find category-specific rule, or the null-categoryId default rule

calculateLineTax(lineTotal, rules, categoryId):
  Find rule for this line's category
  tax = applyBps(lineTotal.amountMinor, rule.rateBps)
  No rule found -> tax = 0 (not an error, some items are tax-exempt)
  Return: Money { amountMinor: taxAmount, currency }
```

Tax rates are in **basis points**: 18% GST = `1800 bps`. Integer math only.

---

### Flow 5: Fulfillment State Machine

Tracks a physical order from warehouse pick to customer delivery.

```
FulfillmentStatus states:
  ORDER_CONFIRMED
       |
       +-> INVENTORY_RESERVED -> PICKING -> PACKED -> SHIPPED -> DELIVERED
       |
       +-> BACKORDERED -> INVENTORY_RESERVED (re-enters normal path when stock arrives)

transitionFulfillment(from, to):
  Validates move against allowed transitions table
  Throws AppError('QUOTE_INVALID_STATE') for illegal moves
  Returns new status

Key rule: DELIVERED is terminal. No going back.
Key rule: BACKORDERED can re-enter INVENTORY_RESERVED when stock arrives.
```

**Why it matters for invoicing:** `buildOneTimeInvoiceLines()` in `invoice.service.ts` checks that a line's `FulfillmentStatus` is `SHIPPED` or `DELIVERED` before including it in an invoice. Nothing is billed before it ships.

---

### Flow 6: Invoice State Machine + Line Building

```
InvoiceStatus states:
  DRAFT -> ISSUED -> PARTIALLY_PAID -> PAID    (terminal)
        -> VOID                                 (terminal)
  ISSUED -> OVERDUE -> PARTIALLY_PAID -> PAID
  ISSUED -> OVERDUE -> PAID

transitionInvoice(from, to):
  Validates move against allowed transition table
  Throws AppError('QUOTE_INVALID_STATE') for illegal moves
  Returns new status

buildOneTimeInvoiceLines(lines, fulfillmentByLineId):
  Filter: only ONE_TIME lines (RECURRING go to subscription engine)
  Check: every ONE_TIME line must be SHIPPED or DELIVERED
  If any unshipped ONE_TIME line exists -> throw AppError('INVOICE_BEFORE_SHIPMENT')
  Return: InvoiceLine[] for the qualifying lines
```

**Key invariant:** You cannot invoice what has not shipped. The check happens in the pure function before any DB write, enforced by the TypeScript compiler via the fulfillment status type.

---

### Flow 7: Payment Application

```
applyPayment(invoiceTotalMinor, paidSoFarMinor, amountMinor):
  |
  +-- Guard: amountMinor > 0 (no zero or negative payments)
  +-- Guard: paidSoFarMinor + amountMinor <= invoiceTotalMinor (no overpayment)
  |
  +-- newPaidMinor = paidSoFarMinor + amountMinor
  +-- Derive status:
        newPaidMinor == invoiceTotalMinor -> 'PAID'
        newPaidMinor < invoiceTotalMinor  -> 'PARTIALLY_PAID'
  |
  +-- Return: { newPaidMinor, status }

Status is DERIVED from math, never set by the caller.
Payments are simulated (no real payment gateway in v1).
```

---

### Flow 8: Subscription State Machine + Billing Dates

```
SubscriptionStatus states:
  ACTIVE <-> PAUSED
  ACTIVE  -> CANCELLED (terminal)
  PAUSED  -> CANCELLED (terminal)

transitionSubscription(from, to):
  Validates move against allowed transition table
  Throws AppError('SUBSCRIPTION_INVALID_STATE') for illegal moves
  Returns new status

nextBillingDate(from: Date, cadenceMonths: number): Date
  Adds cadenceMonths to the given date
  Returns next billing cycle date
  No proration on plan changes (v1 limitation -- change takes effect next cycle)
```

---

## 5. Every File Explained

### `apps/api/src/modules/operations/types.ts`

The shared foundation for all of Panav's code. Contains:

- **`Money`** interface: `{ amountMinor: number; currency: string }`. All money values in the system use this. No raw floats allowed.
- **`applyBps(amountMinor, bps)`**: Applies a basis-point rate to a minor-unit amount. Returns integer (rounded). Example: 18% tax on ₹10,000 = `applyBps(10000, 1800)` = `1800`.
- **`addMoney(a, b)`**: Adds two Money values. Throws if currencies differ — cross-currency addition is a programming error, not a runtime event.
- **`AppError`**: Error class with `code`, `message`, and optional `details`. Code strings match the error codes defined in `packages/contracts/src/errors.ts` (the shared contract). One shape across the whole B3 surface.

> This file is documented to move to `packages/contracts/` once the workspace scaffold from F/B1/B2 exists. Until then it lives here to avoid creating a circular dependency.

---

### `apps/api/src/modules/operations/allocation/allocation.service.ts`

Exports `recommendAllocation(lines, stock)`:
- Accepts: `OrderLineRequest[]` (productId + qty) and `WarehouseStock[]` (warehouse data with computed available qty)
- Sorts warehouses by `shippingCostMinor` ascending (cheapest first)
- Greedy fill: drains cheapest warehouse before moving to next
- Tracks remaining stock locally in a `Map` so no warehouse is double-spent across lines
- Returns: `AllocationResult { allocations[], backorder[], totalShipments }`
- **Pure function. Recommends only. Reserves nothing.**

---

### `apps/api/src/modules/operations/inventory/inventory-state.service.ts`

Exports three functions:

- **`transitionReservation(from, to)`**: State machine guard. Throws on illegal transitions. Returns new status.
- **`availableQty(onHand, reserved)`**: `onHand - reserved`. Never stored, always derived.
- **`reserveStock(onHand, reserved, qty)`**: Guards qty against derived available. Throws `INSUFFICIENT_STOCK` if not enough. Returns new reserved count.

The `ReservationStatus` type: `AVAILABLE | RESERVED | ALLOCATED | SHIPPED | RELEASED`.

Allowed transitions:
```
AVAILABLE  -> RESERVED
RESERVED   -> ALLOCATED | RELEASED
ALLOCATED  -> SHIPPED | RELEASED
SHIPPED    -> (terminal)
RELEASED   -> RESERVED
```

---

### `apps/api/src/modules/operations/pricing/price-resolution.service.ts`

Exports `resolvePrice(priceLists, items, productId, customerTierId)`:
- Tier-specific price list wins over the default list
- If neither list contains the product: throws `AppError('NOT_FOUND')`
- Never returns a zero price silently — a missing price is always an error

Interfaces: `PriceList { id, customerTierId }`, `PriceListItem { priceListId, productId, unitPriceMinor, currency }`.

---

### `apps/api/src/modules/operations/pricing/tax.service.ts`

Exports two functions:
- **`findTaxRule(rules, categoryId)`**: Finds category-specific rule or the null-categoryId default rule
- **`calculateLineTax(lineTotal, rules, categoryId)`**: Returns tax as a `Money` value. No matching rule = 0 tax (not an error — some categories are exempt)

`TaxRule` interface: `{ categoryId: string; rateBps: number }`. Rate is basis points: 18% = `1800`.

---

### `apps/api/src/modules/billing/fulfillment/fulfillment-state.service.ts`

Exports `transitionFulfillment(from, to)` and the `FulfillmentStatus` type.

State machine for a physical order's journey:
```
ORDER_CONFIRMED -> INVENTORY_RESERVED -> PICKING -> PACKED -> SHIPPED -> DELIVERED
ORDER_CONFIRMED -> BACKORDERED -> INVENTORY_RESERVED (when stock arrives)
INVENTORY_RESERVED -> BACKORDERED (if stock check fails after initial confirm)
```
`DELIVERED` and `BACKORDERED` (except re-entry) are terminal or near-terminal.

**Critical dependency:** `invoice.service.ts` uses `FulfillmentStatus` to block invoicing of unshipped lines.

---

### `apps/api/src/modules/billing/invoice/invoice.service.ts`

Exports:
- **`transitionInvoice(from, to)`**: State machine guard for invoice lifecycle
- **`buildOneTimeInvoiceLines(lines, fulfillmentByLineId)`**: Creates invoice lines from order lines

Invoice state machine:
```
DRAFT -> ISSUED -> PARTIALLY_PAID -> PAID  (terminal)
      -> VOID                              (terminal)
ISSUED -> OVERDUE -> PARTIALLY_PAID -> PAID
ISSUED -> OVERDUE -> PAID
```

`buildOneTimeInvoiceLines` rules:
1. Only `ONE_TIME` lines are included (recurring lines go to the subscription engine)
2. Every `ONE_TIME` line must be `SHIPPED` or `DELIVERED` — otherwise throws `INVOICE_BEFORE_SHIPMENT`
3. Returns `InvoiceLine[]` where each line maps `orderLineId -> Money amount`

---

### `apps/api/src/modules/billing/payment/payment.service.ts`

Exports `applyPayment(invoiceTotalMinor, paidSoFarMinor, amountMinor)`.

- Guard: amount must be positive
- Guard: total paid cannot exceed invoice total (no overpayment)
- Derives new invoice status from math (`PAID` vs `PARTIALLY_PAID`)
- Returns: `{ newPaidMinor, status }`

Payments are simulated in v1 — no real payment gateway integration.

---

### `apps/api/src/modules/billing/subscription/subscription.service.ts`

Exports:
- **`transitionSubscription(from, to)`**: State machine guard for subscription lifecycle
- **`nextBillingDate(from, cadenceMonths)`**: Calculates next billing cycle date

Subscription states:
```
ACTIVE <-> PAUSED
ACTIVE  -> CANCELLED (terminal)
PAUSED  -> CANCELLED (terminal)
```

Billing date: adds `cadenceMonths` whole months to `from`. No mid-cycle proration in v1.

---

### `prisma/schema/operations.prisma`

B3-owned operational database tables:

| Model | Purpose |
|-------|---------|
| `Category` | Product categories (Hardware, Services, etc.) |
| `Product` | Products with `costMinor`, `sku`, `categoryId` |
| `ProductVariant` | Product variants with JSON `attributes` |
| `ProductRelationship` | Upsell/cross-sell pairs with `rankScore` (B2 reads this for upsell ranking) |
| `PriceList` | Named price list, optionally tier-specific (`customerTierId`) |
| `PriceListItem` | Per-product price within a list (`unitPriceMinor`) |
| `TaxRule` | Tax rate per category in bps (`rateBps`). Null `categoryId` = default rate |
| `Warehouse` | Physical warehouse with `shippingCostMinor` per shipment |
| `Inventory` | `onHand` + `reserved` per (warehouse, product). `available` is derived, never stored |
| `InventoryMovement` | Append-only log of every `onHand`/`reserved` change with `reason` |

**Cross-domain rule:** Foreign IDs pointing at B1's tables (`customerTierId`) are stored as plain `String` fields, not Prisma relations. The owning schema (B1's `sales.prisma`) declares the relation; B3 just stores the ID.

---

### `prisma/schema/billing.prisma`

B3-owned billing database tables:

| Model | Purpose |
|-------|---------|
| `Fulfillment` | One row per order. `status` is the fulfillment lifecycle string |
| `Subscription` | Recurring billing subscription: `amountMinor`, `cadenceMonths` |
| `BillingSchedule` | Individual billing schedule entries per subscription cycle |
| `Invoice` | Invoice header: `totalMinor`, `paidMinor`, `status` |
| `InvoiceLine` | One row per order line in the invoice |
| `Payment` | Simulated payment records linked to an invoice |
| `Negotiation` | Portal counter-offer thread linked to a quotation (`quotationId`) |
| `NegotiationMessage` | Individual message in a negotiation with optional `requestedDiscountBps` |

**Note:** `orderId` and `quotationId` in these tables are plain strings pointing at B1's tables, not Prisma relations — same cross-domain rule.

---

### `prisma/seed/catalog.seed.ts`

Seeds the catalog data B3 owns:

| Data | Content |
|------|---------|
| Categories | `cat_hardware` (Hardware), `cat_services` (Services) |
| Products | `prd_1` Laptop (cost ₹60,000), `prd_9` Onsite Setup Service (cost ₹10,000) |
| Warehouses | `wh_main` Main Warehouse (₹42 shipping), `wh_east` East Depot (₹29 shipping) |
| Inventory | Main: 30 Laptops, East: 5 Laptops |

**Important:** The seed uses a duck-typed `SeedClient` interface instead of importing `@prisma/client` directly. This means the seed can be written and tested before the full workspace and `prisma generate` exist.

`validateCatalogSeed()` checks referential integrity before writing to the DB — products must reference existing categories, inventory rows must reference existing products.

---

## 6. Data Flow Diagram

```
Future NestJS OperationsModule / BillingModule (HTTP Layer)
     |
     +-- Controller receives request
     +-- Service reads from DB (Prisma)
     +-- Passes plain data objects to pure functions below
     |
     v
+------------------------------------------------------+
|  B3 Pure Business Logic (no DB, no Nest inside)     |
|                                                      |
|  operations/                                         |
|    allocation.service.ts   -> recommendAllocation()  |
|    inventory-state.service -> transitionReservation()|
|                               availableQty()         |
|                               reserveStock()         |
|    pricing/                -> resolvePrice()         |
|                               calculateLineTax()     |
|                                                      |
|  billing/                                            |
|    fulfillment-state       -> transitionFulfillment()|
|    invoice.service         -> transitionInvoice()    |
|                               buildOneTimeInvoice()  |
|    payment.service         -> applyPayment()         |
|    subscription.service    -> transitionSubscription()|
|                               nextBillingDate()      |
+------------------------------------------------------+
     |
     v
Service writes result back to DB (Prisma)
     |
     v
ResponseInterceptor: { success: true, data: ... }
AllExceptionsFilter: { success: false, error: ... }
```

---

## 7. Testing

Panav's tests use **Node.js built-in `node:test`** — no Jest, no test framework dependencies.

```bash
# Run all B3 tests (from repo root)
node --test apps/api/src/modules/operations/**/*.test.ts
node --test apps/api/src/modules/billing/**/*.test.ts
node --test prisma/seed/catalog.seed.test.ts
```

Tests cover:
- Invoice transitions (happy path, terminal states, unshipped lines)
- Payment application (positive, partial, full, overpayment guard)
- Subscription transitions (ACTIVE <-> PAUSED, CANCELLED terminal)
- Billing date calculation
- Fulfillment state transitions
- Allocation (greedy split, backorder, single-warehouse coverage)
- Inventory reservation (reserve, release, re-reserve, insufficient stock)
- Price resolution (tier-specific wins, default fallback, missing price error)
- Tax calculation (category rule, default rule, no rule = zero)
- Catalog seed referential integrity

---

## 8. Key Design Decisions

### Pure functions, no DB inside service logic
All business logic is in plain functions. The future NestJS service layer will read from DB, pass data in, get a result, and write back. This is why tests run with no DB setup — the logic is completely decoupled from persistence.

### No floats
All money is `integer minor units` (paise, cents). Percentages are `basis points` (18% = 1800). `applyBps()` does integer math with rounding. Defined in `types.ts` and will migrate to `packages/contracts/src/money.ts`.

### Available stock is derived, never stored
`available = onHand - reserved`. This is computed at read time from the `Inventory` table. There is no `available` column. This prevents the stale-counter problem where two concurrent writes could leave the column out of sync.

### State machines for every lifecycle
Invoice, fulfillment, subscription, and inventory reservation all use explicit allowed-transition tables. An illegal move throws immediately — the compiler sees `AppError` as the exception shape, and tests verify every illegal transition is rejected.

### Invoice before shipment is impossible
`buildOneTimeInvoiceLines()` checks fulfillment status before building lines. An unshipped line throws `INVOICE_BEFORE_SHIPMENT`. This cannot be bypassed because the check is in the pure function, not in a controller guard that could be misconfigured.

### Cross-domain IDs as plain strings
B3's schemas reference B1's tables (customers, quotations, orders) using plain `String` ID fields, not Prisma `@relation` references. This keeps B3's schema compilable and migratable independently of B1's schema — the owning side declares the relation.

---

## 9. Integration Points with Other Teams

### From B2 (Intelligence Engine)
- B2 reads `ProductRelationship` (from `operations.prisma`) for upsell ranking
- B2 reads `Warehouse` and `Inventory` via `ops-reader.service.ts` for allocation
- B2 creates `inventory_reservations` rows (its own table in `base.prisma`)
- When B3 ships, B2 deletes `ops-reader.service.ts` and wires into B3's real services

### From B1 (Sales Module)
- B3's billing models reference `orderId` / `quotationId` from B1's `sales.prisma`
- B1 confirms orders — B3 creates `Fulfillment` rows when orders are confirmed
- `customerTierId` in `PriceList` points at B1's `CustomerTier`

### From Frontend (F)
- All responses follow `{ success: true, data: ... }` shape (defined in `packages/contracts/src/errors.ts`)
- `AppError` in `types.ts` uses the same error codes as the shared contracts package
- Price resolution, tax, inventory, and billing APIs will be consumed by Screens 7, 8, 12, 13 of the UI

---

## 10. Commands Reference

```powershell
# Install all dependencies (from monorepo root)
pnpm install

# Start PostgreSQL
pnpm db:up

# Run Prisma migrations (includes operations + billing schemas)
pnpm prisma migrate dev --name init
pnpm prisma generate

# Seed catalog data
pnpm db:seed

# Run B3 unit tests (Node built-in test runner)
node --test apps/api/src/modules/operations/allocation/allocation.service.test.ts
node --test apps/api/src/modules/operations/inventory/inventory-state.service.test.ts
node --test apps/api/src/modules/operations/pricing/price-resolution.service.test.ts
node --test apps/api/src/modules/operations/pricing/tax.service.test.ts
node --test apps/api/src/modules/billing/invoice/invoice.service.test.ts
node --test apps/api/src/modules/billing/payment/payment.service.test.ts
node --test apps/api/src/modules/billing/subscription/subscription.service.test.ts
node --test apps/api/src/modules/billing/fulfillment/fulfillment-state.service.test.ts

# Git
git add .
git commit -m "your message"
git push origin panav
```

---

## 11. What Is Not Yet Done (Next Steps for B3)

| Item | Status |
|------|--------|
| NestJS `OperationsModule` and `BillingModule` wired into `app.module.ts` | Pending |
| HTTP controllers for all operations/billing endpoints | Pending |
| Prisma service reads wired to pure functions | Pending |
| Real payment gateway integration | Deferred (v2) |
| Subscription proration | Deferred (v2) |
| Negotiation/portal counter-offer HTTP endpoints | Pending |
| `types.ts` moved to `packages/contracts/` | Pending (needs group agreement) |

The pure functions are complete and tested. Wiring them into NestJS is the remaining work.

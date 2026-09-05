# B2 — Intelligence. Build order.

Aaryan. Everything in this repo under `modules/intelligence`, `prisma/schema/intelligence.prisma`, and the four B2 seed files is yours. This file is the order to do things in and the things to say to the rest of the team.

Read the three sections in order: what already exists, what to do next, what to tell the others.

---

## 1. What is already written and verified

The engine is done and tested. **53 unit tests pass, 0 fail**, with no database and no network — they are pure functions.

| Piece | File | State |
|---|---|---|
| Per-line ceiling resolution | `engine/ceilings.ts` | done, tested |
| Blended risk score + 4 factors | `engine/risk.ts`, `engine/risk-model.ts` | done, tested |
| Approval routing (zero literals) | `engine/routing.ts` | done, tested |
| Idempotency hash | `engine/hash.ts` | done, tested |
| Orchestrator | `engine/evaluate.ts` | done, tested |
| Upsell rank | `engine/upsell.ts` | done, tested |
| Warehouse split | `engine/allocation.ts` | done, tested |
| Deal health detection | `engine/deal-health.ts` | done, tested |
| Prisma models (8 tables) | `prisma/schema/intelligence.prisma` | written, **not yet migrated** |
| 10 services | `modules/intelligence/services/` | written, **not yet compiled** |
| 7 controllers, 6 DTO files | `modules/intelligence/controllers/`, `dto/` | written, **not yet compiled** |
| Seeds | `prisma/seed/*.ts` | written, **not yet run** |
| Mock fixtures for F | `apps/web/src/mocks/intelligence-fixtures.json` | generated from the real engine |

The "not yet compiled" rows are not a warning about quality — the npm registry was blocked in the environment that wrote them, so `tsc` never ran over the NestJS layer. The engine and its tests were executed for real. Expect a handful of import-order or type-narrowing fixes in the service and controller files on the first `pnpm typecheck`, and budget fifteen minutes for them.

---

## 2. Do these in order

### Phase 0 — 15 minutes. Get it running.

```bash
cd dealflow360
cp .env.example .env
pnpm install
pnpm db:up                # postgres 16 + redis 7 in docker
pnpm prisma migrate dev --name init
pnpm db:seed
pnpm typecheck            # fix what falls out here, this is the 15 minutes
pnpm --filter api start:dev
```

Then prove the whole thing works with three curl calls. `AUTH_MODE=dev` means you do not need B1's login to exist:

```bash
# find the quote id
psql postgresql://dealflow:dealflow@localhost:5432/dealflow -c "select id, code from quotations order by code;"

QT=<paste the QT-1001 id>

curl -s -X POST localhost:3001/api/v1/quotes/$QT/evaluate \
  -H 'x-dev-user-id: <a SALES_REP user id>' -H 'x-dev-role: SALES_REP' | jq .

curl -s localhost:3001/api/v1/approvals \
  -H 'x-dev-user-id: <a manager id>' -H 'x-dev-role: SALES_MANAGER' | jq .

curl -s localhost:3001/api/v1/deal-health \
  -H 'x-dev-user-id: <a manager id>' -H 'x-dev-role: SALES_MANAGER' | jq .
```

**Gate:** QT-1001 comes back `riskScore: 80`, `riskLevel: "HIGH"`, `requiredApprovals: ["SALES_MANAGER","FINANCE"]`. If it does, every layer from Postgres to the HTTP envelope is working and you are past the risky part. If the numbers differ, the engine did not change — the seed or the reader did, and `demo-scenarios.spec.ts` will tell you which.

### Phase 1 — 40 minutes. Close the approval loop.

Approve QT-1001 through both steps and watch the quotation status walk `SUBMITTED → PENDING_MANAGER → PENDING_FINANCE → APPROVED`.

```bash
curl -s -X PATCH localhost:3001/api/v1/approvals/<id> \
  -H 'content-type: application/json' \
  -H 'x-dev-user-id: <manager id>' -H 'x-dev-role: SALES_MANAGER' \
  -d '{"action":"APPROVE"}' | jq '.data.status, .data.currentStep'
```

Check three things by hand, because these are the ones a judge can break:

1. A `SALES_MANAGER` trying to action the finance step gets `APPROVAL_STEP_NOT_YOURS`, not a 500.
2. `REJECT` without a `reason` is refused.
3. `GET /api/v1/quotes/<id>/audit-trail` has a row for every one of those transitions, and the timestamps are inside the same transaction window as the status changes.

**Gate:** the audit trail reads like a story with no gaps. That trail is the single most convincing artifact you own.

### Phase 2 — 25 minutes. The policy demo.

This is the moment that separates you from teams who hardcoded thresholds.

```bash
# lower the Gold services ceiling from 10% to 6%
curl -s -X PATCH localhost:3001/api/v1/discount-policies/<gold services policy id> \
  -H 'content-type: application/json' \
  -H 'x-dev-user-id: <admin id>' -H 'x-dev-role: ADMIN' \
  -d '{"maxDiscountBps":600}'

# re-evaluate QT-1002 and watch the routing change
curl -s -X POST localhost:3001/api/v1/quotes/<QT-1002 id>/evaluate \
  -H 'x-dev-user-id: <rep id>' -H 'x-dev-role: SALES_REP' | jq '.data.riskScore, .data.requiredApprovals'
```

QT-1002 should move from `["SALES_MANAGER"]` to `["SALES_MANAGER","FINANCE"]` with no deploy and no code change. Also confirm the input hash changed, so a new evaluation row was written rather than the old one being handed back. Put the ceiling back to 1000 afterwards.

**Gate:** you can say "no threshold in this system is in the code" and then prove it in twenty seconds.

### Phase 3 — 30 minutes. Allocation and upsell.

```bash
curl -s localhost:3001/api/v1/orders/<ORD-2001 id>/allocation-plan -H '...' | jq .
curl -s -X POST localhost:3001/api/v1/orders/<ORD-2001 id>/reserve -H '...' | jq .
curl -s localhost:3001/api/v1/orders/<ORD-2001 id>/allocation-plan -H '...' | jq .   # available has dropped
curl -s localhost:3001/api/v1/quotes/<QT-1001 id>/upsell -H '...' | jq .
```

Expect 22 from Main Warehouse and 2 from East Depot, two shipments, ₹71.00 of shipping. After reserving, the second plan call must show less available stock — that proves reservations are real and not decoration. Upsell must put Priority Support first (best margin × attach rate), and every suggestion must be priced at a discount that would not itself trigger an approval.

### Phase 4 — the rest of the day, in this order

1. **Wire F's screens to the real API.** Hand over `apps/web/src/mocks/intelligence.ts` — F can build against it immediately and swap in `fetch` later. Do this early; F being blocked on you is the most expensive failure mode on the team.
2. **Delete `quote-state.adapter.ts`** the moment B1 ships `QuoteStateService`. One line changes in `intelligence.module.ts`.
3. **Replace the two reader services' stub assumptions** as B1 and B3 land real schemas. Only `quote-reader.service.ts` and `ops-reader.service.ts` should need edits. If a third file needs to change, something leaked and it is worth fixing then rather than later.
4. **Portal re-approval.** When a customer counter-offer changes a line, the flow is: B1 or F updates the line, then calls `POST /quotes/:id/evaluate`. The engine already supersedes the open approval chain and opens a new one. You do not need new code for this — you need to make sure whoever owns the portal calls evaluate. Say so out loud in chat.
5. **Only if there is time:** a BullMQ job calling `DealHealthService.sweep()` every ten minutes. The refresh endpoint already does the same work on demand, so this is polish, not substance. Redis is already running for it.

---

## 3. Say these five things to the team. Today, not later.

Copy-paste them.

**To everyone, before the first migration:**
> I've pushed stub `sales.prisma` and `operations.prisma` so intelligence can migrate and run standalone. They only contain columns the plan already fixes. B1 owns sales.prisma, B3 owns operations.prisma — overwrite them wholesale, don't merge. Only two files in the API read your tables (`quote-reader.service.ts`, `ops-reader.service.ts`), so when your real schemas land those are the only two files I touch.

**To B1, about cost:**
> `QuotationLine.costMinor` is a **unit** cost in my code — I compute line cost as `costMinor × qty`. If you seed or write it as a line total instead, my margin numbers are wrong by a factor of qty and every risk score shifts. Confirm which you're storing.

**To B1, about status:**
> I never write `quotations.status` directly. I go through a `QuoteStatePort` and I've bound it to a temporary adapter with the plan's transition table copied into it. When your `QuoteStateService` is ready, tell me and I'll change one line in `intelligence.module.ts` and delete my adapter. Until then, if you also write status transitions we'll both be enforcing the same table in two places, which is fine, but don't let a third place appear.

**To B3, about reservations:**
> Available stock is `onHand` minus my `inventory_reservations` rows, computed at read time. There is no denormalised `reserved` column being decremented, deliberately. If you need to ship or pick, transition the reservation status — don't subtract from `onHand` behind my back or the two views will disagree.

**To F, about mocks:**
> `apps/web/src/mocks/intelligence.ts` has typed, real response bodies for every intelligence endpoint, generated from the engine rather than typed by hand. Build all the intelligence screens against it now. Every response is wrapped `{ success: true, data: ... }` and every error is `{ success: false, error: { code, message, details } }` — handle the envelope once in your API client, not per screen.

---

## 4. Three honest notes

**plan.md prints 82, the engine computes 80.** For the section 8 worked example, the four-factor model gives 37 + 24 + 14 + 5 = 80. The doc's 82 predates the factor breakdown. Two options: change the doc to 80, or add two points somewhere to match the doc. Change the doc. Never bend a formula to fit a number in a slide — if a judge asks how the score is built, "37 + 24 + 14 + 5, here are the four factors on screen" is a complete answer and "82 because the spec said so" is not. Decide with the team and change it in one place so nobody demos a contradiction.

**The `(tierId, categoryId)` unique index does not prevent duplicate tier defaults.** Postgres treats `NULL` values as distinct in a unique index, so two rows with the same `tierId` and `categoryId = NULL` are both legal. The seed uses find-then-write so it can't create duplicates, and the API only ever updates policies by id, so nothing in the current code can produce one. If you get time and want to close it properly, add a partial unique index in a migration. It is not a demo risk; it is a correctness note so nobody is surprised later.

**Deal health flags QT-1001 as low margin.** That is correct, not a bug — the plan's own worked example has an 11.4% order margin against a 15% floor. The RackServer only carries 13.3% gross margin at list price, which is exactly why discounting it is risky. If the dashboard looks noisy because of it, the answer is to explain it, not to raise the floor until the warning goes away.

---

## 5. Invariants you are personally responsible for

If you break one of these under time pressure at 3am, it will show up in the demo.

1. **No floats.** Money is integer minor units, percentages are basis points. `packages/contracts/src/money.ts` has every helper you need.
2. **The engine imports nothing from Nest or Prisma.** That is why 53 tests run in under a second. If you ever need the database inside `engine/`, you have put logic in the wrong layer — pass the data in.
3. **No approval threshold is a literal in code.** `routing.ts` contains no numbers at all. Score-shaping and display constants live in `risk-model.ts` and govern nothing.
4. **Audit writes share the transaction with the change.** `AuditService.record()` takes a `Prisma.TransactionClient`, so this is enforced by the compiler, not by discipline.
5. **B2 never writes `quotations.status`.** Everything goes through the port.
6. **Evaluation is idempotent.** Same inputs, same hash, same row. The UI can call evaluate on every keystroke and nothing duplicates.

---

## 6. If you are running out of time

Cut in this order, from the bottom:

1. The BullMQ scheduled sweep. The refresh button does the same job.
2. `POST /deal-health/:id/nudge`. Nice, not load-bearing.
3. Reservation release. Reserve alone tells the story.
4. Audit filters. The per-quote trail is the one that matters.

Never cut, in any circumstance: evaluate, the approval queue and actions, the policy editor, the audit trail on a quotation. Those four are the demo.

# DealFlow360 — AI Integration Implementation Plan

## Background

DealFlow360's `intelligence` module already owns a deterministic engine
(`engine/`) that computes risk scores, approval routing, upsell rankings,
and deal-health events with 53 passing unit tests. This plan adds an **AI
layer on top** — the LLM only translates engine outputs into plain English.
No existing business logic moves.

> [!IMPORTANT]
> All new files live under `apps/api/src/modules/intelligence/ai/`.
> The `engine/` folder is **never touched**. Every AI service returns `null`
> on failure so `AI_ENABLED=false` leaves the existing 121 API tests passing.

---

## Pre-flight

```bash
pnpm --filter api add @google/generative-ai groq-sdk
```

Add to `.env` (and `.env.example`):

```env
GEMINI_API_KEY=      # https://aistudio.google.com/  — free
GROQ_API_KEY=        # https://console.groq.com/keys — free
AI_ENABLED=true
```

---

## Proposed Changes

### Phase 0 — AI Foundation (1–2 hours)

Establishes the provider wrapper. No features yet — just the wiring that all
later services inject.

---

#### [NEW] [`ai-provider.service.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/ai/ai-provider.service.ts)

- Wraps `@google/generative-ai` (Gemini Flash) as primary
- Wraps `groq-sdk` (Llama 3.1 8b) as automatic fallback on HTTP 429
- Exposes `call(options)` → `string | null` and `callJson<T>()` → `T | null`
- Returns `null` (never throws) when both providers fail
- Short-circuits immediately when `AI_ENABLED=false`
- Logs every call as structured JSON for quota monitoring

#### [NEW] [`ai.module.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/ai/ai.module.ts)

- NestJS module with `AIProviderService` in `providers` and `exports`

#### [MODIFY] [`intelligence.module.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/intelligence.module.ts)

- Add `imports: [AIModule]` — the only change to the decorator

**Verification:**
```bash
pnpm typecheck   # zero errors
pnpm --filter api start:dev   # API starts, no new endpoints yet
```

---

### Phase 1 — Smart Upsell Reasoning (2 hours)

Enriches `GET /api/v1/quotes/:id/upsell` with an `aiReasoning` field per suggestion.
Purely additive — no new endpoint, no contract break.

---

#### [NEW] [`upsell-ai.service.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/ai/upsell-ai.service.ts)

- Receives `UpsellSuggestion[]` (from `rankUpsell()`) + lightweight quote context
- Builds a prompt listing candidates ranked by expected margin
- Returns the same array with `.aiReasoning?: string` added per item
- Falls back to original array when AI returns null

#### [MODIFY] [`services/upsell.service.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/services/upsell.service.ts)

- Inject `UpsellAiService`
- After `rankUpsell()`, call `upsellAi.enrichWithReasoning(ranked, ctx)` and return the result
- `forQuotation()` now needs `quote.customerName`, `quote.tierName` from `QuoteReaderService`

**New response field:**
```jsonc
{ "productId": "...", "rank": 1, "aiReasoning": "High-volume hardware purchase benefits from guaranteed SLA times." }
```

**Verification:**
```bash
# AI_ENABLED=true
curl -s localhost:3001/api/v1/quotes/<id>/upsell \
  -H 'x-dev-role: SALES_REP' -H 'x-dev-user-id: <id>' | jq '.[].aiReasoning'

# AI_ENABLED=false → aiReasoning absent, same data otherwise
```

---

### Phase 2 — Deal Health AI Summaries (2 hours)

New endpoint that converts open `DealHealthItem[]` for a quote into a 2-sentence
executive summary and 2 next-step actions.

---

#### [NEW] [`deal-health-ai.service.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/ai/deal-health-ai.service.ts)

- Receives `DealHealthItem[]` + quote context (code, customer, value, age in days)
- Returns `{ summary: string, actions: string[2], generatedAt: string } | null`
- Uses the typed event messages already written by `deal-health.ts` engine

#### [MODIFY] [`services/deal-health.service.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/services/deal-health.service.ts)

- Add public method `aiSummaryFor(quotationId, dealHealthAi)` after `nudge()`
- Calls `listFor()`, builds quote context from a single Prisma read, delegates to the AI service

#### [MODIFY] [`controllers/deal-health.controller.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/controllers/deal-health.controller.ts)

- Inject `DealHealthAiService`
- Add `GET /:quoteId/ai-summary` — roles: `SALES_REP, SALES_MANAGER, FINANCE, ADMIN`

**Verification:**
```bash
curl -s localhost:3001/api/v1/deal-health/<quotation-id>/ai-summary \
  -H 'x-dev-role: SALES_MANAGER' -H 'x-dev-user-id: <id>' | jq .data
# Returns { summary, actions[2], generatedAt } or null if no open events
```

---

### Phase 3 — Approval Explanation AI (2 hours)

New endpoint that explains *in manager-friendly language* exactly why a quote
was flagged for approval, citing specific lines and risk factors.

---

#### [NEW] [`approval-ai.service.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/ai/approval-ai.service.ts)

- Receives `ApprovalAiContext` built from `ApprovalDetail` (which `ApprovalService.detail()` already returns)
- Converts bps values to percentages inside the prompt (the audience is not technical)
- Returns `{ explanation: string[3 sentences], recommendation: string[1 sentence], generatedAt: string } | null`

#### [MODIFY] [`controllers/approvals.controller.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/controllers/approval.controller.ts)

- Inject `ApprovalAiService`
- Add `GET /:id/ai-explanation` — roles: `SALES_MANAGER, FINANCE, ADMIN` (internal only)
- Calls `approvals.detail(id)` first (reuses existing logic), maps to context, delegates

**Verification:**
```bash
curl -s localhost:3001/api/v1/approvals/<id>/ai-explanation \
  -H 'x-dev-role: SALES_MANAGER' -H 'x-dev-user-id: <id>' | jq .data.explanation
```

---

### Phase 4 — Negotiation Assistant (3 hours)

`POST /api/v1/portal/quotations/:token/ai-negotiation-hint` — customer-portal endpoint
that accepts a free-text request and returns a counter-offer that is guaranteed to stay
below the ceiling.

---

#### [NEW] [`negotiation-ai.service.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/ai/negotiation-ai.service.ts)

- Receives the customer's free-text string + `NegotiationLineContext` (product, category, current discount, ceiling)
- Builds a prompt asking for a number strictly between `currentDiscountBps` and `ceilingBps`
- **Safety clamp:** if LLM returns a value ≥ ceiling, clamps to `max(current + 50, ceiling - 100)` and sets `wasClamped: true`
- Returns `{ counterOfferDiscountBps, counterOfferRationale, alternativeSuggestion, wasClamped } | null`

#### [MODIFY] Portal controller (whichever file handles `/portal/quotations/:token`)

- Inject `NegotiationAiService`, `PortalService`, `PolicyService`
- Add `POST /:token/ai-negotiation-hint` — protected by `@PortalGuard()` (customer JWT, customerId-scoped)
- Resolves the quotation, loads the relevant line and its ceiling, calls `negotiationAi.hint()`

> [!IMPORTANT]
> The portal guard must enforce that `customerId` from the JWT matches the quotation.
> This is already the pattern for every other portal endpoint — follow it exactly.

**Verification:**
```bash
curl -s -X POST localhost:3001/api/v1/portal/quotations/<token>/ai-negotiation-hint \
  -H 'content-type: application/json' -H 'x-dev-role: CUSTOMER' \
  -d '{"requestedChange":"I want 20% off","lineProductId":"<id>"}' | jq .data

# MUST: counterOfferDiscountBps < ceiling for that line
# MUST: 403 when called with SALES_REP role
```

---

### Phase 5 — Redis Caching + Usage Logging (1 hour)

Prevents duplicate LLM calls on dashboard refresh. Extends `AIProviderService`
with structured usage logs.

---

#### [NEW] [`ai-cache.service.ts`](file:///c:/Users/Aaryan/OneDrive/Desktop/New%20folder%20(2)/DealFlow360/apps/api/src/modules/intelligence/ai/ai-cache.service.ts)

- Uses the existing Redis instance (`@InjectRedis()`) — already running via `docker-compose.yml`
- Key format: `ai:<feature>:<sha256(inputJson)[0:16]>`
- TTLs: `upsell-reasoning` 1800 s · `deal-health-summary` 300 s · `approval-explanation` 600 s · `negotiation-hint` 120 s
- `get<T>()` and `set()` never throw — cache miss on error, proceed to LLM

**Update all four AI services** to check cache before calling LLM, set after success.

**Verification:**
```bash
# Call same endpoint twice within TTL — second call must return same generatedAt
curl ... | jq .data.generatedAt   # call 1
curl ... | jq .data.generatedAt   # call 2 — same value → cache hit
```

---

## Module Wiring — Final State

```diff
// intelligence.module.ts

+ import { AIModule }             from './ai/ai.module';
+ import { UpsellAiService }      from './ai/upsell-ai.service';
+ import { DealHealthAiService }  from './ai/deal-health-ai.service';
+ import { ApprovalAiService }    from './ai/approval-ai.service';
+ import { NegotiationAiService } from './ai/negotiation-ai.service';
+ import { AiCacheService }       from './ai/ai-cache.service';

  @Module({
+   imports: [AIModule],
    controllers: [ /* unchanged */ ],
    providers: [
      /* all existing providers unchanged */
+     UpsellAiService,
+     DealHealthAiService,
+     ApprovalAiService,
+     NegotiationAiService,
+     AiCacheService,
    ],
    exports: [ /* unchanged */ ],
  })
```

---

## Verification Plan

### Automated Tests

```bash
pnpm test          # all 121 existing tests must still pass with AI_ENABLED=false
pnpm typecheck     # zero errors after each phase
pnpm lint          # no new warnings
```

### Manual Verification (per phase)

| Phase | Command | Expected |
|---|---|---|
| 0 | `pnpm --filter api start:dev` | API starts, no crash |
| 1 | `GET /quotes/:id/upsell` | `aiReasoning` field present on each item |
| 2 | `GET /deal-health/:id/ai-summary` | `{ summary, actions[2], generatedAt }` |
| 3 | `GET /approvals/:id/ai-explanation` | `{ explanation, recommendation }` |
| 4 | `POST /portal/.../ai-negotiation-hint` | `counterOfferDiscountBps < ceiling` always |
| 5 | Call any AI endpoint twice | Same `generatedAt` → cache hit |

### Non-Regression

```bash
# Confirm AI=false breaks nothing
AI_ENABLED=false pnpm test
```

---

## Time Estimate

| Phase | Est. |
|---|---|
| 0 — Foundation | 1–2 h |
| 1 — Upsell Reasoning | 2 h |
| 2 — Deal Health Summaries | 2 h |
| 3 — Approval Explanation | 2 h |
| 4 — Negotiation Assistant | 3 h |
| 5 — Caching + Logging | 1 h |
| **Total** | **~11–13 h** |

Recommended execution order: **0 → 1 → 2 → 3 → 4 → 5**.
Start with 0 + 1 to validate the provider pipeline with the lowest-risk change.

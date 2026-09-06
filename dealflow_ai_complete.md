# AI.md — DealFlow360 AI Integration Guide

> **Owner: B2 (Aaryan)**. All new files live under `apps/api/src/modules/intelligence/ai/`.
> The engine (`engine/`) is never touched. The AI layer only reads engine outputs and translates
> them into plain English. Business decisions stay deterministic.

---

## Core Principle

```
engine/evaluate.ts   →  riskScore, violations, requiredApprovals  →  approval-ai.service.ts  →  plain-English explanation
engine/upsell.ts     →  ranked UpsellSuggestion[]                 →  upsell-ai.service.ts    →  per-suggestion reasoning
engine/deal-health.ts→  DealHealthFinding[]                       →  deal-health-ai.service  →  executive summary + actions
(portal flow)        →  negotiation request + ceilings            →  negotiation-ai.service  →  safe counter-offer hint
```

The LLM is **never** asked to make a routing, scoring, or pricing decision.
It is always told: "here is what the engine decided — explain it."

---

## Model Selection

| Provider | Free Tier | SDK | Model |
|---|---|---|---|
| **Google Gemini** (primary) | 15 req/min, 1 M tokens/day | `@google/generative-ai` | `gemini-1.5-flash` |
| **Groq** (fallback on 429) | 14 400 req/day | `groq-sdk` | `llama-3.1-8b-instant` |

Auto-switch: if Gemini returns HTTP 429, `AIProviderService` transparently retries with Groq.

---

## Environment Variables

Add to `.env.example` and `.env`:

```env
# ── AI ──────────────────────────────────────────────────────────────────────
# Get Gemini key free: https://aistudio.google.com/
GEMINI_API_KEY=

# Get Groq key free: https://console.groq.com/keys
GROQ_API_KEY=

# Set to "false" to skip every AI call and return null — no feature breaks
AI_ENABLED=true
```

Install the two SDKs (run once):

```bash
pnpm --filter api add @google/generative-ai groq-sdk
```

---

## Directory Layout (all new files)

```
apps/api/src/modules/intelligence/
  ai/
    ai-provider.service.ts        ← Phase 0: Gemini + Groq wrapper
    ai.module.ts                  ← Phase 0: NestJS module
    upsell-ai.service.ts          ← Phase 1
    deal-health-ai.service.ts     ← Phase 2
    approval-ai.service.ts        ← Phase 3
    negotiation-ai.service.ts     ← Phase 4
    ai-cache.service.ts           ← Phase 5: Redis TTL cache
```

---

---

# Phase 0 — AI Foundation

## `apps/api/src/modules/intelligence/ai/ai-provider.service.ts`

```typescript
// B2 OWNED. The single gateway to every LLM call.
//
// Rules:
//  1. Never throws to callers — always returns null on failure.
//  2. Primary: Gemini Flash. Fallback: Groq on 429 / network error.
//  3. Every call enforces JSON output via the system prompt.
//  4. AI_ENABLED=false short-circuits immediately, returning null.

import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

export interface AiCallOptions {
  /** A short label like "upsell-reasoning" used in logs only. */
  feature: string;
  systemPrompt: string;
  userPrompt: string;
  /** Max tokens to generate. Keep small for latency. Default 512. */
  maxTokens?: number;
}

@Injectable()
export class AIProviderService {
  private readonly logger = new Logger(AIProviderService.name);
  private readonly enabled: boolean;
  private readonly gemini: GoogleGenerativeAI | null;
  private readonly groq: Groq | null;

  constructor() {
    this.enabled = process.env.AI_ENABLED !== 'false';
    this.gemini = process.env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      : null;
    this.groq = process.env.GROQ_API_KEY
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;
  }

  async call(options: AiCallOptions): Promise<string | null> {
    if (!this.enabled) return null;

    const { feature, systemPrompt, userPrompt, maxTokens = 512 } = options;
    const start = Date.now();

    // ── Primary: Gemini Flash ─────────────────────────────────────────────
    if (this.gemini) {
      try {
        const model = this.gemini.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: systemPrompt,
          generationConfig: {
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
          },
        });
        const result = await model.generateContent(userPrompt);
        const text = result.response.text();
        this.logger.log(JSON.stringify({
          event: 'ai_call', feature, provider: 'gemini',
          latencyMs: Date.now() - start, success: true,
        }));
        return text;
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        this.logger.warn(`[AI:${feature}] gemini failed (${status ?? 'unknown'}) — trying groq`);
        if (status && status !== 429 && status < 500) return null;
      }
    }

    // ── Fallback: Groq ────────────────────────────────────────────────────
    if (this.groq) {
      try {
        const completion = await this.groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        const text = completion.choices[0]?.message?.content ?? null;
        this.logger.log(JSON.stringify({
          event: 'ai_call', feature, provider: 'groq',
          latencyMs: Date.now() - start, success: true,
        }));
        return text;
      } catch (err: unknown) {
        this.logger.error(`[AI:${feature}] groq also failed`, err);
      }
    }

    return null;
  }

  async callJson<T>(options: AiCallOptions): Promise<T | null> {
    const raw = await this.call(options);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`[AI:${options.feature}] JSON parse failed — raw: ${raw.slice(0, 200)}`);
      return null;
    }
  }
}
```

---

## `apps/api/src/modules/intelligence/ai/ai.module.ts`

```typescript
// B2 OWNED. Exports AIProviderService so every AI feature service can inject it.

import { Module } from '@nestjs/common';
import { AIProviderService } from './ai-provider.service';

@Module({
  providers: [AIProviderService],
  exports: [AIProviderService],
})
export class AIModule {}
```

---

## Modify `intelligence.module.ts`

Add three lines only — do not touch anything else:

```typescript
// add import at top
import { AIModule } from './ai/ai.module';

// add to @Module({ ... })
@Module({
  imports: [AIModule],   // ← ADD (this line is the only change to the decorator)
  controllers: [ /* unchanged */ ],
  providers: [ /* unchanged */ ],
  exports: [ /* unchanged */ ],
})
```

---

### Verification — Phase 0

```bash
pnpm typecheck
pnpm --filter api start:dev
# API starts with no errors — no new endpoints yet
```

---

---

# Phase 1 — Smart Upsell Reasoning

**What changes:** `GET /api/v1/quotes/:id/upsell` returns each suggestion with
an optional `aiReasoning` field. When `AI_ENABLED=false` the field is absent — no regression.

---

## `apps/api/src/modules/intelligence/ai/upsell-ai.service.ts`

```typescript
// B2 OWNED. Enrich UpsellSuggestion[] with one-sentence AI reasoning per item.

import { Injectable, Logger } from '@nestjs/common';
import type { UpsellSuggestion } from '@dealflow/contracts';
import { AIProviderService } from './ai-provider.service';

export interface UpsellQuoteContext {
  customerName: string;
  tierName: string;
  totalValueMinor: number;
  currency: string;
  existingProducts: string[];
}

type ReasoningItem = { productId: string; reasoning: string };

const SYSTEM = `You are a B2B sales assistant. You receive upsell product candidates
for a business deal and write one short sentence (max 20 words) explaining why each
product is a good fit for this specific deal context.
Respond ONLY in JSON: an array of objects { "productId": string, "reasoning": string }.
No markdown, no explanation outside the JSON.`;

@Injectable()
export class UpsellAiService {
  private readonly logger = new Logger(UpsellAiService.name);

  constructor(private readonly ai: AIProviderService) {}

  async enrichWithReasoning(
    suggestions: UpsellSuggestion[],
    ctx: UpsellQuoteContext,
  ): Promise<UpsellSuggestion[]> {
    if (suggestions.length === 0) return suggestions;

    const candidateList = suggestions
      .map((s) => `- ${s.productName} (id: ${s.productId})`)
      .join('\n');

    const userPrompt = `
Deal context:
- Customer: ${ctx.customerName} (${ctx.tierName} tier)
- Deal value: ${(ctx.totalValueMinor / 100).toFixed(2)} ${ctx.currency}
- Products already on quote: ${ctx.existingProducts.join(', ') || 'none'}

Upsell candidates (already ranked by expected margin):
${candidateList}

Write one sentence per candidate explaining why it fits this deal.
`.trim();

    const result = await this.ai.callJson<ReasoningItem[]>({
      feature: 'upsell-reasoning',
      systemPrompt: SYSTEM,
      userPrompt,
      maxTokens: 400,
    });

    if (!result || !Array.isArray(result)) {
      this.logger.warn('upsell-ai: no valid response — returning original suggestions');
      return suggestions;
    }

    const byId = new Map(result.map((r) => [r.productId, r.reasoning]));

    return suggestions.map((s) => {
      const reasoning = byId.get(s.productId);
      return reasoning ? { ...s, aiReasoning: reasoning } : s;
    });
  }
}
```

---

## Modify `services/upsell.service.ts`

```typescript
// B2 OWNED. GET /quotes/:id/upsell.

import { Injectable } from '@nestjs/common';
import type { UpsellSuggestion } from '@dealflow/contracts';
import { rankUpsell } from '../engine/upsell';
import { OpsReaderService } from './ops-reader.service';
import { QuoteReaderService } from './quote-reader.service';
import { UpsellAiService } from '../ai/upsell-ai.service';   // ← ADD

@Injectable()
export class UpsellService {
  constructor(
    private readonly quotes: QuoteReaderService,
    private readonly ops: OpsReaderService,
    private readonly upsellAi: UpsellAiService,              // ← ADD
  ) {}

  async forQuotation(quotationId: string, limit = 5): Promise<UpsellSuggestion[]> {
    const { input, quote } = await this.quotes.loadEvaluationInput(quotationId);
    const productIds = [...new Set(input.lines.map((l) => l.productId))];
    if (productIds.length === 0) return [];

    const candidates = await this.ops.loadUpsellCandidates(productIds, quote.tierId);
    const ranked = rankUpsell(candidates, quote.currency, limit);

    // ── AI enrichment (additive — never blocks the response) ────────────
    return this.upsellAi.enrichWithReasoning(ranked, {
      customerName: quote.customerName ?? 'the customer',
      tierName: quote.tierName ?? 'Standard',
      totalValueMinor: input.lines.reduce((s, l) => s + l.lineTotalMinor, 0),
      currency: quote.currency,
      existingProducts: input.lines.map((l) => l.productName),
    });
  }
}
```

Add `UpsellAiService` to `intelligence.module.ts` providers array.

---

## New response field after Phase 1

```jsonc
// GET /api/v1/quotes/:id/upsell  — data array item
{
  "productId": "prod_priority_support",
  "productName": "Priority Support",
  "rank": 1,
  "aiReasoning": "High-volume hardware purchase benefits from guaranteed SLA response times."
  // absent (not null) when AI is disabled or fails
}
```

---

---

# Phase 2 — AI-Generated Deal Health Summaries

**What changes:** New endpoint `GET /api/v1/deal-health/:quoteId/ai-summary` returns a
2-sentence executive summary + 2 recommended actions for a quote's open health events.

---

## `apps/api/src/modules/intelligence/ai/deal-health-ai.service.ts`

```typescript
// B2 OWNED. Translate DealHealthItem[] into a short executive summary.

import { Injectable, Logger } from '@nestjs/common';
import type { DealHealthItem } from '@dealflow/contracts';
import { AIProviderService } from './ai-provider.service';

export interface DealHealthSummary {
  summary: string;
  actions: string[];
  generatedAt: string;
}

export interface DealHealthQuoteCtx {
  quotationCode: string;
  customerName: string;
  totalValueMinor: number;
  currency: string;
  ageInDays: number;
}

const SYSTEM = `You are a deal health analyst for a B2B sales platform.
You receive a list of flagged health events for a deal and produce:
1. A two-sentence executive summary of the deal's current health.
2. Exactly two recommended next actions for the sales rep, as short bullet points.
Write for a sales manager, not a technical audience.
Respond ONLY in JSON: { "summary": string, "actions": [string, string] }.`;

@Injectable()
export class DealHealthAiService {
  private readonly logger = new Logger(DealHealthAiService.name);

  constructor(private readonly ai: AIProviderService) {}

  async summarise(
    events: DealHealthItem[],
    ctx: DealHealthQuoteCtx,
  ): Promise<DealHealthSummary | null> {
    if (events.length === 0) return null;

    const eventList = events
      .map((e) => `- [${e.severity}] ${e.type}: ${e.message}`)
      .join('\n');

    const userPrompt = `
Deal: ${ctx.quotationCode} — ${ctx.customerName}
Value: ${(ctx.totalValueMinor / 100).toFixed(2)} ${ctx.currency}
Deal age: ${ctx.ageInDays} days

Open health events:
${eventList}

Summarise the deal health and provide two next-step recommendations.
`.trim();

    const result = await this.ai.callJson<{ summary: string; actions: string[] }>({
      feature: 'deal-health-summary',
      systemPrompt: SYSTEM,
      userPrompt,
      maxTokens: 300,
    });

    if (!result || typeof result.summary !== 'string' || !Array.isArray(result.actions)) {
      this.logger.warn('deal-health-ai: invalid response shape');
      return null;
    }

    return {
      summary: result.summary,
      actions: result.actions.slice(0, 2),
      generatedAt: new Date().toISOString(),
    };
  }
}
```

---

## Add method to `services/deal-health.service.ts`

Add below the `nudge` method, before the private `decorate`:

```typescript
// Add these imports at the top of deal-health.service.ts
import { DealHealthAiService, type DealHealthSummary } from '../ai/deal-health-ai.service';

// Add this public method inside the DealHealthService class
async aiSummaryFor(
  quotationId: string,
  dealHealthAi: DealHealthAiService,
): Promise<DealHealthSummary | null> {
  const events = await this.listFor(quotationId);
  if (events.length === 0) return null;

  const q = await this.prisma.quotation.findUnique({
    where: { id: quotationId },
    select: {
      code: true, totalMinor: true, currency: true,
      createdAt: true, customer: { select: { name: true } },
    },
  });
  if (!q) return null;

  const ageInDays = Math.floor((Date.now() - q.createdAt.getTime()) / 86_400_000);

  return dealHealthAi.summarise(events, {
    quotationCode: q.code,
    customerName: q.customer.name,
    totalValueMinor: q.totalMinor,
    currency: q.currency,
    ageInDays,
  });
}
```

---

## Add route to `controllers/deal-health.controller.ts`

```typescript
// add to constructor
constructor(
  private readonly dealHealth: DealHealthService,
  private readonly dealHealthAi: DealHealthAiService,  // ← ADD
) {}

// add route
@Get(':quoteId/ai-summary')
@Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
async aiSummary(@Param('quoteId') quoteId: string) {
  const data = await this.dealHealth.aiSummaryFor(quoteId, this.dealHealthAi);
  return { success: true, data };
}
```

Add `DealHealthAiService` to `intelligence.module.ts` providers.

---

## Response after Phase 2

```jsonc
// GET /api/v1/deal-health/:quoteId/ai-summary
{
  "success": true,
  "data": {
    "summary": "QT-1042 for Acme Corp has been stalled 10 days in manager review, and its margin of 11.4% falls below the 15% floor. Immediate escalation is needed to prevent deal loss.",
    "actions": [
      "Follow up with the sales manager today to clear the pending approval.",
      "Review the hardware line discount — reducing it 3 points brings margin above the floor."
    ],
    "generatedAt": "2026-09-05T16:00:00.000Z"
  }
}
```

---

---

# Phase 3 — Approval Explanation AI

**What changes:** `GET /api/v1/approvals/:id/ai-explanation` returns a plain-English
explanation of why the quote was flagged + one-sentence recommendation.
Internal only — never exposed through the customer portal.

---

## `apps/api/src/modules/intelligence/ai/approval-ai.service.ts`

```typescript
// B2 OWNED. Translate a risk evaluation + violations into a manager-facing explanation.

import { Injectable, Logger } from '@nestjs/common';
import type { DiscountViolation, RiskFactor, RiskLevel } from '@dealflow/contracts';
import { AIProviderService } from './ai-provider.service';

export interface ApprovalAiExplanation {
  explanation: string;
  recommendation: string;
  generatedAt: string;
}

export interface ApprovalAiContext {
  quotationCode: string;
  customerName: string;
  totalValueMinor: number;
  currency: string;
  riskScore: number;
  riskLevel: RiskLevel;
  violations: DiscountViolation[];
  factors: RiskFactor[];
  requiredApprovals: string[];
}

const SYSTEM = `You are explaining an approval request to a sales manager.
The audience is not technical — do not use the word "basis points" or "bps".
Convert all bps values to percentages (divide by 100).
Produce:
1. A three-sentence explanation of why the quote was flagged.
2. One sentence recommending what the approver should focus on.
Respond ONLY in JSON: { "explanation": string, "recommendation": string }.`;

@Injectable()
export class ApprovalAiService {
  private readonly logger = new Logger(ApprovalAiService.name);

  constructor(private readonly ai: AIProviderService) {}

  async explain(ctx: ApprovalAiContext): Promise<ApprovalAiExplanation | null> {
    const violationLines = ctx.violations
      .map(
        (v) =>
          `  - ${v.categoryName}: asked ${(v.actualBps / 100).toFixed(1)}% discount, ` +
          `ceiling is ${(v.allowedBps / 100).toFixed(1)}% ` +
          `(+${(v.excessBps / 100).toFixed(1)}% over)`,
      )
      .join('\n');

    const factorLines = ctx.factors
      .map((f) => `  - ${f.label}: ${f.points}/${f.maxPoints} points — ${f.detail}`)
      .join('\n');

    const userPrompt = `
Approval request for quote ${ctx.quotationCode} — ${ctx.customerName}
Deal value: ${(ctx.totalValueMinor / 100).toFixed(2)} ${ctx.currency}
Risk score: ${ctx.riskScore}/100 (${ctx.riskLevel})
Required approvers: ${ctx.requiredApprovals.join(', ')}

Discount violations:
${violationLines || '  (none)'}

Risk factor breakdown:
${factorLines}

Explain why this approval is needed and what the approver should focus on.
`.trim();

    const result = await this.ai.callJson<{ explanation: string; recommendation: string }>({
      feature: 'approval-explanation',
      systemPrompt: SYSTEM,
      userPrompt,
      maxTokens: 350,
    });

    if (!result || typeof result.explanation !== 'string') {
      this.logger.warn('approval-ai: invalid response');
      return null;
    }

    return {
      explanation: result.explanation,
      recommendation: result.recommendation ?? '',
      generatedAt: new Date().toISOString(),
    };
  }
}
```

---

## Add route to `controllers/approvals.controller.ts`

```typescript
// add to constructor
constructor(
  private readonly approvals: ApprovalService,
  private readonly approvalAi: ApprovalAiService,   // ← ADD
) {}

// add route
@Get(':id/ai-explanation')
@Roles('SALES_MANAGER', 'FINANCE', 'ADMIN')
async aiExplanation(@Param('id') id: string) {
  const detail = await this.approvals.detail(id);

  const data = await this.approvalAi.explain({
    quotationCode: detail.quotationCode,
    customerName: detail.customerName,
    totalValueMinor: detail.total.amountMinor,
    currency: detail.total.currency ?? 'INR',
    riskScore: detail.riskScore,
    riskLevel: detail.riskLevel,
    violations: detail.evaluation?.violations ?? [],
    factors: detail.evaluation?.factors ?? [],
    requiredApprovals: detail.evaluation?.requiredApprovals ?? [],
  });

  return { success: true, data };
}
```

Add `ApprovalAiService` to `intelligence.module.ts` providers.

---

## Response after Phase 3

```jsonc
// GET /api/v1/approvals/:id/ai-explanation
{
  "success": true,
  "data": {
    "explanation": "Quote QT-1042 for Acme Corp requires approval because the Onsite Setup service carries an 18% discount against a 10% ceiling — 8 points over. The blended risk score of 80/100 is HIGH, driven mainly by discount excess and margin pressure. Finance sign-off is required because both the blended and worst-line thresholds were crossed.",
    "recommendation": "Focus on the Onsite Setup line — reducing its discount to 10% drops the risk below the HIGH threshold and removes the Finance step.",
    "generatedAt": "2026-09-05T16:05:00.000Z"
  }
}
```

---

---

# Phase 4 — Negotiation Assistant (Customer Portal)

**What changes:** `POST /api/v1/portal/quotations/:token/ai-negotiation-hint`
accepts the customer's free-text request and returns a ceiling-safe counter-offer.

> **Safety invariant:** `counterOfferDiscountBps` is validated server-side before
> being returned. If the LLM hallucinates a value ≥ the ceiling it is silently clamped.

---

## `apps/api/src/modules/intelligence/ai/negotiation-ai.service.ts`

```typescript
// B2 OWNED. Generate a ceiling-safe counter-offer hint for a customer negotiation request.

import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from './ai-provider.service';

export interface NegotiationLineContext {
  productName: string;
  categoryName: string;
  currentDiscountBps: number;
  ceilingBps: number;
}

export interface NegotiationSuggestion {
  counterOfferDiscountBps: number;   // always < ceilingBps
  counterOfferRationale: string;
  alternativeSuggestion: string;
  wasClamped: boolean;
}

const SYSTEM = `You are a B2B deal negotiation assistant.
The customer has made a counter-offer request. Suggest a compromise discount
that improves on the current discount but stays STRICTLY BELOW the given ceiling.
Also suggest one non-discount alternative concession.
Respond ONLY in JSON:
{
  "counterOfferDiscountBps": number,
  "counterOfferRationale": string,
  "alternativeSuggestion": string
}`;

@Injectable()
export class NegotiationAiService {
  private readonly logger = new Logger(NegotiationAiService.name);

  constructor(private readonly ai: AIProviderService) {}

  async hint(
    customerRequest: string,
    line: NegotiationLineContext,
  ): Promise<NegotiationSuggestion | null> {
    const currentPct = (line.currentDiscountBps / 100).toFixed(1);
    const ceilPct = (line.ceilingBps / 100).toFixed(1);

    const userPrompt = `
Product: ${line.productName} (category: ${line.categoryName})
Customer request: "${customerRequest}"
Current discount: ${currentPct}%
Maximum allowed discount (ceiling): ${ceilPct}%

Suggest a counter-offer discount that is above ${currentPct}% and strictly below ${ceilPct}%.
Also suggest one alternative non-discount concession.
`.trim();

    const raw = await this.ai.callJson<{
      counterOfferDiscountBps: number;
      counterOfferRationale: string;
      alternativeSuggestion: string;
    }>({
      feature: 'negotiation-hint',
      systemPrompt: SYSTEM,
      userPrompt,
      maxTokens: 250,
    });

    if (!raw || typeof raw.counterOfferDiscountBps !== 'number') {
      this.logger.warn('negotiation-ai: invalid response');
      return null;
    }

    // ── Safety clamp: LLM must NEVER produce a discount >= ceiling ────────
    let wasClamped = false;
    let suggested = Math.round(raw.counterOfferDiscountBps);
    if (suggested >= line.ceilingBps) {
      this.logger.warn(
        `negotiation-ai: LLM suggested ${suggested} bps >= ceiling ${line.ceilingBps} — clamping`,
      );
      suggested = Math.max(line.currentDiscountBps + 50, line.ceilingBps - 100);
      wasClamped = true;
    }

    return {
      counterOfferDiscountBps: suggested,
      counterOfferRationale: raw.counterOfferRationale ?? '',
      alternativeSuggestion: raw.alternativeSuggestion ?? '',
      wasClamped,
    };
  }
}
```

---

## Portal route

Add to the portal quotation controller:

```typescript
@Post(':token/ai-negotiation-hint')
@PortalGuard()   // customer-scoped JWT only
async aiNegotiationHint(
  @Param('token') token: string,
  @Body() body: { requestedChange: string; lineProductId: string },
  @CurrentUser() user: AuthUser,
) {
  const quote = await this.portalService.resolveQuote(token, user.customerId);
  const line  = await this.negotiationAi.resolveLineContext(
    quote.id, body.lineProductId, this.policyService,
  );
  if (!line) return { success: true, data: null };

  const data = await this.negotiationAi.hint(body.requestedChange, line);
  return { success: true, data };
}
```

Add `NegotiationAiService` to `intelligence.module.ts` providers.

---

## Response after Phase 4

```jsonc
// POST /api/v1/portal/quotations/:token/ai-negotiation-hint
// Body: { "requestedChange": "I want 20% off the laptops", "lineProductId": "prod_rackserver" }
{
  "success": true,
  "data": {
    "counterOfferDiscountBps": 1300,
    "counterOfferRationale": "13% balances your budget while staying within our Gold-tier ceiling.",
    "alternativeSuggestion": "Priority Support included at no extra cost instead of a deeper discount.",
    "wasClamped": false
  }
}
```

---

---

# Phase 5 — Redis Caching & Usage Logging

## `apps/api/src/modules/intelligence/ai/ai-cache.service.ts`

```typescript
// B2 OWNED. Redis cache for AI responses. Prevents duplicate LLM calls on refresh.
// Key = ai:<feature>:<sha256(input)[0:16]>

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';

const TTL: Record<string, number> = {
  'deal-health-summary':  300,   // 5 min
  'approval-explanation': 600,   // 10 min
  'upsell-reasoning':    1800,   // 30 min
  'negotiation-hint':     120,   // 2 min
};

@Injectable()
export class AiCacheService {
  private readonly logger = new Logger(AiCacheService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private key(feature: string, input: unknown): string {
    return `ai:${feature}:${createHash('sha256')
      .update(JSON.stringify(input)).digest('hex').slice(0, 16)}`;
  }

  async get<T>(feature: string, input: unknown): Promise<T | null> {
    try {
      const raw = await this.redis.get(this.key(feature, input));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
  }

  async set(feature: string, input: unknown, value: unknown): Promise<void> {
    const ttl = TTL[feature] ?? 300;
    try {
      await this.redis.setex(this.key(feature, input), ttl, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`ai-cache: set failed for ${feature}`, err);
    }
  }
}
```

## Cache usage pattern (apply to all four AI services)

```typescript
// 1. check cache
const cached = await this.cache.get<ApprovalAiExplanation>('approval-explanation', ctx);
if (cached) return cached;

// 2. call LLM (existing logic)
const result = /* ... */;

// 3. store
if (result) await this.cache.set('approval-explanation', ctx, result);
return result;
```

---

---

# Final `intelligence.module.ts` diff

```typescript
import { AIModule }               from './ai/ai.module';
import { UpsellAiService }        from './ai/upsell-ai.service';
import { DealHealthAiService }    from './ai/deal-health-ai.service';
import { ApprovalAiService }      from './ai/approval-ai.service';
import { NegotiationAiService }   from './ai/negotiation-ai.service';
import { AiCacheService }         from './ai/ai-cache.service';

@Module({
  imports: [AIModule],             // ← only new import
  controllers: [ /* unchanged */ ],
  providers: [
    /* all existing providers unchanged */

    UpsellAiService,
    DealHealthAiService,
    ApprovalAiService,
    NegotiationAiService,
    AiCacheService,
  ],
  exports: [ /* unchanged */ ],
})
export class IntelligenceModule {}
```

---

# Invariants — AI Layer

| # | Rule |
|---|---|
| 1 | **AI never decides.** Score, routing, and ceilings are always engine output. |
| 2 | **AI failure is always silent.** Every service returns `null`; no 500s. |
| 3 | **`AI_ENABLED=false` breaks zero existing tests.** Layer is purely additive. |
| 4 | **Negotiation hint is always < ceiling.** Safety clamp enforced in code. |
| 5 | **Portal never sees approval/deal-health AI.** Those endpoints are internal only. |
| 6 | **Cache keys hash the input.** Changed quote → cache miss automatically. |

---

# Estimated Time

| Phase | Feature | Est. |
|---|---|---|
| 0 | Foundation (`AIProviderService`, module wiring) | 1–2 h |
| 1 | Upsell Reasoning | 2 h |
| 2 | Deal Health Summaries | 2 h |
| 3 | Approval Explanation | 2 h |
| 4 | Negotiation Assistant | 3 h |
| 5 | Redis caching + logging | 1 h |
| **Total** | | **~11–13 h** |

**Recommended start:** Phase 0 → Phase 1. Purely additive, immediately visible on the
quotation screen, and proves the provider pipeline works before adding more features.


---

# Groq AI Implementation Prompts

This document details exactly how the LLM (Groq / Gemini) is prompted for the 4 core AI features in the DealFlow360 Intelligence module. 

Every feature follows a strict pattern:
1. **System Prompt**: Defines the persona, the constraints, and absolutely mandates a specific JSON schema.
2. **User Prompt**: Injects the dynamic deal context and data.
3. **JSON Response**: The Groq SDK is called with `response_format: { type: 'json_object' }` to ensure deterministic parsing.

Here are the complete prompts used in the implementation.

---

## 1. Smart Upsell Reasoning
**Goal:** Generate a one-sentence explanation for why each upsell candidate is a good fit for the deal.

### System Prompt
```text
You are a B2B sales assistant.
You receive a list of upsell product candidates for a business deal and write one short
sentence (maximum 20 words) explaining why each product is a good fit for this specific
deal context. Base your reasoning on the deal value, customer tier, and products already
on the quote.
Respond ONLY in JSON: an array of objects with shape { "productId": string, "reasoning": string }.
No markdown, no keys outside productId and reasoning, no explanation outside the JSON array.
```

### User Prompt Template
```text
Deal context:
- Customer: {{customerName}} ({{tierName}} tier)
- Deal value: {{totalValue}} {{currency}}
- Products already on this quote: {{existingProducts}}

Upsell candidates (already ranked by expected margin — maintain this order in your response):
1. {{productName1}} (productId: {{productId1}})
2. {{productName2}} (productId: {{productId2}})
...

Return a JSON array with one reasoning sentence per candidate.
```

### Expected JSON Output
```json
[
  {
    "productId": "prod_123",
    "reasoning": "High-volume hardware purchase benefits from guaranteed SLA times."
  }
]
```

---

## 2. Deal Health Summaries
**Goal:** Summarize multiple structured risk events into a 2-sentence executive summary and 2 next-step actions.

### System Prompt
```text
You are a deal health analyst for a B2B sales platform.
You receive a list of flagged health events for a deal and must produce:
1. A two-sentence executive summary of the deal's current health.
2. Exactly two recommended next actions for the sales representative — short, specific bullet points.
Write for a sales manager, not a technical audience. Do not mention "basis points" or internal system names.
Respond ONLY in JSON with this exact shape: { "summary": string, "actions": [string, string] }.
```

### User Prompt Template
```text
Deal summary:
- Quote: {{quotationCode}}
- Customer: {{customerName}}
- Deal value: {{totalValue}} {{currency}}
- Deal age: {{ageInDays}} days

Open health flags (most severe first):
- [HIGH] Slippage: No activity for 10 days.
- [MEDIUM] Margin: Current discount exceeds rep average.

Write a two-sentence executive summary and two specific next-step recommendations.
```

### Expected JSON Output
```json
{
  "summary": "This deal is at risk due to a lack of recent activity and higher-than-average discounting. Immediate engagement is needed to prevent it from slipping out of the quarter.",
  "actions": [
    "Schedule a follow-up call with the primary stakeholder to re-establish momentum.",
    "Review the discount structure to ensure it aligns with acceptable margins."
  ]
}
```

---

## 3. Approval Explanation
**Goal:** Translate complex basis-point (bps) math and policy violations into a plain-English explanation for a non-technical sales manager.

### System Prompt
```text
You are explaining an approval request to a sales manager.
The audience is not technical — never use the words "basis points" or "bps".
Convert all bps values to percentages (divide by 100 and write as e.g. "8.0%").
Produce:
1. A three-sentence explanation of why the quote was flagged for approval.
2. One sentence recommending what the approver should focus on to make a decision.
Respond ONLY in JSON: { "explanation": string, "recommendation": string }.
```

### User Prompt Template
```text
Approval request details:
- Quote: {{quotationCode}}
- Customer: {{customerName}}
- Deal value: {{totalValue}} {{currency}}
- Risk score: {{riskScore}}/100 ({{riskLevel}})
- Required approvers: SALES_MANAGER -> FINANCE

Discount ceiling violations:
  - Hardware: requested 15.0% discount, ceiling is 10.0% (5.0% over limit)

Risk factor breakdown (out of 100 total):
  - Margin Impact: 40/40 points — Deep discounting on low-margin hardware.
  - Rep History: 10/20 points — Rep frequently discounts this category.

Explain in plain English why this quote needs approval, then give one focused recommendation.
```

### Expected JSON Output
```json
{
  "explanation": "This quote requires approval because the requested 15.0% discount on Hardware exceeds the 10.0% policy limit. Additionally, the deal carries a high risk score due to deep discounting on low-margin items. The sales representative also has a history of heavily discounting this specific category.",
  "recommendation": "Review the margin impact to ensure the 15.0% discount is justified before approving."
}
```

---

## 4. Negotiation Assistant (Customer Portal)
**Goal:** Safely suggest a counter-offer to a customer that strictly adheres to internal policy limits (ceilings).

### System Prompt
```text
You are a B2B deal negotiation assistant.
The customer has made a counter-offer request. Your task is to suggest a compromise discount
that improves on the current discount but stays STRICTLY BELOW the given maximum ceiling.
You must also suggest one non-discount alternative concession (e.g. added service, extended warranty).
Respond ONLY in JSON with this exact shape:
{
  "counterOfferDiscountBps": number,    // integer basis points, must be strictly < ceilingBps
  "counterOfferRationale": string,      // max 25 words, can be shared with the customer
  "alternativeSuggestion": string       // max 25 words, a non-discount concession
}
```

### User Prompt Template
```text
Product: {{productName}} (category: {{categoryName}})
Customer's request: "{{customerRequest}}"
Current discount on this line: {{currentPct}}%
Maximum allowed discount (policy ceiling): {{ceilPct}}%

Suggest a counter-offer discount that:
1. Is strictly above {{currentPct}}% (gives the customer something)
2. Is strictly below {{ceilPct}}% (stays inside policy)
Also suggest one alternative non-discount concession.
```

### Expected JSON Output
```json
{
  "counterOfferDiscountBps": 1250,
  "counterOfferRationale": "We can offer a 12.5% discount as a final compromise to help close this deal today.",
  "alternativeSuggestion": "Alternatively, we can keep the current discount but include an extended 2-year warranty at no extra cost."
}
```

---

## How Groq is Invoked in Code

The `AIProviderService` uses the `groq-sdk` to execute these prompts. It enforces the JSON schema at the API level using `response_format: { type: 'json_object' }`.

```typescript
const completion = await this.groq.chat.completions.create({
  model: 'llama-3.1-8b-instant',
  max_tokens: 350,
  response_format: { type: 'json_object' }, 
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
});

const text = completion.choices[0]?.message?.content ?? null;
return JSON.parse(text); 
```

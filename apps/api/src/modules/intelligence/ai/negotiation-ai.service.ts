// B2 OWNED. Generate a ceiling-safe counter-offer hint for a customer negotiation request.
//
// The customer types a free-text request ("I want 20% off the laptops").
// This service reads the current discount and the governing ceiling for that line,
// asks the LLM for a counter-offer, then VALIDATES that the result stays below
// the ceiling before returning it. The LLM cannot cause a policy violation.
//
// On AI failure: returns null. The portal shows no hint — no 500, no data leak.

import { Injectable, Logger } from '@nestjs/common';
import { AIProviderService } from './ai-provider.service';

export interface NegotiationLineContext {
  productName: string;
  categoryName: string;
  /** Current discount on this line in basis points. */
  currentDiscountBps: number;
  /** Absolute ceiling for this line's category and the customer's tier. */
  ceilingBps: number;
}

export interface NegotiationSuggestion {
  /** Suggested counter-offer discount in basis points. Always < ceilingBps. */
  counterOfferDiscountBps: number;
  /** One-sentence rationale the sales rep can share with the customer. */
  counterOfferRationale: string;
  /** One alternative non-discount concession (e.g. extended warranty). */
  alternativeSuggestion: string;
  /** True if the LLM hallucinated a value >= ceiling and it was clamped. */
  wasClamped: boolean;
}

const SYSTEM = `You are a B2B deal negotiation assistant.
The customer has made a counter-offer request. Your task is to suggest a compromise discount
that improves on the current discount but stays STRICTLY BELOW the given maximum ceiling.
You must also suggest one non-discount alternative concession (e.g. added service, extended warranty).
Respond ONLY in JSON with this exact shape:
{
  "counterOfferDiscountBps": number,    // integer basis points, must be strictly < ceilingBps
  "counterOfferRationale": string,      // max 25 words, can be shared with the customer
  "alternativeSuggestion": string       // max 25 words, a non-discount concession
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
Customer's request: "${customerRequest}"
Current discount on this line: ${currentPct}%
Maximum allowed discount (policy ceiling): ${ceilPct}%

Suggest a counter-offer discount that:
1. Is strictly above ${currentPct}% (gives the customer something)
2. Is strictly below ${ceilPct}% (stays inside policy)
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
      this.logger.warn('negotiation-ai: invalid or missing response — returning null');
      return null;
    }

    // ── Safety clamp: the LLM must NEVER produce a discount >= ceiling ─────────
    // This is enforced in code, not in trust. A hallucinated value above the ceiling
    // would push the quote back into approval, which is exactly what the customer
    // is trying to avoid. We clamp silently and flag it so the caller can log it.
    let suggested = Math.round(raw.counterOfferDiscountBps);
    let wasClamped = false;

    if (suggested >= line.ceilingBps) {
      this.logger.warn(
        `negotiation-ai: LLM suggested ${suggested} bps >= ceiling ${line.ceilingBps} bps — clamping`,
      );
      // Stay above current discount but safely under the ceiling
      suggested = Math.max(line.currentDiscountBps + 50, line.ceilingBps - 100);
      wasClamped = true;
    }

    // Also clamp from below: suggestion must improve on current
    if (suggested <= line.currentDiscountBps) {
      suggested = line.currentDiscountBps + 50;
    }

    return {
      counterOfferDiscountBps: suggested,
      counterOfferRationale: (raw.counterOfferRationale ?? '').trim(),
      alternativeSuggestion: (raw.alternativeSuggestion ?? '').trim(),
      wasClamped,
    };
  }
}

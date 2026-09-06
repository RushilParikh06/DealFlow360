// B2 OWNED. Enrich UpsellSuggestion[] with one-sentence AI reasoning per item.
//
// The engine's rankUpsell() already orders candidates by expected margin × attach rate.
// This service asks the LLM to explain WHY each product fits this specific deal in
// plain language the sales rep can repeat verbatim to the customer.
//
// On AI failure: returns original suggestions untouched. Never throws.

import { Injectable, Logger } from '@nestjs/common';
import type { UpsellSuggestion } from '@dealflow/contracts';
import { AIProviderService } from './ai-provider.service';

export interface UpsellQuoteContext {
  customerName: string;
  tierName: string;         // e.g. "Gold"
  totalValueMinor: number;
  currency: string;
  existingProducts: string[];
}

type ReasoningItem = { productId: string; reasoning: string };

const SYSTEM = `You are a B2B sales assistant.
You receive a list of upsell product candidates for a business deal and write one short
sentence (maximum 20 words) explaining why each product is a good fit for this specific
deal context. Base your reasoning on the deal value, customer tier, and products already
on the quote.
Respond ONLY in JSON: an array of objects with shape { "productId": string, "reasoning": string }.
No markdown, no keys outside productId and reasoning, no explanation outside the JSON array.`;

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
      .map((s, i) => `${i + 1}. ${s.productName} (productId: ${s.productId})`)
      .join('\n');

    const userPrompt = `
Deal context:
- Customer: ${ctx.customerName} (${ctx.tierName} tier)
- Deal value: ${(ctx.totalValueMinor / 100).toFixed(2)} ${ctx.currency}
- Products already on this quote: ${ctx.existingProducts.length > 0 ? ctx.existingProducts.join(', ') : 'none'}

Upsell candidates (already ranked by expected margin — maintain this order in your response):
${candidateList}

Return a JSON array with one reasoning sentence per candidate.
`.trim();

    const result = await this.ai.callJson<ReasoningItem[]>({
      feature: 'upsell-reasoning',
      systemPrompt: SYSTEM,
      userPrompt,
      maxTokens: 400,
    });

    if (!result || !Array.isArray(result)) {
      this.logger.warn('upsell-ai: no valid response — returning original suggestions unchanged');
      return suggestions;
    }

    const byId = new Map(result.map((r) => [r.productId, r.reasoning]));

    return suggestions.map((s) => {
      const reasoning = byId.get(s.productId);
      // only attach reasoning if we actually got a non-empty string
      if (reasoning && typeof reasoning === 'string' && reasoning.trim().length > 0) {
        return { ...s, aiReasoning: reasoning.trim() } as UpsellSuggestion & { aiReasoning: string };
      }
      return s;
    });
  }
}

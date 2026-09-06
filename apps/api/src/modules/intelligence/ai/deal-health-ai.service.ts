// B2 OWNED. Convert open DealHealthItem[] into a short executive summary.
//
// The engine already writes precise, structured event messages (e.g. "No activity
// for 10 days while sitting in PENDING_MANAGER"). This service asks the LLM to
// stitch those into one human-readable paragraph + two recommended next steps.
//
// On AI failure: returns null. The controller returns { data: null } — no 500.

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
You receive a list of flagged health events for a deal and must produce:
1. A two-sentence executive summary of the deal's current health.
2. Exactly two recommended next actions for the sales representative — short, specific bullet points.
Write for a sales manager, not a technical audience. Do not mention "basis points" or internal system names.
Respond ONLY in JSON with this exact shape: { "summary": string, "actions": [string, string] }.`;

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
Deal summary:
- Quote: ${ctx.quotationCode}
- Customer: ${ctx.customerName}
- Deal value: ${(ctx.totalValueMinor / 100).toFixed(2)} ${ctx.currency}
- Deal age: ${ctx.ageInDays} day${ctx.ageInDays === 1 ? '' : 's'}

Open health flags (most severe first):
${eventList}

Write a two-sentence executive summary and two specific next-step recommendations.
`.trim();

    const result = await this.ai.callJson<{ summary: string; actions: string[] }>({
      feature: 'deal-health-summary',
      systemPrompt: SYSTEM,
      userPrompt,
      maxTokens: 300,
    });

    if (!result || typeof result.summary !== 'string' || !Array.isArray(result.actions)) {
      this.logger.warn('deal-health-ai: invalid response shape — returning null');
      return null;
    }

    return {
      summary: result.summary,
      actions: result.actions.slice(0, 2),
      generatedAt: new Date().toISOString(),
    };
  }
}

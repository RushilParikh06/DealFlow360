// B2 OWNED. Translate a risk evaluation + violations into a manager-facing explanation.
//
// Approvers on screen 6 already see the raw violation table and factor bar chart.
// This adds a plain-English paragraph so they understand the "so what" without
// having to decode basis-point arithmetic.
//
// Never exposed through the customer portal — internal staff only.
// On AI failure: returns null. The controller returns { data: null } — no 500.

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
The audience is not technical — never use the words "basis points" or "bps".
Convert all bps values to percentages (divide by 100 and write as e.g. "8.0%").
Produce:
1. A three-sentence explanation of why the quote was flagged for approval.
2. One sentence recommending what the approver should focus on to make a decision.
Respond ONLY in JSON: { "explanation": string, "recommendation": string }.`;

@Injectable()
export class ApprovalAiService {
  private readonly logger = new Logger(ApprovalAiService.name);

  constructor(private readonly ai: AIProviderService) {}

  async explain(ctx: ApprovalAiContext): Promise<ApprovalAiExplanation | null> {
    const violationLines =
      ctx.violations.length > 0
        ? ctx.violations
            .map(
              (v) =>
                `  - ${v.categoryName}: requested ${(v.actualBps / 100).toFixed(1)}% discount, ` +
                `ceiling is ${(v.allowedBps / 100).toFixed(1)}% ` +
                `(${(v.excessBps / 100).toFixed(1)}% over limit)`,
            )
            .join('\n')
        : '  - (no ceiling violations — approval triggered by blended risk score)';

    const factorLines = ctx.factors
      .map((f) => `  - ${f.label}: ${f.points}/${f.maxPoints} points — ${f.detail}`)
      .join('\n');

    const userPrompt = `
Approval request details:
- Quote: ${ctx.quotationCode}
- Customer: ${ctx.customerName}
- Deal value: ${(ctx.totalValueMinor / 100).toFixed(2)} ${ctx.currency}
- Risk score: ${ctx.riskScore}/100 (${ctx.riskLevel})
- Required approvers: ${ctx.requiredApprovals.join(' → ')}

Discount ceiling violations:
${violationLines}

Risk factor breakdown (out of 100 total):
${factorLines}

Explain in plain English why this quote needs approval, then give one focused recommendation.
`.trim();

    const result = await this.ai.callJson<{ explanation: string; recommendation: string }>({
      feature: 'approval-explanation',
      systemPrompt: SYSTEM,
      userPrompt,
      maxTokens: 350,
    });

    if (!result || typeof result.explanation !== 'string') {
      this.logger.warn('approval-ai: invalid response shape — returning null');
      return null;
    }

    return {
      explanation: result.explanation,
      recommendation: result.recommendation ?? '',
      generatedAt: new Date().toISOString(),
    };
  }
}

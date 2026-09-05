// B2 OWNED. GET /quotes/:id/upsell.
// Step 4 of the organisers' quick test flow, so it is not optional.

import { Injectable } from '@nestjs/common';
import type { UpsellSuggestion } from '@dealflow/contracts';
import { rankUpsell } from '../engine/upsell';
import { OpsReaderService } from './ops-reader.service';
import { QuoteReaderService } from './quote-reader.service';

@Injectable()
export class UpsellService {
  constructor(
    private readonly quotes: QuoteReaderService,
    private readonly ops: OpsReaderService,
  ) {}

  async forQuotation(quotationId: string, limit = 5): Promise<UpsellSuggestion[]> {
    const { input, quote } = await this.quotes.loadEvaluationInput(quotationId);
    const productIds = [...new Set(input.lines.map((l) => l.productId))];
    if (productIds.length === 0) return [];

    const candidates = await this.ops.loadUpsellCandidates(productIds, quote.tierId);
    return rankUpsell(candidates, quote.currency, limit);
  }
}

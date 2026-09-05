// B2 OWNED, but it is the seam. This file and ops-reader.service.ts are the ONLY
// two places in the intelligence module that read a table owned by B1 or B3.
//
// That is deliberate. When B1 renames a column or replaces the stub sales.prisma,
// exactly one file breaks and the engine, the services and the tests do not
// notice. If you are ever tempted to reach for prisma.quotation inside
// evaluation.service.ts, put it here instead.

import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { EngineLine, EnginePolicy, EvaluationInput } from '../engine/types';
import type { DealHealthInput } from '../engine/deal-health';

export interface QuoteContext {
  id: string;
  code: string;
  status: string;
  currency: string;
  customerId: string;
  customerName: string;
  ownerUserId: string;
  tierId: string;
  tierCode: string;
  totalMinor: number;
  lastActivityAt: Date;
}

@Injectable()
export class QuoteReaderService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active policy rows for one tier. Both the tier default and every category row. */
  async loadPolicies(tierId: string): Promise<EnginePolicy[]> {
    const rows = await this.prisma.discountPolicy.findMany({
      where: { tierId, isActive: true },
      orderBy: [{ categoryId: 'asc' }],
    });

    if (rows.length === 0) {
      throw new AppError(
        ErrorCode.POLICY_NOT_CONFIGURED,
        'No active discount policy exists for this customer tier. Run the policy seed.',
        { tierId },
      );
    }

    return rows.map((r) => ({
      id: r.id,
      tierId: r.tierId,
      categoryId: r.categoryId,
      maxDiscountBps: r.maxDiscountBps,
      requiresManagerAboveBps: r.requiresManagerAboveBps,
      requiresFinanceAboveBps: r.requiresFinanceAboveBps,
    }));
  }

  async loadEvaluationInput(
    quotationId: string,
  ): Promise<{ input: EvaluationInput; quote: QuoteContext }> {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { lines: true, customer: { include: { tier: true } } },
    });

    if (!quotation) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Quotation not found.', { quotationId });
    }

    // one query for every product on the quote, so a 40-line quote is still 3 queries
    const productIds = [...new Set(quotation.lines.map((l) => l.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });
    const byProduct = new Map(products.map((p) => [p.id, p]));

    const lines: EngineLine[] = quotation.lines.map((l) => {
      const product = byProduct.get(l.productId);
      return {
        quoteLineId: l.id,
        productId: l.productId,
        categoryId: product?.categoryId ?? null,
        categoryName: product?.category.name ?? 'Uncategorised',
        qty: l.qty,
        unitPriceMinor: l.unitPriceMinor,
        discountBps: l.discountBps,
        lineTotalMinor: l.lineTotalMinor,
        // UNIT cost. If B1 ever stores a line total here, margin silently halves,
        // so this is the assumption to re-check at the first integration gate.
        costMinor: l.costMinor,
        lineType: l.lineType,
      };
    });

    const policies = await this.loadPolicies(quotation.customer.tierId);

    return {
      input: {
        quotationId: quotation.id,
        currency: quotation.currency,
        tierId: quotation.customer.tierId,
        tierCode: quotation.customer.tier.code,
        lines,
        policies,
      },
      quote: {
        id: quotation.id,
        code: quotation.code,
        status: quotation.status,
        currency: quotation.currency,
        customerId: quotation.customerId,
        customerName: quotation.customer.name,
        ownerUserId: quotation.ownerUserId,
        tierId: quotation.customer.tierId,
        tierCode: quotation.customer.tier.code,
        totalMinor: quotation.totalMinor,
        lastActivityAt: quotation.lastActivityAt,
      },
    };
  }

  /**
   * The rep's own mean discount across their other quotes, weighted by line value.
   * Comparing a rep against themselves is the whole point of the anomaly check -
   * a rep who always discounts 20 percent is not an anomaly, they are a pattern.
   */
  async repAverageDiscountBps(ownerUserId: string, excludeQuotationId: string): Promise<number | null> {
    const rows = await this.prisma.quotationLine.findMany({
      where: {
        quotation: { ownerUserId, id: { not: excludeQuotationId } },
      },
      select: { discountBps: true, lineTotalMinor: true },
    });
    if (rows.length === 0) return null;

    const net = rows.reduce((s, r) => s + r.lineTotalMinor, 0);
    if (net === 0) return null;
    return Math.round(rows.reduce((s, r) => s + r.discountBps * r.lineTotalMinor, 0) / net);
  }

  async loadDealHealthInput(quotationId: string): Promise<DealHealthInput> {
    const { input, quote } = await this.loadEvaluationInput(quotationId);

    const netMinor = input.lines.reduce((s, l) => s + l.lineTotalMinor, 0);
    const costMinor = input.lines.reduce((s, l) => s + l.costMinor * l.qty, 0);

    return {
      quotationId,
      status: quote.status,
      lastActivityAt: quote.lastActivityAt,
      marginBps: netMinor === 0 ? 0 : Math.round(((netMinor - costMinor) * 10_000) / netMinor),
      lines: input.lines.map((l) => ({ discountBps: l.discountBps, lineTotalMinor: l.lineTotalMinor })),
      repAverageDiscountBps: await this.repAverageDiscountBps(quote.ownerUserId, quotationId),
      // B3 owns fulfillment dates. Until they land, slippage simply never fires,
      // which is better than inventing a date and demoing a fake warning.
      promisedDeliveryDate: null,
      projectedDeliveryDate: null,
    };
  }
}

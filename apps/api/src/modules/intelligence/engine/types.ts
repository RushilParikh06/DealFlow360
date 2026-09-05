// B2 OWNED. The engine's own vocabulary.
//
// Nothing in engine/ imports Prisma, Nest, or anything from the database layer.
// It takes plain objects in and returns plain objects out, which is why every
// rule in here is unit tested in milliseconds with no container running.
// services/quote-reader.service.ts is the only adapter that builds these.

import type { LineType } from '@dealflow/contracts';

export interface EngineLine {
  quoteLineId: string;
  productId: string;
  categoryId: string | null;
  categoryName: string;
  qty: number;
  unitPriceMinor: number;
  discountBps: number;
  /** Net of discount, as B1 stored it. The weighting basis for the blend. */
  lineTotalMinor: number;
  /** UNIT cost. Line cost is costMinor * qty. */
  costMinor: number;
  lineType: LineType;
}

/** One discount_policies row, already narrowed to the customer's tier. */
export interface EnginePolicy {
  id: string;
  tierId: string;
  categoryId: string | null;
  maxDiscountBps: number;
  requiresManagerAboveBps: number;
  requiresFinanceAboveBps: number;
}

export interface EvaluationInput {
  quotationId: string;
  currency: string;
  tierId: string;
  tierCode: string;
  lines: EngineLine[];
  policies: EnginePolicy[];
}

export interface LineCeiling {
  quoteLineId: string;
  productId: string;
  categoryId: string | null;
  categoryName: string;
  policyId: string;
  allowedDiscountBps: number;
  actualDiscountBps: number;
  /** max(0, actual - allowed). Zero means the line is within its ceiling. */
  overBps: number;
  lineTotalMinor: number;
}

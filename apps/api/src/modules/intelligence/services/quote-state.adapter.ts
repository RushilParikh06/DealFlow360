// ############################################################################
// TEMPORARY. THE ONE AGREED EXCEPTION TO INVARIANT 5.
//
// plan.md invariant 5: quotations.status is written only by
// quote-state.service.ts, which B1 owns and which does not exist yet.
//
// B2's entire job produces status changes, so rather than block for three hours
// this adapter implements B1's QuoteStatePort with the transition table from
// plan.md section 7 copied verbatim. It is a placeholder with a deadline.
//
// AT THE FIRST INTEGRATION CHECKPOINT AFTER B1 SHIPS quote-state.service.ts:
//   1. delete this file
//   2. in intelligence.module.ts swap the provider to B1's implementation
//   3. nothing else changes - every caller depends on QUOTE_STATE_PORT, not on this
//
// Say this out loud in chat now so B1 knows the port exists and matches their
// signature. Two people writing two transition tables is the bug this prevents.
// ############################################################################

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  QuotationStatus,
  type QuoteStatePort,
  type QuoteStateTransition,
} from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';

/** plan.md section 7, transcribed. Anything not in this table throws. */
const ALLOWED: Record<string, QuotationStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['AUTO_APPROVED', 'PENDING_MANAGER'],
  AUTO_APPROVED: ['CONFIRMED'],
  PENDING_MANAGER: ['REJECTED', 'RETURNED', 'PENDING_FINANCE', 'APPROVED'],
  PENDING_FINANCE: ['REJECTED', 'APPROVED'],
  RETURNED: ['DRAFT'],
  APPROVED: ['CONFIRMED'],
  CONFIRMED: ['FULFILLING', 'NEGOTIATING'],
  FULFILLING: ['COMPLETED'],
  NEGOTIATING: ['CONFIRMED', 'PENDING_MANAGER'],
  REJECTED: [],
  COMPLETED: [],
};

@Injectable()
export class TemporaryQuoteStateAdapter implements QuoteStatePort {
  constructor(private readonly prisma: PrismaService) {}

  async transition(
    input: QuoteStateTransition,
    tx?: unknown,
  ): Promise<{ status: QuotationStatus }> {
    const client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma;

    const current = await client.quotation.findUnique({
      where: { id: input.quotationId },
      select: { status: true },
    });
    if (!current) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Quotation not found.', { quotationId: input.quotationId });
    }

    if (current.status === input.to) return { status: input.to };

    const allowed = ALLOWED[current.status] ?? [];
    if (!allowed.includes(input.to)) {
      throw new AppError(
        ErrorCode.QUOTE_INVALID_STATE,
        `A quotation cannot move from ${current.status} to ${input.to}.`,
        { from: current.status, to: input.to, allowed },
      );
    }

    await client.quotation.update({
      where: { id: input.quotationId },
      data: { status: input.to, lastActivityAt: new Date() },
    });

    return { status: input.to };
  }
}

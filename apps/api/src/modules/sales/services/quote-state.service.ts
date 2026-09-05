// B1 owned. plan.md invariant 5: quotations.status is written only here.
// Implements QuoteStatePort so B2 (and anyone else) can drive transitions
// without importing this module or touching quotations.status directly.
//
// Swaps in for B2's TemporaryQuoteStateAdapter: bind QUOTE_STATE_PORT to this
// class in intelligence.module.ts and delete quote-state.adapter.ts.

import { Injectable, Inject } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  QuotationStatus,
  type QuoteStatePort,
  type QuoteStateTransition,
} from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';

/** plan.md section 7, the whole state machine. Anything not listed throws. */
export const ALLOWED_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
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

/** Pure check, no I/O - what audit/tests/other owners can call without a client. */
export function isTransitionAllowed(from: QuotationStatus, to: QuotationStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class QuoteStateService implements QuoteStatePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async transition(input: QuoteStateTransition, tx?: unknown): Promise<{ status: QuotationStatus }> {
    const client: Client = (tx as Prisma.TransactionClient | undefined) ?? this.prisma;

    const current = await client.quotation.findUnique({
      where: { id: input.quotationId },
      select: { status: true },
    });
    if (!current) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Quotation not found.', { quotationId: input.quotationId });
    }
    const from = current.status as QuotationStatus;

    if (from === input.to) return { status: input.to };

    if (!isTransitionAllowed(from, input.to)) {
      throw new AppError(
        ErrorCode.QUOTE_INVALID_STATE,
        `A quotation cannot move from ${from} to ${input.to}.`,
        { from, to: input.to, allowed: ALLOWED_TRANSITIONS[from] },
      );
    }

    await client.quotation.update({
      where: { id: input.quotationId },
      data: { status: input.to, lastActivityAt: new Date() },
    });

    return { status: input.to };
  }
}

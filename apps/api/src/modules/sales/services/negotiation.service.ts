// B1 owned. The customer-facing side of a quotation: the negotiation thread and
// the customer's sign-off. These are the only write paths a CUSTOMER token can
// reach (quotes.controller.ts scopes them to the owning customer), so ownership
// is enforced here rather than trusted from the caller.
//
// plan.md invariant 6: a negotiation response and a customer acceptance are both
// auditable events, so each writes its audit_logs row in the SAME transaction as
// the change. AuditService.record() takes a Prisma.TransactionClient, which is
// why every write below runs inside $transaction.
import { Injectable } from '@nestjs/common';
import { ErrorCode, QuotationStatus } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { AuditService } from '../../intelligence/services/audit.service';
import { QuoteStateService, isTransitionAllowed } from './quote-state.service';
import type { AddNoteDto } from '../dto/quote.dto';

@Injectable()
export class NegotiationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly quoteState: QuoteStateService,
  ) {}

  /**
   * Resolves the quote by id-or-code and, when the actor is a CUSTOMER, asserts
   * it is theirs. Internal roles see any quote. Returns the resolved quote so
   * callers do not look it up twice.
   */
  private async resolveOwned(idOrCode: string, actor: AuthUser) {
    const quote = await this.prisma.quotation.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    });
    if (!quote) throw new AppError(ErrorCode.NOT_FOUND, 'Quotation not found.', { id: idOrCode });
    if (actor.role === 'CUSTOMER' && quote.customerId !== actor.customerId) {
      throw new AppError(ErrorCode.FORBIDDEN, 'This quotation belongs to another customer.', { id: idOrCode });
    }
    return quote;
  }

  /** The one Negotiation row per quote, created lazily the first time anyone posts. */
  private async ensureNegotiation(quotationId: string) {
    const existing = await this.prisma.negotiation.findFirst({ where: { quotationId } });
    if (existing) return existing;
    return this.prisma.negotiation.create({ data: { quotationId, status: 'OPEN' } });
  }

  /** The thread for the quote's detail / portal page, oldest first. */
  async listNotes(idOrCode: string, actor: AuthUser) {
    const quote = await this.resolveOwned(idOrCode, actor);
    const negotiation = await this.prisma.negotiation.findFirst({ where: { quotationId: quote.id } });
    if (!negotiation) return { quotationId: quote.id, code: quote.code, messages: [] as unknown[] };
    const messages = await this.prisma.negotiationMessage.findMany({
      where: { negotiationId: negotiation.id },
      orderBy: { createdAt: 'asc' },
    });
    return { quotationId: quote.id, code: quote.code, messages };
  }

  /**
   * Post a note. A customer note on a CONFIRMED quote nudges it into
   * NEGOTIATING when the state machine allows it, so the deal desk sees the
   * quote reopen; a note that cannot legally reopen the quote is still recorded
   * (a reply on an in-flight approval, say) without touching status.
   */
  async addNote(idOrCode: string, dto: AddNoteDto, actor: AuthUser) {
    const quote = await this.resolveOwned(idOrCode, actor);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.negotiation.findFirst({ where: { quotationId: quote.id } });
      const negotiation = existing ?? (await tx.negotiation.create({ data: { quotationId: quote.id, status: 'OPEN' } }));

      const message = await tx.negotiationMessage.create({
        data: {
          negotiationId: negotiation.id,
          body: dto.body,
          requestedDiscountBps: dto.requestedDiscountBps ?? null,
        },
      });

      // A customer asking for a concession on a settled quote reopens it, but
      // only if the machine permits CONFIRMED -> NEGOTIATING. Never force it.
      const from = quote.status as QuotationStatus;
      if (
        actor.role === 'CUSTOMER' &&
        from === QuotationStatus.CONFIRMED &&
        isTransitionAllowed(from, QuotationStatus.NEGOTIATING)
      ) {
        await this.quoteState.transition({ quotationId: quote.id, to: QuotationStatus.NEGOTIATING, actorUserId: actor.id }, tx);
        await this.audit.record(tx, {
          entityType: 'QUOTATION',
          entityId: quote.id,
          action: 'NEGOTIATION_REOPENED',
          actorUserId: actor.id,
          actorRole: actor.role,
          fromValue: from,
          toValue: QuotationStatus.NEGOTIATING,
        });
      }

      await this.audit.record(tx, {
        entityType: 'QUOTATION',
        entityId: quote.id,
        action: 'NEGOTIATION_NOTE',
        actorUserId: actor.id,
        actorRole: actor.role,
        metadata: { requestedDiscountBps: dto.requestedDiscountBps ?? null },
      });

      return message;
    });
  }

  /**
   * Customer sign-off. A customer cannot drive the internal approval chain, so
   * acceptance is recorded as an auditable event and a thread message - it does
   * NOT force a status jump the state machine disallows. Settlement (confirm)
   * stays with internal roles. Honest by design: acceptance is visible, not silent.
   */
  async accept(idOrCode: string, actor: AuthUser) {
    const quote = await this.resolveOwned(idOrCode, actor);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.negotiation.findFirst({ where: { quotationId: quote.id } });
      const negotiation = existing ?? (await tx.negotiation.create({ data: { quotationId: quote.id, status: 'OPEN' } }));

      await tx.negotiationMessage.create({
        data: { negotiationId: negotiation.id, body: 'Customer accepted and signed this quotation.' },
      });

      await this.audit.record(tx, {
        entityType: 'QUOTATION',
        entityId: quote.id,
        action: 'CUSTOMER_ACCEPTED',
        actorUserId: actor.id,
        actorRole: actor.role,
        toValue: quote.status,
      });
    });

    return this.prisma.quotation.findFirst({
      where: { id: quote.id },
      include: { lines: true, customer: { include: { tier: true } } },
    });
  }
}

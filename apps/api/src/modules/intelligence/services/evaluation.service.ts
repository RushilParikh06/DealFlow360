// B2 OWNED. POST /quotes/:id/evaluate. The endpoint everything else is built on.
//
// Three responsibilities, in this order:
//   1. score the quote, by handing plain data to the pure engine
//   2. append a risk_evaluations row, unless nothing changed since the last one
//   3. if the quote is at a routing point, open or supersede the approval chain
//
// It is idempotent because F calls it on every keystroke in the builder screen.
// Same inputs, same hash, no new row, no duplicate approval request.

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, RiskEvaluation } from '@prisma/client';
import {
  QUOTE_STATE_PORT,
  type ApproverRole,
  type DiscountViolation,
  type EvaluationResponse,
  type QuoteStatePort,
  type RiskFactor,
  type RiskLevel,
} from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { evaluateQuotation, type EngineEvaluation } from '../engine/evaluate';
import type { EvaluationInput } from '../engine/types';
import { AuditService } from './audit.service';
import { QuoteReaderService, type QuoteContext } from './quote-reader.service';

/** Statuses where a fresh evaluation is allowed to move the quote. A DRAFT quote
 *  gets scored for the badge and nothing else - the rep is still typing. */
const ROUTING_STATUSES = new Set(['SUBMITTED', 'NEGOTIATING']);

@Injectable()
export class EvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: QuoteReaderService,
    private readonly audit: AuditService,
    @Inject(QUOTE_STATE_PORT) private readonly quoteState: QuoteStatePort,
  ) {}

  async evaluate(quotationId: string, actor: AuthUser): Promise<EvaluationResponse> {
    const { input, quote } = await this.reader.loadEvaluationInput(quotationId);
    const result = evaluateQuotation(input);

    const latest = await this.prisma.riskEvaluation.findFirst({
      where: { quotationId },
      orderBy: { createdAt: 'desc' },
    });

    // idempotent path: nothing about the quote or the policies changed
    if (latest && latest.inputHash === result.inputHash && !ROUTING_STATUSES.has(quote.status)) {
      return this.toResponse(latest, result, input);
    }

    return this.prisma.$transaction(async (tx) => {
      const row =
        latest && latest.inputHash === result.inputHash
          ? latest
          : await this.persist(tx, quotationId, result, input, actor);

      if (ROUTING_STATUSES.has(quote.status)) {
        await this.applyRouting(tx, quote, row, result, actor);
      }

      return this.toResponse(row, result, input);
    });
  }

  /** Newest first. The trail is append-only, so this is the negotiation history
   *  of the quote: every re-evaluation that ever happened, with the score as it
   *  stood at the time. */
  async history(quotationId: string, take = 50): Promise<EvaluationResponse[]> {
    const rows = await this.prisma.riskEvaluation.findMany({
      where: { quotationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((r) => this.fromRow(r));
  }

  async latestFor(quotationId: string): Promise<EvaluationResponse | null> {
    const row = await this.prisma.riskEvaluation.findFirst({
      where: { quotationId },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.fromRow(row) : null;
  }

  // ---------------------------------------------------------------- internals

  private async persist(
    tx: Prisma.TransactionClient,
    quotationId: string,
    result: EngineEvaluation,
    input: EvaluationInput,
    actor: AuthUser,
  ): Promise<RiskEvaluation> {
    const row = await tx.riskEvaluation.create({
      data: {
        quotationId,
        inputHash: result.inputHash,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        approvalRequired: result.approvalRequired,
        requiredApprovals: result.requiredApprovals,
        weightedExcessBps: result.blend.weightedExcessBps,
        worstLineExcessBps: result.blend.worstLineExcessBps,
        marginBps: result.blend.marginBps,
        netMinor: result.blend.netMinor,
        currency: input.currency,
        violations: result.violations as unknown as Prisma.InputJsonValue,
        factors: result.factors as unknown as Prisma.InputJsonValue,
        evaluatedByUserId: actor.id,
      },
    });

    await this.audit.record(tx, {
      entityType: 'RISK_EVALUATION',
      entityId: quotationId,
      action: 'QUOTE_EVALUATED',
      actorUserId: actor.id,
      actorRole: actor.role,
      toValue: `${result.riskLevel} ${result.riskScore}`,
      metadata: {
        weightedExcessBps: result.blend.weightedExcessBps,
        worstLineExcessBps: result.blend.worstLineExcessBps,
        marginBps: result.blend.marginBps,
        violations: result.violations.length,
        routing: result.routing.reason,
      },
    });

    return row;
  }

  /**
   * The escalation itself. This is the moment the demo is built around, so it is
   * worth reading slowly.
   *
   * Over ceiling  -> open a chain and push the quote to PENDING_MANAGER
   * Within        -> supersede any open chain, and the quote either auto approves
   *                  (from SUBMITTED) or returns to CONFIRMED (from NEGOTIATING)
   *
   * The second branch is what makes a portal counter-offer safe: the customer
   * lowers their ask, the engine re-scores, the stale approval chain is closed
   * rather than left dangling in somebody's queue.
   */
  private async applyRouting(
    tx: Prisma.TransactionClient,
    quote: QuoteContext,
    evaluation: RiskEvaluation,
    result: EngineEvaluation,
    actor: AuthUser,
  ): Promise<void> {
    const open = await tx.approvalRequest.findFirst({
      where: { quotationId: quote.id, status: 'PENDING' },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });

    if (!result.approvalRequired) {
      if (open) {
        await tx.approvalRequest.update({
          where: { id: open.id },
          data: { status: 'SUPERSEDED', closedAt: new Date() },
        });
        await this.audit.record(tx, {
          entityType: 'APPROVAL_REQUEST',
          entityId: open.id,
          action: 'APPROVAL_SUPERSEDED',
          actorUserId: actor.id,
          actorRole: actor.role,
          fromValue: 'PENDING',
          toValue: 'SUPERSEDED',
          metadata: { reason: 'Re-evaluation brought every line inside its ceiling.' },
        });
      }

      const to = quote.status === 'NEGOTIATING' ? 'CONFIRMED' : 'AUTO_APPROVED';
      await this.transition(tx, quote, to, actor, result.routing.reason);
      return;
    }

    // already pending on exactly the same chain, nothing to do
    if (open) {
      const existingChain = open.steps.map((s) => s.approverRole).join(',');
      const wantedChain = result.requiredApprovals.join(',');
      if (existingChain === wantedChain) return;

      // the chain itself changed - a counter-offer that now needs finance too.
      // Supersede rather than mutate, so the old queue entry has a paper trail.
      await tx.approvalRequest.update({
        where: { id: open.id },
        data: { status: 'SUPERSEDED', closedAt: new Date() },
      });
      await this.audit.record(tx, {
        entityType: 'APPROVAL_REQUEST',
        entityId: open.id,
        action: 'APPROVAL_SUPERSEDED',
        actorUserId: actor.id,
        actorRole: actor.role,
        fromValue: existingChain,
        toValue: wantedChain,
        metadata: { reason: 'Required approval chain changed after re-evaluation.' },
      });
    }

    const request = await tx.approvalRequest.create({
      data: {
        quotationId: quote.id,
        riskEvaluationId: evaluation.id,
        status: 'PENDING',
        currentSequence: 1,
        steps: {
          create: result.requiredApprovals.map((role: ApproverRole, i: number) => ({
            sequence: i + 1,
            approverRole: role,
            status: 'PENDING' as const,
          })),
        },
      },
    });

    await this.audit.record(tx, {
      entityType: 'APPROVAL_REQUEST',
      entityId: request.id,
      action: 'APPROVAL_REQUESTED',
      actorUserId: actor.id,
      actorRole: actor.role,
      toValue: result.requiredApprovals.join(','),
      metadata: {
        quotationId: quote.id,
        riskScore: result.riskScore,
        governingExcessBps: result.routing.governingExcessBps,
        reason: result.routing.reason,
        violations: result.violations.map((v: DiscountViolation) => ({
          quoteLineId: v.quoteLineId,
          categoryName: v.categoryName,
          allowedBps: v.allowedBps,
          actualBps: v.actualBps,
          excessBps: v.excessBps,
        })),
      },
    });

    await this.transition(tx, quote, 'PENDING_MANAGER', actor, result.routing.reason);
  }

  /** B2 never writes quotations.status directly (invariant 5). It asks the port. */
  private async transition(
    tx: Prisma.TransactionClient,
    quote: QuoteContext,
    to: 'AUTO_APPROVED' | 'PENDING_MANAGER' | 'CONFIRMED',
    actor: AuthUser,
    reason: string,
  ): Promise<void> {
    if (quote.status === to) return;

    await this.quoteState.transition({ quotationId: quote.id, to, actorUserId: actor.id, reason }, tx);
    await this.audit.record(tx, {
      entityType: 'QUOTATION',
      entityId: quote.id,
      action: 'STATUS_CHANGED',
      actorUserId: actor.id,
      actorRole: actor.role,
      fromValue: quote.status,
      toValue: to,
      metadata: { reason },
    });
  }

  private toResponse(
    row: RiskEvaluation,
    result: EngineEvaluation,
    input: EvaluationInput,
  ): EvaluationResponse {
    return {
      evaluationId: row.id,
      quotationId: row.quotationId,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      approvalRequired: result.approvalRequired,
      requiredApprovals: result.requiredApprovals,
      violations: result.violations,
      blended: {
        weightedExcessBps: result.blend.weightedExcessBps,
        worstLineExcessBps: result.blend.worstLineExcessBps,
        marginBps: result.blend.marginBps,
      },
      factors: result.factors,
      lineCeilings: result.ceilings.map((c) => ({
        quoteLineId: c.quoteLineId,
        allowedDiscountBps: c.allowedDiscountBps,
        actualDiscountBps: c.actualDiscountBps,
        overBps: c.overBps,
      })),
      net: { amountMinor: result.blend.netMinor, currency: input.currency },
      evaluatedAt: row.createdAt.toISOString(),
    };
  }

  /** Rehydrate a stored row without recomputing. Used by the history endpoint
   *  and by the approval screens, which must show the score AS IT WAS JUDGED. */
  private fromRow(row: RiskEvaluation): EvaluationResponse {
    const violations = row.violations as unknown as DiscountViolation[];
    return {
      evaluationId: row.id,
      quotationId: row.quotationId,
      riskScore: row.riskScore,
      riskLevel: row.riskLevel as RiskLevel,
      approvalRequired: row.approvalRequired,
      requiredApprovals: row.requiredApprovals as ApproverRole[],
      violations,
      blended: {
        weightedExcessBps: row.weightedExcessBps,
        worstLineExcessBps: row.worstLineExcessBps,
        marginBps: row.marginBps,
      },
      factors: row.factors as unknown as RiskFactor[],
      lineCeilings: violations.map((v) => ({
        quoteLineId: v.quoteLineId,
        allowedDiscountBps: v.allowedBps,
        actualDiscountBps: v.actualBps,
        overBps: v.excessBps,
      })),
      net: { amountMinor: row.netMinor, currency: row.currency },
      evaluatedAt: row.createdAt.toISOString(),
    };
  }
}

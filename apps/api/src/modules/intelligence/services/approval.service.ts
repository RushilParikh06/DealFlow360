// B2 OWNED. The approvals queue and the three decisions.
//
// The rule that matters: a step belongs to a role, and only that role can decide
// it. A finance user cannot skip ahead and clear the manager step, and a manager
// cannot sign finance's. That check is server side and it throws
// APPROVAL_STEP_NOT_YOURS, never a hidden button (plan.md invariant 7's spirit).

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  QUOTE_STATE_PORT,
  type ApprovalDetail,
  type ApprovalListItem,
  type ApprovalStatus,
  type ApprovalStepView,
  type ApproverRole,
  type Paginated,
  type QuotationStatus,
  type QuoteStatePort,
  type RiskLevel,
  type UserRole,
} from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { AuditService } from './audit.service';
import { EvaluationService } from './evaluation.service';

export interface ListApprovalsFilter {
  status?: ApprovalStatus;
  assignedRole?: ApproverRole;
  page?: number;
  pageSize?: number;
}

/** Which quotation status each outcome implies. Kept next to the decision it
 *  belongs to rather than buried in a switch three files away. */
const OUTCOME_STATUS: Record<'APPROVE_FINAL' | 'APPROVE_ADVANCE' | 'REJECT' | 'RETURN', QuotationStatus> = {
  APPROVE_FINAL: 'APPROVED',
  APPROVE_ADVANCE: 'PENDING_FINANCE',
  REJECT: 'REJECTED',
  RETURN: 'RETURNED',
};

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly evaluations: EvaluationService,
    @Inject(QUOTE_STATE_PORT) private readonly quoteState: QuoteStatePort,
  ) {}

  async list(filter: ListApprovalsFilter): Promise<Paginated<ApprovalListItem>> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

    // "assigned to me" means the step at the front of the queue is mine, not
    // that my role appears anywhere in the chain
    const where: Prisma.ApprovalRequestWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.assignedRole
        ? { steps: { some: { approverRole: filter.assignedRole, status: 'PENDING' } } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where,
        include: { riskEvaluation: true, steps: { orderBy: { sequence: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    const quotations = await this.quotationHeaders(rows.map((r) => r.quotationId));

    const items = rows
      .filter((r) => {
        if (!filter.assignedRole) return true;
        const current = r.steps.find((s) => s.sequence === r.currentSequence);
        return current?.approverRole === filter.assignedRole && current.status === 'PENDING';
      })
      .map((r) => {
        const header = quotations.get(r.quotationId);
        const current = r.steps.find((s) => s.sequence === r.currentSequence);
        return {
          id: r.id,
          quotationId: r.quotationId,
          quotationCode: header?.code ?? r.quotationId,
          customerName: header?.customerName ?? 'Unknown',
          status: r.status as ApprovalStatus,
          currentStep: (current?.approverRole ?? null) as ApproverRole | null,
          riskScore: r.riskEvaluation.riskScore,
          riskLevel: r.riskEvaluation.riskLevel as RiskLevel,
          total: { amountMinor: header?.totalMinor ?? 0, currency: r.riskEvaluation.currency },
          createdAt: r.createdAt.toISOString(),
        };
      });

    return { items, total, page, pageSize };
  }

  async detail(id: string): Promise<ApprovalDetail> {
    const row = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        riskEvaluation: true,
        steps: { orderBy: { sequence: 'asc' }, include: { actions: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, 'Approval request not found.', { id });

    const header = (await this.quotationHeaders([row.quotationId])).get(row.quotationId);
    const current = row.steps.find((s) => s.sequence === row.currentSequence);

    // the score AS IT WAS JUDGED, not a fresh recompute. If a rep edits the quote
    // after submitting, the reviewer must still see what they were asked to sign.
    const evaluation = (await this.evaluations.history(row.quotationId)).find(
      (e) => e.evaluationId === row.riskEvaluationId,
    );
    if (!evaluation) {
      throw new AppError(ErrorCode.NOT_FOUND, 'The evaluation behind this approval is missing.', { id });
    }

    const steps: ApprovalStepView[] = row.steps.map((s) => ({
      id: s.id,
      sequence: s.sequence,
      approverRole: s.approverRole as ApproverRole,
      status: s.status,
      decidedByUserId: s.decidedByUserId,
      decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null,
      actions: s.actions.map((a) => ({
        id: a.id,
        actionType: a.actionType,
        actorUserId: a.actorUserId,
        actorRole: a.actorRole as UserRole,
        reason: a.reason,
        createdAt: a.createdAt.toISOString(),
      })),
    }));

    return {
      id: row.id,
      quotationId: row.quotationId,
      quotationCode: header?.code ?? row.quotationId,
      customerName: header?.customerName ?? 'Unknown',
      status: row.status as ApprovalStatus,
      currentStep: (current?.approverRole ?? null) as ApproverRole | null,
      riskScore: row.riskEvaluation.riskScore,
      riskLevel: row.riskEvaluation.riskLevel as RiskLevel,
      total: { amountMinor: header?.totalMinor ?? 0, currency: row.riskEvaluation.currency },
      createdAt: row.createdAt.toISOString(),
      evaluation,
      steps,
      audit: await this.audit.trailForQuotation(row.quotationId, row.id),
    };
  }

  async act(
    id: string,
    action: 'APPROVE' | 'REJECT' | 'RETURN',
    actor: AuthUser,
    reason?: string,
  ): Promise<ApprovalDetail> {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.approvalRequest.findUnique({
        where: { id },
        include: { steps: { orderBy: { sequence: 'asc' } } },
      });
      if (!request) throw new AppError(ErrorCode.NOT_FOUND, 'Approval request not found.', { id });

      if (request.status !== 'PENDING') {
        throw new AppError(
          ErrorCode.APPROVAL_ALREADY_CLOSED,
          `This approval is already ${request.status}.`,
          { id, status: request.status },
        );
      }

      const step = request.steps.find((s) => s.sequence === request.currentSequence);
      if (!step || step.status !== 'PENDING') {
        throw new AppError(ErrorCode.APPROVAL_ALREADY_CLOSED, 'No step is waiting on a decision.', { id });
      }

      // an ADMIN may act on any step. Anyone else must own the step's role.
      const mayDecide = actor.role === 'ADMIN' || String(step.approverRole) === String(actor.role);
      if (!mayDecide) {
        throw new AppError(
          ErrorCode.APPROVAL_STEP_NOT_YOURS,
          `This step is waiting on ${step.approverRole}, not ${actor.role}.`,
          { stepId: step.id, requiredRole: step.approverRole, actorRole: actor.role },
        );
      }

      if (action !== 'APPROVE' && !reason?.trim()) {
        throw new AppError(
          ErrorCode.VALIDATION_FAILED,
          'A reason is required when rejecting or returning a quote.',
          { action },
        );
      }

      await tx.approvalAction.create({
        data: {
          approvalStepId: step.id,
          actionType: action,
          actorUserId: actor.id,
          actorRole: actor.role,
          reason: reason?.trim() ?? null,
        },
      });

      const stepStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'RETURNED';
      await tx.approvalStep.update({
        where: { id: step.id },
        data: { status: stepStatus, decidedByUserId: actor.id, decidedAt: new Date() },
      });
      await this.audit.record(tx, {
        entityType: 'APPROVAL_STEP',
        entityId: step.id,
        action: `STEP_${stepStatus}`,
        actorUserId: actor.id,
        actorRole: actor.role,
        fromValue: 'PENDING',
        toValue: stepStatus,
        metadata: { approverRole: step.approverRole, sequence: step.sequence, reason: reason ?? null },
      });

      const nextStep = request.steps.find((s) => s.sequence === request.currentSequence + 1);
      const outcome =
        action === 'REJECT'
          ? 'REJECT'
          : action === 'RETURN'
            ? 'RETURN'
            : nextStep
              ? 'APPROVE_ADVANCE'
              : 'APPROVE_FINAL';

      if (outcome === 'APPROVE_ADVANCE') {
        await tx.approvalRequest.update({
          where: { id },
          data: { currentSequence: request.currentSequence + 1 },
        });
      } else {
        const requestStatus: ApprovalStatus =
          outcome === 'APPROVE_FINAL' ? 'APPROVED' : outcome === 'REJECT' ? 'REJECTED' : 'RETURNED';

        await tx.approvalRequest.update({
          where: { id },
          data: { status: requestStatus, closedAt: new Date() },
        });
        // skip the steps nobody will ever reach, so the queue does not show a
        // finance step for a quote that was rejected by the manager
        await tx.approvalStep.updateMany({
          where: { approvalRequestId: id, status: 'PENDING' },
          data: { status: 'SKIPPED' },
        });
        await this.audit.record(tx, {
          entityType: 'APPROVAL_REQUEST',
          entityId: id,
          action: `APPROVAL_${requestStatus}`,
          actorUserId: actor.id,
          actorRole: actor.role,
          fromValue: 'PENDING',
          toValue: requestStatus,
          metadata: { reason: reason ?? null },
        });
      }

      const to = OUTCOME_STATUS[outcome];
      const before = await tx.quotation.findUnique({
        where: { id: request.quotationId },
        select: { status: true },
      });
      await this.quoteState.transition(
        { quotationId: request.quotationId, to, actorUserId: actor.id, reason },
        tx,
      );
      await this.audit.record(tx, {
        entityType: 'QUOTATION',
        entityId: request.quotationId,
        action: 'STATUS_CHANGED',
        actorUserId: actor.id,
        actorRole: actor.role,
        fromValue: before?.status ?? null,
        toValue: to,
        metadata: { approvalRequestId: id, via: `APPROVAL_${action}` },
      });
    });

    return this.detail(id);
  }

  /** Reads B1's tables, so it stays small and obvious. */
  private async quotationHeaders(
    ids: string[],
  ): Promise<Map<string, { code: string; customerName: string; totalMinor: number }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.quotation.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true, totalMinor: true, customer: { select: { name: true } } },
    });
    return new Map(
      rows.map((r) => [r.id, { code: r.code, customerName: r.customer.name, totalMinor: r.totalMinor }]),
    );
  }
}

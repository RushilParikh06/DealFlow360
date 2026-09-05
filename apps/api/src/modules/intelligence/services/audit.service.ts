// B2 OWNED. plan.md invariant 6: every state transition, approval action,
// discount override and negotiation response writes an audit_logs row in the
// SAME transaction as the change.
//
// The enforcement is the signature. record() takes a Prisma.TransactionClient,
// not the PrismaService, so a caller outside a $transaction has nothing valid to
// pass and the build fails. An invariant a compiler checks is worth ten in a doc.

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuditEntry, UserRole } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';

export interface AuditInput {
  entityType: 'QUOTATION' | 'APPROVAL_REQUEST' | 'APPROVAL_STEP' | 'RISK_EVALUATION' | 'DISCOUNT_POLICY' | 'INVENTORY_RESERVATION' | 'DEAL_HEALTH_EVENT';
  entityId: string;
  action: string;
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only callable from inside a transaction. That is the point. */
  async record(tx: Prisma.TransactionClient, input: AuditInput): Promise<void> {
    await tx.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        fromValue: input.fromValue ?? null,
        toValue: input.toValue ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Read side for GET /audit and for the trail on the approval detail screen. */
  async list(filter: { entityType?: string; entityId?: string; take?: number }): Promise<AuditEntry[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.entityId ? { entityId: filter.entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filter.take ?? 100,
    });

    return rows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      action: r.action,
      actorUserId: r.actorUserId,
      actorRole: r.actorRole,
      fromValue: r.fromValue,
      toValue: r.toValue,
      metadata: (r.metadata ?? null) as Record<string, unknown> | null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** The trail a reviewer reads on screen 6: the quote, its approval, its steps. */
  async trailForQuotation(quotationId: string, approvalRequestId?: string): Promise<AuditEntry[]> {
    const stepIds = approvalRequestId
      ? (await this.prisma.approvalStep.findMany({ where: { approvalRequestId }, select: { id: true } })).map((s) => s.id)
      : [];

    const rows = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'QUOTATION', entityId: quotationId },
          { entityType: 'RISK_EVALUATION', entityId: quotationId },
          ...(approvalRequestId ? [{ entityType: 'APPROVAL_REQUEST' as const, entityId: approvalRequestId }] : []),
          ...(stepIds.length ? [{ entityType: 'APPROVAL_STEP' as const, entityId: { in: stepIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      action: r.action,
      actorUserId: r.actorUserId,
      actorRole: r.actorRole,
      fromValue: r.fromValue,
      toValue: r.toValue,
      metadata: (r.metadata ?? null) as Record<string, unknown> | null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

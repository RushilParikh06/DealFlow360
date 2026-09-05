// B2 OWNED. The admin screen for discount ceilings.
//
// This is the demo moment for screen 15: change a ceiling here, re-evaluate the
// quote, and the routing changes with no deploy and no code edit. It only works
// because routing.ts contains no numeric literals (plan.md invariant 9).

import { Injectable } from '@nestjs/common';
import { ErrorCode, type DiscountPolicyView } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import { AuditService } from './audit.service';
import type { AuthUser } from '../../shared/current-user';

export interface UpdatePolicyInput {
  maxDiscountBps?: number;
  requiresManagerAboveBps?: number;
  requiresFinanceAboveBps?: number;
  isActive?: boolean;
}

@Injectable()
export class PolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<DiscountPolicyView[]> {
    const rows = await this.prisma.discountPolicy.findMany({ orderBy: [{ tierId: 'asc' }, { categoryId: 'asc' }] });

    const tiers = new Map((await this.prisma.customerTier.findMany()).map((t) => [t.id, t.code]));
    const categories = new Map((await this.prisma.category.findMany()).map((c) => [c.id, c.name]));

    return rows.map((r) => ({
      id: r.id,
      tierId: r.tierId,
      tierCode: tiers.get(r.tierId) ?? r.tierId,
      categoryId: r.categoryId,
      categoryName: r.categoryId ? (categories.get(r.categoryId) ?? r.categoryId) : null,
      maxDiscountBps: r.maxDiscountBps,
      requiresManagerAboveBps: r.requiresManagerAboveBps,
      requiresFinanceAboveBps: r.requiresFinanceAboveBps,
      isActive: r.isActive,
    }));
  }

  async update(id: string, patch: UpdatePolicyInput, actor: AuthUser): Promise<DiscountPolicyView> {
    const existing = await this.prisma.discountPolicy.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Discount policy not found.', { id });

    const next = {
      maxDiscountBps: patch.maxDiscountBps ?? existing.maxDiscountBps,
      requiresManagerAboveBps: patch.requiresManagerAboveBps ?? existing.requiresManagerAboveBps,
      requiresFinanceAboveBps: patch.requiresFinanceAboveBps ?? existing.requiresFinanceAboveBps,
      isActive: patch.isActive ?? existing.isActive,
    };

    // a finance threshold below the manager threshold would make the manager step
    // unreachable, which silently disables an approval level
    if (next.requiresFinanceAboveBps < next.requiresManagerAboveBps) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'The finance threshold cannot be below the manager threshold.',
        next,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.discountPolicy.update({ where: { id }, data: next });
      await this.audit.record(tx, {
        entityType: 'DISCOUNT_POLICY',
        entityId: id,
        action: 'POLICY_UPDATED',
        actorUserId: actor.id,
        actorRole: actor.role,
        fromValue: `max=${existing.maxDiscountBps} mgr=${existing.requiresManagerAboveBps} fin=${existing.requiresFinanceAboveBps}`,
        toValue: `max=${next.maxDiscountBps} mgr=${next.requiresManagerAboveBps} fin=${next.requiresFinanceAboveBps}`,
        metadata: { tierId: existing.tierId, categoryId: existing.categoryId },
      });
    });

    const view = (await this.list()).find((p) => p.id === id);
    if (!view) throw new AppError(ErrorCode.NOT_FOUND, 'Discount policy not found.', { id });
    return view;
  }
}

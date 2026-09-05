// B2 OWNED. GET /deal-health, GET /deal-health/:quotationId, POST /:id/nudge.
//
// Detection is idempotent: the unique index on (quotationId, type, dedupeKey)
// turns the sweep into an upsert, so it can run on demand from the dashboard or
// on a BullMQ schedule without piling up duplicates.

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ErrorCode, type DealHealthItem } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { detectDealHealth } from '../engine/deal-health';
import { AuditService } from './audit.service';
import { QuoteReaderService } from './quote-reader.service';

@Injectable()
export class DealHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: QuoteReaderService,
    private readonly audit: AuditService,
  ) {}

  /** Run detection across every open quote. Idempotent, so safe to call from a
   *  refresh button as well as from a scheduled job. */
  async sweep(now = new Date()): Promise<{ scanned: number; findings: number }> {
    const quotes = await this.prisma.quotation.findMany({
      where: { status: { in: ['DRAFT', 'SUBMITTED', 'PENDING_MANAGER', 'PENDING_FINANCE', 'RETURNED', 'NEGOTIATING'] } },
      select: { id: true },
    });

    let findings = 0;
    for (const q of quotes) {
      findings += (await this.detectFor(q.id, now)).length;
    }
    return { scanned: quotes.length, findings };
  }

  async detectFor(quotationId: string, now = new Date()): Promise<DealHealthItem[]> {
    const input = await this.reader.loadDealHealthInput(quotationId);
    const detected = detectDealHealth(input, now);

    for (const f of detected) {
      await this.prisma.dealHealthEvent.upsert({
        where: { quotationId_type_dedupeKey: { quotationId: f.quotationId, type: f.type, dedupeKey: f.dedupeKey } },
        create: {
          quotationId: f.quotationId,
          type: f.type,
          severity: f.severity,
          dedupeKey: f.dedupeKey,
          message: f.message,
          metadata: f.metadata as unknown as Prisma.InputJsonValue,
        },
        // message carries live numbers ("no activity for 12 days"), so refresh it
        update: {
          message: f.message,
          metadata: f.metadata as unknown as Prisma.InputJsonValue,
          resolvedAt: null,
        },
      });
    }

    // a condition that stopped being true resolves itself rather than lingering
    const stillOpen = new Set(detected.map((f) => `${f.type}:${f.dedupeKey}`));
    const existing = await this.prisma.dealHealthEvent.findMany({
      where: { quotationId, resolvedAt: null },
    });
    const stale = existing.filter((e) => !stillOpen.has(`${e.type}:${e.dedupeKey}`));
    if (stale.length > 0) {
      await this.prisma.dealHealthEvent.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { resolvedAt: now },
      });
    }

    return this.listFor(quotationId);
  }

  async list(filter: { severity?: 'INFO' | 'WARN' | 'CRITICAL'; includeResolved?: boolean }): Promise<DealHealthItem[]> {
    const rows = await this.prisma.dealHealthEvent.findMany({
      where: {
        ...(filter.severity ? { severity: filter.severity } : {}),
        ...(filter.includeResolved ? {} : { resolvedAt: null }),
      },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      take: 200,
    });
    return this.decorate(rows);
  }

  async listFor(quotationId: string): Promise<DealHealthItem[]> {
    const rows = await this.prisma.dealHealthEvent.findMany({
      where: { quotationId, resolvedAt: null },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
    });
    return this.decorate(rows);
  }

  /** POST /deal-health/:id/nudge. Records that somebody chased the deal. The
   *  outbound message itself is B3's or F's problem, not the engine's. */
  async nudge(eventId: string, actor: AuthUser): Promise<DealHealthItem> {
    const event = await this.prisma.dealHealthEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError(ErrorCode.NOT_FOUND, 'Deal health event not found.', { eventId });

    await this.prisma.$transaction(async (tx) => {
      await tx.dealHealthEvent.update({ where: { id: eventId }, data: { nudgedAt: new Date() } });
      await this.audit.record(tx, {
        entityType: 'DEAL_HEALTH_EVENT',
        entityId: eventId,
        action: 'DEAL_NUDGED',
        actorUserId: actor.id,
        actorRole: actor.role,
        metadata: { quotationId: event.quotationId, type: event.type },
      });
    });

    // Re-read rather than spreading a mutated copy: one cheap query, and the
    // response is guaranteed to be what is actually in the table.
    const refreshed = await this.prisma.dealHealthEvent.findUnique({ where: { id: eventId } });
    const [item] = await this.decorate(refreshed ? [refreshed] : []);
    if (!item) throw new AppError(ErrorCode.NOT_FOUND, 'Deal health event not found.', { eventId });
    return item;
  }

  private async decorate(
    rows: Array<{
      id: string;
      quotationId: string;
      type: string;
      severity: string;
      message: string;
      metadata: unknown;
      detectedAt: Date;
      resolvedAt: Date | null;
      nudgedAt: Date | null;
    }>,
  ): Promise<DealHealthItem[]> {
    if (rows.length === 0) return [];

    const quotes = await this.prisma.quotation.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.quotationId))] } },
      select: { id: true, code: true, customer: { select: { name: true } } },
    });
    const byId = new Map(quotes.map((q) => [q.id, q]));

    return rows.map((r) => ({
      id: r.id,
      quotationId: r.quotationId,
      quotationCode: byId.get(r.quotationId)?.code ?? r.quotationId,
      customerName: byId.get(r.quotationId)?.customer.name ?? 'Unknown',
      type: r.type as DealHealthItem['type'],
      severity: r.severity as DealHealthItem['severity'],
      message: r.message,
      metadata: (r.metadata ?? null) as Record<string, unknown> | null,
      detectedAt: r.detectedAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      nudgedAt: r.nudgedAt ? r.nudgedAt.toISOString() : null,
    }));
  }
}

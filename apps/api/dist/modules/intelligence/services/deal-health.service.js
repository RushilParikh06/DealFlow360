"use strict";
// B2 OWNED. GET /deal-health, GET /deal-health/:quotationId, POST /:id/nudge.
//
// Detection is idempotent: the unique index on (quotationId, type, dedupeKey)
// turns the sweep into an upsert, so it can run on demand from the dashboard or
// on a BullMQ schedule without piling up duplicates.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealHealthService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
const deal_health_1 = require("../engine/deal-health");
const audit_service_1 = require("./audit.service");
const quote_reader_service_1 = require("./quote-reader.service");
let DealHealthService = class DealHealthService {
    prisma;
    reader;
    audit;
    constructor(prisma, reader, audit) {
        this.prisma = prisma;
        this.reader = reader;
        this.audit = audit;
    }
    /** Run detection across every open quote. Idempotent, so safe to call from a
     *  refresh button as well as from a scheduled job. */
    async sweep(now = new Date()) {
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
    async detectFor(quotationId, now = new Date()) {
        const input = await this.reader.loadDealHealthInput(quotationId);
        const detected = (0, deal_health_1.detectDealHealth)(input, now);
        for (const f of detected) {
            await this.prisma.dealHealthEvent.upsert({
                where: { quotationId_type_dedupeKey: { quotationId: f.quotationId, type: f.type, dedupeKey: f.dedupeKey } },
                create: {
                    quotationId: f.quotationId,
                    type: f.type,
                    severity: f.severity,
                    dedupeKey: f.dedupeKey,
                    message: f.message,
                    metadata: f.metadata,
                },
                // message carries live numbers ("no activity for 12 days"), so refresh it
                update: {
                    message: f.message,
                    metadata: f.metadata,
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
    async list(filter) {
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
    async listFor(quotationId) {
        const rows = await this.prisma.dealHealthEvent.findMany({
            where: { quotationId, resolvedAt: null },
            orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
        });
        return this.decorate(rows);
    }
    /** POST /deal-health/:id/nudge. Records that somebody chased the deal. The
     *  outbound message itself is B3's or F's problem, not the engine's. */
    async nudge(eventId, actor) {
        const event = await this.prisma.dealHealthEvent.findUnique({ where: { id: eventId } });
        if (!event)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Deal health event not found.', { eventId });
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
        if (!item)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Deal health event not found.', { eventId });
        return item;
    }
    async decorate(rows) {
        if (rows.length === 0)
            return [];
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
            type: r.type,
            severity: r.severity,
            message: r.message,
            metadata: (r.metadata ?? null),
            detectedAt: r.detectedAt.toISOString(),
            resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
            nudgedAt: r.nudgedAt ? r.nudgedAt.toISOString() : null,
        }));
    }
};
exports.DealHealthService = DealHealthService;
exports.DealHealthService = DealHealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quote_reader_service_1.QuoteReaderService,
        audit_service_1.AuditService])
], DealHealthService);
//# sourceMappingURL=deal-health.service.js.map
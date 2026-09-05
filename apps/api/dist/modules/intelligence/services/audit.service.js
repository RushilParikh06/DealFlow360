"use strict";
// B2 OWNED. plan.md invariant 6: every state transition, approval action,
// discount override and negotiation response writes an audit_logs row in the
// SAME transaction as the change.
//
// The enforcement is the signature. record() takes a Prisma.TransactionClient,
// not the PrismaService, so a caller outside a $transaction has nothing valid to
// pass and the build fails. An invariant a compiler checks is worth ten in a doc.
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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
let AuditService = class AuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Only callable from inside a transaction. That is the point. */
    async record(tx, input) {
        await tx.auditLog.create({
            data: {
                entityType: input.entityType,
                entityId: input.entityId,
                action: input.action,
                actorUserId: input.actorUserId ?? null,
                actorRole: input.actorRole ?? null,
                fromValue: input.fromValue ?? null,
                toValue: input.toValue ?? null,
                metadata: (input.metadata ?? undefined),
            },
        });
    }
    /** Read side for GET /audit and for the trail on the approval detail screen. */
    async list(filter) {
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
            metadata: (r.metadata ?? null),
            createdAt: r.createdAt.toISOString(),
        }));
    }
    /** The trail a reviewer reads on screen 6: the quote, its approval, its steps. */
    async trailForQuotation(quotationId, approvalRequestId) {
        const stepIds = approvalRequestId
            ? (await this.prisma.approvalStep.findMany({ where: { approvalRequestId }, select: { id: true } })).map((s) => s.id)
            : [];
        const rows = await this.prisma.auditLog.findMany({
            where: {
                OR: [
                    { entityType: 'QUOTATION', entityId: quotationId },
                    { entityType: 'RISK_EVALUATION', entityId: quotationId },
                    ...(approvalRequestId ? [{ entityType: 'APPROVAL_REQUEST', entityId: approvalRequestId }] : []),
                    ...(stepIds.length ? [{ entityType: 'APPROVAL_STEP', entityId: { in: stepIds } }] : []),
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
            metadata: (r.metadata ?? null),
            createdAt: r.createdAt.toISOString(),
        }));
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map
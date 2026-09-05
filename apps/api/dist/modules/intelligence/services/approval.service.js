"use strict";
// B2 OWNED. The approvals queue and the three decisions.
//
// The rule that matters: a step belongs to a role, and only that role can decide
// it. A finance user cannot skip ahead and clear the manager step, and a manager
// cannot sign finance's. That check is server side and it throws
// APPROVAL_STEP_NOT_YOURS, never a hidden button (plan.md invariant 7's spirit).
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
const audit_service_1 = require("./audit.service");
const evaluation_service_1 = require("./evaluation.service");
/** Which quotation status each outcome implies. Kept next to the decision it
 *  belongs to rather than buried in a switch three files away. */
const OUTCOME_STATUS = {
    APPROVE_FINAL: 'APPROVED',
    APPROVE_ADVANCE: 'PENDING_FINANCE',
    REJECT: 'REJECTED',
    RETURN: 'RETURNED',
};
let ApprovalService = class ApprovalService {
    prisma;
    audit;
    evaluations;
    quoteState;
    constructor(prisma, audit, evaluations, quoteState) {
        this.prisma = prisma;
        this.audit = audit;
        this.evaluations = evaluations;
        this.quoteState = quoteState;
    }
    async list(filter) {
        const page = Math.max(1, filter.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
        // "assigned to me" means the step at the front of the queue is mine, not
        // that my role appears anywhere in the chain
        const where = {
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
            if (!filter.assignedRole)
                return true;
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
                status: r.status,
                currentStep: (current?.approverRole ?? null),
                riskScore: r.riskEvaluation.riskScore,
                riskLevel: r.riskEvaluation.riskLevel,
                total: { amountMinor: header?.totalMinor ?? 0, currency: r.riskEvaluation.currency },
                createdAt: r.createdAt.toISOString(),
            };
        });
        return { items, total, page, pageSize };
    }
    async detail(id) {
        const row = await this.prisma.approvalRequest.findUnique({
            where: { id },
            include: {
                riskEvaluation: true,
                steps: { orderBy: { sequence: 'asc' }, include: { actions: { orderBy: { createdAt: 'asc' } } } },
            },
        });
        if (!row)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Approval request not found.', { id });
        const header = (await this.quotationHeaders([row.quotationId])).get(row.quotationId);
        const current = row.steps.find((s) => s.sequence === row.currentSequence);
        // the score AS IT WAS JUDGED, not a fresh recompute. If a rep edits the quote
        // after submitting, the reviewer must still see what they were asked to sign.
        const evaluation = (await this.evaluations.history(row.quotationId)).find((e) => e.evaluationId === row.riskEvaluationId);
        if (!evaluation) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'The evaluation behind this approval is missing.', { id });
        }
        const steps = row.steps.map((s) => ({
            id: s.id,
            sequence: s.sequence,
            approverRole: s.approverRole,
            status: s.status,
            decidedByUserId: s.decidedByUserId,
            decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null,
            actions: s.actions.map((a) => ({
                id: a.id,
                actionType: a.actionType,
                actorUserId: a.actorUserId,
                actorRole: a.actorRole,
                reason: a.reason,
                createdAt: a.createdAt.toISOString(),
            })),
        }));
        return {
            id: row.id,
            quotationId: row.quotationId,
            quotationCode: header?.code ?? row.quotationId,
            customerName: header?.customerName ?? 'Unknown',
            status: row.status,
            currentStep: (current?.approverRole ?? null),
            riskScore: row.riskEvaluation.riskScore,
            riskLevel: row.riskEvaluation.riskLevel,
            total: { amountMinor: header?.totalMinor ?? 0, currency: row.riskEvaluation.currency },
            createdAt: row.createdAt.toISOString(),
            evaluation,
            steps,
            audit: await this.audit.trailForQuotation(row.quotationId, row.id),
        };
    }
    async act(id, action, actor, reason) {
        await this.prisma.$transaction(async (tx) => {
            const request = await tx.approvalRequest.findUnique({
                where: { id },
                include: { steps: { orderBy: { sequence: 'asc' } } },
            });
            if (!request)
                throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Approval request not found.', { id });
            if (request.status !== 'PENDING') {
                throw new app_error_1.AppError(contracts_1.ErrorCode.APPROVAL_ALREADY_CLOSED, `This approval is already ${request.status}.`, { id, status: request.status });
            }
            const step = request.steps.find((s) => s.sequence === request.currentSequence);
            if (!step || step.status !== 'PENDING') {
                throw new app_error_1.AppError(contracts_1.ErrorCode.APPROVAL_ALREADY_CLOSED, 'No step is waiting on a decision.', { id });
            }
            // an ADMIN may act on any step. Anyone else must own the step's role.
            const mayDecide = actor.role === 'ADMIN' || String(step.approverRole) === String(actor.role);
            if (!mayDecide) {
                throw new app_error_1.AppError(contracts_1.ErrorCode.APPROVAL_STEP_NOT_YOURS, `This step is waiting on ${step.approverRole}, not ${actor.role}.`, { stepId: step.id, requiredRole: step.approverRole, actorRole: actor.role });
            }
            if (action !== 'APPROVE' && !reason?.trim()) {
                throw new app_error_1.AppError(contracts_1.ErrorCode.VALIDATION_FAILED, 'A reason is required when rejecting or returning a quote.', { action });
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
            const outcome = action === 'REJECT'
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
            }
            else {
                const requestStatus = outcome === 'APPROVE_FINAL' ? 'APPROVED' : outcome === 'REJECT' ? 'REJECTED' : 'RETURNED';
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
            await this.quoteState.transition({ quotationId: request.quotationId, to, actorUserId: actor.id, reason }, tx);
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
    async quotationHeaders(ids) {
        if (ids.length === 0)
            return new Map();
        const rows = await this.prisma.quotation.findMany({
            where: { id: { in: ids } },
            select: { id: true, code: true, totalMinor: true, customer: { select: { name: true } } },
        });
        return new Map(rows.map((r) => [r.id, { code: r.code, customerName: r.customer.name, totalMinor: r.totalMinor }]));
    }
};
exports.ApprovalService = ApprovalService;
exports.ApprovalService = ApprovalService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(contracts_1.QUOTE_STATE_PORT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        evaluation_service_1.EvaluationService, Object])
], ApprovalService);
//# sourceMappingURL=approval.service.js.map
"use strict";
// B2 OWNED. POST /quotes/:id/evaluate. The endpoint everything else is built on.
//
// Three responsibilities, in this order:
//   1. score the quote, by handing plain data to the pure engine
//   2. append a risk_evaluations row, unless nothing changed since the last one
//   3. if the quote is at a routing point, open or supersede the approval chain
//
// It is idempotent because F calls it on every keystroke in the builder screen.
// Same inputs, same hash, no new row, no duplicate approval request.
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
exports.EvaluationService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const prisma_service_1 = require("../../shared/prisma.service");
const evaluate_1 = require("../engine/evaluate");
const audit_service_1 = require("./audit.service");
const quote_reader_service_1 = require("./quote-reader.service");
/** Statuses where a fresh evaluation is allowed to move the quote. A DRAFT quote
 *  gets scored for the badge and nothing else - the rep is still typing. */
const ROUTING_STATUSES = new Set(['SUBMITTED', 'NEGOTIATING']);
let EvaluationService = class EvaluationService {
    prisma;
    reader;
    audit;
    quoteState;
    constructor(prisma, reader, audit, quoteState) {
        this.prisma = prisma;
        this.reader = reader;
        this.audit = audit;
        this.quoteState = quoteState;
    }
    async evaluate(quotationId, actor) {
        const { input, quote } = await this.reader.loadEvaluationInput(quotationId);
        const result = (0, evaluate_1.evaluateQuotation)(input);
        const latest = await this.prisma.riskEvaluation.findFirst({
            where: { quotationId },
            orderBy: { createdAt: 'desc' },
        });
        // idempotent path: nothing about the quote or the policies changed
        if (latest && latest.inputHash === result.inputHash && !ROUTING_STATUSES.has(quote.status)) {
            return this.toResponse(latest, result, input);
        }
        return this.prisma.$transaction(async (tx) => {
            const row = latest && latest.inputHash === result.inputHash
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
    async history(quotationId, take = 50) {
        const rows = await this.prisma.riskEvaluation.findMany({
            where: { quotationId },
            orderBy: { createdAt: 'desc' },
            take,
        });
        return rows.map((r) => this.fromRow(r));
    }
    async latestFor(quotationId) {
        const row = await this.prisma.riskEvaluation.findFirst({
            where: { quotationId },
            orderBy: { createdAt: 'desc' },
        });
        return row ? this.fromRow(row) : null;
    }
    // ---------------------------------------------------------------- internals
    async persist(tx, quotationId, result, input, actor) {
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
                violations: result.violations,
                factors: result.factors,
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
    async applyRouting(tx, quote, evaluation, result, actor) {
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
            if (existingChain === wantedChain)
                return;
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
                    create: result.requiredApprovals.map((role, i) => ({
                        sequence: i + 1,
                        approverRole: role,
                        status: 'PENDING',
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
                violations: result.violations.map((v) => ({
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
    async transition(tx, quote, to, actor, reason) {
        if (quote.status === to)
            return;
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
    toResponse(row, result, input) {
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
    fromRow(row) {
        const violations = row.violations;
        return {
            evaluationId: row.id,
            quotationId: row.quotationId,
            riskScore: row.riskScore,
            riskLevel: row.riskLevel,
            approvalRequired: row.approvalRequired,
            requiredApprovals: row.requiredApprovals,
            violations,
            blended: {
                weightedExcessBps: row.weightedExcessBps,
                worstLineExcessBps: row.worstLineExcessBps,
                marginBps: row.marginBps,
            },
            factors: row.factors,
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
};
exports.EvaluationService = EvaluationService;
exports.EvaluationService = EvaluationService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(contracts_1.QUOTE_STATE_PORT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quote_reader_service_1.QuoteReaderService,
        audit_service_1.AuditService, Object])
], EvaluationService);
//# sourceMappingURL=evaluation.service.js.map
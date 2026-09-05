"use strict";
// B1 owned. plan.md invariant 5: quotations.status is written only here.
// Implements QuoteStatePort so B2 (and anyone else) can drive transitions
// without importing this module or touching quotations.status directly.
//
// Swaps in for B2's TemporaryQuoteStateAdapter: bind QUOTE_STATE_PORT to this
// class in intelligence.module.ts and delete quote-state.adapter.ts.
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
exports.QuoteStateService = exports.ALLOWED_TRANSITIONS = void 0;
exports.isTransitionAllowed = isTransitionAllowed;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
/** plan.md section 7, the whole state machine. Anything not listed throws. */
exports.ALLOWED_TRANSITIONS = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['AUTO_APPROVED', 'PENDING_MANAGER'],
    AUTO_APPROVED: ['CONFIRMED'],
    PENDING_MANAGER: ['REJECTED', 'RETURNED', 'PENDING_FINANCE', 'APPROVED'],
    PENDING_FINANCE: ['REJECTED', 'APPROVED'],
    RETURNED: ['DRAFT'],
    APPROVED: ['CONFIRMED'],
    CONFIRMED: ['FULFILLING', 'NEGOTIATING'],
    FULFILLING: ['COMPLETED'],
    NEGOTIATING: ['CONFIRMED', 'PENDING_MANAGER'],
    REJECTED: [],
    COMPLETED: [],
};
/** Pure check, no I/O - what audit/tests/other owners can call without a client. */
function isTransitionAllowed(from, to) {
    return from === to || exports.ALLOWED_TRANSITIONS[from].includes(to);
}
let QuoteStateService = class QuoteStateService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async transition(input, tx) {
        const client = tx ?? this.prisma;
        const current = await client.quotation.findUnique({
            where: { id: input.quotationId },
            select: { status: true },
        });
        if (!current) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Quotation not found.', { quotationId: input.quotationId });
        }
        const from = current.status;
        if (from === input.to)
            return { status: input.to };
        if (!isTransitionAllowed(from, input.to)) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.QUOTE_INVALID_STATE, `A quotation cannot move from ${from} to ${input.to}.`, { from, to: input.to, allowed: exports.ALLOWED_TRANSITIONS[from] });
        }
        await client.quotation.update({
            where: { id: input.quotationId },
            data: { status: input.to, lastActivityAt: new Date() },
        });
        return { status: input.to };
    }
};
exports.QuoteStateService = QuoteStateService;
exports.QuoteStateService = QuoteStateService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(prisma_service_1.PrismaService)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuoteStateService);
//# sourceMappingURL=quote-state.service.js.map
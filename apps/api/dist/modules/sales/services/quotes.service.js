"use strict";
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
exports.QuotesService = void 0;
// B1 owned. /quotes CRUD + lines + submit/confirm (plan.md section 8). Only
// this service writes quotation_lines/order_lines; only quote-state.service.ts
// writes quotations.status (invariant 5) - submit/confirm call through it.
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
const quote_state_service_1 = require("./quote-state.service");
const totals_service_1 = require("./totals.service");
// ponytail: sequential-by-count code generation races under concurrent writers.
// Fine for a single-process demo; swap for a DB sequence if that ever matters.
async function nextCode(prefix, count) {
    return `${prefix}-${1000 + (await count()) + 1}`;
}
let QuotesService = class QuotesService {
    prisma;
    quoteState;
    constructor(prisma, quoteState) {
        this.prisma = prisma;
        this.quoteState = quoteState;
    }
    async list(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {
            ...(query.status ? { status: query.status } : {}),
            ...(query.customerId ? { customerId: query.customerId } : {}),
            ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.quotation.findMany({
                where,
                include: { customer: { include: { tier: true } } },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { lastActivityAt: 'desc' },
            }),
            this.prisma.quotation.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }
    async get(id) {
        const quote = await this.prisma.quotation.findUnique({
            where: { id },
            include: { lines: true, customer: { include: { tier: true } } },
        });
        if (!quote)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Quotation not found.', { id });
        return quote;
    }
    async create(dto, actor) {
        const code = await nextCode('QT', () => this.prisma.quotation.count());
        return this.prisma.quotation.create({
            data: { code, customerId: dto.customerId, ownerUserId: actor.id, currency: dto.currency },
        });
    }
    /** Recomputes and persists the quotation's totals from its current lines. */
    async recomputeTotals(quotationId) {
        const lines = await this.prisma.quotationLine.findMany({ where: { quotationId } });
        const totals = (0, totals_service_1.computeQuotationTotals)(lines);
        await this.prisma.quotation.update({
            where: { id: quotationId },
            data: { ...totals, lastActivityAt: new Date() },
        });
    }
    assertEditable(status) {
        if (status !== contracts_1.QuotationStatus.DRAFT) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.QUOTE_INVALID_STATE, 'Only a DRAFT quotation can be edited.', { status });
        }
    }
    /**
     * Price, cost, description and lineType come off the product, never off the
     * request body (invariant 2). costMinor is stored as a UNIT cost because
     * that is what B2's quote-reader.service.ts multiplies by qty.
     */
    async addLine(quotationId, dto) {
        const quote = await this.get(quotationId);
        this.assertEditable(quote.status);
        const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
        if (!product)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Product not found.', { productId: dto.productId });
        if (product.currency !== quote.currency) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.VALIDATION_FAILED, 'Product is priced in another currency.', {
                productCurrency: product.currency,
                quoteCurrency: quote.currency,
            });
        }
        const discountBps = dto.discountBps ?? 0;
        const { lineTotalMinor } = (0, totals_service_1.computeLineTotals)({
            unitPriceMinor: product.listPriceMinor,
            qty: dto.qty,
            discountBps,
        });
        const line = await this.prisma.quotationLine.create({
            data: {
                quotationId,
                productId: product.id,
                description: product.name,
                qty: dto.qty,
                unitPriceMinor: product.listPriceMinor,
                discountBps,
                lineTotalMinor,
                costMinor: product.unitCostMinor,
                lineType: product.lineType,
            },
        });
        await this.recomputeTotals(quotationId);
        return line;
    }
    async updateLine(quotationId, lineId, dto) {
        const quote = await this.get(quotationId);
        this.assertEditable(quote.status);
        const existing = quote.lines.find((l) => l.id === lineId);
        if (!existing)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Quotation line not found.', { lineId });
        const merged = {
            unitPriceMinor: existing.unitPriceMinor,
            qty: dto.qty ?? existing.qty,
            discountBps: dto.discountBps ?? existing.discountBps,
        };
        const { lineTotalMinor } = (0, totals_service_1.computeLineTotals)(merged);
        const line = await this.prisma.quotationLine.update({
            where: { id: lineId },
            data: { ...dto, lineTotalMinor },
        });
        await this.recomputeTotals(quotationId);
        return line;
    }
    async deleteLine(quotationId, lineId) {
        const quote = await this.get(quotationId);
        this.assertEditable(quote.status);
        // The line must belong to THIS quote. Without the check, deleting
        // /quotes/A/lines/<a line of quote B> removes B's line and then recomputes
        // A's totals, leaving B silently priced as if the line were still there.
        if (!quote.lines.some((l) => l.id === lineId)) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Quotation line not found.', { quotationId, lineId });
        }
        await this.prisma.quotationLine.delete({ where: { id: lineId } });
        await this.recomputeTotals(quotationId);
    }
    /**
     * DRAFT -> SUBMITTED. Scoring and further routing (AUTO_APPROVED vs
     * PENDING_MANAGER) happen when the caller invokes B2's POST /evaluate right
     * after this, per plan.md's client-driven flow - this endpoint only opens
     * the gate.
     */
    async submit(quotationId, actor) {
        const quote = await this.get(quotationId);
        if (quote.lines.length === 0) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.VALIDATION_FAILED, 'Cannot submit a quotation with no lines.', { quotationId });
        }
        await this.quoteState.transition({ quotationId, to: contracts_1.QuotationStatus.SUBMITTED, actorUserId: actor.id });
        return this.get(quotationId);
    }
    /**
     * AUTO_APPROVED or APPROVED -> CONFIRMED, and copies the quote into a new
     * order (order_lines snapshot quotation_lines because the quote may still
     * change after the order exists - plan.md section 6).
     */
    async confirm(quotationId, actor) {
        const quote = await this.get(quotationId);
        if (quote.status !== contracts_1.QuotationStatus.AUTO_APPROVED && quote.status !== contracts_1.QuotationStatus.APPROVED) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.QUOTE_INVALID_STATE, 'Only an approved quotation can be confirmed.', {
                status: quote.status,
            });
        }
        return this.prisma.$transaction(async (tx) => {
            await this.quoteState.transition({ quotationId, to: contracts_1.QuotationStatus.CONFIRMED, actorUserId: actor.id }, tx);
            const code = await nextCode('ORD', () => tx.order.count());
            const order = await tx.order.create({
                data: {
                    code,
                    quotationId,
                    customerId: quote.customerId,
                    currency: quote.currency,
                    totalMinor: quote.totalMinor,
                    lines: {
                        create: quote.lines.map((l) => ({
                            productId: l.productId,
                            description: l.description,
                            qty: l.qty,
                            unitPriceMinor: l.unitPriceMinor,
                            discountBps: l.discountBps,
                            lineTotalMinor: l.lineTotalMinor,
                            costMinor: l.costMinor,
                            lineType: l.lineType,
                        })),
                    },
                },
                include: { lines: true },
            });
            return order;
        });
    }
};
exports.QuotesService = QuotesService;
exports.QuotesService = QuotesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quote_state_service_1.QuoteStateService])
], QuotesService);
//# sourceMappingURL=quotes.service.js.map
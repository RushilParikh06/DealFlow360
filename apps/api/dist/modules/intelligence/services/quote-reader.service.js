"use strict";
// B2 OWNED, but it is the seam. This file and ops-reader.service.ts are the ONLY
// two places in the intelligence module that read a table owned by B1 or B3.
//
// That is deliberate. When B1 renames a column or replaces the stub sales.prisma,
// exactly one file breaks and the engine, the services and the tests do not
// notice. If you are ever tempted to reach for prisma.quotation inside
// evaluation.service.ts, put it here instead.
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
exports.QuoteReaderService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
let QuoteReaderService = class QuoteReaderService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Active policy rows for one tier. Both the tier default and every category row. */
    async loadPolicies(tierId) {
        const rows = await this.prisma.discountPolicy.findMany({
            where: { tierId, isActive: true },
            orderBy: [{ categoryId: 'asc' }],
        });
        if (rows.length === 0) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.POLICY_NOT_CONFIGURED, 'No active discount policy exists for this customer tier. Run the policy seed.', { tierId });
        }
        return rows.map((r) => ({
            id: r.id,
            tierId: r.tierId,
            categoryId: r.categoryId,
            maxDiscountBps: r.maxDiscountBps,
            requiresManagerAboveBps: r.requiresManagerAboveBps,
            requiresFinanceAboveBps: r.requiresFinanceAboveBps,
        }));
    }
    async loadEvaluationInput(quotationId) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { lines: true, customer: { include: { tier: true } } },
        });
        if (!quotation) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Quotation not found.', { quotationId });
        }
        // one query for every product on the quote, so a 40-line quote is still 3 queries
        const productIds = [...new Set(quotation.lines.map((l) => l.productId))];
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            include: { category: true },
        });
        const byProduct = new Map(products.map((p) => [p.id, p]));
        const lines = quotation.lines.map((l) => {
            const product = byProduct.get(l.productId);
            return {
                quoteLineId: l.id,
                productId: l.productId,
                categoryId: product?.categoryId ?? null,
                categoryName: product?.category.name ?? 'Uncategorised',
                qty: l.qty,
                unitPriceMinor: l.unitPriceMinor,
                discountBps: l.discountBps,
                lineTotalMinor: l.lineTotalMinor,
                // UNIT cost. If B1 ever stores a line total here, margin silently halves,
                // so this is the assumption to re-check at the first integration gate.
                costMinor: l.costMinor,
                lineType: l.lineType,
            };
        });
        const policies = await this.loadPolicies(quotation.customer.tierId);
        return {
            input: {
                quotationId: quotation.id,
                currency: quotation.currency,
                tierId: quotation.customer.tierId,
                tierCode: quotation.customer.tier.code,
                lines,
                policies,
            },
            quote: {
                id: quotation.id,
                code: quotation.code,
                status: quotation.status,
                currency: quotation.currency,
                customerId: quotation.customerId,
                customerName: quotation.customer.name,
                ownerUserId: quotation.ownerUserId,
                tierId: quotation.customer.tierId,
                tierCode: quotation.customer.tier.code,
                totalMinor: quotation.totalMinor,
                lastActivityAt: quotation.lastActivityAt,
            },
        };
    }
    /**
     * The rep's own mean discount across their other quotes, weighted by line value.
     * Comparing a rep against themselves is the whole point of the anomaly check -
     * a rep who always discounts 20 percent is not an anomaly, they are a pattern.
     */
    async repAverageDiscountBps(ownerUserId, excludeQuotationId) {
        const rows = await this.prisma.quotationLine.findMany({
            where: {
                quotation: { ownerUserId, id: { not: excludeQuotationId } },
            },
            select: { discountBps: true, lineTotalMinor: true },
        });
        if (rows.length === 0)
            return null;
        const net = rows.reduce((s, r) => s + r.lineTotalMinor, 0);
        if (net === 0)
            return null;
        return Math.round(rows.reduce((s, r) => s + r.discountBps * r.lineTotalMinor, 0) / net);
    }
    async loadDealHealthInput(quotationId) {
        const { input, quote } = await this.loadEvaluationInput(quotationId);
        const netMinor = input.lines.reduce((s, l) => s + l.lineTotalMinor, 0);
        const costMinor = input.lines.reduce((s, l) => s + l.costMinor * l.qty, 0);
        return {
            quotationId,
            status: quote.status,
            lastActivityAt: quote.lastActivityAt,
            marginBps: netMinor === 0 ? 0 : Math.round(((netMinor - costMinor) * 10_000) / netMinor),
            lines: input.lines.map((l) => ({ discountBps: l.discountBps, lineTotalMinor: l.lineTotalMinor })),
            repAverageDiscountBps: await this.repAverageDiscountBps(quote.ownerUserId, quotationId),
            // B3 owns fulfillment dates. Until they land, slippage simply never fires,
            // which is better than inventing a date and demoing a fake warning.
            promisedDeliveryDate: null,
            projectedDeliveryDate: null,
        };
    }
};
exports.QuoteReaderService = QuoteReaderService;
exports.QuoteReaderService = QuoteReaderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuoteReaderService);
//# sourceMappingURL=quote-reader.service.js.map
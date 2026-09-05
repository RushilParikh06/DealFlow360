"use strict";
// B2 OWNED seam onto B3's tables. See the header of quote-reader.service.ts.
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
exports.OpsReaderService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
let OpsReaderService = class OpsReaderService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * available = onHand - reserved, computed here and never stored (invariant,
     * plan.md section 6). Reserved counts B2's own inventory_reservations rows,
     * not a denormalised column somebody forgot to decrement.
     */
    async loadStock(productIds) {
        const rows = await this.prisma.inventory.findMany({
            where: { productId: { in: productIds } },
            include: { warehouse: true },
        });
        const held = await this.prisma.inventoryReservation.groupBy({
            by: ['warehouseId', 'productId'],
            where: { productId: { in: productIds }, status: { in: ['RESERVED', 'ALLOCATED'] } },
            _sum: { qty: true },
        });
        const heldBy = new Map(held.map((h) => [`${h.warehouseId}:${h.productId}`, h._sum.qty ?? 0]));
        return rows.map((r) => ({
            warehouseId: r.warehouseId,
            warehouseName: r.warehouse.name,
            productId: r.productId,
            availableQty: r.onHand - (heldBy.get(`${r.warehouseId}:${r.productId}`) ?? 0),
            shipmentCostMinor: r.warehouse.shipmentCostMinor,
        }));
    }
    async loadOrderDemand(orderId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
        if (!order)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Order not found.', { orderId });
        // collapse duplicate products so one product is allocated once, not twice
        const merged = new Map();
        for (const line of order.lines) {
            merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.qty);
        }
        return {
            currency: order.currency,
            demand: [...merged.entries()].map(([productId, qty]) => ({ productId, qty })),
        };
    }
    /**
     * B3 supplies the pairs and the attach rate. B2 attaches the ceiling-safe
     * discount for the customer's tier, so every suggestion is one a rep can
     * actually give without sending their own quote back into approval.
     */
    async loadUpsellCandidates(productIdsOnQuote, tierId) {
        const relationships = await this.prisma.productRelationship.findMany({
            where: { sourceProductId: { in: productIdsOnQuote } },
        });
        if (relationships.length === 0)
            return [];
        const targetIds = [...new Set(relationships.map((r) => r.targetProductId))];
        const products = await this.prisma.product.findMany({ where: { id: { in: targetIds } } });
        const byId = new Map(products.map((p) => [p.id, p]));
        const policies = await this.prisma.discountPolicy.findMany({ where: { tierId, isActive: true } });
        const tierDefault = policies.find((p) => p.categoryId === null);
        const safeFor = (categoryId) => policies.find((p) => p.categoryId === categoryId)?.maxDiscountBps ?? tierDefault?.maxDiscountBps ?? 0;
        const onQuote = new Set(productIdsOnQuote);
        return relationships.flatMap((rel) => {
            const product = byId.get(rel.targetProductId);
            if (!product)
                return [];
            return [
                {
                    productId: product.id,
                    productName: product.name,
                    kind: rel.kind === 'CROSS_SELL' ? 'CROSS_SELL' : 'UPSELL',
                    suggestedQty: 1,
                    unitPriceMinor: product.listPriceMinor,
                    unitCostMinor: product.unitCostMinor,
                    attachRateBps: rel.attachRateBps,
                    alreadyOnQuote: onQuote.has(product.id),
                    safeDiscountBps: safeFor(product.categoryId),
                },
            ];
        });
    }
};
exports.OpsReaderService = OpsReaderService;
exports.OpsReaderService = OpsReaderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OpsReaderService);
//# sourceMappingURL=ops-reader.service.js.map
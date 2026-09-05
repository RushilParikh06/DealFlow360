"use strict";
// B2 OWNED. The allocation CHOICE. It recommends and commits nothing
// (plan.md section 8: "recommend a split, commit nothing").
//
// B3 owns the endpoint that acts on the recommendation. B2 owns the reservation
// rows, which are the only mechanism by which stock leaves the available pool.
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
exports.AllocationService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
const allocation_1 = require("../engine/allocation");
const audit_service_1 = require("./audit.service");
const ops_reader_service_1 = require("./ops-reader.service");
let AllocationService = class AllocationService {
    prisma;
    ops;
    audit;
    constructor(prisma, ops, audit) {
        this.prisma = prisma;
        this.ops = ops;
        this.audit = audit;
    }
    async recommend(orderId) {
        const { currency, demand } = await this.ops.loadOrderDemand(orderId);
        const stock = await this.ops.loadStock(demand.map((d) => d.productId));
        return (0, allocation_1.chooseAllocation)(orderId, demand, stock, currency);
    }
    /**
     * Turn a recommendation into reservation rows. Re-reads stock INSIDE the
     * transaction and re-runs the same pure function, because the recommendation
     * the user is looking at may be seconds stale and two reps confirming the last
     * unit at once is the one race that matters here.
     */
    async reserve(orderId, actor) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.inventoryReservation.count({
                where: { orderId, status: { in: ['RESERVED', 'ALLOCATED', 'SHIPPED'] } },
            });
            if (existing > 0) {
                throw new app_error_1.AppError(contracts_1.ErrorCode.INSUFFICIENT_STOCK, 'This order already holds reservations. Release them before reserving again.', { orderId, existing });
            }
            const { currency, demand } = await this.ops.loadOrderDemand(orderId);
            const stock = await this.ops.loadStock(demand.map((d) => d.productId));
            const plan = (0, allocation_1.chooseAllocation)(orderId, demand, stock, currency);
            if (plan.allocations.length === 0) {
                throw new app_error_1.AppError(contracts_1.ErrorCode.INSUFFICIENT_STOCK, 'No stock is available for this order.', {
                    orderId,
                    backorder: plan.backorder,
                });
            }
            await tx.inventoryReservation.createMany({
                data: plan.allocations.map((a) => ({
                    orderId,
                    productId: a.productId,
                    warehouseId: a.warehouseId,
                    qty: a.qty,
                    status: 'RESERVED',
                })),
            });
            await this.audit.record(tx, {
                entityType: 'INVENTORY_RESERVATION',
                entityId: orderId,
                action: 'STOCK_RESERVED',
                actorUserId: actor.id,
                actorRole: actor.role,
                toValue: `${plan.allocations.length} reservation(s) across ${plan.totalShipments} shipment(s)`,
                metadata: { allocations: plan.allocations, backorder: plan.backorder },
            });
            return plan;
        });
    }
    async release(orderId, actor) {
        return this.prisma.$transaction(async (tx) => {
            const result = await tx.inventoryReservation.updateMany({
                where: { orderId, status: { in: ['RESERVED', 'ALLOCATED'] } },
                data: { status: 'RELEASED', releasedAt: new Date() },
            });
            await this.audit.record(tx, {
                entityType: 'INVENTORY_RESERVATION',
                entityId: orderId,
                action: 'STOCK_RELEASED',
                actorUserId: actor.id,
                actorRole: actor.role,
                toValue: String(result.count),
            });
            return { released: result.count };
        });
    }
};
exports.AllocationService = AllocationService;
exports.AllocationService = AllocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ops_reader_service_1.OpsReaderService,
        audit_service_1.AuditService])
], AllocationService);
//# sourceMappingURL=allocation.service.js.map
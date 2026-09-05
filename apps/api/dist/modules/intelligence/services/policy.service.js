"use strict";
// B2 OWNED. The admin screen for discount ceilings.
//
// This is the demo moment for screen 15: change a ceiling here, re-evaluate the
// quote, and the routing changes with no deploy and no code edit. It only works
// because routing.ts contains no numeric literals (plan.md invariant 9).
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
exports.PolicyService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
const audit_service_1 = require("./audit.service");
let PolicyService = class PolicyService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list() {
        const rows = await this.prisma.discountPolicy.findMany({ orderBy: [{ tierId: 'asc' }, { categoryId: 'asc' }] });
        const tiers = new Map((await this.prisma.customerTier.findMany()).map((t) => [t.id, t.code]));
        const categories = new Map((await this.prisma.category.findMany()).map((c) => [c.id, c.name]));
        return rows.map((r) => ({
            id: r.id,
            tierId: r.tierId,
            tierCode: tiers.get(r.tierId) ?? r.tierId,
            categoryId: r.categoryId,
            categoryName: r.categoryId ? (categories.get(r.categoryId) ?? r.categoryId) : null,
            maxDiscountBps: r.maxDiscountBps,
            requiresManagerAboveBps: r.requiresManagerAboveBps,
            requiresFinanceAboveBps: r.requiresFinanceAboveBps,
            isActive: r.isActive,
        }));
    }
    async update(id, patch, actor) {
        const existing = await this.prisma.discountPolicy.findUnique({ where: { id } });
        if (!existing)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Discount policy not found.', { id });
        const next = {
            maxDiscountBps: patch.maxDiscountBps ?? existing.maxDiscountBps,
            requiresManagerAboveBps: patch.requiresManagerAboveBps ?? existing.requiresManagerAboveBps,
            requiresFinanceAboveBps: patch.requiresFinanceAboveBps ?? existing.requiresFinanceAboveBps,
            isActive: patch.isActive ?? existing.isActive,
        };
        // a finance threshold below the manager threshold would make the manager step
        // unreachable, which silently disables an approval level
        if (next.requiresFinanceAboveBps < next.requiresManagerAboveBps) {
            throw new app_error_1.AppError(contracts_1.ErrorCode.VALIDATION_FAILED, 'The finance threshold cannot be below the manager threshold.', next);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.discountPolicy.update({ where: { id }, data: next });
            await this.audit.record(tx, {
                entityType: 'DISCOUNT_POLICY',
                entityId: id,
                action: 'POLICY_UPDATED',
                actorUserId: actor.id,
                actorRole: actor.role,
                fromValue: `max=${existing.maxDiscountBps} mgr=${existing.requiresManagerAboveBps} fin=${existing.requiresFinanceAboveBps}`,
                toValue: `max=${next.maxDiscountBps} mgr=${next.requiresManagerAboveBps} fin=${next.requiresFinanceAboveBps}`,
                metadata: { tierId: existing.tierId, categoryId: existing.categoryId },
            });
        });
        const view = (await this.list()).find((p) => p.id === id);
        if (!view)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Discount policy not found.', { id });
        return view;
    }
};
exports.PolicyService = PolicyService;
exports.PolicyService = PolicyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PolicyService);
//# sourceMappingURL=policy.service.js.map
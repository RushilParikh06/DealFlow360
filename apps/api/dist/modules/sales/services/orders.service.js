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
exports.OrdersService = void 0;
// B1 owned. GET /orders, GET /orders/:id (plan.md section 8).
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
let OrdersService = class OrdersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {
            ...(query.status ? { status: query.status } : {}),
            ...(query.customerId ? { customerId: query.customerId } : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                // Order stores customerId only, but every list view shows the customer
                // by name, so read it through the quotation rather than making the
                // client fetch /customers per row.
                include: {
                    quotation: { select: { customer: { select: { name: true } } } },
                    _count: { select: { lines: true } },
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.order.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }
    async get(id) {
        const order = await this.prisma.order.findUnique({ where: { id }, include: { lines: true } });
        if (!order)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Order not found.', { id });
        return order;
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map
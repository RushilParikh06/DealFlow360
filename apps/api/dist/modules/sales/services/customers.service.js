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
exports.CustomersService = void 0;
// B1 owned. GET/POST /customers, GET/PATCH /customers/:id (plan.md section 8).
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const app_error_1 = require("../../shared/app-error");
const prisma_service_1 = require("../../shared/prisma.service");
let CustomersService = class CustomersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {
            ...(query.tierId ? { tierId: query.tierId } : {}),
            ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.customer.findMany({
                where,
                include: { tier: true },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.customer.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }
    async get(id) {
        const customer = await this.prisma.customer.findUnique({ where: { id }, include: { tier: true } });
        if (!customer)
            throw new app_error_1.AppError(contracts_1.ErrorCode.NOT_FOUND, 'Customer not found.', { id });
        return customer;
    }
    create(dto) {
        return this.prisma.customer.create({ data: dto, include: { tier: true } });
    }
    async update(id, dto) {
        await this.get(id); // 404s before Prisma throws its own error shape
        return this.prisma.customer.update({ where: { id }, data: dto, include: { tier: true } });
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomersService);
//# sourceMappingURL=customers.service.js.map
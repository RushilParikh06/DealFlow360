"use strict";
// B2 OWNED — the allocation CHOICE only.
//   GET  /api/v1/orders/:id/allocation-plan   recommend, commit nothing
//   POST /api/v1/orders/:id/reserve           write reservation rows
//   POST /api/v1/orders/:id/release           give the stock back
//
// B3 owns order confirmation, picking, shipment and invoicing. B2 owns the split
// decision and the reservation table, because reservations are what make
// "available" mean something.
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
exports.AllocationController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../shared/auth.guard");
const roles_guard_1 = require("../../shared/roles.guard");
const current_user_1 = require("../../shared/current-user");
const allocation_service_1 = require("../services/allocation.service");
let AllocationController = class AllocationController {
    allocation;
    constructor(allocation) {
        this.allocation = allocation;
    }
    plan(id) {
        return this.allocation.recommend(id);
    }
    reserve(id, actor) {
        return this.allocation.reserve(id, actor);
    }
    release(id, actor) {
        return this.allocation.release(id, actor);
    }
};
exports.AllocationController = AllocationController;
__decorate([
    (0, common_1.Get)(':id/allocation-plan'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AllocationController.prototype, "plan", null);
__decorate([
    (0, common_1.Post)(':id/reserve'),
    (0, roles_guard_1.Roles)('FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AllocationController.prototype, "reserve", null);
__decorate([
    (0, common_1.Post)(':id/release'),
    (0, roles_guard_1.Roles)('FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AllocationController.prototype, "release", null);
exports.AllocationController = AllocationController = __decorate([
    (0, common_1.Controller)('orders'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [allocation_service_1.AllocationService])
], AllocationController);
//# sourceMappingURL=allocation.controller.js.map
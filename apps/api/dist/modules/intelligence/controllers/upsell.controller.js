"use strict";
// B2 OWNED. GET /api/v1/quotes/:id/upsell
// Step 4 of the organisers' Quick Test Flow. Ships early for that reason.
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
exports.UpsellController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../shared/auth.guard");
const roles_guard_1 = require("../../shared/roles.guard");
const upsell_dto_1 = require("../dto/upsell.dto");
const upsell_service_1 = require("../services/upsell.service");
let UpsellController = class UpsellController {
    upsell;
    constructor(upsell) {
        this.upsell = upsell;
    }
    forQuote(id, query) {
        return this.upsell.forQuotation(id, query.limit);
    }
};
exports.UpsellController = UpsellController;
__decorate([
    (0, common_1.Get)(':id/upsell'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, upsell_dto_1.UpsellQueryDto]),
    __metadata("design:returntype", Promise)
], UpsellController.prototype, "forQuote", null);
exports.UpsellController = UpsellController = __decorate([
    (0, common_1.Controller)('quotes'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [upsell_service_1.UpsellService])
], UpsellController);
//# sourceMappingURL=upsell.controller.js.map
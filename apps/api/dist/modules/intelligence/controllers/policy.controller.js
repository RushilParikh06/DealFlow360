"use strict";
// B2 OWNED. Screen 15, the admin ceiling editor. ADMIN only.
//   GET   /api/v1/discount-policies
//   PATCH /api/v1/discount-policies/:id
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
exports.PolicyController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../shared/auth.guard");
const roles_guard_1 = require("../../shared/roles.guard");
const current_user_1 = require("../../shared/current-user");
const policy_dto_1 = require("../dto/policy.dto");
const policy_service_1 = require("../services/policy.service");
let PolicyController = class PolicyController {
    policies;
    constructor(policies) {
        this.policies = policies;
    }
    list() {
        return this.policies.list();
    }
    update(id, body, actor) {
        return this.policies.update(id, body, actor);
    }
};
exports.PolicyController = PolicyController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.Roles)('SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PolicyController.prototype, "list", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_guard_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, policy_dto_1.UpdatePolicyDto, Object]),
    __metadata("design:returntype", Promise)
], PolicyController.prototype, "update", null);
exports.PolicyController = PolicyController = __decorate([
    (0, common_1.Controller)('discount-policies'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [policy_service_1.PolicyService])
], PolicyController);
//# sourceMappingURL=policy.controller.js.map
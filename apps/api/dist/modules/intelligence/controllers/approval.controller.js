"use strict";
// B2 OWNED.
//   GET   /api/v1/approvals            my queue
//   GET   /api/v1/approvals/:id        detail + the evaluation AS IT WAS JUDGED
//   PATCH /api/v1/approvals/:id        approve / reject / return
//
// The queue is role-scoped in the service, not here: a SALES_MANAGER sees steps
// where the front of the queue is a manager step, FINANCE sees finance steps,
// ADMIN sees everything. Doing it in the service keeps it testable.
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
exports.ApprovalController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../shared/auth.guard");
const roles_guard_1 = require("../../shared/roles.guard");
const current_user_1 = require("../../shared/current-user");
const approval_dto_1 = require("../dto/approval.dto");
const approval_service_1 = require("../services/approval.service");
let ApprovalController = class ApprovalController {
    approvals;
    constructor(approvals) {
        this.approvals = approvals;
    }
    list(query, actor) {
        // A manager cannot spy on the finance queue by passing ?role=FINANCE.
        const assignedRole = actor.role === 'ADMIN'
            ? query.role
            : actor.role === 'FINANCE'
                ? 'FINANCE'
                : 'SALES_MANAGER';
        return this.approvals.list({
            status: query.status,
            assignedRole,
            page: query.page,
            pageSize: query.pageSize,
        });
    }
    detail(id) {
        return this.approvals.detail(id);
    }
    act(id, body, actor) {
        return this.approvals.act(id, body.action, actor, body.reason);
    }
};
exports.ApprovalController = ApprovalController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.Roles)('SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [approval_dto_1.ListApprovalsQueryDto, Object]),
    __metadata("design:returntype", Promise)
], ApprovalController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ApprovalController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_guard_1.Roles)('SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, approval_dto_1.ApprovalActionDto, Object]),
    __metadata("design:returntype", Promise)
], ApprovalController.prototype, "act", null);
exports.ApprovalController = ApprovalController = __decorate([
    (0, common_1.Controller)('approvals'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [approval_service_1.ApprovalService])
], ApprovalController);
//# sourceMappingURL=approval.controller.js.map
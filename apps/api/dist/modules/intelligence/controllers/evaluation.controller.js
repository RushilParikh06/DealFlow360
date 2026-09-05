"use strict";
// B2 OWNED. plan.md section 8:
//   POST /api/v1/quotes/:id/evaluate      re-run the engine, route approvals
//   GET  /api/v1/quotes/:id/risk          latest evaluation (dashboard badge)
//   GET  /api/v1/quotes/:id/risk/history  append-only trail
//
// Route prefix note: the path segment is `quotes`, which is B1's noun. That is
// deliberate and agreed — B1 owns /quotes CRUD, B2 owns the /evaluate and /risk
// sub-resources. Nest merges them; nobody edits anybody else's file.
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
exports.EvaluationController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../shared/auth.guard");
const roles_guard_1 = require("../../shared/roles.guard");
const current_user_1 = require("../../shared/current-user");
const evaluate_dto_1 = require("../dto/evaluate.dto");
const evaluation_service_1 = require("../services/evaluation.service");
let EvaluationController = class EvaluationController {
    evaluations;
    constructor(evaluations) {
        this.evaluations = evaluations;
    }
    /**
     * Idempotent. Same quote + same lines + same policies => same inputHash => the
     * existing evaluation comes back instead of a duplicate row. Safe to call from
     * a line-edit autosave, which is exactly how the UI will use it.
     */
    evaluate(id, actor) {
        return this.evaluations.evaluate(id, actor);
    }
    latest(id) {
        return this.evaluations.latestFor(id);
    }
    history(id, query) {
        return this.evaluations.history(id, query.take);
    }
};
exports.EvaluationController = EvaluationController;
__decorate([
    (0, common_1.Post)(':id/evaluate'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EvaluationController.prototype, "evaluate", null);
__decorate([
    (0, common_1.Get)(':id/risk'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EvaluationController.prototype, "latest", null);
__decorate([
    (0, common_1.Get)(':id/risk/history'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, evaluate_dto_1.EvaluationHistoryQueryDto]),
    __metadata("design:returntype", Promise)
], EvaluationController.prototype, "history", null);
exports.EvaluationController = EvaluationController = __decorate([
    (0, common_1.Controller)('quotes'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [evaluation_service_1.EvaluationService])
], EvaluationController);
//# sourceMappingURL=evaluation.controller.js.map
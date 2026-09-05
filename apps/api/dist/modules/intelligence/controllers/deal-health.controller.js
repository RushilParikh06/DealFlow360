"use strict";
// B2 OWNED.
//   GET  /api/v1/deal-health                    dashboard list
//   POST /api/v1/deal-health/refresh            re-run detection over open quotes
//   GET  /api/v1/deal-health/quote/:id          findings for one quote
//   POST /api/v1/deal-health/:eventId/nudge     record a chase
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
exports.DealHealthController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../shared/auth.guard");
const roles_guard_1 = require("../../shared/roles.guard");
const current_user_1 = require("../../shared/current-user");
const deal_health_dto_1 = require("../dto/deal-health.dto");
const deal_health_service_1 = require("../services/deal-health.service");
let DealHealthController = class DealHealthController {
    health;
    constructor(health) {
        this.health = health;
    }
    list(query) {
        return this.health.list({
            severity: query.severity,
            includeResolved: query.includeResolved === 'true',
        });
    }
    /** The demo presses this. Idempotent, so pressing it twice is not a story. */
    refresh() {
        return this.health.sweep();
    }
    forQuote(id) {
        return this.health.detectFor(id);
    }
    nudge(eventId, actor) {
        return this.health.nudge(eventId, actor);
    }
};
exports.DealHealthController = DealHealthController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [deal_health_dto_1.DealHealthQueryDto]),
    __metadata("design:returntype", Promise)
], DealHealthController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, roles_guard_1.Roles)('SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DealHealthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Get)('quote/:id'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], DealHealthController.prototype, "forQuote", null);
__decorate([
    (0, common_1.Post)(':eventId/nudge'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('eventId')),
    __param(1, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DealHealthController.prototype, "nudge", null);
exports.DealHealthController = DealHealthController = __decorate([
    (0, common_1.Controller)('deal-health'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [deal_health_service_1.DealHealthService])
], DealHealthController);
//# sourceMappingURL=deal-health.controller.js.map
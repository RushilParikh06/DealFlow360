"use strict";
// B2 OWNED.
//   GET /api/v1/audit                     filtered log
//   GET /api/v1/quotes/:id/audit-trail    everything that happened to one quote
//
// Read-only by construction: AuditService has no public write method that works
// outside a transaction, so there is no endpoint that could forge a row.
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
exports.AuditController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../shared/auth.guard");
const roles_guard_1 = require("../../shared/roles.guard");
const audit_dto_1 = require("../dto/audit.dto");
const audit_service_1 = require("../services/audit.service");
let AuditController = class AuditController {
    audit;
    constructor(audit) {
        this.audit = audit;
    }
    list(query) {
        return this.audit.list(query);
    }
    trail(id) {
        return this.audit.trailForQuotation(id);
    }
};
exports.AuditController = AuditController;
__decorate([
    (0, common_1.Get)('audit'),
    (0, roles_guard_1.Roles)('SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [audit_dto_1.AuditQueryDto]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('quotes/:id/audit-trail'),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuditController.prototype, "trail", null);
exports.AuditController = AuditController = __decorate([
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [audit_service_1.AuditService])
], AuditController);
//# sourceMappingURL=audit.controller.js.map
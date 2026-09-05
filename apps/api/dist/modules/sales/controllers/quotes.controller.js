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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotesController = void 0;
// B1 owned. plan.md section 8: /quotes CRUD, lines, submit, confirm.
// Route prefix `quotes` also carries B2's /evaluate and /risk sub-resources -
// Nest merges controllers on the same path, nobody edits anybody else's file.
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../shared/auth.guard");
const roles_guard_1 = require("../../shared/roles.guard");
const current_user_1 = require("../../shared/current-user");
const quote_dto_1 = require("../dto/quote.dto");
const quotes_service_1 = require("../services/quotes.service");
let QuotesController = class QuotesController {
    quotes;
    constructor(quotes) {
        this.quotes = quotes;
    }
    list(query) {
        return this.quotes.list(query);
    }
    get(id) {
        return this.quotes.get(id);
    }
    create(dto, actor) {
        return this.quotes.create(dto, actor);
    }
    addLine(id, dto) {
        return this.quotes.addLine(id, dto);
    }
    updateLine(id, lineId, dto) {
        return this.quotes.updateLine(id, lineId, dto);
    }
    deleteLine(id, lineId) {
        return this.quotes.deleteLine(id, lineId);
    }
    submit(id, actor) {
        return this.quotes.submit(id, actor);
    }
    confirm(id, actor) {
        return this.quotes.confirm(id, actor);
    }
};
exports.QuotesController = QuotesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [quote_dto_1.ListQuotesQueryDto]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [quote_dto_1.CreateQuotationDto, Object]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/lines'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, quote_dto_1.AddQuotationLineDto]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "addLine", null);
__decorate([
    (0, common_1.Patch)(':id/lines/:lineId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('lineId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, quote_dto_1.UpdateQuotationLineDto]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "updateLine", null);
__decorate([
    (0, common_1.Delete)(':id/lines/:lineId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('lineId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "deleteLine", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QuotesController.prototype, "confirm", null);
exports.QuotesController = QuotesController = __decorate([
    (0, common_1.Controller)('quotes'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'),
    __metadata("design:paramtypes", [quotes_service_1.QuotesService])
], QuotesController);
//# sourceMappingURL=quotes.controller.js.map
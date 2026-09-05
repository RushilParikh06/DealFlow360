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
exports.ApprovalActionDto = exports.ListApprovalsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const contracts_1 = require("@dealflow/contracts");
class ListApprovalsQueryDto {
    /** ADMIN/FINANCE may pass this to widen the queue; reps always see their own. */
    status;
    role;
    page;
    pageSize;
}
exports.ListApprovalsQueryDto = ListApprovalsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(contracts_1.ApprovalStatus),
    __metadata("design:type", Object)
], ListApprovalsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(contracts_1.ApproverRole),
    __metadata("design:type", Object)
], ListApprovalsQueryDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListApprovalsQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListApprovalsQueryDto.prototype, "pageSize", void 0);
class ApprovalActionDto {
    action;
    /** Required for REJECT and RETURN. The service enforces that; this only bounds it. */
    reason;
}
exports.ApprovalActionDto = ApprovalActionDto;
__decorate([
    (0, class_validator_1.IsEnum)(contracts_1.ApprovalActionType),
    __metadata("design:type", Object)
], ApprovalActionDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], ApprovalActionDto.prototype, "reason", void 0);
//# sourceMappingURL=approval.dto.js.map
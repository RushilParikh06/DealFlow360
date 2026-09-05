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
exports.UpdateQuotationLineDto = exports.AddQuotationLineDto = exports.CreateQuotationDto = exports.ListOrdersQueryDto = exports.ListQuotesQueryDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const contracts_1 = require("@dealflow/contracts");
class ListQuotesQueryDto {
    status;
    customerId;
    ownerUserId;
    page;
    pageSize;
}
exports.ListQuotesQueryDto = ListQuotesQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(contracts_1.QuotationStatus),
    __metadata("design:type", Object)
], ListQuotesQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListQuotesQueryDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListQuotesQueryDto.prototype, "ownerUserId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListQuotesQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListQuotesQueryDto.prototype, "pageSize", void 0);
/** A class, not an inline type: without one, ValidationPipe cannot transform
 *  page/pageSize and Prisma is handed a string where it wants an Int. */
class ListOrdersQueryDto {
    status;
    customerId;
    page;
    pageSize;
}
exports.ListOrdersQueryDto = ListOrdersQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListOrdersQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListOrdersQueryDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListOrdersQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListOrdersQueryDto.prototype, "pageSize", void 0);
class CreateQuotationDto {
    customerId;
    currency;
}
exports.CreateQuotationDto = CreateQuotationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuotationDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuotationDto.prototype, "currency", void 0);
/**
 * plan.md section 8: `POST /quotes/:id/lines { productId, qty, discountBps }`.
 * Price, cost, description and lineType are deliberately NOT accepted from the
 * client - the service reads them off the product. Letting the browser send
 * costMinor would hand it control of the margin B2 scores risk on, and with it
 * the approval routing (invariant 2).
 */
class AddQuotationLineDto {
    productId;
    qty;
    discountBps;
}
exports.AddQuotationLineDto = AddQuotationLineDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddQuotationLineDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddQuotationLineDto.prototype, "qty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(10000),
    __metadata("design:type", Number)
], AddQuotationLineDto.prototype, "discountBps", void 0);
class UpdateQuotationLineDto {
    qty;
    discountBps;
    description;
}
exports.UpdateQuotationLineDto = UpdateQuotationLineDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateQuotationLineDto.prototype, "qty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(10000),
    __metadata("design:type", Number)
], UpdateQuotationLineDto.prototype, "discountBps", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpdateQuotationLineDto.prototype, "description", void 0);
//# sourceMappingURL=quote.dto.js.map
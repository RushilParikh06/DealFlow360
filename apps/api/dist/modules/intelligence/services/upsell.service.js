"use strict";
// B2 OWNED. GET /quotes/:id/upsell.
// Step 4 of the organisers' quick test flow, so it is not optional.
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
exports.UpsellService = void 0;
const common_1 = require("@nestjs/common");
const upsell_1 = require("../engine/upsell");
const ops_reader_service_1 = require("./ops-reader.service");
const quote_reader_service_1 = require("./quote-reader.service");
let UpsellService = class UpsellService {
    quotes;
    ops;
    constructor(quotes, ops) {
        this.quotes = quotes;
        this.ops = ops;
    }
    async forQuotation(quotationId, limit = 5) {
        const { input, quote } = await this.quotes.loadEvaluationInput(quotationId);
        const productIds = [...new Set(input.lines.map((l) => l.productId))];
        if (productIds.length === 0)
            return [];
        const candidates = await this.ops.loadUpsellCandidates(productIds, quote.tierId);
        return (0, upsell_1.rankUpsell)(candidates, quote.currency, limit);
    }
};
exports.UpsellService = UpsellService;
exports.UpsellService = UpsellService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [quote_reader_service_1.QuoteReaderService,
        ops_reader_service_1.OpsReaderService])
], UpsellService);
//# sourceMappingURL=upsell.service.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
// GROUP OWNED. One module per owner, all four in one process (plan.md section 12).
// B1 adds SalesModule, B3 adds OperationsModule and BillingModule. Do not
// reorder or wrap what is already here.
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("./modules/shared/prisma.module");
const intelligence_module_1 = require("./modules/intelligence/intelligence.module");
const sales_module_1 = require("./modules/sales/sales.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            intelligence_module_1.IntelligenceModule,
            sales_module_1.SalesModule,
            // OperationsModule, <- B3
            // BillingModule,    <- B3
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesModule = void 0;
// B1 owned. plan.md section 4: auth, customers, quotations, lines, totals,
// orders, state machine.
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const auth_controller_1 = require("./controllers/auth.controller");
const customers_controller_1 = require("./controllers/customers.controller");
const quotes_controller_1 = require("./controllers/quotes.controller");
const orders_controller_1 = require("./controllers/orders.controller");
const auth_service_1 = require("./services/auth.service");
const customers_service_1 = require("./services/customers.service");
const quotes_service_1 = require("./services/quotes.service");
const orders_service_1 = require("./services/orders.service");
const quote_state_service_1 = require("./services/quote-state.service");
let SalesModule = class SalesModule {
};
exports.SalesModule = SalesModule;
exports.SalesModule = SalesModule = __decorate([
    (0, common_1.Module)({
        controllers: [auth_controller_1.AuthController, customers_controller_1.CustomersController, quotes_controller_1.QuotesController, orders_controller_1.OrdersController],
        providers: [
            auth_service_1.AuthService,
            customers_service_1.CustomersService,
            quotes_service_1.QuotesService,
            orders_service_1.OrdersService,
            quote_state_service_1.QuoteStateService,
            // The seam B2 depends on (packages/contracts/src/ports.ts). Anything that
            // needs to move quotations.status asks for QUOTE_STATE_PORT, never this
            // class directly.
            { provide: contracts_1.QUOTE_STATE_PORT, useClass: quote_state_service_1.QuoteStateService },
        ],
        exports: [quote_state_service_1.QuoteStateService],
    })
], SalesModule);
//# sourceMappingURL=sales.module.js.map
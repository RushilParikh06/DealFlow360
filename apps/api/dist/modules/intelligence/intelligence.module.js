"use strict";
// B2 OWNED. The whole of Aaryan's surface area in one wiring file.
//
// Two things worth reading twice:
//
// 1. QUOTE_STATE_PORT is bound to B1's real QuoteStateService (apps/api/src/
//    modules/sales/services/quote-state.service.ts). plan.md invariant 5 says
//    B2 must never write quotations.status directly, so it only ever depends
//    on this port. The temporary adapter this used to point at is deleted.
//
// 2. The engine/ folder is deliberately NOT in providers. It exports pure
//    functions with no Nest decorators and no DI, which is why the 49 unit tests
//    need neither a database nor a Nest test module to run.
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligenceModule = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@dealflow/contracts");
const allocation_controller_1 = require("./controllers/allocation.controller");
const approval_controller_1 = require("./controllers/approval.controller");
const audit_controller_1 = require("./controllers/audit.controller");
const deal_health_controller_1 = require("./controllers/deal-health.controller");
const evaluation_controller_1 = require("./controllers/evaluation.controller");
const policy_controller_1 = require("./controllers/policy.controller");
const upsell_controller_1 = require("./controllers/upsell.controller");
const allocation_service_1 = require("./services/allocation.service");
const approval_service_1 = require("./services/approval.service");
const audit_service_1 = require("./services/audit.service");
const deal_health_service_1 = require("./services/deal-health.service");
const evaluation_service_1 = require("./services/evaluation.service");
const ops_reader_service_1 = require("./services/ops-reader.service");
const policy_service_1 = require("./services/policy.service");
const quote_reader_service_1 = require("./services/quote-reader.service");
const quote_state_service_1 = require("../sales/services/quote-state.service");
const upsell_service_1 = require("./services/upsell.service");
let IntelligenceModule = class IntelligenceModule {
};
exports.IntelligenceModule = IntelligenceModule;
exports.IntelligenceModule = IntelligenceModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            evaluation_controller_1.EvaluationController,
            approval_controller_1.ApprovalController,
            policy_controller_1.PolicyController,
            audit_controller_1.AuditController,
            upsell_controller_1.UpsellController,
            allocation_controller_1.AllocationController,
            deal_health_controller_1.DealHealthController,
        ],
        providers: [
            // readers — the only two files that touch B1's and B3's tables
            quote_reader_service_1.QuoteReaderService,
            ops_reader_service_1.OpsReaderService,
            // B2 domain services
            audit_service_1.AuditService,
            policy_service_1.PolicyService,
            evaluation_service_1.EvaluationService,
            approval_service_1.ApprovalService,
            upsell_service_1.UpsellService,
            allocation_service_1.AllocationService,
            deal_health_service_1.DealHealthService,
            // THE SEAM. B1's real implementation - the temporary adapter is gone.
            quote_state_service_1.QuoteStateService,
            { provide: contracts_1.QUOTE_STATE_PORT, useClass: quote_state_service_1.QuoteStateService },
        ],
        exports: [
            // B1 and B3 consume these; they do not reach into the engine directly.
            audit_service_1.AuditService,
            evaluation_service_1.EvaluationService,
            allocation_service_1.AllocationService,
        ],
    })
], IntelligenceModule);
//# sourceMappingURL=intelligence.module.js.map
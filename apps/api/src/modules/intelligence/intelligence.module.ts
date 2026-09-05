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

import { Module } from '@nestjs/common';
import { QUOTE_STATE_PORT } from '@dealflow/contracts';

import { AllocationController } from './controllers/allocation.controller';
import { ApprovalController } from './controllers/approval.controller';
import { AuditController } from './controllers/audit.controller';
import { DealHealthController } from './controllers/deal-health.controller';
import { EvaluationController } from './controllers/evaluation.controller';
import { PolicyController } from './controllers/policy.controller';
import { UpsellController } from './controllers/upsell.controller';

import { AllocationService } from './services/allocation.service';
import { ApprovalService } from './services/approval.service';
import { AuditService } from './services/audit.service';
import { DealHealthService } from './services/deal-health.service';
import { EvaluationService } from './services/evaluation.service';
import { OpsReaderService } from './services/ops-reader.service';
import { PolicyService } from './services/policy.service';
import { QuoteReaderService } from './services/quote-reader.service';
import { QuoteStateService } from '../sales/services/quote-state.service';
import { UpsellService } from './services/upsell.service';

@Module({
  controllers: [
    EvaluationController,
    ApprovalController,
    PolicyController,
    AuditController,
    UpsellController,
    AllocationController,
    DealHealthController,
  ],
  providers: [
    // readers — the only two files that touch B1's and B3's tables
    QuoteReaderService,
    OpsReaderService,

    // B2 domain services
    AuditService,
    PolicyService,
    EvaluationService,
    ApprovalService,
    UpsellService,
    AllocationService,
    DealHealthService,

    // THE SEAM. B1's real implementation - the temporary adapter is gone.
    QuoteStateService,
    { provide: QUOTE_STATE_PORT, useClass: QuoteStateService },
  ],
  exports: [
    // B1 and B3 consume these; they do not reach into the engine directly.
    AuditService,
    EvaluationService,
    AllocationService,
  ],
})
export class IntelligenceModule {}

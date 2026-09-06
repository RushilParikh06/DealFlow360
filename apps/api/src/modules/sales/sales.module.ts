// B1 owned. plan.md section 4: auth, customers, quotations, lines, totals,
// orders, state machine.
import { Module } from '@nestjs/common';
import { QUOTE_STATE_PORT } from '@dealflow/contracts';

import { AuthController } from './controllers/auth.controller';
import { CustomersController } from './controllers/customers.controller';
import { QuotesController } from './controllers/quotes.controller';
import { OrdersController } from './controllers/orders.controller';

import { AuthService } from './services/auth.service';
import { CustomersService } from './services/customers.service';
import { QuotesService } from './services/quotes.service';
import { NegotiationService } from './services/negotiation.service';
import { OrdersService } from './services/orders.service';
import { QuoteStateService } from './services/quote-state.service';
// Imported for AuditService: a negotiation note and a customer acceptance are
// auditable events, and AuditService.record() only runs inside a transaction.
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [AuthController, CustomersController, QuotesController, OrdersController],
  providers: [
    AuthService,
    CustomersService,
    QuotesService,
    NegotiationService,
    OrdersService,
    QuoteStateService,
    // The seam B2 depends on (packages/contracts/src/ports.ts). Anything that
    // needs to move quotations.status asks for QUOTE_STATE_PORT, never this
    // class directly.
    { provide: QUOTE_STATE_PORT, useClass: QuoteStateService },
  ],
  exports: [QuoteStateService],
})
export class SalesModule {}

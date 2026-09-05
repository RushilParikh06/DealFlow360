// B3 OWNED. Billing wiring (plan.md section 12).
//
// IntelligenceModule is imported for AuditService only. plan.md invariant 6
// says every transition writes its audit row in the same transaction as the
// change, and AuditService.record() takes a Prisma.TransactionClient, so the
// compiler refuses a caller that is not already inside $transaction.
import { Module } from '@nestjs/common';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { BillingService } from './billing.service';
import { FulfillmentsController } from './controllers/fulfillments.controller';
import { InvoicesController, OrderInvoicingController } from './controllers/invoices.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';

@Module({
  imports: [IntelligenceModule],
  controllers: [FulfillmentsController, InvoicesController, OrderInvoicingController, SubscriptionsController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

// GROUP OWNED. One module per owner, all four in one process (plan.md section 12).
// B1 adds SalesModule, B3 adds OperationsModule and BillingModule. Do not
// reorder or wrap what is already here.
import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/shared/prisma.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { SalesModule } from './modules/sales/sales.module';
import { OperationsModule } from './modules/operations/operations.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    PrismaModule,
    IntelligenceModule,
    SalesModule,
    OperationsModule,
    BillingModule,
  ],
})
export class AppModule {}

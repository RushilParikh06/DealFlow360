// GROUP OWNED. One module per owner, all four in one process (plan.md section 12).
// B1 adds SalesModule, B3 adds OperationsModule and BillingModule. Do not
// reorder or wrap what is already here.
import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/shared/prisma.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { SalesModule } from './modules/sales/sales.module';

@Module({
  imports: [
    PrismaModule,
    IntelligenceModule,
    SalesModule,
    // OperationsModule, <- B3
    // BillingModule,    <- B3
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ActivitiesModule } from './activities/activities.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CustomersModule } from './customers/customers.module.js';
import { DealsModule } from './deals/deals.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StagesModule } from './stages/stages.module.js';

@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    LeadsModule,
    DealsModule,
    ActivitiesModule,
    StagesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

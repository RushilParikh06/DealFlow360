import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DealsController } from './deals.controller.js';
import { DealsService } from './deals.service.js';
import { OpportunitiesController } from './opportunities.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [DealsController, OpportunitiesController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}

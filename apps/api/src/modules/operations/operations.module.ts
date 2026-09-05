// B3 OWNED. Operations wiring (plan.md section 12).
//
// pricing/ and allocation/ stay out of providers on purpose: they export pure
// functions with no decorators and no DI, which is why their unit tests need
// neither a database nor a Nest test module. Only the file that talks to Prisma
// is a provider.
//
// The allocation recommendation endpoint is B2's (GET /orders/:id/allocation-plan)
// and already live, so allocation.service.ts here is not routed twice.
import { Module } from '@nestjs/common';
import { InventoryController } from './controllers/inventory.controller';
import { InventoryService } from './inventory/inventory.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class OperationsModule {}

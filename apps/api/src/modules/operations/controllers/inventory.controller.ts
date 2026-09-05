// B3 owned. plan.md section 8: GET /inventory, POST /inventory/:id/reserve.
//
// B2's allocation controller owns POST /orders/:id/reserve, which reserves
// against its own inventory_reservations ledger for a whole order. This is the
// warehouse-level view of the onHand/reserved columns - the two are reconciled
// at the ops-reader seam, not merged.
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { ListInventoryQueryDto, ReserveInventoryDto } from '../dto/inventory.dto';
import { InventoryService } from '../inventory/inventory.service';

@Controller('inventory')
@UseGuards(AuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  list(@Query() query: ListInventoryQueryDto) {
    return this.inventory.list(query);
  }

  @Post(':id/reserve')
  @Roles('SALES_MANAGER', 'ADMIN')
  reserve(@Param('id') id: string, @Body() dto: ReserveInventoryDto) {
    return this.inventory.reserve(id, dto.qty, dto.reason);
  }
}

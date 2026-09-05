// B2 OWNED — the allocation CHOICE only.
//   GET  /api/v1/orders/:id/allocation-plan   recommend, commit nothing
//   POST /api/v1/orders/:id/reserve           write reservation rows
//   POST /api/v1/orders/:id/release           give the stock back
//
// B3 owns order confirmation, picking, shipment and invoicing. B2 owns the split
// decision and the reservation table, because reservations are what make
// "available" mean something.

import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AllocationResponse } from '@dealflow/contracts';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import { AllocationService } from '../services/allocation.service';

@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
export class AllocationController {
  constructor(private readonly allocation: AllocationService) {}

  @Get(':id/allocation-plan')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  plan(@Param('id') id: string): Promise<AllocationResponse> {
    return this.allocation.recommend(id);
  }

  @Post(':id/reserve')
  @Roles('FINANCE', 'ADMIN')
  reserve(@Param('id') id: string, @CurrentUser() actor: AuthUser): Promise<AllocationResponse> {
    return this.allocation.reserve(id, actor);
  }

  @Post(':id/release')
  @Roles('FINANCE', 'ADMIN')
  release(@Param('id') id: string, @CurrentUser() actor: AuthUser): Promise<{ released: number }> {
    return this.allocation.release(id, actor);
  }
}

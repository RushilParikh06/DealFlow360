// B2 OWNED. GET /api/v1/quotes/:id/upsell
// Step 4 of the organisers' Quick Test Flow. Ships early for that reason.

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { UpsellSuggestion } from '@dealflow/contracts';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { UpsellQueryDto } from '../dto/upsell.dto';
import { UpsellService } from '../services/upsell.service';

@Controller('quotes')
@UseGuards(AuthGuard, RolesGuard)
export class UpsellController {
  constructor(private readonly upsell: UpsellService) {}

  @Get(':id/upsell')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  forQuote(@Param('id') id: string, @Query() query: UpsellQueryDto): Promise<UpsellSuggestion[]> {
    return this.upsell.forQuotation(id, query.limit);
  }
}

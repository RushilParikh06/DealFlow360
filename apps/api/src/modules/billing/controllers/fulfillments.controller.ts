// B3 owned. plan.md section 8: GET /fulfillments, PATCH /fulfillments/:id.
// The transition table lives in fulfillment-state.service.ts and is the only
// thing allowed to decide whether a move is legal.
import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import { BillingService } from '../billing.service';
import { AdvanceFulfillmentDto, ListFulfillmentsQueryDto } from '../dto/billing.dto';

@Controller('fulfillments')
@UseGuards(AuthGuard, RolesGuard)
export class FulfillmentsController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  list(@Query() query: ListFulfillmentsQueryDto) {
    return this.billing.listFulfillments(query);
  }

  @Patch(':id')
  @Roles('SALES_MANAGER', 'ADMIN')
  advance(@Param('id') id: string, @Body() dto: AdvanceFulfillmentDto, @CurrentUser() actor: AuthUser) {
    return this.billing.advanceFulfillment(id, dto.status, actor);
  }
}

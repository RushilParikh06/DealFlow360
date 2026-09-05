// B3 owned. plan.md section 8: GET /subscriptions, PATCH /subscriptions/:id.
// A plan change takes effect on the next cycle, never mid-cycle - there is no
// proration anywhere in this module (README limitations).
import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import { BillingService } from '../billing.service';
import { ListSubscriptionsQueryDto, TransitionSubscriptionDto } from '../dto/billing.dto';

@Controller('subscriptions')
@UseGuards(AuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  list(@Query() query: ListSubscriptionsQueryDto) {
    return this.billing.listSubscriptions(query);
  }

  @Get(':id')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  detail(@Param('id') id: string) {
    return this.billing.getSubscription(id);
  }

  @Patch(':id')
  @Roles('SALES_MANAGER', 'FINANCE', 'ADMIN')
  transition(@Param('id') id: string, @Body() dto: TransitionSubscriptionDto, @CurrentUser() actor: AuthUser) {
    return this.billing.transitionSubscription(id, dto.status, actor);
  }
}

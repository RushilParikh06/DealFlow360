// B3 owned. plan.md section 8:
//   GET  /invoices, GET /invoices/:id
//   POST /invoices/:id/payments
//   POST /orders/:id/invoices        <- the order->billing split
//
// The `orders` prefix is shared with B1's OrdersController and B2's
// AllocationController. Nest merges controllers on the same path, so each owner
// keeps their own file.
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import { BillingService } from '../billing.service';
import { ListInvoicesQueryDto, RecordPaymentDto } from '../dto/billing.dto';

@Controller('invoices')
@UseGuards(AuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  list(@Query() query: ListInvoicesQueryDto) {
    return this.billing.listInvoices(query);
  }

  @Get(':id')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  get(@Param('id') id: string) {
    return this.billing.getInvoice(id);
  }

  /** Settlement is finance's call, not a sales rep's. */
  @Post(':id/payments')
  @Roles('FINANCE', 'ADMIN')
  pay(@Param('id') id: string, @Body() dto: RecordPaymentDto, @CurrentUser() actor: AuthUser) {
    return this.billing.payInvoice(id, dto.amountMinor, dto.method, dto.reference, actor);
  }
}

@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
export class OrderInvoicingController {
  constructor(private readonly billing: BillingService) {}

  @Post(':id/invoices')
  @Roles('SALES_MANAGER', 'FINANCE', 'ADMIN')
  invoice(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.billing.invoiceOrder(id, actor);
  }
}

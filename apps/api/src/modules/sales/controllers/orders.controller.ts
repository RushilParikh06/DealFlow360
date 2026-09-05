// B1 owned. plan.md section 8: GET /orders, GET /orders/:id.
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { ListOrdersQueryDto } from '../dto/quote.dto';
import { OrdersService } from '../services/orders.service';

@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: ListOrdersQueryDto) {
    return this.orders.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }
}

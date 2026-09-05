// B1 owned. plan.md section 8: GET/POST /customers, GET/PATCH /customers/:id.
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from '../dto/customer.dto';
import { CustomersService } from '../services/customers.service';

@Controller('customers')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() query: ListCustomersQueryDto) {
    return this.customers.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.customers.get(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CustomersService } from './customers.service.js';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(Number(id));
  }

  @Post()
  create(
    @Body()
    data: {
      name: string;
      email?: string;
      phone?: string;
      company?: string;
    },
  ) {
    return this.customersService.create(data);
  }
}
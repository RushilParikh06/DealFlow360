import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.db.orm.public.Customer.all();
  }

  async findOne(id: number) {
    return this.prisma.db.orm.public.Customer.first({ id });
  }

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
  }) {
    return this.prisma.db.orm.public.Customer.create({
      ...data,
      updatedAt: new Date(),
    });
  }
}
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nowInstant } from '../common/temporal.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.db.orm.public.Customer.all();
  }

  async findOne(id: number) {
    const customer = await this.prisma.db.orm.public.Customer.first({ id });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    return customer;
  }

  async create(dto: CreateCustomerDto) {
    if (dto.email) {
      const existing = await this.prisma.db.orm.public.Customer.where((c) =>
        c.email.eq(dto.email!),
      ).first();
      if (existing) {
        throw new ConflictException(
          `Customer with email ${dto.email} already exists`,
        );
      }
    }

    return this.prisma.db.orm.public.Customer.create({
      ...dto,
      updatedAt: nowInstant(),
    });
  }

  async update(id: number, dto: UpdateCustomerDto) {
    await this.findOne(id);

    if (dto.email) {
      const existing = await this.prisma.db.orm.public.Customer.where((c) =>
        c.email.eq(dto.email!),
      ).first();
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Customer with email ${dto.email} already exists`,
        );
      }
    }

    const updated = await this.prisma.db.orm.public.Customer.where({ id }).update({
      ...dto,
      updatedAt: nowInstant(),
    });
    return Array.isArray(updated) ? updated[0] : updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.db.orm.public.Customer.where({ id }).delete();
    return { success: true, message: `Customer with ID ${id} deleted` };
  }
}
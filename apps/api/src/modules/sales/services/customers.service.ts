// B1 owned. GET/POST /customers, GET/PATCH /customers/:id (plan.md section 8).
import { Injectable } from '@nestjs/common';
import { ErrorCode, type Paginated } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from '../dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCustomersQueryDto): Promise<Paginated<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.tierId ? { tierId: query.tierId } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: { tier: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, include: { tier: true } });
    if (!customer) throw new AppError(ErrorCode.NOT_FOUND, 'Customer not found.', { id });
    return customer;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto, include: { tier: true } });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.get(id); // 404s before Prisma throws its own error shape
    return this.prisma.customer.update({ where: { id }, data: dto, include: { tier: true } });
  }
}

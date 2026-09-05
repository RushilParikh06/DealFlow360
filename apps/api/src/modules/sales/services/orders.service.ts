// B1 owned. GET /orders, GET /orders/:id (plan.md section 8).
import { Injectable } from '@nestjs/common';
import { ErrorCode, type Paginated } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { ListQuotesQueryDto } from '../dto/quote.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: Pick<ListQuotesQueryDto, 'customerId' | 'page' | 'pageSize'> & { status?: string }): Promise<Paginated<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { lines: true } });
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, 'Order not found.', { id });
    return order;
  }
}

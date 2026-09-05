// B1 owned. GET /orders, GET /orders/:id (plan.md section 8).
import { Injectable } from '@nestjs/common';
import { ErrorCode, type Paginated } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { ListOrdersQueryDto } from '../dto/quote.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListOrdersQueryDto): Promise<Paginated<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        // Order stores customerId only, but every list view shows the customer
        // by name, so read it through the quotation rather than making the
        // client fetch /customers per row.
        include: {
          quotation: { select: { code: true, customer: { select: { name: true } } } },
          _count: { select: { lines: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** Either the cuid or the human code, so /fulfillment/ORD-2001/ resolves. */
  async get(idOrCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
      include: { lines: true, quotation: { select: { code: true, customer: { select: { name: true } } } } },
    });
    if (!order) throw new AppError(ErrorCode.NOT_FOUND, 'Order not found.', { id: idOrCode });
    return order;
  }
}

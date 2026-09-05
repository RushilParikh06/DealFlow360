// B1 owned. /quotes CRUD + lines + submit/confirm (plan.md section 8). Only
// this service writes quotation_lines/order_lines; only quote-state.service.ts
// writes quotations.status (invariant 5) - submit/confirm call through it.
import { Injectable } from '@nestjs/common';
import { ErrorCode, QuotationStatus, type Paginated } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import type { AuthUser } from '../../shared/current-user';
import { QuoteStateService } from './quote-state.service';
import { computeLineTotals, computeQuotationTotals } from './totals.service';
import type {
  AddQuotationLineDto,
  CreateQuotationDto,
  ListQuotesQueryDto,
  UpdateQuotationLineDto,
} from '../dto/quote.dto';

// ponytail: sequential-by-count code generation races under concurrent writers.
// Fine for a single-process demo; swap for a DB sequence if that ever matters.
async function nextCode(prefix: string, count: () => Promise<number>): Promise<string> {
  return `${prefix}-${1000 + (await count()) + 1}`;
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteState: QuoteStateService,
  ) {}

  async list(query: ListQuotesQueryDto): Promise<Paginated<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        include: { customer: { include: { tier: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastActivityAt: 'desc' },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    // ownerUserId is a plain id, not a Prisma relation (users is B1-owned but
    // the column predates the relation), so every list view was rendering a raw
    // cuid in its "Sales Owner" column. One extra query for the page beats a
    // schema change, and beats the client fetching a user per row.
    const owners = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(items.map((q) => q.ownerUserId))] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(owners.map((u) => [u.id, u.name]));

    return {
      items: items.map((q) => ({ ...q, ownerName: nameById.get(q.ownerUserId) ?? q.ownerUserId })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Accepts either the cuid or the human code. Quote URLs read
   * /quotations/QT-1001/, which is what people type, paste into chat and read
   * off a screen share - resolving both here keeps that from needing a
   * separate lookup round trip on every detail page.
   */
  async get(idOrCode: string) {
    const quote = await this.prisma.quotation.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
      include: { lines: true, customer: { include: { tier: true } } },
    });
    if (!quote) throw new AppError(ErrorCode.NOT_FOUND, 'Quotation not found.', { id: idOrCode });
    return quote;
  }

  async create(dto: CreateQuotationDto, actor: AuthUser) {
    const code = await nextCode('QT', () => this.prisma.quotation.count());
    return this.prisma.quotation.create({
      data: { code, customerId: dto.customerId, ownerUserId: actor.id, currency: dto.currency },
    });
  }

  /** Recomputes and persists the quotation's totals from its current lines. */
  private async recomputeTotals(quotationId: string): Promise<void> {
    const lines = await this.prisma.quotationLine.findMany({ where: { quotationId } });
    const totals = computeQuotationTotals(lines);
    await this.prisma.quotation.update({
      where: { id: quotationId },
      data: { ...totals, lastActivityAt: new Date() },
    });
  }

  private assertEditable(status: string): void {
    if (status !== QuotationStatus.DRAFT) {
      throw new AppError(ErrorCode.QUOTE_INVALID_STATE, 'Only a DRAFT quotation can be edited.', { status });
    }
  }

  /**
   * Price, cost, description and lineType come off the product, never off the
   * request body (invariant 2). costMinor is stored as a UNIT cost because
   * that is what B2's quote-reader.service.ts multiplies by qty.
   */
  async addLine(quotationId: string, dto: AddQuotationLineDto) {
    const quote = await this.get(quotationId);
    this.assertEditable(quote.status);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new AppError(ErrorCode.NOT_FOUND, 'Product not found.', { productId: dto.productId });
    if (product.currency !== quote.currency) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Product is priced in another currency.', {
        productCurrency: product.currency,
        quoteCurrency: quote.currency,
      });
    }

    const discountBps = dto.discountBps ?? 0;
    const { lineTotalMinor } = computeLineTotals({
      unitPriceMinor: product.listPriceMinor,
      qty: dto.qty,
      discountBps,
    });

    const line = await this.prisma.quotationLine.create({
      data: {
        quotationId,
        productId: product.id,
        description: product.name,
        qty: dto.qty,
        unitPriceMinor: product.listPriceMinor,
        discountBps,
        lineTotalMinor,
        costMinor: product.unitCostMinor,
        lineType: product.lineType,
      },
    });
    await this.recomputeTotals(quotationId);
    return line;
  }

  async updateLine(quotationId: string, lineId: string, dto: UpdateQuotationLineDto) {
    const quote = await this.get(quotationId);
    this.assertEditable(quote.status);

    const existing = quote.lines.find((l) => l.id === lineId);
    if (!existing) throw new AppError(ErrorCode.NOT_FOUND, 'Quotation line not found.', { lineId });

    const merged = {
      unitPriceMinor: existing.unitPriceMinor,
      qty: dto.qty ?? existing.qty,
      discountBps: dto.discountBps ?? existing.discountBps,
    };
    const { lineTotalMinor } = computeLineTotals(merged);

    const line = await this.prisma.quotationLine.update({
      where: { id: lineId },
      data: { ...dto, lineTotalMinor },
    });
    await this.recomputeTotals(quotationId);
    return line;
  }

  async deleteLine(quotationId: string, lineId: string): Promise<void> {
    const quote = await this.get(quotationId);
    this.assertEditable(quote.status);

    // The line must belong to THIS quote. Without the check, deleting
    // /quotes/A/lines/<a line of quote B> removes B's line and then recomputes
    // A's totals, leaving B silently priced as if the line were still there.
    if (!quote.lines.some((l) => l.id === lineId)) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Quotation line not found.', { quotationId, lineId });
    }

    await this.prisma.quotationLine.delete({ where: { id: lineId } });
    await this.recomputeTotals(quotationId);
  }

  /**
   * DRAFT -> SUBMITTED. Scoring and further routing (AUTO_APPROVED vs
   * PENDING_MANAGER) happen when the caller invokes B2's POST /evaluate right
   * after this, per plan.md's client-driven flow - this endpoint only opens
   * the gate.
   */
  async submit(quotationId: string, actor: AuthUser) {
    const quote = await this.get(quotationId);
    if (quote.lines.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Cannot submit a quotation with no lines.', { quotationId });
    }
    await this.quoteState.transition({ quotationId, to: QuotationStatus.SUBMITTED, actorUserId: actor.id });
    return this.get(quotationId);
  }

  /**
   * AUTO_APPROVED or APPROVED -> CONFIRMED, and copies the quote into a new
   * order (order_lines snapshot quotation_lines because the quote may still
   * change after the order exists - plan.md section 6).
   */
  async confirm(quotationId: string, actor: AuthUser) {
    const quote = await this.get(quotationId);
    if (quote.status !== QuotationStatus.AUTO_APPROVED && quote.status !== QuotationStatus.APPROVED) {
      throw new AppError(ErrorCode.QUOTE_INVALID_STATE, 'Only an approved quotation can be confirmed.', {
        status: quote.status,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.quoteState.transition({ quotationId, to: QuotationStatus.CONFIRMED, actorUserId: actor.id }, tx);

      const code = await nextCode('ORD', () => tx.order.count());
      const order = await tx.order.create({
        data: {
          code,
          quotationId,
          customerId: quote.customerId,
          currency: quote.currency,
          totalMinor: quote.totalMinor,
          lines: {
            create: quote.lines.map((l) => ({
              productId: l.productId,
              description: l.description,
              qty: l.qty,
              unitPriceMinor: l.unitPriceMinor,
              discountBps: l.discountBps,
              lineTotalMinor: l.lineTotalMinor,
              costMinor: l.costMinor,
              lineType: l.lineType,
            })),
          },
        },
        include: { lines: true },
      });

      // Every order needs a fulfillment from the moment it exists. Nothing else
      // creates one, and B3 refuses to invoice an order that has not reached
      // SHIPPED - so without this row the order/ship/invoice/pay chain was
      // unreachable and both billing screens stayed permanently empty.
      await tx.fulfillment.create({ data: { orderId: order.id, status: 'ORDER_CONFIRMED' } });

      return order;
    });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nowInstant, toInstant } from '../common/temporal.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDealDto, DealStage, DealStatus } from './dto/create-deal.dto.js';
import { UpdateDealDto } from './dto/update-deal.dto.js';

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(stage?: string, status?: string, customerId?: number) {
    if (stage && status && customerId) {
      return this.prisma.db.orm.public.Deal.where((d) => d.stage.eq(stage))
        .where((d) => d.status.eq(status))
        .where((d) => d.customerId.eq(customerId))
        .all();
    }
    if (stage && customerId) {
      return this.prisma.db.orm.public.Deal.where((d) => d.stage.eq(stage))
        .where((d) => d.customerId.eq(customerId))
        .all();
    }
    if (status && customerId) {
      return this.prisma.db.orm.public.Deal.where((d) => d.status.eq(status))
        .where((d) => d.customerId.eq(customerId))
        .all();
    }
    if (stage) {
      return this.prisma.db.orm.public.Deal.where((d) =>
        d.stage.eq(stage),
      ).all();
    }
    if (status) {
      return this.prisma.db.orm.public.Deal.where((d) =>
        d.status.eq(status),
      ).all();
    }
    if (customerId) {
      return this.prisma.db.orm.public.Deal.where((d) =>
        d.customerId.eq(customerId),
      ).all();
    }
    return this.prisma.db.orm.public.Deal.all();
  }

  async findOne(id: number) {
    const deal = await this.prisma.db.orm.public.Deal.first({ id });
    if (!deal) {
      throw new NotFoundException(`Deal with ID ${id} not found`);
    }
    return deal;
  }

  async create(dto: CreateDealDto) {
    const customer = await this.prisma.db.orm.public.Customer.first({
      id: dto.customerId,
    });
    if (!customer) {
      throw new BadRequestException(
        `Customer with ID ${dto.customerId} does not exist`,
      );
    }

    if (dto.leadId) {
      const lead = await this.prisma.db.orm.public.Lead.first({
        id: dto.leadId,
      });
      if (!lead) {
        throw new BadRequestException(
          `Lead with ID ${dto.leadId} does not exist`,
        );
      }
    }

    const stage = dto.stage ?? DealStage.PROSPECTING;
    let status = dto.status ?? DealStatus.OPEN;
    let closedAt: any = null;

    if (stage === DealStage.CLOSED_WON) {
      status = DealStatus.WON;
      closedAt = nowInstant();
    } else if (stage === DealStage.CLOSED_LOST) {
      status = DealStatus.LOST;
      closedAt = nowInstant();
    }

    return this.prisma.db.orm.public.Deal.create({
      title: dto.title,
      value: dto.value ?? 0,
      stage,
      status,
      pipeline: dto.pipeline ?? 'Standard Sales Pipeline',
      expectedCloseDate: toInstant(dto.expectedCloseDate),
      closedAt,
      customerId: dto.customerId,
      leadId: dto.leadId ?? null,
      updatedAt: nowInstant(),
    });
  }

  async update(id: number, dto: UpdateDealDto) {
    await this.findOne(id);

    if (dto.customerId !== undefined && dto.customerId !== null) {
      const customer = await this.prisma.db.orm.public.Customer.first({
        id: dto.customerId,
      });
      if (!customer) {
        throw new BadRequestException(
          `Customer with ID ${dto.customerId} does not exist`,
        );
      }
    }

    if (dto.leadId !== undefined && dto.leadId !== null) {
      const lead = await this.prisma.db.orm.public.Lead.first({
        id: dto.leadId,
      });
      if (!lead) {
        throw new BadRequestException(
          `Lead with ID ${dto.leadId} does not exist`,
        );
      }
    }

    const updatePayload: Record<string, any> = {
      ...dto,
      updatedAt: nowInstant(),
    };

    if (dto.expectedCloseDate !== undefined) {
      updatePayload.expectedCloseDate = toInstant(dto.expectedCloseDate);
    }

    if (dto.stage) {
      if (dto.stage === DealStage.CLOSED_WON) {
        updatePayload.status = DealStatus.WON;
        updatePayload.closedAt = nowInstant();
      } else if (dto.stage === DealStage.CLOSED_LOST) {
        updatePayload.status = DealStatus.LOST;
        updatePayload.closedAt = nowInstant();
      } else {
        updatePayload.status = DealStatus.OPEN;
        updatePayload.closedAt = null;
      }
    }

    const updated = await this.prisma.db.orm.public.Deal.where({ id }).update(
      updatePayload,
    );
    return Array.isArray(updated) ? updated[0] : updated;
  }

  async updateStage(id: number, newStage: DealStage) {
    return this.update(id, { stage: newStage });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.db.orm.public.Deal.where({ id }).delete();
    return { success: true, message: `Deal with ID ${id} deleted` };
  }
}

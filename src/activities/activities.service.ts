import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nowInstant, toInstant } from '../common/temporal.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivityStatus, CreateActivityDto } from './dto/create-activity.dto.js';
import { UpdateActivityDto } from './dto/update-activity.dto.js';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    customerId?: number,
    leadId?: number,
    dealId?: number,
    status?: string,
  ) {
    if (customerId) {
      return this.prisma.db.orm.public.Activity.where((a) =>
        a.customerId.eq(customerId),
      ).all();
    }
    if (leadId) {
      return this.prisma.db.orm.public.Activity.where((a) =>
        a.leadId.eq(leadId),
      ).all();
    }
    if (dealId) {
      return this.prisma.db.orm.public.Activity.where((a) =>
        a.dealId.eq(dealId),
      ).all();
    }
    if (status) {
      return this.prisma.db.orm.public.Activity.where((a) =>
        a.status.eq(status),
      ).all();
    }
    return this.prisma.db.orm.public.Activity.all();
  }

  async findOne(id: number) {
    const activity = await this.prisma.db.orm.public.Activity.first({ id });
    if (!activity) {
      throw new NotFoundException(`Activity with ID ${id} not found`);
    }
    return activity;
  }

  async create(dto: CreateActivityDto) {
    if (dto.customerId) {
      const customer = await this.prisma.db.orm.public.Customer.first({
        id: dto.customerId,
      });
      if (!customer) {
        throw new BadRequestException(
          `Customer with ID ${dto.customerId} does not exist`,
        );
      }
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

    if (dto.dealId) {
      const deal = await this.prisma.db.orm.public.Deal.first({
        id: dto.dealId,
      });
      if (!deal) {
        throw new BadRequestException(
          `Deal with ID ${dto.dealId} does not exist`,
        );
      }
    }

    const status = dto.status ?? ActivityStatus.PENDING;
    let completedAt: any = null;
    if (dto.completedAt) {
      completedAt = toInstant(dto.completedAt);
    } else if (status === ActivityStatus.COMPLETED) {
      completedAt = nowInstant();
    }

    return this.prisma.db.orm.public.Activity.create({
      type: dto.type,
      subject: dto.subject,
      description: dto.description ?? null,
      status,
      dueDate: toInstant(dto.dueDate),
      completedAt,
      customerId: dto.customerId ?? null,
      leadId: dto.leadId ?? null,
      dealId: dto.dealId ?? null,
      updatedAt: nowInstant(),
    });
  }

  async update(id: number, dto: UpdateActivityDto) {
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

    if (dto.dealId !== undefined && dto.dealId !== null) {
      const deal = await this.prisma.db.orm.public.Deal.first({
        id: dto.dealId,
      });
      if (!deal) {
        throw new BadRequestException(
          `Deal with ID ${dto.dealId} does not exist`,
        );
      }
    }

    const updatePayload: Record<string, any> = {
      ...dto,
      updatedAt: nowInstant(),
    };

    if (dto.dueDate !== undefined) {
      updatePayload.dueDate = toInstant(dto.dueDate);
    }

    if (dto.completedAt !== undefined) {
      updatePayload.completedAt = toInstant(dto.completedAt);
    } else if (dto.status === ActivityStatus.COMPLETED) {
      updatePayload.completedAt = nowInstant();
    } else if (dto.status) {
      updatePayload.completedAt = null;
    }

    const updated = await this.prisma.db.orm.public.Activity.where({
      id,
    }).update(updatePayload);
    return Array.isArray(updated) ? updated[0] : updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.db.orm.public.Activity.where({ id }).delete();
    return { success: true, message: `Activity with ID ${id} deleted` };
  }
}

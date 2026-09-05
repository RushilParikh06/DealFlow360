import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nowInstant, toInstant } from '../common/temporal.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConvertLeadDto } from './dto/convert-lead.dto.js';
import { CreateLeadDto, LeadStatus } from './dto/create-lead.dto.js';
import { UpdateLeadDto } from './dto/update-lead.dto.js';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string, customerId?: number) {
    if (status && customerId) {
      return this.prisma.db.orm.public.Lead.where((l) =>
        l.status.eq(status),
      )
        .where((l) => l.customerId.eq(customerId))
        .all();
    }
    if (status) {
      return this.prisma.db.orm.public.Lead.where((l) =>
        l.status.eq(status),
      ).all();
    }
    if (customerId) {
      return this.prisma.db.orm.public.Lead.where((l) =>
        l.customerId.eq(customerId),
      ).all();
    }
    return this.prisma.db.orm.public.Lead.all();
  }

  async findOne(id: number) {
    const lead = await this.prisma.db.orm.public.Lead.first({ id });
    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }
    return lead;
  }

  async create(dto: CreateLeadDto) {
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

    return this.prisma.db.orm.public.Lead.create({
      title: dto.title,
      source: dto.source ?? null,
      status: dto.status ?? LeadStatus.NEW,
      contactName: dto.contactName ?? null,
      contactEmail: dto.contactEmail ?? null,
      contactPhone: dto.contactPhone ?? null,
      company: dto.company ?? null,
      notes: dto.notes ?? null,
      customerId: dto.customerId ?? null,
      convertedDealId: null,
      updatedAt: nowInstant(),
    });
  }

  async update(id: number, dto: UpdateLeadDto) {
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

    const updated = await this.prisma.db.orm.public.Lead.where({ id }).update({
      ...dto,
      updatedAt: nowInstant(),
    });
    return Array.isArray(updated) ? updated[0] : updated;
  }

  async convert(id: number, dto: ConvertLeadDto) {
    const lead = await this.findOne(id);

    if (lead.status === LeadStatus.CONVERTED) {
      throw new ConflictException(`Lead with ID ${id} has already been converted`);
    }

    let customerId = lead.customerId;

    // If lead not yet attached to a customer, find by email or create new customer
    if (!customerId) {
      if (lead.contactEmail) {
        const existingCustomer =
          await this.prisma.db.orm.public.Customer.where((c) =>
            c.email.eq(lead.contactEmail!),
          ).first();
        if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      }

      if (!customerId) {
        const newCustomer = await this.prisma.db.orm.public.Customer.create({
          name: lead.contactName || lead.title,
          email: lead.contactEmail ?? null,
          phone: lead.contactPhone ?? null,
          company: lead.company ?? null,
          updatedAt: nowInstant(),
        });
        customerId = newCustomer.id;
      }
    }

    // Create Opportunity / Deal
    const deal = await this.prisma.db.orm.public.Deal.create({
      title: dto.dealTitle || `${lead.title} Deal`,
      value: dto.dealValue ?? 0,
      stage: 'QUALIFICATION',
      status: 'OPEN',
      pipeline: dto.pipeline || 'Standard Sales Pipeline',
      expectedCloseDate: toInstant(dto.expectedCloseDate),
      closedAt: null,
      customerId,
      leadId: lead.id,
      updatedAt: nowInstant(),
    });

    // Update lead status and mark as converted
    const updatedLead = await this.prisma.db.orm.public.Lead.where({
      id: lead.id,
    }).update({
      status: LeadStatus.CONVERTED,
      convertedDealId: deal.id,
      customerId,
      updatedAt: nowInstant(),
    });

    return {
      message: 'Lead converted successfully',
      lead: Array.isArray(updatedLead) ? updatedLead[0] : updatedLead,
      deal,
    };
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.db.orm.public.Lead.where({ id }).delete();
    return { success: true, message: `Lead with ID ${id} deleted` };
  }
}

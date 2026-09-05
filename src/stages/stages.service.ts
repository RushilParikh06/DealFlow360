import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nowInstant } from '../common/temporal.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStageDto } from './dto/create-stage.dto.js';
import { UpdateStageDto } from './dto/update-stage.dto.js';

@Injectable()
export class StagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.db.orm.public.PipelineStage.orderBy((s) =>
      s.order.asc(),
    ).all();
  }

  async findOne(id: number) {
    const stage = await this.prisma.db.orm.public.PipelineStage.first({ id });
    if (!stage) {
      throw new NotFoundException(`PipelineStage with ID ${id} not found`);
    }
    return stage;
  }

  async create(dto: CreateStageDto) {
    const existing = await this.prisma.db.orm.public.PipelineStage.where((s) =>
      s.name.eq(dto.name),
    ).first();
    if (existing) {
      throw new ConflictException(
        `Pipeline stage with name "${dto.name}" already exists`,
      );
    }

    return this.prisma.db.orm.public.PipelineStage.create({
      name: dto.name,
      order: dto.order ?? 0,
      probability: dto.probability ?? 0.0,
      updatedAt: nowInstant(),
    });
  }

  async update(id: number, dto: UpdateStageDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.db.orm.public.PipelineStage.where(
        (s) => s.name.eq(dto.name!),
      ).first();
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Pipeline stage with name "${dto.name}" already exists`,
        );
      }
    }

    const updated = await this.prisma.db.orm.public.PipelineStage.where({
      id,
    }).update({
      ...dto,
      updatedAt: nowInstant(),
    });
    return Array.isArray(updated) ? updated[0] : updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.db.orm.public.PipelineStage.where({ id }).delete();
    return { success: true, message: `PipelineStage with ID ${id} deleted` };
  }
}

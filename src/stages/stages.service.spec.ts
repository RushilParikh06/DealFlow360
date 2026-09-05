import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { StagesService } from './stages.service.js';

describe('StagesService', () => {
  let service: StagesService;

  const mockStageOrm = {
    all: vi.fn(),
    first: vi.fn(),
    create: vi.fn(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          PipelineStage: mockStageOrm,
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStageOrm.where.mockReturnThis();
    mockStageOrm.orderBy.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StagesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StagesService>(StagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all stages', async () => {
    mockStageOrm.all.mockResolvedValue([{ id: 1, name: 'Prospecting', order: 1 }]);
    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, name: 'Prospecting', order: 1 }]);
  });

  it('should find one stage', async () => {
    mockStageOrm.first.mockResolvedValue({ id: 1, name: 'Prospecting' });
    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1, name: 'Prospecting' });
  });

  it('should throw NotFoundException if stage not found', async () => {
    mockStageOrm.first.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should create stage', async () => {
    mockStageOrm.first.mockResolvedValue(null);
    mockStageOrm.create.mockResolvedValue({ id: 1, name: 'Prospecting', order: 1 });
    const result = await service.create({ name: 'Prospecting', order: 1 });
    expect(result.id).toBe(1);
  });

  it('should throw ConflictException on duplicate stage name', async () => {
    mockStageOrm.first.mockResolvedValue({ id: 1, name: 'Prospecting' });
    await expect(
      service.create({ name: 'Prospecting', order: 1 }),
    ).rejects.toThrow(ConflictException);
  });

  it('should remove stage', async () => {
    mockStageOrm.first.mockResolvedValue({ id: 1 });
    mockStageOrm.delete.mockResolvedValue(undefined);
    const result = await service.remove(1);
    expect(result.success).toBe(true);
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivitiesService } from './activities.service.js';
import { ActivityStatus, ActivityType } from './dto/create-activity.dto.js';

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  const mockActivityOrm = {
    all: vi.fn(),
    first: vi.fn(),
    create: vi.fn(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockCustomerOrm = {
    first: vi.fn(),
  };

  const mockLeadOrm = {
    first: vi.fn(),
  };

  const mockDealOrm = {
    first: vi.fn(),
  };

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          Activity: mockActivityOrm,
          Customer: mockCustomerOrm,
          Lead: mockLeadOrm,
          Deal: mockDealOrm,
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockActivityOrm.where.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all activities', async () => {
    mockActivityOrm.all.mockResolvedValue([{ id: 1, subject: 'Follow up' }]);
    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, subject: 'Follow up' }]);
  });

  it('should find one activity', async () => {
    mockActivityOrm.first.mockResolvedValue({ id: 1, subject: 'Follow up' });
    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1, subject: 'Follow up' });
  });

  it('should throw NotFoundException if activity not found', async () => {
    mockActivityOrm.first.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should create activity with customer validation', async () => {
    mockCustomerOrm.first.mockResolvedValue({ id: 5 });
    mockActivityOrm.create.mockResolvedValue({
      id: 1,
      type: ActivityType.CALL,
      subject: 'Call customer',
      customerId: 5,
      status: ActivityStatus.PENDING,
    });

    const result = await service.create({
      type: ActivityType.CALL,
      subject: 'Call customer',
      customerId: 5,
    });
    expect(result.id).toBe(1);
  });

  it('should throw BadRequestException if referenced customer not found', async () => {
    mockCustomerOrm.first.mockResolvedValue(null);
    await expect(
      service.create({
        type: ActivityType.CALL,
        subject: 'Call customer',
        customerId: 999,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should update activity and auto-set completedAt on COMPLETED status', async () => {
    mockActivityOrm.first.mockResolvedValueOnce({ id: 1, status: ActivityStatus.PENDING });
    mockActivityOrm.update.mockResolvedValueOnce([
      { id: 1, status: ActivityStatus.COMPLETED, completedAt: new Date() },
    ]);

    const result = await service.update(1, { status: ActivityStatus.COMPLETED });
    expect(result.status).toBe(ActivityStatus.COMPLETED);
    expect(result.completedAt).toBeDefined();
  });

  it('should remove activity', async () => {
    mockActivityOrm.first.mockResolvedValue({ id: 1 });
    mockActivityOrm.delete.mockResolvedValue(undefined);
    const result = await service.remove(1);
    expect(result.success).toBe(true);
  });
});

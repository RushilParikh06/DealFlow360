import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { DealsService } from './deals.service.js';
import { DealStage, DealStatus } from './dto/create-deal.dto.js';

describe('DealsService', () => {
  let service: DealsService;

  const mockDealOrm = {
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

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          Deal: mockDealOrm,
          Customer: mockCustomerOrm,
          Lead: mockLeadOrm,
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDealOrm.where.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DealsService>(DealsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find all deals', async () => {
    mockDealOrm.all.mockResolvedValue([{ id: 1, title: 'Deal 1' }]);
    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, title: 'Deal 1' }]);
  });

  it('should find one deal', async () => {
    mockDealOrm.first.mockResolvedValue({ id: 1, title: 'Deal 1' });
    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1, title: 'Deal 1' });
  });

  it('should throw NotFoundException if deal not found', async () => {
    mockDealOrm.first.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should create a deal with customer validation', async () => {
    mockCustomerOrm.first.mockResolvedValue({ id: 10 });
    mockDealOrm.create.mockResolvedValue({
      id: 1,
      title: 'Deal 1',
      customerId: 10,
      stage: DealStage.PROSPECTING,
      status: DealStatus.OPEN,
    });

    const result = await service.create({
      title: 'Deal 1',
      customerId: 10,
      stage: DealStage.PROSPECTING,
    });
    expect(result.id).toBe(1);
    expect(result.status).toBe(DealStatus.OPEN);
  });

  it('should throw BadRequestException if customer does not exist', async () => {
    mockCustomerOrm.first.mockResolvedValue(null);
    await expect(
      service.create({
        title: 'Deal 1',
        customerId: 999,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should auto-set status to WON on CLOSED_WON stage transition', async () => {
    mockDealOrm.first.mockResolvedValueOnce({ id: 1, title: 'Deal 1', stage: DealStage.PROSPECTING });
    mockDealOrm.update.mockResolvedValueOnce([
      { id: 1, stage: DealStage.CLOSED_WON, status: DealStatus.WON },
    ]);

    const result = await service.updateStage(1, DealStage.CLOSED_WON);
    expect(result.status).toBe(DealStatus.WON);
    expect(result.stage).toBe(DealStage.CLOSED_WON);
  });

  it('should remove deal', async () => {
    mockDealOrm.first.mockResolvedValue({ id: 1 });
    mockDealOrm.delete.mockResolvedValue(undefined);
    const result = await service.remove(1);
    expect(result.success).toBe(true);
  });
});

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { LeadStatus } from './dto/create-lead.dto.js';
import { LeadsService } from './leads.service.js';

describe('LeadsService', () => {
  let service: LeadsService;

  const mockLeadOrm = {
    all: vi.fn(),
    first: vi.fn(),
    create: vi.fn(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockCustomerOrm = {
    first: vi.fn(),
    create: vi.fn(),
    where: vi.fn().mockReturnThis(),
  };

  const mockDealOrm = {
    create: vi.fn(),
  };

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          Lead: mockLeadOrm,
          Customer: mockCustomerOrm,
          Deal: mockDealOrm,
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockLeadOrm.where.mockReturnThis();
    mockCustomerOrm.where.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all leads', async () => {
    mockLeadOrm.all.mockResolvedValue([{ id: 1, title: 'Lead 1' }]);
    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, title: 'Lead 1' }]);
  });

  it('should find one lead', async () => {
    mockLeadOrm.first.mockResolvedValue({ id: 1, title: 'Lead 1' });
    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1, title: 'Lead 1' });
  });

  it('should throw NotFoundException if lead not found', async () => {
    mockLeadOrm.first.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should create lead', async () => {
    mockLeadOrm.create.mockResolvedValue({ id: 1, title: 'Lead 1', status: LeadStatus.NEW });
    const result = await service.create({ title: 'Lead 1' });
    expect(result.id).toBe(1);
  });

  it('should update lead', async () => {
    mockLeadOrm.first.mockResolvedValueOnce({ id: 1, title: 'Lead 1' });
    mockLeadOrm.update.mockResolvedValue([{ id: 1, title: 'Lead 1', status: LeadStatus.QUALIFIED }]);
    const result = await service.update(1, { status: LeadStatus.QUALIFIED });
    expect(result.status).toBe(LeadStatus.QUALIFIED);
  });

  it('should convert lead to deal and customer', async () => {
    mockLeadOrm.first.mockResolvedValueOnce({
      id: 1,
      title: 'Enterprise Lead',
      status: LeadStatus.QUALIFIED,
      contactName: 'Alice',
      contactEmail: 'alice@enterprise.com',
      company: 'Enterprise Inc',
      customerId: null,
    });
    mockCustomerOrm.first.mockResolvedValueOnce(null); // No existing customer
    mockCustomerOrm.create.mockResolvedValueOnce({ id: 10, name: 'Alice' });
    mockDealOrm.create.mockResolvedValueOnce({ id: 100, title: 'Enterprise Lead Deal', customerId: 10 });
    mockLeadOrm.update.mockResolvedValueOnce([{ id: 1, status: LeadStatus.CONVERTED, convertedDealId: 100 }]);

    const result = await service.convert(1, { dealValue: 50000 });
    expect(result.message).toBe('Lead converted successfully');
    expect(result.deal.id).toBe(100);
  });

  it('should throw ConflictException if lead is already converted', async () => {
    mockLeadOrm.first.mockResolvedValueOnce({
      id: 1,
      status: LeadStatus.CONVERTED,
    });
    await expect(service.convert(1, {})).rejects.toThrow(ConflictException);
  });

  it('should remove lead', async () => {
    mockLeadOrm.first.mockResolvedValue({ id: 1 });
    mockLeadOrm.delete.mockResolvedValue(undefined);
    const result = await service.remove(1);
    expect(result.success).toBe(true);
  });
});

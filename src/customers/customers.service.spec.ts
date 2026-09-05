import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { CustomersService } from './customers.service.js';

describe('CustomersService', () => {
  let service: CustomersService;

  const mockCustomerOrm = {
    all: vi.fn(),
    first: vi.fn(),
    create: vi.fn(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          Customer: mockCustomerOrm,
        },
      },
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCustomerOrm.where.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return all customers', async () => {
    mockCustomerOrm.all.mockResolvedValue([{ id: 1, name: 'Acme' }]);
    const result = await service.findAll();
    expect(result).toEqual([{ id: 1, name: 'Acme' }]);
  });

  it('should return customer by id', async () => {
    mockCustomerOrm.first.mockResolvedValue({ id: 1, name: 'Acme' });
    const result = await service.findOne(1);
    expect(result).toEqual({ id: 1, name: 'Acme' });
  });

  it('should throw NotFoundException if customer not found', async () => {
    mockCustomerOrm.first.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should create customer', async () => {
    mockCustomerOrm.first.mockResolvedValue(null);
    mockCustomerOrm.create.mockResolvedValue({ id: 1, name: 'Acme', email: 'a@test.com' });
    const result = await service.create({ name: 'Acme', email: 'a@test.com' });
    expect(result).toEqual({ id: 1, name: 'Acme', email: 'a@test.com' });
  });

  it('should throw ConflictException on duplicate email on create', async () => {
    mockCustomerOrm.first.mockResolvedValue({ id: 2, email: 'a@test.com' });
    await expect(
      service.create({ name: 'Acme', email: 'a@test.com' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should update customer', async () => {
    mockCustomerOrm.first.mockResolvedValueOnce({ id: 1, name: 'Acme' });
    mockCustomerOrm.update.mockResolvedValue([{ id: 1, name: 'Acme Corp' }]);
    const result = await service.update(1, { name: 'Acme Corp' });
    expect(result).toEqual({ id: 1, name: 'Acme Corp' });
  });

  it('should delete customer', async () => {
    mockCustomerOrm.first.mockResolvedValue({ id: 1, name: 'Acme' });
    mockCustomerOrm.delete.mockResolvedValue(undefined);
    const result = await service.remove(1);
    expect(result).toEqual({ success: true, message: 'Customer with ID 1 deleted' });
  });
});

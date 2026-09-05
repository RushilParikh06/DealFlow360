import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: CustomersService;

  const mockCustomersService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        {
          provide: CustomersService,
          useValue: mockCustomersService,
        },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
    service = module.get<CustomersService>(CustomersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll', async () => {
    mockCustomersService.findAll.mockResolvedValue([{ id: 1, name: 'Acme' }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: 1, name: 'Acme' }]);
    expect(mockCustomersService.findAll).toHaveBeenCalled();
  });

  it('should call findOne', async () => {
    mockCustomersService.findOne.mockResolvedValue({ id: 1, name: 'Acme' });
    const result = await controller.findOne(1);
    expect(result).toEqual({ id: 1, name: 'Acme' });
    expect(mockCustomersService.findOne).toHaveBeenCalledWith(1);
  });

  it('should call create', async () => {
    const dto = { name: 'Acme', email: 'acme@test.com' };
    mockCustomersService.create.mockResolvedValue({ id: 1, ...dto });
    const result = await controller.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
    expect(mockCustomersService.create).toHaveBeenCalledWith(dto);
  });

  it('should call update', async () => {
    const dto = { name: 'Acme Updated' };
    mockCustomersService.update.mockResolvedValue({ id: 1, ...dto });
    const result = await controller.update(1, dto);
    expect(result).toEqual({ id: 1, ...dto });
    expect(mockCustomersService.update).toHaveBeenCalledWith(1, dto);
  });

  it('should call remove', async () => {
    mockCustomersService.remove.mockResolvedValue({ success: true });
    const result = await controller.remove(1);
    expect(result).toEqual({ success: true });
    expect(mockCustomersService.remove).toHaveBeenCalledWith(1);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DealsController } from './deals.controller.js';
import { DealsService } from './deals.service.js';
import { DealStage, DealStatus } from './dto/create-deal.dto.js';

describe('DealsController', () => {
  let controller: DealsController;

  const mockDealsService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStage: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealsController],
      providers: [
        {
          provide: DealsService,
          useValue: mockDealsService,
        },
      ],
    }).compile();

    controller = module.get<DealsController>(DealsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll', async () => {
    mockDealsService.findAll.mockResolvedValue([{ id: 1, title: 'Big Deal' }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: 1, title: 'Big Deal' }]);
    expect(mockDealsService.findAll).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('should call findOne', async () => {
    mockDealsService.findOne.mockResolvedValue({ id: 1, title: 'Big Deal' });
    const result = await controller.findOne(1);
    expect(result).toEqual({ id: 1, title: 'Big Deal' });
    expect(mockDealsService.findOne).toHaveBeenCalledWith(1);
  });

  it('should call create', async () => {
    const dto = {
      title: 'Big Deal',
      value: 10000,
      customerId: 1,
      stage: DealStage.PROSPECTING,
    };
    mockDealsService.create.mockResolvedValue({ id: 1, ...dto });
    const result = await controller.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
    expect(mockDealsService.create).toHaveBeenCalledWith(dto);
  });

  it('should call updateStage', async () => {
    mockDealsService.updateStage.mockResolvedValue({ id: 1, stage: DealStage.CLOSED_WON, status: DealStatus.WON });
    const result = await controller.updateStage(1, { stage: DealStage.CLOSED_WON });
    expect(result.status).toBe(DealStatus.WON);
    expect(mockDealsService.updateStage).toHaveBeenCalledWith(1, DealStage.CLOSED_WON);
  });

  it('should call remove', async () => {
    mockDealsService.remove.mockResolvedValue({ success: true });
    const result = await controller.remove(1);
    expect(result).toEqual({ success: true });
    expect(mockDealsService.remove).toHaveBeenCalledWith(1);
  });
});

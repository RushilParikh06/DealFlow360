import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StagesController } from './stages.controller.js';
import { StagesService } from './stages.service.js';

describe('StagesController', () => {
  let controller: StagesController;

  const mockStagesService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StagesController],
      providers: [
        {
          provide: StagesService,
          useValue: mockStagesService,
        },
      ],
    }).compile();

    controller = module.get<StagesController>(StagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll', async () => {
    mockStagesService.findAll.mockResolvedValue([{ id: 1, name: 'Lead' }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: 1, name: 'Lead' }]);
    expect(mockStagesService.findAll).toHaveBeenCalled();
  });

  it('should call findOne', async () => {
    mockStagesService.findOne.mockResolvedValue({ id: 1, name: 'Lead' });
    const result = await controller.findOne(1);
    expect(result).toEqual({ id: 1, name: 'Lead' });
    expect(mockStagesService.findOne).toHaveBeenCalledWith(1);
  });

  it('should call create', async () => {
    const dto = { name: 'Lead', order: 1 };
    mockStagesService.create.mockResolvedValue({ id: 1, ...dto });
    const result = await controller.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
    expect(mockStagesService.create).toHaveBeenCalledWith(dto);
  });

  it('should call update', async () => {
    const dto = { name: 'Qualified' };
    mockStagesService.update.mockResolvedValue({ id: 1, name: 'Qualified' });
    const result = await controller.update(1, dto);
    expect(result.name).toBe('Qualified');
    expect(mockStagesService.update).toHaveBeenCalledWith(1, dto);
  });

  it('should call remove', async () => {
    mockStagesService.remove.mockResolvedValue({ success: true });
    const result = await controller.remove(1);
    expect(result).toEqual({ success: true });
    expect(mockStagesService.remove).toHaveBeenCalledWith(1);
  });
});

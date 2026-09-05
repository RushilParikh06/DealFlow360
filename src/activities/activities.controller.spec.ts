import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivitiesController } from './activities.controller.js';
import { ActivitiesService } from './activities.service.js';
import { ActivityStatus, ActivityType } from './dto/create-activity.dto.js';

describe('ActivitiesController', () => {
  let controller: ActivitiesController;

  const mockActivitiesService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
      ],
    }).compile();

    controller = module.get<ActivitiesController>(ActivitiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll', async () => {
    mockActivitiesService.findAll.mockResolvedValue([{ id: 1, subject: 'Follow up' }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: 1, subject: 'Follow up' }]);
    expect(mockActivitiesService.findAll).toHaveBeenCalled();
  });

  it('should call findOne', async () => {
    mockActivitiesService.findOne.mockResolvedValue({ id: 1, subject: 'Follow up' });
    const result = await controller.findOne(1);
    expect(result).toEqual({ id: 1, subject: 'Follow up' });
    expect(mockActivitiesService.findOne).toHaveBeenCalledWith(1);
  });

  it('should call create', async () => {
    const dto = {
      type: ActivityType.CALL,
      subject: 'Intro Call',
      customerId: 1,
    };
    mockActivitiesService.create.mockResolvedValue({ id: 1, ...dto, status: ActivityStatus.PENDING });
    const result = await controller.create(dto);
    expect(result).toEqual({ id: 1, ...dto, status: ActivityStatus.PENDING });
    expect(mockActivitiesService.create).toHaveBeenCalledWith(dto);
  });

  it('should call update', async () => {
    const dto = { status: ActivityStatus.COMPLETED };
    mockActivitiesService.update.mockResolvedValue({ id: 1, status: ActivityStatus.COMPLETED });
    const result = await controller.update(1, dto);
    expect(result.status).toBe(ActivityStatus.COMPLETED);
    expect(mockActivitiesService.update).toHaveBeenCalledWith(1, dto);
  });

  it('should call remove', async () => {
    mockActivitiesService.remove.mockResolvedValue({ success: true });
    const result = await controller.remove(1);
    expect(result).toEqual({ success: true });
    expect(mockActivitiesService.remove).toHaveBeenCalledWith(1);
  });
});

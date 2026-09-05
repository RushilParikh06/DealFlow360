import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadStatus } from './dto/create-lead.dto.js';
import { LeadsController } from './leads.controller.js';
import { LeadsService } from './leads.service.js';

describe('LeadsController', () => {
  let controller: LeadsController;

  const mockLeadsService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    convert: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: LeadsService,
          useValue: mockLeadsService,
        },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call findAll', async () => {
    mockLeadsService.findAll.mockResolvedValue([{ id: 1, title: 'Inbound Lead' }]);
    const result = await controller.findAll();
    expect(result).toEqual([{ id: 1, title: 'Inbound Lead' }]);
    expect(mockLeadsService.findAll).toHaveBeenCalledWith(undefined, undefined);
  });

  it('should call findOne', async () => {
    mockLeadsService.findOne.mockResolvedValue({ id: 1, title: 'Inbound Lead' });
    const result = await controller.findOne(1);
    expect(result).toEqual({ id: 1, title: 'Inbound Lead' });
    expect(mockLeadsService.findOne).toHaveBeenCalledWith(1);
  });

  it('should call create', async () => {
    const dto = { title: 'New Lead', status: LeadStatus.NEW };
    mockLeadsService.create.mockResolvedValue({ id: 1, ...dto });
    const result = await controller.create(dto);
    expect(result).toEqual({ id: 1, ...dto });
    expect(mockLeadsService.create).toHaveBeenCalledWith(dto);
  });

  it('should call update', async () => {
    const dto = { status: LeadStatus.QUALIFIED };
    mockLeadsService.update.mockResolvedValue({ id: 1, title: 'Lead', status: LeadStatus.QUALIFIED });
    const result = await controller.update(1, dto);
    expect(result).toEqual({ id: 1, title: 'Lead', status: LeadStatus.QUALIFIED });
    expect(mockLeadsService.update).toHaveBeenCalledWith(1, dto);
  });

  it('should call convert', async () => {
    mockLeadsService.convert.mockResolvedValue({ message: 'Lead converted successfully' });
    const result = await controller.convert(1, { dealTitle: 'Converted Deal' });
    expect(result).toEqual({ message: 'Lead converted successfully' });
    expect(mockLeadsService.convert).toHaveBeenCalledWith(1, { dealTitle: 'Converted Deal' });
  });

  it('should call remove', async () => {
    mockLeadsService.remove.mockResolvedValue({ success: true });
    const result = await controller.remove(1);
    expect(result).toEqual({ success: true });
    expect(mockLeadsService.remove).toHaveBeenCalledWith(1);
  });
});

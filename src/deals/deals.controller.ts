import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DealsService } from './deals.service.js';
import { CreateDealDto } from './dto/create-deal.dto.js';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto.js';
import { UpdateDealDto } from './dto/update-deal.dto.js';

@Controller('deals')
export class DealsController {
  constructor(protected readonly dealsService: DealsService) {}

  @Get()
  findAll(
    @Query('stage') stage?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    const custId = customerId ? Number(customerId) : undefined;
    return this.dealsService.findAll(stage, status, custId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dealsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDealDto) {
    return this.dealsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.update(id, dto);
  }

  @Patch(':id/stage')
  updateStage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDealStageDto,
  ) {
    return this.dealsService.updateStage(id, dto.stage);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.dealsService.remove(id);
  }
}

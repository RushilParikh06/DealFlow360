// B1 owned. plan.md section 8: /quotes CRUD, lines, submit, confirm.
// Route prefix `quotes` also carries B2's /evaluate and /risk sub-resources -
// Nest merges controllers on the same path, nobody edits anybody else's file.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import {
  AddQuotationLineDto,
  CreateQuotationDto,
  ListQuotesQueryDto,
  UpdateQuotationLineDto,
} from '../dto/quote.dto';
import { QuotesService } from '../services/quotes.service';

@Controller('quotes')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Get()
  list(@Query() query: ListQuotesQueryDto) {
    return this.quotes.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.quotes.get(id);
  }

  @Post()
  create(@Body() dto: CreateQuotationDto, @CurrentUser() actor: AuthUser) {
    return this.quotes.create(dto, actor);
  }

  @Post(':id/lines')
  addLine(@Param('id') id: string, @Body() dto: AddQuotationLineDto) {
    return this.quotes.addLine(id, dto);
  }

  @Patch(':id/lines/:lineId')
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: UpdateQuotationLineDto) {
    return this.quotes.updateLine(id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  deleteLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.quotes.deleteLine(id, lineId);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.quotes.submit(id, actor);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.quotes.confirm(id, actor);
  }
}

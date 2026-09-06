// B1 owned. plan.md section 8: /quotes CRUD, lines, submit, confirm.
// Route prefix `quotes` also carries B2's /evaluate and /risk sub-resources -
// Nest merges controllers on the same path, nobody edits anybody else's file.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import {
  AddNoteDto,
  AddQuotationLineDto,
  CreateQuotationDto,
  ListQuotesQueryDto,
  UpdateQuotationLineDto,
} from '../dto/quote.dto';
import { QuotesService } from '../services/quotes.service';
import { NegotiationService } from '../services/negotiation.service';

// CUSTOMER is intentionally listed at the class level: the read routes and the
// negotiation routes scope themselves to the actor's own quote (see below), so
// a customer token reaches only its own rows. The write routes that a customer
// must never touch (create, lines, submit, confirm) re-declare a narrower
// @Roles WITHOUT CUSTOMER, which the RolesGuard enforces per-handler.
@Controller('quotes')
@UseGuards(AuthGuard, RolesGuard)
@Roles('CUSTOMER', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
export class QuotesController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly negotiation: NegotiationService,
  ) {}

  @Get()
  list(@Query() query: ListQuotesQueryDto, @CurrentUser() actor: AuthUser) {
    // A customer sees only their own quotes, no matter what customerId they pass.
    if (actor.role === 'CUSTOMER') {
      return this.quotes.list({ ...query, customerId: actor.customerId ?? '__none__' });
    }
    return this.quotes.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.quotes.get(id, actor);
  }

  @Get(':id/notes')
  listNotes(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.negotiation.listNotes(id, actor);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: AddNoteDto, @CurrentUser() actor: AuthUser) {
    return this.negotiation.addNote(id, dto, actor);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.negotiation.accept(id, actor);
  }

  @Post()
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  create(@Body() dto: CreateQuotationDto, @CurrentUser() actor: AuthUser) {
    return this.quotes.create(dto, actor);
  }

  @Post(':id/lines')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  addLine(@Param('id') id: string, @Body() dto: AddQuotationLineDto) {
    return this.quotes.addLine(id, dto);
  }

  @Patch(':id/lines/:lineId')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  updateLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: UpdateQuotationLineDto) {
    return this.quotes.updateLine(id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  deleteLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.quotes.deleteLine(id, lineId);
  }

  @Post(':id/submit')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  submit(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.quotes.submit(id, actor);
  }

  @Post(':id/confirm')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  confirm(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.quotes.confirm(id, actor);
  }
}

// B2 OWNED. plan.md section 8:
//   POST /api/v1/quotes/:id/evaluate      re-run the engine, route approvals
//   GET  /api/v1/quotes/:id/risk          latest evaluation (dashboard badge)
//   GET  /api/v1/quotes/:id/risk/history  append-only trail
//
// Route prefix note: the path segment is `quotes`, which is B1's noun. That is
// deliberate and agreed — B1 owns /quotes CRUD, B2 owns the /evaluate and /risk
// sub-resources. Nest merges them; nobody edits anybody else's file.

import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { EvaluationResponse } from '@dealflow/contracts';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import { EvaluationHistoryQueryDto } from '../dto/evaluate.dto';
import { EvaluationService } from '../services/evaluation.service';

@Controller('quotes')
@UseGuards(AuthGuard, RolesGuard)
export class EvaluationController {
  constructor(private readonly evaluations: EvaluationService) {}

  /**
   * Idempotent. Same quote + same lines + same policies => same inputHash => the
   * existing evaluation comes back instead of a duplicate row. Safe to call from
   * a line-edit autosave, which is exactly how the UI will use it.
   */
  @Post(':id/evaluate')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  evaluate(@Param('id') id: string, @CurrentUser() actor: AuthUser): Promise<EvaluationResponse> {
    return this.evaluations.evaluate(id, actor);
  }

  @Get(':id/risk')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  latest(@Param('id') id: string): Promise<EvaluationResponse | null> {
    return this.evaluations.latestFor(id);
  }

  @Get(':id/risk/history')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  history(
    @Param('id') id: string,
    @Query() query: EvaluationHistoryQueryDto,
  ): Promise<EvaluationResponse[]> {
    return this.evaluations.history(id, query.take);
  }
}

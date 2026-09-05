// B2 OWNED.
//   GET   /api/v1/approvals            my queue
//   GET   /api/v1/approvals/:id        detail + the evaluation AS IT WAS JUDGED
//   PATCH /api/v1/approvals/:id        approve / reject / return
//
// The queue is role-scoped in the service, not here: a SALES_MANAGER sees steps
// where the front of the queue is a manager step, FINANCE sees finance steps,
// ADMIN sees everything. Doing it in the service keeps it testable.

import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { ApprovalDetail, ApprovalListItem, Paginated } from '@dealflow/contracts';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import { ApprovalActionDto, ListApprovalsQueryDto } from '../dto/approval.dto';
import { ApprovalService } from '../services/approval.service';

@Controller('approvals')
@UseGuards(AuthGuard, RolesGuard)
export class ApprovalController {
  constructor(private readonly approvals: ApprovalService) {}

  @Get()
  @Roles('SALES_MANAGER', 'FINANCE', 'ADMIN')
  list(
    @Query() query: ListApprovalsQueryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<Paginated<ApprovalListItem>> {
    // A manager cannot spy on the finance queue by passing ?role=FINANCE.
    const assignedRole =
      actor.role === 'ADMIN'
        ? query.role
        : actor.role === 'FINANCE'
          ? 'FINANCE'
          : 'SALES_MANAGER';

    return this.approvals.list({
      status: query.status,
      assignedRole,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get(':id')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  detail(@Param('id') id: string): Promise<ApprovalDetail> {
    return this.approvals.detail(id);
  }

  @Patch(':id')
  @Roles('SALES_MANAGER', 'FINANCE', 'ADMIN')
  act(
    @Param('id') id: string,
    @Body() body: ApprovalActionDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<ApprovalDetail> {
    return this.approvals.act(id, body.action, actor, body.reason);
  }
}

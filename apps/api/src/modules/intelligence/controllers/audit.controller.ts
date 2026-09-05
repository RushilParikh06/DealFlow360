// B2 OWNED.
//   GET /api/v1/audit                     filtered log
//   GET /api/v1/quotes/:id/audit-trail    everything that happened to one quote
//
// Read-only by construction: AuditService has no public write method that works
// outside a transaction, so there is no endpoint that could forge a row.

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { AuditEntry } from '@dealflow/contracts';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { AuditQueryDto } from '../dto/audit.dto';
import { AuditService } from '../services/audit.service';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('audit')
  @Roles('SALES_MANAGER', 'FINANCE', 'ADMIN')
  list(@Query() query: AuditQueryDto): Promise<AuditEntry[]> {
    return this.audit.list(query);
  }

  @Get('quotes/:id/audit-trail')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  trail(@Param('id') id: string): Promise<AuditEntry[]> {
    return this.audit.trailForQuotation(id);
  }
}

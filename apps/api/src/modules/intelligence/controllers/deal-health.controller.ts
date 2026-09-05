// B2 OWNED.
//   GET  /api/v1/deal-health                    dashboard list
//   POST /api/v1/deal-health/refresh            re-run detection over open quotes
//   GET  /api/v1/deal-health/quote/:id          findings for one quote
//   POST /api/v1/deal-health/:eventId/nudge     record a chase

import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { DealHealthItem } from '@dealflow/contracts';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import { DealHealthQueryDto } from '../dto/deal-health.dto';
import { DealHealthService } from '../services/deal-health.service';

@Controller('deal-health')
@UseGuards(AuthGuard, RolesGuard)
export class DealHealthController {
  constructor(private readonly health: DealHealthService) {}

  @Get()
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  list(@Query() query: DealHealthQueryDto): Promise<DealHealthItem[]> {
    return this.health.list({
      severity: query.severity,
      includeResolved: query.includeResolved === 'true',
    });
  }

  /** The demo presses this. Idempotent, so pressing it twice is not a story. */
  @Post('refresh')
  @Roles('SALES_MANAGER', 'FINANCE', 'ADMIN')
  refresh(): Promise<{ scanned: number; findings: number }> {
    return this.health.sweep();
  }

  @Get('quote/:id')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  forQuote(@Param('id') id: string): Promise<DealHealthItem[]> {
    return this.health.detectFor(id);
  }

  @Post(':eventId/nudge')
  @Roles('SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN')
  nudge(@Param('eventId') eventId: string, @CurrentUser() actor: AuthUser): Promise<DealHealthItem> {
    return this.health.nudge(eventId, actor);
  }
}

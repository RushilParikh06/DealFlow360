// B2 OWNED. Screen 15, the admin ceiling editor. ADMIN only.
//   GET   /api/v1/discount-policies
//   PATCH /api/v1/discount-policies/:id

import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { DiscountPolicyView } from '@dealflow/contracts';
import { AuthGuard } from '../../shared/auth.guard';
import { Roles, RolesGuard } from '../../shared/roles.guard';
import { CurrentUser, type AuthUser } from '../../shared/current-user';
import { UpdatePolicyDto } from '../dto/policy.dto';
import { PolicyService } from '../services/policy.service';

@Controller('discount-policies')
@UseGuards(AuthGuard, RolesGuard)
export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  @Get()
  @Roles('SALES_MANAGER', 'FINANCE', 'ADMIN')
  list(): Promise<DiscountPolicyView[]> {
    return this.policies.list();
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePolicyDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<DiscountPolicyView> {
    return this.policies.update(id, body, actor);
  }
}

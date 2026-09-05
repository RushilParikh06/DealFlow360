// GROUP OWNED. Authorization is checked server side on every endpoint
// (plan.md definition of done). Never by hiding UI.

import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type UserRole } from '@dealflow/contracts';
import { AppError } from './app-error';
import type { AuthUser } from './current-user';

export const ROLES_KEY = 'dealflow:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw new AppError(ErrorCode.UNAUTHENTICATED, 'No authenticated user on request.');

    if (!required.includes(user.role)) {
      throw new AppError(ErrorCode.FORBIDDEN, `Role ${user.role} cannot perform this action.`, {
        required,
      });
    }
    return true;
  }
}

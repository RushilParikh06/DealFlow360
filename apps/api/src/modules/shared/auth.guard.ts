// GROUP OWNED - and TEMPORARY in its dev half.
//
// B1 owns auth. Until B1's JwtAuthGuard exists, AUTH_MODE=dev lets B2 exercise
// the approval chain by sending two headers:
//
//   x-dev-user-id: usr_manager
//   x-dev-role: SALES_MANAGER
//
// That is the whole trick that keeps B2 off the critical path for three hours.
// When B1 lands the real guard, flip AUTH_MODE=jwt in .env and delete the dev
// branch below. Nothing else changes, because every handler reads @CurrentUser.

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode, UserRole } from '@dealflow/contracts';
import { AppError } from './app-error';
import type { AuthUser } from './current-user';

const VALID_ROLES = new Set<string>(Object.values(UserRole));

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();

    if ((process.env.AUTH_MODE ?? 'dev') === 'dev') {
      const id = req.headers['x-dev-user-id'];
      const role = req.headers['x-dev-role'];

      if (!id || !role) {
        throw new AppError(
          ErrorCode.UNAUTHENTICATED,
          'AUTH_MODE=dev requires x-dev-user-id and x-dev-role headers.',
        );
      }
      if (!VALID_ROLES.has(role)) {
        throw new AppError(ErrorCode.UNAUTHENTICATED, `Unknown role "${role}".`);
      }

      req.user = {
        id,
        role: role as UserRole,
        customerId: req.headers['x-dev-customer-id'] ?? null,
      };
      return true;
    }

    // AUTH_MODE=jwt - B1 replaces this branch with the real verification.
    throw new AppError(
      ErrorCode.UNAUTHENTICATED,
      'AUTH_MODE=jwt but B1 JwtAuthGuard is not wired yet.',
    );
  }
}

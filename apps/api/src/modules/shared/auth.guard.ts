// GROUP OWNED - and TEMPORARY in its dev half.
//
// AUTH_MODE=dev still lets anyone exercise a role-guarded endpoint by sending
// two headers, useful for exploring the API without a login round trip:
//
//   x-dev-user-id: usr_manager
//   x-dev-role: SALES_MANAGER
//
// AUTH_MODE=jwt is the real path: B1's guard below verifies the bearer token
// signed by apps/api/src/modules/sales/services/auth.service.ts.

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode, UserRole } from '@dealflow/contracts';
import { AppError } from './app-error';
import type { AuthUser } from './current-user';
import { verifyJwt } from '../sales/auth/jwt';

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

    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Missing bearer token.');
    }

    const payload = verifyJwt(auth.slice('Bearer '.length), process.env.JWT_SECRET ?? 'dev-only-change-me');
    // A refresh token is long-lived and revocable through refresh_tokens; the
    // guard never consults that table, so it must not accept one as a bearer.
    if (payload.typ !== 'access') {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'A refresh token cannot be used as a bearer token.');
    }
    if (!VALID_ROLES.has(payload.role)) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, `Unknown role "${payload.role}".`);
    }

    req.user = { id: payload.sub, role: payload.role as UserRole, customerId: payload.customerId };
    return true;
  }
}

// GROUP OWNED.
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ErrorCode, type UserRole } from '@dealflow/contracts';
import { AppError } from './app-error';

export interface AuthUser {
  id: string;
  role: UserRole;
  customerId: string | null;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
  if (!user) throw new AppError(ErrorCode.UNAUTHENTICATED, 'No authenticated user on request.');
  return user;
});

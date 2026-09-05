// B1 owned. POST /auth/login | /auth/signup | /auth/refresh (plan.md section 8).
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ErrorCode, UserRole } from '@dealflow/contracts';
import { AppError } from '../../shared/app-error';
import { PrismaService } from '../../shared/prisma.service';
import { hashPassword, verifyPassword } from '../auth/password';
import { signJwt, verifyJwt, ttlToSeconds } from '../auth/jwt';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '7d';
const secret = (): string => process.env.JWT_SECRET ?? 'dev-only-change-me';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private async issueTokens(user: { id: string; role: string; customerId: string | null }): Promise<TokenPair> {
    const claims = { sub: user.id, role: user.role, customerId: user.customerId };
    const accessToken = signJwt({ ...claims, typ: 'access' }, secret(), ACCESS_TTL);
    const refreshToken = signJwt({ ...claims, typ: 'refresh' }, secret(), REFRESH_TTL);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ttlToSeconds(REFRESH_TTL) * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  /** Internal signup only - SALES_REP by default. Customer accounts are provisioned separately. */
  async signup(email: string, name: string, password: string): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'An account with this email already exists.', { email });
    }
    const user = await this.prisma.user.create({
      data: { email, name, passwordHash: hashPassword(password), role: UserRole.SALES_REP },
    });
    return this.issueTokens({ id: user.id, role: user.role, customerId: user.customerId });
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Invalid email or password.');
    }
    return this.issueTokens({ id: user.id, role: user.role, customerId: user.customerId });
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = verifyJwt(refreshToken, secret());
    if (payload.typ !== 'refresh') {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Not a refresh token.');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Refresh token is invalid or revoked.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'User no longer exists.');
    }

    // rotate: revoke the used token, issue a new pair
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens({ id: user.id, role: user.role, customerId: user.customerId });
  }
}

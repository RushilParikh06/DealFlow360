// B1 owned. Plain HMAC-SHA256 JWT (header.payload.signature, base64url) using
// only node:crypto - the stack calls for JWT access/refresh tokens, not for a
// specific library, and this is a dozen lines against adding one.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../shared/app-error';
import { ErrorCode } from '@dealflow/contracts';

export interface JwtPayload {
  sub: string; // user id
  role: string;
  customerId: string | null;
  exp: number; // unix seconds
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/** ttl like "15m", "7d", "30s". */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`invalid ttl "${ttl}"`);
  const value = Number(match[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return value * unit;
}

export function signJwt(payload: Omit<JwtPayload, 'exp'>, secret: string, ttl: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + ttlToSeconds(ttl);
  const body = base64url(JSON.stringify({ ...payload, exp }));
  const signature = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Malformed token.');
  }
  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Invalid token signature.');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Token expired.');
  }
  return payload;
}

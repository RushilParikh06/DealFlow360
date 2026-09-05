// B1 owned. Format `scrypt$salt$hash` matches prisma/seed/base.seed.ts's
// placeholder exactly, so seeded users log in without a re-seed.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(8).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, KEY_LEN).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hex] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = scryptSync(password, salt, KEY_LEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

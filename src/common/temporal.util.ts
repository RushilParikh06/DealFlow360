import 'temporal-polyfill/global';
import { Temporal } from 'temporal-polyfill';

export function nowInstant(): any {
  return Temporal.Now.instant();
}

export function toInstant(value?: string | Date | null): any {
  if (!value) return null;
  if (typeof value === 'string') {
    return Temporal.Instant.from(new Date(value).toISOString());
  }
  if (value instanceof Date) {
    return Temporal.Instant.from(value.toISOString());
  }
  return value;
}

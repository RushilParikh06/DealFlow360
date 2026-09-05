// Outside apps/api's jest rootDir - run directly: node --test prisma/seed/catalog.seed.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalogSeed } from './catalog.seed.ts';

test('every seeded product and inventory row references a real id', () => {
  assert.deepEqual(validateCatalogSeed(), []);
});

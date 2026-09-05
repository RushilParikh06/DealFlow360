/**
 * The engine specs import nothing but the engine, so `pnpm test` runs with no
 * database, no container and no network. That is what makes it usable at hour 20.
 */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json', isolatedModules: true }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Points at the built output (run `pnpm --filter @dealflow/contracts build`
  // first), not packages/contracts/src/*.ts directly: jest's resolver won't
  // locate a .ts file living outside rootDir even with the right absolute
  // path here ("Could not locate module ... mapped as ..."), because it's
  // never scanned into the haste map. Plain compiled JS has no such problem.
  moduleNameMapper: {
    '^@dealflow/contracts$': '<rootDir>/../../../packages/contracts/dist/index',
    '^@dealflow/contracts/(.*)$': '<rootDir>/../../../packages/contracts/dist/$1',
  },
  collectCoverageFrom: ['modules/intelligence/engine/**/*.ts'],
};

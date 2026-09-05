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
  moduleNameMapper: {
    '^@dealflow/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
    '^@dealflow/contracts/(.*)$': '<rootDir>/../../../packages/contracts/src/$1',
  },
  collectCoverageFrom: ['modules/intelligence/engine/**/*.ts'],
};

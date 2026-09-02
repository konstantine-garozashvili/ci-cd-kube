/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // templates/ holds source for *generated* projects, not code this package
  // runs. Those files are exercised by scripts/smoke.js instead.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/templates/'],
  collectCoverageFrom: ['lib/**/*.js', 'bin/**/*.js'],
  coverageReporters: ['text', 'lcov'],
};

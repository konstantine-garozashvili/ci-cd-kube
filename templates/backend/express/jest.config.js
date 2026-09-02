/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/public/**'],
  coverageThreshold: {
    global: { branches: 60, functions: 60, lines: 70, statements: 70 },
  },
  coverageReporters: ['text', 'lcov'],
};

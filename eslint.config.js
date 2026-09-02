'use strict';

const js = require('@eslint/js');
const globals = require('globals');

/**
 * Flat config. ESLint 10 removed .eslintrc support entirely, so this is the
 * only supported format.
 */
module.exports = [
  {
    // templates/ holds source for *generated* projects — JSX, Vue SFCs and
    // TypeScript that this config has no parser for. Each template ships its
    // own config and is linted by scripts/smoke.js instead.
    ignores: ['templates/**', 'node_modules/**', 'coverage/**', '.smoke/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
];

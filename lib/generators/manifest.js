'use strict';

const { NODE_ENGINE_RANGE } = require('../constants');

/**
 * Generates every package.json in a scaffolded project.
 *
 * The script *names* are deliberately identical in monorepo and single-package
 * mode, so the generated CI workflow can call `npm run test:unit` without ever
 * knowing which layout it is running in.
 */

/** Root manifest for the generated project. */
function generateRootPackageJson(options) {
  const { projectName, isFullstack, database, backend, frontend } = options;

  const devDependencies = {
    '@playwright/test': '^1.44.0',
    husky: '^9.0.11',
    'lint-staged': '^15.2.5',
    prettier: '^3.2.5',
  };

  const lintStaged = {
    '*.{js,jsx,ts,tsx,vue}': ['prettier --write', 'eslint --fix'],
    '*.{json,md,yml,yaml,css,html}': ['prettier --write'],
  };

  if (!isFullstack) {
    // Single package: the root *is* the backend, so backend scripts live here.
    return {
      name: projectName,
      version: '1.0.0',
      private: true,
      description: `Cloud-native ${backend} microservice with a DevSecOps pipeline`,
      main: backend === 'nestjs' ? 'dist/main.js' : 'src/server.js',
      engines: { node: NODE_ENGINE_RANGE, npm: '>=10.0.0' },
      scripts: {
        ...backendScripts(options),
        'test:e2e': 'playwright test',
        format: 'prettier --write .',
        'format:check': 'prettier --check .',
        'scan:secrets': 'gitleaks detect --verbose --redact',
        'scan:sast': 'semgrep scan --config="p/owasp-top-ten" src',
        prepare: 'husky || true',
      },
      'lint-staged': lintStaged,
      dependencies: backendDependencies(options),
      devDependencies: { ...backendDevDependencies(options), ...devDependencies },
      // NestJS compiles TypeScript, so Jest needs the ts-jest transform here
      // too — not only in the workspace manifest.
      ...(backend === 'nestjs' ? { jest: nestJestConfig() } : {}),
    };
  }

  return {
    name: projectName,
    version: '1.0.0',
    private: true,
    description: `Fullstack ${backend} + ${frontend} monorepo with a DevSecOps pipeline`,
    workspaces: ['backend', 'frontend'],
    engines: { node: NODE_ENGINE_RANGE, npm: '>=10.0.0' },
    scripts: {
      dev: 'concurrently -k -n "API,UI" -c "cyan,magenta" "npm:dev:backend" "npm:dev:frontend"',
      'dev:backend': 'npm run dev --workspace=backend',
      'dev:frontend': 'npm run dev --workspace=frontend',

      build: 'npm run build --workspaces --if-present',
      'build:backend': 'npm run build --workspace=backend --if-present',
      'build:frontend': 'npm run build --workspace=frontend',

      // `start` boots the API only: CI's DAST probe and Playwright rely on it.
      start: 'npm run start --workspace=backend',
      'start:frontend': 'npm run preview --workspace=frontend',

      lint: 'npm run lint --workspaces --if-present',
      'lint:fix': 'npm run lint:fix --workspaces --if-present',
      format: 'prettier --write .',
      'format:check': 'prettier --check .',

      test: 'npm run test:unit && npm run test:integration',
      'test:unit': 'npm run test:unit --workspace=backend',
      'test:integration': 'npm run test:integration --workspace=backend',
      'test:e2e': 'playwright test',

      'scan:secrets': 'gitleaks detect --verbose --redact',
      'scan:sast': `semgrep scan --config="p/owasp-top-ten" ${options.sastPaths}`,

      ...databaseScripts(database, true),
      prepare: 'husky || true',
    },
    'lint-staged': lintStaged,
    devDependencies: { ...devDependencies, concurrently: '^8.2.2' },
  };
}

function databaseScripts(database, isWorkspace) {
  if (database !== 'postgres') {
    return {};
  }
  const prefix = isWorkspace ? 'npm run db:' : 'prisma ';
  const suffix = isWorkspace ? ' --workspace=backend' : '';
  return isWorkspace
    ? {
        'db:generate': `${prefix}generate${suffix}`,
        'db:migrate': `${prefix}migrate${suffix}`,
        'db:push': `${prefix}push${suffix}`,
        'db:studio': `${prefix}studio${suffix}`,
      }
    : {
        'db:generate': 'prisma generate',
        'db:migrate': 'prisma migrate dev',
        'db:push': 'prisma db push',
        'db:studio': 'prisma studio',
      };
}

function backendScripts(options) {
  const { backend, database } = options;

  const common = {
    ...(database === 'postgres' ? { postinstall: 'prisma generate' } : {}),
    ...databaseScripts(database, false),
  };

  if (backend === 'nestjs') {
    return {
      build: 'nest build',
      start: 'node dist/main.js',
      dev: 'nest start --watch',
      lint: 'eslint "src/**/*.ts" "tests/**/*.ts"',
      'lint:fix': 'eslint "src/**/*.ts" "tests/**/*.ts" --fix',
      test: 'npm run test:unit && npm run test:integration',
      'test:unit': 'jest --runInBand --testPathPattern=tests/unit',
      'test:integration': 'jest --runInBand --testPathPattern=tests/integration',
      'test:coverage': 'jest --coverage',
      ...common,
    };
  }

  if (backend === 'hono') {
    return {
      start: 'node src/server.js',
      dev: 'node --watch src/server.js',
      build: 'echo "No build step required for Hono"',
      lint: 'eslint "src/**/*.js" "tests/**/*.js"',
      'lint:fix': 'eslint "src/**/*.js" "tests/**/*.js" --fix',
      test: 'npm run test:unit && npm run test:integration',
      // Glob form rather than a bare directory: Node's test runner treats a
      // directory argument as a file to execute on current releases.
      'test:unit': 'node --test "tests/unit/**/*.test.js"',
      'test:integration': 'node --test "tests/integration/**/*.test.js"',
      ...common,
    };
  }

  return {
    start: 'node src/server.js',
    dev: 'node --watch src/server.js',
    build: 'echo "No build step required for Express"',
    lint: 'eslint "src/**/*.js" "tests/**/*.js"',
    'lint:fix': 'eslint "src/**/*.js" "tests/**/*.js" --fix',
    test: 'npm run test:unit && npm run test:integration',
    'test:unit': 'jest tests/unit --runInBand',
    'test:integration': 'jest tests/integration --runInBand',
    'test:coverage': 'jest --coverage',
    ...common,
  };
}

function backendDependencies({ backend, database }) {
  const db = {
    ...(database === 'postgres' ? { '@prisma/client': '^5.14.0' } : {}),
    ...(database === 'mongodb' ? { mongoose: '^8.4.0' } : {}),
  };

  if (backend === 'nestjs') {
    return {
      '@nestjs/common': '^10.3.8',
      '@nestjs/config': '^3.2.2',
      '@nestjs/core': '^10.3.8',
      '@nestjs/platform-express': '^10.3.8',
      'express-rate-limit': '^7.2.0',
      helmet: '^7.1.0',
      'reflect-metadata': '^0.2.2',
      rxjs: '^7.8.1',
      ...db,
    };
  }

  if (backend === 'hono') {
    return {
      '@hono/node-server': '^1.11.1',
      dotenv: '^16.4.5',
      hono: '^4.3.7',
      ...db,
    };
  }

  return {
    cors: '^2.8.5',
    dotenv: '^16.4.5',
    express: '^4.19.2',
    'express-rate-limit': '^7.2.0',
    helmet: '^7.1.0',
    ...db,
  };
}

function backendDevDependencies({ backend, database }) {
  const db = database === 'postgres' ? { prisma: '^5.14.0' } : {};

  if (backend === 'nestjs') {
    return {
      '@nestjs/cli': '^10.3.2',
      '@nestjs/schematics': '^10.1.1',
      '@nestjs/testing': '^10.3.8',
      '@types/express': '^4.17.21',
      '@types/jest': '^29.5.12',
      '@types/node': '^20.14.2',
      '@types/supertest': '^6.0.2',
      '@typescript-eslint/eslint-plugin': '^7.11.0',
      '@typescript-eslint/parser': '^7.11.0',
      eslint: '^8.57.0',
      jest: '^29.7.0',
      supertest: '^7.0.0',
      'ts-jest': '^29.1.4',
      'ts-node': '^10.9.2',
      typescript: '^5.4.5',
      ...db,
    };
  }

  if (backend === 'hono') {
    return { eslint: '^8.57.0', ...db };
  }

  return {
    eslint: '^8.57.0',
    jest: '^29.7.0',
    supertest: '^7.0.0',
    ...db,
  };
}

/** Workspace manifest for `backend/package.json` in fullstack mode. */
function generateBackendPackageJson(options) {
  return {
    name: 'backend',
    version: '1.0.0',
    private: true,
    description: `${options.backend} API service`,
    main: options.backend === 'nestjs' ? 'dist/main.js' : 'src/server.js',
    ...(options.backend === 'hono' ? { type: 'module' } : {}),
    scripts: backendScripts(options),
    dependencies: backendDependencies(options),
    devDependencies: backendDevDependencies(options),
    ...(options.backend === 'nestjs' ? { jest: nestJestConfig() } : {}),
  };
}

function nestJestConfig() {
  return {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testRegex: '.*\\.(spec|test)\\.ts$',
    transform: { '^.+\\.(t|j)s$': 'ts-jest' },
    collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
    coverageDirectory: 'coverage',
    testEnvironment: 'node',
  };
}

module.exports = {
  generateRootPackageJson,
  generateBackendPackageJson,
  backendScripts,
  backendDependencies,
  backendDevDependencies,
};

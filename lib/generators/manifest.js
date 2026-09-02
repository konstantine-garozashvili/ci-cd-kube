'use strict';

// Every dependency version comes from lib/versions.js — the ceilings that stop
// certain packages following `latest`, and the reason for each, are documented
// there rather than duplicated here.

const { NODE_ENGINE_RANGE, FRONTEND_PORT } = require('../constants');
const { BASELINE } = require('../versions');

/**
 * Generates every package.json in a scaffolded project.
 *
 * The script *names* are deliberately identical in monorepo and single-package
 * mode, so the generated CI workflow can call `npm run test:unit` without ever
 * knowing which layout it is running in.
 */

/** Root manifest for the generated project. */
/**
 * Transitive dependencies that carry an advisory with no fixed release of their
 * parent yet.
 *
 * npm's `--omit=dev` does not exclude a *workspace's* devDependencies when the
 * audit runs from the repository root, so a build-time-only vulnerability fails
 * the generated project's own audit gate on its first push. Rather than weaken
 * the gate — which would hide real findings — pin the transitive dependency
 * forward to a release without the advisory.
 *
 * Each entry is a liability: remove it once the parent ships a fix.
 */
const OVERRIDES = {
  // prisma 6.19.3 (the CLI, a devDependency) pins @prisma/config to
  // deepmerge-ts 7.1.5, which has a high-severity advisory. @prisma/client —
  // the only part that ships — does not depend on it at all. Verified that
  // prisma validate, generate and db push all work against 8.0.2.
  'deepmerge-ts': '^8.0.2',
};

function generateRootPackageJson(options) {
  const { projectName, isFullstack, database, backend, frontend, versions = BASELINE } = options;
  const engineRange = (options.node && options.node.engineRange) || NODE_ENGINE_RANGE;

  const devDependencies = pick(versions, ['@playwright/test', 'husky', 'lint-staged', 'prettier']);

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
      ...(database === 'postgres' ? { overrides: OVERRIDES } : {}),
      engines: { node: engineRange, npm: '>=10.0.0' },
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
    ...(database === 'postgres' ? { overrides: OVERRIDES } : {}),
    engines: { node: engineRange, npm: '>=10.0.0' },
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
    devDependencies: { ...devDependencies, ...pick(versions, ['concurrently']) },
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
      'test:unit': 'jest --runInBand --testPathPatterns=tests/unit',
      'test:integration': 'jest --runInBand --testPathPatterns=tests/integration',
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

/**
 * Turns a list of package names into a `{ name: range }` map.
 *
 * Ranges come from `options.versions`, which is BASELINE by default and the
 * registry's current releases when the wizard ran with --latest. Listing names
 * here rather than literal versions means there is exactly one place a version
 * is written down.
 */
function pick(versions, names) {
  return Object.fromEntries(names.map((name) => [name, versions[name] || BASELINE[name]]));
}

function backendDependencies({ backend, database, versions = BASELINE }) {
  const db = [
    ...(database === 'postgres' ? ['@prisma/client'] : []),
    ...(database === 'mongodb' ? ['mongoose'] : []),
  ];

  if (backend === 'nestjs') {
    return pick(versions, [
      '@nestjs/common',
      '@nestjs/config',
      '@nestjs/core',
      '@nestjs/platform-express',
      'express-rate-limit',
      'helmet',
      'reflect-metadata',
      'rxjs',
      ...db,
    ]);
  }

  if (backend === 'hono') {
    return pick(versions, ['@hono/node-server', 'dotenv', 'hono', ...db]);
  }

  return pick(versions, ['cors', 'dotenv', 'express', 'express-rate-limit', 'helmet', ...db]);
}

function backendDevDependencies({ backend, database, versions = BASELINE }) {
  const db = database === 'postgres' ? ['prisma'] : [];

  // Every workspace lints itself, so each needs the flat-config building blocks.
  const linting = ['@eslint/js', 'eslint', 'globals'];

  if (backend === 'nestjs') {
    return pick(versions, [
      '@nestjs/cli',
      '@nestjs/schematics',
      '@nestjs/testing',
      '@types/express',
      '@types/jest',
      '@types/node',
      '@types/supertest',
      ...linting,
      'typescript-eslint',
      'jest',
      'supertest',
      'ts-jest',
      'ts-node',
      'typescript',
      ...db,
    ]);
  }

  if (backend === 'hono') {
    return pick(versions, [...linting, ...db]);
  }

  return pick(versions, [...linting, 'jest', 'supertest', ...db]);
}

/**
 * Workspace manifest for `frontend/package.json`.
 *
 * Generated rather than shipped as a static file so that --latest reaches the
 * frontend dependencies too, and so every version in the project comes from the
 * same map.
 */
function generateFrontendPackageJson(options) {
  const { frontend, versions = BASELINE } = options;

  const linting = ['@eslint/js', 'eslint', 'globals'];

  const byFramework = {
    react: {
      dependencies: ['react', 'react-dom'],
      devDependencies: [
        ...linting,
        '@vitejs/plugin-react',
        'eslint-plugin-react',
        'eslint-plugin-react-hooks',
        'vite',
      ],
    },
    vue: {
      dependencies: ['vue'],
      devDependencies: [...linting, '@vitejs/plugin-vue', 'eslint-plugin-vue', 'vite'],
    },
    vanilla: {
      dependencies: [],
      devDependencies: [...linting, 'vite'],
    },
    nextjs: {
      dependencies: ['next', 'react', 'react-dom'],
      devDependencies: [
        ...linting,
        '@types/node',
        '@types/react',
        '@types/react-dom',
        'eslint-config-next',
        'typescript',
      ],
    },
  };

  const spec = byFramework[frontend];

  // Next.js runs its own server; the Vite frameworks build to static assets.
  const scripts =
    frontend === 'nextjs'
      ? {
          dev: `next dev -p ${FRONTEND_PORT}`,
          build: 'next build',
          start: `next start -p ${FRONTEND_PORT}`,
          lint: 'eslint .',
        }
      : {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          lint: 'eslint .',
        };

  return {
    name: 'frontend',
    version: '1.0.0',
    private: true,
    // Next.js resolves its own module format; the Vite templates are ESM.
    ...(frontend === 'nextjs' ? {} : { type: 'module' }),
    scripts,
    ...(spec.dependencies.length ? { dependencies: pick(versions, spec.dependencies) } : {}),
    devDependencies: pick(versions, spec.devDependencies),
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
  generateFrontendPackageJson,
  backendScripts,
  backendDependencies,
  backendDevDependencies,
};

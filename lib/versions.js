'use strict';

/**
 * Dependency versions for generated projects.
 *
 * BASELINE is the set this scaffolder has actually built, linted, tested and
 * run in a container. It is what a project gets by default, so a fresh scaffold
 * is reproducible and known-good.
 *
 * `--latest` resolves the current `latest` dist-tag from the npm registry at
 * scaffold time instead, for anything not in CONSTRAINED. That keeps a project
 * current years from now without waiting on a release of this package.
 *
 * CONSTRAINED never follows latest, because the newest major is known to break
 * a generated project. Each entry carries the reason, so the ceiling can be
 * revisited rather than cargo-culted. `npm run versions:report` shows which
 * ceilings now have a newer major waiting behind them.
 */

const { NODE_VERSION, NODE_ENGINE_RANGE } = require('./constants');

const BASELINE = {
  // Runtime — Express
  cors: '^2.8.6',
  dotenv: '^17.4.2',
  express: '^5.2.1',
  'express-rate-limit': '^8.7.0',
  helmet: '^8.3.0',

  // Runtime — Hono
  '@hono/node-server': '^2.1.1',
  hono: '^4.13.5',

  // Runtime — NestJS
  '@nestjs/common': '^11.2.3',
  '@nestjs/config': '^4.0.4',
  '@nestjs/core': '^11.2.3',
  '@nestjs/platform-express': '^11.2.3',
  'reflect-metadata': '^0.2.2',
  rxjs: '^7.8.2',

  // Database
  '@prisma/client': '^6.19.3',
  mongoose: '^9.9.4',
  prisma: '^6.19.3',

  // Tooling
  '@eslint/js': '^9.39.5',
  '@nestjs/cli': '^11.0.24',
  '@nestjs/schematics': '^11.1.0',
  '@nestjs/testing': '^11.2.3',
  '@playwright/test': '^1.62.1',
  '@types/express': '^5.0.6',
  '@types/jest': '^30.0.0',
  '@types/node': '^26.4.0',
  '@types/supertest': '^7.2.1',
  concurrently: '^10.0.5',
  eslint: '^9.39.5',
  globals: '^17.12.0',
  husky: '^9.1.7',
  jest: '^30.5.1',
  'lint-staged': '^17.4.1',
  prettier: '^3.9.6',
  supertest: '^7.2.2',
  'ts-jest': '^29.4.12',
  'ts-node': '^10.9.2',
  typescript: '~6.0.3',
  'typescript-eslint': '^8.69.0',

  // Frontend
  '@types/react': '^19.2.18',
  '@types/react-dom': '^19.2.5',
  '@vitejs/plugin-react': '^5.2.0',
  '@vitejs/plugin-vue': '^6.0.8',
  'eslint-config-next': '^16.3.4',
  'eslint-plugin-react': '^7.37.5',
  'eslint-plugin-react-hooks': '^7.1.1',
  'eslint-plugin-vue': '^10.10.0',
  next: '^16.3.4',
  react: '^19.2.8',
  'react-dom': '^19.2.8',
  vite: '^7.1.12',
  vue: '^3.5.42',
};

/**
 * Packages that must not follow `latest`, with the reason each ceiling exists.
 * `max` is the highest major known to work in a generated project.
 */
const CONSTRAINED = {
  eslint: {
    max: 9,
    reason:
      "eslint-plugin-react's peer range stops at ^9.7, so ESLint 10 makes a generated project fail to install without --legacy-peer-deps.",
  },
  '@eslint/js': { max: 9, reason: 'Kept in lockstep with the eslint ceiling.' },

  prisma: {
    max: 6,
    reason:
      "Prisma 7's client generator emits TypeScript only — generatedFileExtension accepts ts/mts/cts and nothing else — so the JavaScript backends would need a compile step to import their own database client.",
  },
  '@prisma/client': { max: 6, reason: 'Kept in lockstep with the prisma ceiling.' },

  '@nestjs/core': {
    max: 11,
    reason:
      'NestJS 12 is ESM-only, which needs the template converted to ESM (.js suffixes on relative imports, module: nodenext) and a Jest ESM setup.',
  },
  '@nestjs/common': { max: 11, reason: 'Kept in lockstep with @nestjs/core.' },
  '@nestjs/platform-express': { max: 11, reason: 'Kept in lockstep with @nestjs/core.' },
  '@nestjs/testing': { max: 11, reason: 'Kept in lockstep with @nestjs/core.' },
  '@nestjs/cli': { max: 11, reason: 'Kept in lockstep with @nestjs/core.' },
  '@nestjs/schematics': { max: 11, reason: 'Kept in lockstep with @nestjs/core.' },
  '@nestjs/config': { max: 4, reason: 'The 4.x line is what pairs with NestJS 11.' },

  typescript: {
    max: 6,
    reason:
      'Three peer ranges must intersect: @nestjs/schematics needs >=6, ts-jest needs <7, typescript-eslint needs <6.1. Only the 6.0.x line satisfies all three, which is why the baseline uses a tilde range.',
  },
  vite: {
    max: 7,
    reason:
      'Vite 8 depends on rolldown 1.0.0-rc.x — a release candidate with native bindings. npm\'s optional-dependency bug (npm/cli#4828) leaves @rolldown/binding-win32-x64-msvc uninstalled on Windows, so `npm run dev` dies with "Cannot find native binding" on a fresh scaffold. Vite 7 uses rollup ^4.40, which has a pure-JS fallback. Reported by a Windows user on 2.1.0.',
  },

  '@vitejs/plugin-react': {
    max: 5,
    reason:
      'Version 6 peers vite ^8.0.0 only, so it cannot install alongside the vite ceiling. 5.2.0 peers ^4.2 || ^5 || ^6 || ^7 || ^8 and works either side of it.',
  },

  'ts-jest': {
    max: 29,
    reason: 'Declares a TypeScript peer range of <7, matching the typescript ceiling.',
  },
};

/** Registry endpoint; the abbreviated Accept header keeps the response small. */
const REGISTRY = 'https://registry.npmjs.org';
const ABBREVIATED = 'application/vnd.npm.install-v1+json';

function majorOf(version) {
  const match = /(\d+)\./.exec(String(version));
  return match ? Number(match[1]) : null;
}

/**
 * True for 8.0.0-rc.12, 7.0.0-beta.1 and friends.
 *
 * Packages do publish prereleases to the `latest` dist-tag — Prisma had
 * 8.0.0-rc.12 there while 7.x was the newest stable — so following `latest`
 * without this check would put release candidates into new projects.
 */
function isPrerelease(version) {
  return String(version).includes('-');
}

/**
 * Resolves the current Node.js Active LTS major from the official release index.
 *
 * Pinned here rather than in constants so a project scaffolded years from now
 * gets whatever LTS is current then — 24 today, 28 or 30 later — without anyone
 * editing this repository. The engine floor is the previous LTS (majors go
 * 20, 22, 24, …) so a contributor one release behind is not locked out.
 *
 * @returns {Promise<{major: number, engineRange: string}|{error: string}>}
 */
async function fetchNodeLts({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://nodejs.org/dist/index.json', {
      signal: controller.signal,
    });
    if (!res.ok) {
      return { error: `nodejs.org responded ${res.status}` };
    }

    const releases = await res.json();

    // `lts` is the codename string for LTS releases and false otherwise.
    const ltsMajors = [
      ...new Set(releases.filter((r) => r.lts).map((r) => majorOf(r.version.slice(1)))),
    ].sort((a, b) => b - a);

    if (ltsMajors.length === 0) {
      return { error: 'no LTS releases listed' };
    }

    const major = ltsMajors[0];
    const previous = ltsMajors[1] ?? major;

    return { major, engineRange: `>=${previous}.0.0` };
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'timed out' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Looks up one package's `latest` dist-tag.
 *
 * @returns {Promise<{version: string}|{error: string}>}
 */
async function fetchLatest(name, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${REGISTRY}/${name.replace('/', '%2F')}`, {
      headers: { Accept: ABBREVIATED },
      signal: controller.signal,
    });

    if (!res.ok) {
      return { error: `registry responded ${res.status}` };
    }

    const body = await res.json();
    const version = body['dist-tags'] && body['dist-tags'].latest;

    return version ? { version } : { error: 'no latest dist-tag' };
  } catch (err) {
    return { error: err.name === 'AbortError' ? 'timed out' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds the version map a scaffold should use.
 *
 * Always returns a complete map: anything that cannot be resolved keeps its
 * baseline, so a slow or offline registry degrades to the tested set instead of
 * failing the scaffold.
 *
 * @param {{ latest?: boolean, timeoutMs?: number }} options
 * @returns {Promise<{versions: object, updated: string[], held: string[], failed: string[]}>}
 */
async function resolveVersions({ latest = true, timeoutMs = 8000 } = {}) {
  const versions = { ...BASELINE };
  const node = { major: Number(NODE_VERSION), engineRange: NODE_ENGINE_RANGE, resolved: false };

  if (!latest) {
    return { versions, node, updated: [], held: [], failed: [] };
  }

  const names = Object.keys(BASELINE);
  const [nodeResult, ...results] = await Promise.all([
    fetchNodeLts({ timeoutMs }),
    ...names.map(async (name) => [name, await fetchLatest(name, { timeoutMs })]),
  ]);

  if (!nodeResult.error) {
    node.major = nodeResult.major;
    node.engineRange = nodeResult.engineRange;
    node.resolved = true;
  }

  const updated = [];
  const held = [];
  const failed = [];

  for (const [name, result] of results) {
    if (result.error) {
      failed.push(name);
      continue;
    }

    if (isPrerelease(result.version)) {
      held.push(`${name} (latest ${result.version} is a prerelease)`);
      continue;
    }

    const ceiling = CONSTRAINED[name];
    if (ceiling && majorOf(result.version) > ceiling.max) {
      // A newer major exists but is known to break generated projects, so the
      // baseline stands. versions:report surfaces these for a maintainer.
      held.push(`${name} (latest ${result.version}, held at ${ceiling.max}.x)`);
      continue;
    }

    const range = `^${result.version}`;
    if (range !== BASELINE[name]) {
      updated.push(`${name} ${BASELINE[name]} → ${range}`);
      versions[name] = range;
    }
  }

  return { versions, node, updated, held, failed };
}

module.exports = {
  BASELINE,
  CONSTRAINED,
  resolveVersions,
  fetchLatest,
  fetchNodeLts,
  majorOf,
  isPrerelease,
};

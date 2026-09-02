'use strict';

const path = require('path');
const { BACKENDS, FRONTENDS, DATABASES } = require('./constants');

/**
 * npm package names may not contain uppercase letters, spaces or most
 * punctuation, and may not start with a dot or underscore. The scaffolded
 * project name becomes a package name, so it has to satisfy the same rules —
 * otherwise `npm install` fails immediately after generation.
 */
const NAME_PATTERN = /^(?!\.)(?!_)[a-z0-9][a-z0-9._-]*$/;
const RESERVED_NAMES = new Set(['node_modules', 'favicon.ico', '.', '..']);

/**
 * Turns a directory name into a valid npm package name, so `My App` still
 * produces a working project instead of a hard error.
 */
function normaliseProjectName(raw) {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/^[.-]+/, '')
    .replace(/[.-]+$/, '')
    .slice(0, 214);
}

/**
 * @returns {{ ok: true, name: string } | { ok: false, reason: string }}
 */
function validateProjectName(raw) {
  const trimmed = String(raw ?? '').trim();

  if (!trimmed) {
    return { ok: false, reason: 'Project name must not be empty.' };
  }

  // "." means "scaffold into the current directory" and skips name rules —
  // the package name is taken from the directory instead.
  if (trimmed === '.') {
    return { ok: true, name: '.' };
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return {
      ok: false,
      reason: 'Project name must be a single directory name, not a path.',
    };
  }

  const normalised = normaliseProjectName(trimmed);

  if (!normalised) {
    return { ok: false, reason: 'Project name contains no usable characters.' };
  }

  // Check the raw input too: "node_modules" normalises to "node-modules",
  // which would otherwise slip past a check on the normalised name alone.
  if (RESERVED_NAMES.has(trimmed.toLowerCase()) || RESERVED_NAMES.has(normalised)) {
    return { ok: false, reason: `"${trimmed}" is a reserved name.` };
  }

  if (!NAME_PATTERN.test(normalised)) {
    return {
      ok: false,
      reason:
        'Project name must start with a letter or digit and contain only lowercase letters, digits, dots, hyphens and underscores.',
    };
  }

  return { ok: true, name: normalised };
}

function assertChoice(label, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`Unknown ${label} "${value}". Expected one of: ${allowed.join(', ')}.`);
  }
}

/** Where a frontend keeps the source Semgrep should scan. */
function frontendSourcePath(frontend) {
  if (frontend === 'nextjs') {
    return 'frontend/app';
  }
  if (frontend === 'vanilla') {
    return 'frontend';
  }
  return 'frontend/src';
}

/**
 * Normalises the wizard's answers into the single shape every generator reads.
 * All derived facts (is this a monorepo? which Dockerfiles exist? what should
 * Semgrep scan?) are computed exactly once, here.
 */
function buildOptions({ targetPath, name, backend, frontend, database }) {
  assertChoice('backend', backend, BACKENDS);
  assertChoice('frontend', frontend, FRONTENDS);
  assertChoice('database', database, DATABASES);

  if (backend === 'none' && frontend === 'none') {
    throw new Error(
      'Select at least a backend or a frontend — "none" for both leaves nothing to scaffold.'
    );
  }

  // A frontend-only project still needs a backend to proxy to, so the wizard
  // treats "no backend" as "Express with no extras" rather than silently
  // producing a broken proxy target.
  const resolvedBackend = backend === 'none' ? 'express' : backend;
  const isFullstack = frontend !== 'none';

  const projectName =
    name === '.' ? normaliseProjectName(path.basename(targetPath)) || 'app' : name;

  const dockerTargets = isFullstack
    ? [
        { service: 'backend', dockerfile: 'backend/Dockerfile' },
        { service: 'frontend', dockerfile: 'frontend/Dockerfile' },
      ]
    : [{ service: 'backend', dockerfile: 'Dockerfile' }];

  const sastPaths = isFullstack ? `backend/src ${frontendSourcePath(frontend)}` : 'src';

  return {
    targetPath,
    projectName,
    backend: resolvedBackend,
    frontend,
    database,
    isFullstack,
    // Whether there is a browser-renderable page for the Playwright UI suite.
    hasUi: isFullstack || resolvedBackend === 'express',
    backendDir: isFullstack ? 'backend' : '.',
    frontendDir: isFullstack ? 'frontend' : null,
    dockerTargets,
    sastPaths,
  };
}

module.exports = {
  validateProjectName,
  normaliseProjectName,
  buildOptions,
  frontendSourcePath,
};

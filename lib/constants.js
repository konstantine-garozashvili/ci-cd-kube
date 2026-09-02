'use strict';

/**
 * Node.js version used by generated projects.
 *
 * NODE_VERSION pins .nvmrc, the Docker base image and the CI matrix so all
 * three can never drift apart. NODE_ENGINE_RANGE is the floor package.json
 * advertises — deliberately one major lower than the pinned version so a
 * contributor on the previous LTS is not blocked.
 */
const NODE_VERSION = '24';
const NODE_ENGINE_RANGE = '>=22.0.0';

/** Ports the generated project uses everywhere: compose, CI, Playwright, nginx. */
const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

/** Backends that compile to `dist/` and therefore need a Docker build stage. */
const COMPILED_BACKENDS = new Set(['nestjs']);

/** Frontends that build to static assets served by nginx. */
const STATIC_FRONTENDS = new Set(['react', 'vue', 'vanilla']);

/**
 * The wizard speaks in product names ("postgres"), the templates are named
 * after the library that implements them ("prisma"). Map between the two in
 * one place rather than at every call site.
 */
const DB_TEMPLATE_DIR = {
  postgres: 'prisma',
  mongodb: 'mongoose',
  none: 'none',
};

const BACKENDS = ['express', 'hono', 'nestjs', 'none'];
const FRONTENDS = ['react', 'vue', 'vanilla', 'nextjs', 'none'];
const DATABASES = ['postgres', 'mongodb', 'none'];

module.exports = {
  NODE_VERSION,
  NODE_ENGINE_RANGE,
  BACKEND_PORT,
  FRONTEND_PORT,
  COMPILED_BACKENDS,
  STATIC_FRONTENDS,
  DB_TEMPLATE_DIR,
  BACKENDS,
  FRONTENDS,
  DATABASES,
};

'use strict';

const { BACKEND_PORT, FRONTEND_PORT } = require('../constants');

/**
 * Playwright configuration.
 *
 * `baseURL` always points at whatever the browser should open — the frontend in
 * a fullstack project, the API otherwise. Because every frontend proxies
 * `/api`, `/healthz`, `/ready` and `/live` to the backend on its own origin,
 * the API contract suite can use the same `baseURL` and still reach the API.
 * That means the E2E run also proves the proxy is wired correctly.
 */
function generatePlaywrightConfig(options) {
  const { isFullstack, database } = options;

  const baseUrl = isFullstack
    ? `http://127.0.0.1:${FRONTEND_PORT}`
    : `http://127.0.0.1:${BACKEND_PORT}`;

  const backendServer = `    {
      command: 'npm run start',
      url: 'http://127.0.0.1:${BACKEND_PORT}/healthz',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120 * 1000,
    },`;

  const frontendServer = `    {
      command: 'npm run dev:frontend',
      url: 'http://127.0.0.1:${FRONTEND_PORT}',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120 * 1000,
    },`;

  const dbNote =
    database === 'none'
      ? ''
      : `\n *\n * This project uses a database. Start it before running the suite locally:\n *   docker compose up -d ${database === 'postgres' ? 'postgres' : 'mongodb'}\n`;

  return `const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright starts the application itself via \`webServer\`, so \`npm run test:e2e\`
 * works from a clean checkout with no manual setup.${dbNote} *
 * Setting E2E_BASE_URL points the suite at an application that is already
 * running — a compose stack, a preview deployment — and turns \`webServer\` off.
 * Without that, Playwright refuses to start under CI, where reuseExistingServer
 * is false, because the port it wants is already taken by the running app.
 */
const externalTarget = process.env.E2E_BASE_URL;

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Fails the run if a \`test.only\` was committed by accident.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },

  use: {
    baseURL: externalTarget || '${baseUrl}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: externalTarget
    ? undefined
    : [
${isFullstack ? `${backendServer}\n${frontendServer}` : backendServer}
      ],
});
`;
}

/**
 * Environment files. `.env.example` is committed as documentation; `.env` is a
 * ready-to-run copy that .gitignore keeps out of version control.
 */
function generateBackendEnv(options, { dbPassword = '__REPLACE_ME__' } = {}) {
  const { projectName, database, isFullstack } = options;

  const dbLines =
    database === 'postgres'
      ? `
# Database — matches the postgres service in docker-compose.yml.
# Use localhost when running the API on your machine, or the service name
# "postgres" when the API itself runs inside compose.
DATABASE_URL=postgresql://postgres:${dbPassword}@localhost:5432/app_db?schema=public
`
      : database === 'mongodb'
        ? `
# Database — matches the mongodb service in docker-compose.yml.
MONGODB_URI=mongodb://localhost:27017/app_db
`
        : '';

  return `# ---------------------------------------------------------------------------
# Backend configuration
#
# Copy to .env and edit. Never commit .env — it is gitignored on purpose.
# ---------------------------------------------------------------------------
NODE_ENV=development
PORT=${BACKEND_PORT}

APP_NAME=${projectName}${isFullstack ? '-api' : ''}
APP_VERSION=1.0.0

# Comma-separated list of allowed origins. In development the frontend proxies
# the API on its own origin, so this is only needed if you call the API directly
# from another host. Never use * in a deployed environment.
CORS_ORIGIN=http://localhost:${FRONTEND_PORT}

# Number of proxy hops in front of this service. The frontend proxies the API
# on its own origin, so requests arrive with an X-Forwarded-For header and
# express-rate-limit needs to know how many hops to trust. Set to 0 when the API
# is exposed directly — trusting a hop that does not exist lets a client spoof
# its own IP and evade rate limiting.
TRUST_PROXY=${isFullstack ? '1' : '0'}

# Rate limiting for /api routes (health probes are never rate limited).
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
${dbLines}`;
}

function generateFrontendEnv(options) {
  const isNext = options.frontend === 'nextjs';

  if (isNext) {
    return `# ---------------------------------------------------------------------------
# Frontend configuration
# ---------------------------------------------------------------------------
# Where next.config.mjs forwards /api, /healthz, /ready and /live.
API_PROXY_TARGET=http://localhost:${BACKEND_PORT}
`;
  }

  return `# ---------------------------------------------------------------------------
# Frontend configuration
# ---------------------------------------------------------------------------
# Where the Vite dev server forwards /api, /healthz, /ready and /live.
VITE_API_PROXY_TARGET=http://localhost:${BACKEND_PORT}

# Optional. Leave empty to use the same-origin proxy above, which is what you
# want in development and in the nginx container. Set an absolute URL only if
# the API lives on a different origin in production (then configure CORS too).
VITE_API_URL=
`;
}

/** gitleaks profile, named after the project so scan output is identifiable. */
function generateGitleaksConfig({ projectName }) {
  return `# Secret scanning profile for ${projectName}.
# Run locally with: npm run scan:secrets
title = "${projectName} secret scan profile"

[extend]
useDefault = true

[allowlist]
description = "Paths and patterns that legitimately contain placeholder values"
paths = [
  '''^\\.gitleaks\\.toml$''',
  '''(^|/)\\.env\\.example$''',
  '''(^|/)tests?/''',
  '''(^|/)package-lock\\.json$''',
  '''(^|/)docs/''',
]
regexes = [
  '''(?i)example[_-]?(key|secret|token)''',
  '''(?i)(mock|dummy|placeholder|changeme)[_-]?(key|secret|token|password)''',
  '''replace-with-your-own''',
]
`;
}

module.exports = {
  generatePlaywrightConfig,
  generateBackendEnv,
  generateFrontendEnv,
  generateGitleaksConfig,
};

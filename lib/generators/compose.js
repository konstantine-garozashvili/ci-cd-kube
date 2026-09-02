'use strict';

const { BACKEND_PORT, FRONTEND_PORT } = require('../constants');

/**
 * Builds `docker-compose.yml` for local multi-service development.
 *
 * Build contexts are always the repository root (`.`) with an explicit
 * `dockerfile:` path, because npm workspaces keep one lockfile at the root and
 * `npm ci` inside the image cannot run without it.
 */
function generateDockerCompose(options) {
  const { isFullstack, frontend, database, projectName } = options;

  const services = [];
  const volumes = [];

  const dependsOnDb =
    database === 'postgres'
      ? '\n    depends_on:\n      postgres:\n        condition: service_healthy'
      : database === 'mongodb'
        ? '\n    depends_on:\n      mongodb:\n        condition: service_healthy'
        : '';

  const dbEnv =
    database === 'postgres'
      ? '\n      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/app_db?schema=public'
      : database === 'mongodb'
        ? '\n      MONGODB_URI: mongodb://${MONGO_USER:-app}:${MONGO_PASSWORD}@mongodb:27017/app_db?authSource=admin'
        : '';

  services.push(`  backend:
    build:
      context: .
      dockerfile: ${isFullstack ? 'backend/Dockerfile' : 'Dockerfile'}
    image: ${projectName}-backend
    restart: unless-stopped
    ports:
      - "\${BACKEND_PORT:-${BACKEND_PORT}}:${BACKEND_PORT}"
    environment:
      NODE_ENV: production
      PORT: ${BACKEND_PORT}
      # Only the frontend origin is allowed. Never ship CORS_ORIGIN=* to a
      # deployed environment.
      CORS_ORIGIN: http://localhost:\${FRONTEND_PORT:-${FRONTEND_PORT}}${dbEnv}${dependsOnDb}
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('http').get('http://127.0.0.1:${BACKEND_PORT}/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))",
        ]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 15s`);

  if (isFullstack) {
    const isNext = frontend === 'nextjs';
    services.push(`  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    image: ${projectName}-frontend
    restart: unless-stopped
    ports:
      - "\${FRONTEND_PORT:-${FRONTEND_PORT}}:${isNext ? FRONTEND_PORT : 80}"
    environment:
      # The frontend proxies the API on its own origin, so the browser never
      # makes a cross-origin request.
      ${isNext ? 'API_PROXY_TARGET' : 'BACKEND_URL'}: http://backend:${BACKEND_PORT}
    depends_on:
      backend:
        condition: service_healthy`);
  }

  if (database === 'postgres') {
    volumes.push('pgdata');
    services.push(`  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      # Supplied by the root .env, which is generated with a unique password per
      # project and gitignored. The :? makes compose fail with "required variable
      # POSTGRES_PASSWORD is missing a value" rather than falling back to a
      # default, so a deployment cannot silently run on a guessable password.
      # Copy .env.example to .env and set one.
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?}
      POSTGRES_DB: app_db
    ports:
      - "\${POSTGRES_PORT:-55432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app_db"]
      interval: 5s
      timeout: 5s
      retries: 10`);
  }

  if (database === 'mongodb') {
    volumes.push('mongodata');
    services.push(`  mongodb:
    image: mongo:7-jammy
    restart: unless-stopped
    environment:
      # Without these Mongo starts with authentication disabled and accepts any
      # connection. Supplied by the root .env, which is generated with a unique
      # password per project and gitignored; the :? makes compose fail rather
      # than silently starting an open database.
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_USER:-app}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_PASSWORD:?}
      MONGO_INITDB_DATABASE: app_db
    ports:
      - "\${MONGO_PORT:-57017}:27017"
    volumes:
      - mongodata:/data/db
    healthcheck:
      # The ping needs credentials now that authentication is on.
      test:
        [
          "CMD",
          "mongosh",
          "--quiet",
          "-u",
          "\${MONGO_USER:-app}",
          "-p",
          "\${MONGO_PASSWORD}",
          "--authenticationDatabase",
          "admin",
          "--eval",
          "db.runCommand({ ping: 1 })",
        ]
      interval: 10s
      timeout: 5s
      retries: 10`);
  }

  const volumesBlock = volumes.length
    ? `\nvolumes:\n${volumes.map((v) => `  ${v}:`).join('\n')}\n`
    : '';

  // No top-level `version:` key — Compose v2 ignores it and warns about it.
  return `# Local multi-service stack for ${projectName}.
#
#   docker compose up --build      start everything
#   docker compose down -v         stop and delete database volumes
#
# Ports can be overridden from a .env file next to this file, e.g. BACKEND_PORT=4000.

services:
${services.join('\n\n')}
${volumesBlock}`;
}

module.exports = { generateDockerCompose };

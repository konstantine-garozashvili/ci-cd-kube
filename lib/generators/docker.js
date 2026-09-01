'use strict';

const { BACKEND_PORT, FRONTEND_PORT, COMPILED_BACKENDS, NODE_VERSION } = require('../constants');

/**
 * The backend image is always built from the *repository root* so that npm has
 * access to the root lockfile. Without it `npm ci` cannot run, because npm
 * workspaces keep a single lockfile at the root and never write one per package.
 */
function generateBackendDockerfile(options) {
  const { backend, database, isFullstack } = options;
  const needsBuild = COMPILED_BACKENDS.has(backend);
  const entrypoint = needsBuild ? 'dist/main.js' : 'src/server.js';

  const workspaceFlag = isFullstack ? ' --workspace=backend' : '';
  const workdir = isFullstack ? '/app/backend' : '/app';
  const dockerfilePath = isFullstack ? 'backend/Dockerfile' : 'Dockerfile';

  // Manifests are copied before the source so this layer stays cached until
  // dependencies actually change, not on every source edit.
  const manifestCopy = isFullstack
    ? 'COPY package.json package-lock.json ./\nCOPY backend/package.json ./backend/'
    : 'COPY package.json package-lock.json ./';

  // Prisma's postinstall hook generates the client from the schema, so the
  // schema has to be in place before `npm ci` runs.
  const prismaSchema = isFullstack ? 'backend/prisma' : 'prisma';
  const copyPrismaSchema =
    database === 'postgres' ? `\nCOPY ${prismaSchema} ./${prismaSchema}` : '';

  const copySource = isFullstack ? 'COPY backend ./backend' : 'COPY . .';
  const buildCommand = needsBuild ? `RUN npm run build${workspaceFlag}\n` : '';

  return `# syntax=docker/dockerfile:1
# ===========================================================================
# ${backend} backend image.
#
# Build from the repository root, not from this directory:
#   docker build -f ${dockerfilePath} -t app-backend .
#
# The root context is required because npm workspaces keep a single lockfile at
# the repository root, and \`npm ci\` refuses to run without one.
# ===========================================================================
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
# tini reaps zombie processes and forwards SIGTERM, neither of which Node does
# when it runs as PID 1.${
    database === 'postgres'
      ? `
#
# openssl is not optional here. Without it Prisma cannot detect the platform at
# generate time and falls back to an openssl-1.1.x query engine, which then
# fails to load at runtime on Alpine's openssl 3 with:
#   Error loading shared library libssl.so.1.1
# The failure only appears inside the container, never on the host.`
      : ''
  }
# hadolint ignore=DL3018
RUN apk add --no-cache tini${database === 'postgres' ? ' openssl' : ''}

# ---------------------------------------------------------------------------
# Stage 1: install, build, then strip back to production dependencies
#
# The install is deliberately a *full* one. Dev dependencies are needed for the
# build${database === 'postgres' ? " and for Prisma's client generation" : ''}, so they are removed afterwards with \`npm prune\` rather than
# skipped up front — \`npm ci --omit=dev\` would fail before it got that far.
# ---------------------------------------------------------------------------
FROM base AS builder
${manifestCopy}${copyPrismaSchema}
RUN npm ci${workspaceFlag}

${copySource}
${buildCommand}
RUN npm prune --omit=dev && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 2: minimal runtime
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=${BACKEND_PORT}

# Copying the builder's whole tree avoids having to guess whether npm hoisted a
# package to the root node_modules or nested it inside the workspace.
COPY --from=builder --chown=node:node /app ./

USER node
WORKDIR ${workdir}
EXPOSE ${BACKEND_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:${BACKEND_PORT}/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "${entrypoint}"]
`;
}

/**
 * Static frontends are compiled to plain files and served by nginx, which also
 * proxies the API so the browser sees a single origin (no CORS in production).
 */
function generateFrontendDockerfile(options) {
  const { frontend, isFullstack } = options;

  if (frontend === 'nextjs') {
    return `# syntax=docker/dockerfile:1
# ===========================================================================
# Next.js frontend image (standalone output).
# Build from the repository root:  docker build -f frontend/Dockerfile .
# ===========================================================================
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
# hadolint ignore=DL3018
RUN apk add --no-cache tini

FROM base AS builder
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm ci --workspace=frontend
COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=${FRONTEND_PORT}
ENV HOSTNAME=0.0.0.0

# \`output: 'standalone'\` bundles the server and only the modules it actually
# imports, so no node_modules copy is needed here.
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
# public/ always exists in this template — Docker COPY fails on a missing
# source path, and standalone output does not bundle it automatically.
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public

USER node
EXPOSE ${FRONTEND_PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \\
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:${FRONTEND_PORT}/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "frontend/server.js"]
`;
  }

  const workspaceFlag = isFullstack ? ' --workspace=frontend' : '';
  const manifests = isFullstack
    ? 'COPY package.json package-lock.json ./\nCOPY frontend/package.json ./frontend/'
    : 'COPY package.json package-lock.json ./';
  const sourceDir = isFullstack ? 'frontend' : '.';
  const distPath = isFullstack ? '/app/frontend/dist' : '/app/dist';

  return `# syntax=docker/dockerfile:1
# ===========================================================================
# ${frontend} frontend image: Vite build served by nginx.
# Build from the repository root:  docker build -f frontend/Dockerfile .
# ===========================================================================
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
${manifests}
RUN npm ci${workspaceFlag}
COPY ${sourceDir} ./${isFullstack ? 'frontend' : ''}
RUN npm run build${workspaceFlag}

# ---------------------------------------------------------------------------
# Runtime: nginx serving static assets and proxying the API
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# The official image runs envsubst over templates/ at startup, which is how
# BACKEND_URL becomes a real upstream without rebuilding the image.
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder ${distPath} /usr/share/nginx/html

ENV BACKEND_URL=http://backend:${BACKEND_PORT}
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD ["wget", "-q", "--spider", "http://127.0.0.1/"]
`;
}

/**
 * nginx config template. `${BACKEND_URL}` is substituted at container start by
 * the official image's envsubst entrypoint.
 */
function generateNginxConfTemplate() {
  return `server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Do not advertise the nginx version on error pages or in headers.
  server_tokens off;

  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  gzip on;
  gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;
  gzip_min_length 1024;

  # Fingerprinted build assets never change, so they can be cached forever.
  # Set as a single header: pairing an expires directive with add_header emits
  # two conflicting Cache-Control lines.
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
  }

  # Same-origin proxy to the API: the browser never makes a cross-origin
  # request, so no CORS configuration is needed in production.
  location ~ ^/(api|healthz|ready|live) {
    proxy_pass \${BACKEND_URL};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 5s;
    proxy_read_timeout 30s;
  }

  # Single-page app fallback: unknown paths render the app shell, not a 404.
  location / {
    try_files $uri $uri/ /index.html;
  }
}
`;
}

module.exports = {
  generateBackendDockerfile,
  generateFrontendDockerfile,
  generateNginxConfTemplate,
};

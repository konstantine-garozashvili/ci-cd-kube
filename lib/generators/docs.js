'use strict';

const { BACKEND_PORT, FRONTEND_PORT, NODE_VERSION } = require('../constants');

const BACKEND_LABEL = {
  express: 'Express',
  hono: 'Hono',
  nestjs: 'NestJS',
  none: 'none',
};

const FRONTEND_LABEL = {
  react: 'React + Vite',
  vue: 'Vue 3 + Vite',
  vanilla: 'Vanilla + Vite',
  nextjs: 'Next.js (App Router)',
  none: 'none',
};

const DATABASE_LABEL = {
  postgres: 'PostgreSQL (Prisma)',
  mongodb: 'MongoDB (Mongoose)',
  none: 'none',
};

/** README.md for the generated project. */
function generateReadme(options) {
  const { projectName, backend, frontend, database, isFullstack, hasUi } = options;
  const nodeVersion = (options.node && options.node.major) || NODE_VERSION;

  return `# ${projectName}

${isFullstack ? `Fullstack monorepo` : `Backend service`} scaffolded with a complete DevSecOps
pipeline: linting, formatting, unit / integration / end-to-end tests, secret
scanning, SAST, dependency auditing, container CVE scanning and a multi-stage
production image — all wired up and passing from the first commit.

| Layer     | Choice                          |
| --------- | ------------------------------- |
| Backend   | ${BACKEND_LABEL[backend]} |
| Frontend  | ${FRONTEND_LABEL[frontend]} |
| Database  | ${DATABASE_LABEL[database]} |
| Tests     | ${backend === 'hono' ? 'node:test' : 'Jest'} + Playwright |
| Container | Multi-stage, non-root, healthchecked |

## Requirements

- **Node.js ${nodeVersion}** (\`.nvmrc\` pins it — run \`nvm use\`)
- **npm 10+**
${database !== 'none' ? '- **Docker** — to run the database locally\n' : ''}
## Quick start

\`\`\`bash
npm install
${database !== 'none' ? `docker compose up -d ${database === 'postgres' ? 'postgres' : 'mongodb'}\n` : ''}${database === 'postgres' ? 'npm run db:push\n' : ''}npm run dev
\`\`\`

${
  isFullstack
    ? `- Frontend → http://localhost:${FRONTEND_PORT}
- API      → http://localhost:${BACKEND_PORT}`
    : `- API → http://localhost:${BACKEND_PORT}`
}

The frontend proxies \`/api\`, \`/healthz\`, \`/ready\` and \`/live\` to the backend on
its own origin, in development *and* in the production nginx image. The browser
never makes a cross-origin request, so there is no CORS to configure.

## Project layout

\`\`\`
${projectName}/
├── .github/workflows/ci-cd.yml   Pipeline: gates on every push and pull request
├── .husky/                       Pre-commit lint + secret scan, commit-msg check
${
  isFullstack
    ? `├── backend/                      ${BACKEND_LABEL[backend]} API
│   ├── src/
│   │   ├── ${backend === 'nestjs' ? 'health/, api/            Controllers' : 'routes/                Health probes and API routes'}
│   │   ├── ${backend === 'nestjs' ? 'database/              Swappable database service' : 'db/                    Swappable database adapter'}
│   │   └── ${backend === 'nestjs' ? 'main.ts                Bootstrap' : 'server.js              Bootstrap and graceful shutdown'}
│   └── tests/{unit,integration}/
├── frontend/                     ${FRONTEND_LABEL[frontend]}
│   ├── ${frontend === 'nextjs' ? 'app/                     App Router pages' : 'src/                     Application source'}
│   └── nginx.conf.template       Production proxy config
`
    : `├── src/
│   ├── ${backend === 'nestjs' ? 'health/, api/              Controllers' : 'routes/                  Health probes and API routes'}
│   ├── ${backend === 'nestjs' ? 'database/                Swappable database service' : 'db/                      Swappable database adapter'}
│   └── ${backend === 'nestjs' ? 'main.ts                  Bootstrap' : 'server.js                Bootstrap and graceful shutdown'}
├── tests/{unit,integration}/
`
}├── tests/e2e/                    Playwright browser + API contract suites
└── docker-compose.yml            Local multi-service stack
\`\`\`

## Scripts

| Command | What it does |
| ------- | ------------ |
| \`npm run dev\` | ${isFullstack ? 'Start API and frontend together with live reload' : 'Start the API with live reload'} |
| \`npm start\` | Run the API the way production does |
| \`npm run build\` | Compile everything that needs compiling |
| \`npm run lint\` / \`lint:fix\` | ESLint across every workspace |
| \`npm run format\` / \`format:check\` | Prettier |
| \`npm run test:unit\` | Fast, isolated unit tests |
| \`npm run test:integration\` | HTTP-level tests against the real app |
| \`npm run test:e2e\` | Playwright — boots the app itself, no manual setup |
| \`npm run scan:secrets\` | gitleaks over the repository history |
| \`npm run scan:sast\` | Semgrep, OWASP Top 10 ruleset |
${database === 'postgres' ? '| `npm run db:push` | Apply the Prisma schema to the database |\n| `npm run db:migrate` | Create and apply a migration |\n| `npm run db:studio` | Browse data in Prisma Studio |\n' : ''}
## Health probes

Three endpoints, each answering a different question — this distinction matters
in Kubernetes:

| Endpoint | Question | Behaviour |
| -------- | -------- | --------- |
| \`GET /healthz\` | Is the process alive? | Always 200 while running. Checks **no** dependencies, so a database blip cannot trigger a pod restart. |
| \`GET /ready\` | Can it serve traffic? | Checks the database and returns **503** when it cannot, so the load balancer drains this instance. |
| \`GET /live\` | Cheap ping | Plaintext \`OK\` for uptime monitors. |

${
  database !== 'none'
    ? `In development the API starts even when the database is unreachable — it logs a
warning and \`/ready\` reports \`DOWN\`, so you can work on routes without Docker
running. In production a failed connection exits immediately.

`
    : ''
}## Environment variables

Each package ships a \`.env.example\`. The scaffolder already created a working
\`.env\` next to it; \`.env\` is gitignored, \`.env.example\` is committed as the
documented contract. When you add a variable, add it to **both**.

## Docker

\`\`\`bash
docker compose up --build     # whole stack
docker compose down -v        # stop and wipe database volumes
\`\`\`

Images are built from the **repository root** with an explicit \`-f\` path, because
npm keeps a single lockfile at the root and \`npm ci\` cannot run without it:

\`\`\`bash
docker build -f ${isFullstack ? 'backend/Dockerfile' : 'Dockerfile'} -t ${projectName}-backend .
\`\`\`

Both images run as a non-root user, use multi-stage builds so no build toolchain
ships to production, declare a \`HEALTHCHECK\`, and use \`tini\` as PID 1 so
\`SIGTERM\` reaches Node and shutdown is graceful.

## Pipeline

\`.github/workflows/ci-cd.yml\` runs on every push **and every pull request**:

1. **Quality gate** — secret scan, formatting, lint, production dependency
   audit, Semgrep SAST, unit and integration tests${database !== 'none' ? ' against a real database service container' : ''}.
2. **End-to-end** — Playwright${hasUi ? ' browser journey and' : ''} API contract suite.
3. **Build & scan** — hadolint, multi-stage image build, Trivy CVE scan, then
   publish to GHCR. The scan happens **before** the push, and pull requests
   build without publishing.
4. **DAST** — OWASP ZAP baseline, advisory only (it flags findings that are
   expected on a fresh project — read the artifact rather than trusting the tick).
5. **Notify** — optional Google Chat card. Set the \`GOOGLE_CHAT_WEBHOOK_URL\`
   secret to enable it; without it the step logs a note and passes.

Every gate that says it blocks does block. To accept a specific Trivy finding,
add it to a \`.trivyignore\` file rather than turning the gate off.

## Git hooks

\`npm install\` installs husky hooks:

- **pre-commit** — Prettier and ESLint on staged files, plus \`gitleaks protect\`
  when gitleaks is installed locally (skipped with a note otherwise).
- **commit-msg** — enforces Conventional Commits (\`feat:\`, \`fix:\`, \`chore:\` …).

Bypass in an emergency with \`git commit --no-verify\`.

## Troubleshooting

**\`npm ci\` fails in CI** — \`package-lock.json\` must be committed. It is *not*
gitignored in this project, and \`npm ci\` cannot run without it.

**The gitleaks CI step fails on an organization repo** — gitleaks-action needs
a free licence key for organization-owned repositories (personal accounts need
none). Get one at gitleaks.io and add it as a \`GITLEAKS_LICENSE\` secret.

**Port already in use** — override in \`.env\`: \`PORT=4000\`, or for compose
\`BACKEND_PORT=4000\`.

${database !== 'none' ? `**Database connection refused** — start it with \`docker compose up -d ${database === 'postgres' ? 'postgres' : 'mongodb'}\`.${database === 'postgres' ? ' From inside compose the host is `postgres`, from your machine it is `localhost`.' : ''}\n\n` : ''}**Playwright cannot start the app** — it runs \`npm start\`${isFullstack ? ' and `npm run dev:frontend`' : ''}. Make sure
those work on their own first, then re-run \`npm run test:e2e\`.

---

Scaffolded with [laplateforme-starter](https://www.npmjs.com/package/laplateforme-starter).
`;
}

module.exports = { generateReadme };

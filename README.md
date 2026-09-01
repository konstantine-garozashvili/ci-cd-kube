# 🏛️ laplateforme-starter

Scaffold a production-ready Node.js project whose security gates, CI/CD
pipeline, tests and container images **work from the first commit**.

```bash
npx laplateforme-starter my-app
```

That's it. You get a project that passes its own `npm run lint`, `npm test`,
`npm run test:e2e` and `npm run build` before you write a single line — and a
GitHub Actions pipeline that goes green on the first push.

---

## What you can generate

|              | Options                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| **Backend**  | Express · Hono (ESM) · NestJS (TypeScript)                                             |
| **Frontend** | React + Vite · Vue 3 + Vite · Vanilla + Vite · Next.js (App Router, TypeScript) · none |
| **Database** | PostgreSQL (Prisma) · MongoDB (Mongoose) · none                                        |

Every combination is verified in CI — see [Keeping it honest](#keeping-it-honest).

## Usage

```bash
# Interactive wizard
npx laplateforme-starter my-app

# Non-interactive
npx laplateforme-starter my-api \
  --backend=hono --frontend=none --database=none

# Into the current directory
npx laplateforme-starter . --defaults
```

| Flag                | Effect                                              |
| ------------------- | --------------------------------------------------- |
| `-y`, `--defaults`  | Accept every default without prompting              |
| `--backend=<name>`  | `express` \| `hono` \| `nestjs`                     |
| `--frontend=<name>` | `react` \| `vue` \| `vanilla` \| `nextjs` \| `none` |
| `--database=<name>` | `postgres` \| `mongodb` \| `none`                   |
| `--no-install`      | Skip `npm install`                                  |
| `--no-git`          | Skip `git init` and the initial commit              |
| `--force`           | Scaffold into a non-empty directory                 |

Piping or running without a TTY behaves like `--defaults` rather than hanging
on a prompt.

## What lands in a generated project

**Application**

- Health probes with correct Kubernetes semantics — `/healthz` never checks
  dependencies, `/ready` returns 503 when the database is unreachable.
- A swappable database adapter: the same three functions whichever database you
  picked, so no route code changes between them.
- Graceful shutdown that drains in-flight requests on `SIGTERM`.
- Helmet, CORS and rate limiting, with health probes exempt from the limiter.

**Developer environment**

- `.nvmrc`, `engines`, `.editorconfig`, Prettier and ESLint configured per
  workspace — including JSX, Vue SFC and TypeScript parsers that actually parse.
- Husky hooks: `lint-staged` plus `gitleaks protect` on pre-commit, and a
  Conventional Commits check on `commit-msg`.
- A generated `README.md` explaining the project's own scripts and layout.
- `docker compose up` for the whole stack, with healthchecks and named volumes.

**Pipeline** (`.github/workflows/ci-cd.yml`)

- Gates **pull requests**, not just pushes to main.
- Gitleaks → Prettier → ESLint → `npm audit` → Semgrep → unit → integration →
  Playwright → hadolint → build → Trivy → publish.
- Images are scanned **before** they are published, and never published from a
  pull request.
- Optional Google Chat notification; without the secret it logs a note and passes.

See [`docs/architecture/pipeline_architecture.md`](docs/architecture/pipeline_architecture.md)
for the full pipeline reference.

## Design decisions worth knowing

**`package-lock.json` is committed.** `npm ci` cannot run without it, so
gitignoring the lockfile breaks CI on the first push. Generated `.gitignore`
files deliberately leave it in.

**Docker builds run from the repository root.** npm workspaces keep one
lockfile at the root, so a build context of `./backend` has no lockfile to
install from. Both Dockerfiles are used as `docker build -f backend/Dockerfile .`.

**Dev dependencies are pruned, not skipped.** The backend image runs a full
`npm ci`, builds, runs `postinstall` code generation (Prisma's client), and only
then runs `npm prune --omit=dev`. Installing with `--omit=dev` up front fails
before code generation can happen.

**Prisma needs `openssl` on Alpine.** Without it Prisma detects no platform at
generate time and emits an `openssl-1.1.x` query engine, which then fails to
load against Alpine's OpenSSL 3 (`Error loading shared library libssl.so.1.1`).
The image installs it explicitly. This one only reproduces inside a container.

**The Next.js API proxy lives in `middleware.ts`, not in `next.config.mjs`
rewrites.** Rewrite destinations are serialised into the build output, so a
containerised app would keep proxying to whatever URL was set at build time and
ignore `API_PROXY_TARGET` at runtime. Middleware is evaluated per request, so
one image works in dev, in compose and in production.

**Frontends proxy the API on their own origin.** Vite proxies in development,
nginx proxies in the container, and Next.js rewrites. The browser never makes a
cross-origin request, so there is no CORS to misconfigure — and the E2E API
suite runs through that proxy, which means it also tests the proxy.

**The database is optional at runtime in development.** If it is unreachable the
API still starts and `/ready` honestly reports `DOWN`, so you can work on routes
without Docker running. In production a failed connection exits immediately.

## Keeping it honest

A scaffolder is only as good as the projects it produces, so this repository
tests the output rather than the templates:

```bash
npm test          # 473 assertions across all 45 wizard combinations
npm run smoke     # scaffold 7 real projects, run THEIR gates against them
npm run smoke:quick
```

`scripts/smoke.js` generates each project, then runs its `lint`, `format:check`,
`build`, `test:unit`, `test:integration` and (with `--e2e`) `test:e2e`. It also
asserts statically that:

- every `npm run <script>` the generated workflow invokes actually exists,
- every Dockerfile the workflow and compose file reference was generated,
- `.gitignore` does not exclude `package-lock.json`,
- `docker-compose.yml` carries no obsolete `version` key.

CI runs the full matrix on every pull request, plus a `docker-smoke` matrix
that covers all four Dockerfile shapes the generator emits — workspace backend,
compiled backend, static frontend behind nginx, Next.js standalone, and the
single-package root Dockerfile. Each leg brings the stack up against a real
database, probes the endpoints through the frontend's proxy, and runs the
generated E2E suite against the running containers.

Every shape in that matrix has been built and booted locally: images run as
non-root, report `healthy` to Docker, serve `/ready` as `UP` against a live
database, and shut down cleanly on `SIGTERM` with exit code 0.

## Repository layout

```
bin/cli.js              Argument parsing and orchestration
lib/
├── constants.js        Ports, Node version, valid choices
├── options.js          Validation and the single normalised options shape
├── prompts.js          Interactive wizard
├── scaffold.js         Writes a project to disk
├── fs-utils.js         Copy helpers and exit-code-checked process runner
└── generators/         Everything whose content depends on the answers
    ├── manifest.js     package.json
    ├── docker.js       Dockerfiles + nginx config
    ├── compose.js      docker-compose.yml
    ├── ci.js           GitHub Actions workflow
    ├── config.js       Playwright, .env, gitleaks
    └── docs.js         The generated project's README
templates/              Files copied verbatim into generated projects
scripts/smoke.js        Matrix smoke test
tests/                  Unit tests for the generators
```

Anything byte-identical across projects lives in `templates/`. Anything that
depends on the wizard's answers is produced by a generator. Every generator
reads the same `options` object, so adding a wizard choice means touching one
shape rather than eight signatures.

## Requirements

- Node.js 22 or newer (24 recommended — `.nvmrc` pins it)
- npm 10+
- Docker, only if you pick a database or want to build images

## Contributing

```bash
npm install
npm run lint && npm test
npm run smoke:quick
```

Adding a framework means adding a directory under `templates/`, a branch in the
relevant generator, and an entry in the `MATRIX` in `scripts/smoke.js`. The
smoke test will tell you what you missed.

## License

MIT © Konstantine Garozashvili

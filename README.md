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
- Database credentials are generated per project, written to a gitignored
  `.env`, and referenced from compose as `\${POSTGRES_PASSWORD:?…}` — so the
  stack refuses to start on a missing password rather than falling back to a
  guessable default, and nothing committed carries a real credential.
- CI and CD are separated: builds and CVE scans run on pull requests, but the
  publish step is skipped unless the run came from main or a version tag.
- `permissions: {}` at the workflow level; each job requests only what it needs.
- Gitleaks → Prettier → ESLint → `npm audit` → Semgrep → unit → integration →
  Playwright → hadolint → build → Trivy → publish.
- Images are scanned **before** they are published, and never published from a
  pull request.
- Optional Google Chat notification; without the secret it logs a note and passes.

See [`docs/architecture/pipeline_architecture.md`](docs/architecture/pipeline_architecture.md)
for the full pipeline reference.

## Dependency versions

**Versions are resolved when someone scaffolds, not when this package is
released.** Run it in three years and you get whatever is current then — no
maintenance needed here, and no waiting for a release of this tool.

Two things are resolved at init time:

- **Node.js** — the current Active LTS, from the official release index. It sets
  `.nvmrc`, the Docker base image, the CI matrix and the `engines` floor (the
  previous LTS), so all four can never drift apart.
- **Every framework and tool** — React, Vue, Next.js, NestJS, Express, Hono,
  Prisma, Vite, ESLint and the rest, from their `latest` dist-tag on npm.

```bash
npx laplateforme-starter my-app            # current stable, the default
npx laplateforme-starter my-app --pinned   # the exact set this tool was tested against
```

### Why that is safe

"Always latest" breaks projects if you do it naively. Four guards make it work:

**Ceilings.** Some majors are known to break a generated project, and are held
back with the reason recorded in `lib/versions.js`:

| Package      | Held at | Why                                                                                                                                          |
| ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint`     | 9.x     | `eslint-plugin-react`'s peer range stops at `^9.7`, so ESLint 10 fails to install without `--legacy-peer-deps`.                              |
| `prisma`     | 6.x     | Prisma 7's client generator emits TypeScript only, so the JavaScript backends would need a compile step to import their own database client. |
| `@nestjs/*`  | 11.x    | NestJS 12 is ESM-only, which needs the template converted to ESM and a Jest ESM setup.                                                       |
| `typescript` | 6.0.x   | Three peer ranges must intersect: `@nestjs/schematics` needs `>=6`, `ts-jest` needs `<7`, `typescript-eslint` needs `<6.1`.                  |

**No prereleases.** npm's `latest` tag is not always a stable release — while
this was written, Prisma had `8.0.0-rc.12` sitting on it.

**Automatic fallback.** A ceiling can only describe breakage that is already
known. If a _future_ release breaks the install, the scaffolder rewrites every
manifest with the tested set and retries, rather than handing over a project
that cannot start:

```
⚠ npm install did not complete: npm install exited with code 1
⚠ Install failed with current releases — retrying with the tested versions.
✔ Installed with the tested versions.
```

**Offline degradation.** If npm or nodejs.org is slow or unreachable, resolution
falls back to the tested baseline instead of failing the scaffold.

### Keeping the baseline honest

The tested baseline still matters — it is the fallback, so it must stay current.

```bash
npm run versions:report
```

Shows what has drifted and which ceilings now have a newer major behind them.
A weekly **dependency canary** scaffolds against current releases, runs the full
gates, and files an issue when an upstream release breaks a generated project —
so breakage surfaces here within a week rather than in someone's first install.

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
npm test               # 535 assertions across all 45 wizard combinations
npm run smoke          # scaffold 8 real projects, run THEIR gates against them
npm run smoke -- --latest   # …against today's npm releases instead
npm run versions:report
npm run check:actions
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
database, and drain in-flight requests on `SIGTERM` before disconnecting.

The Express and Hono images exit 0 after draining. NestJS re-raises the signal
once its shutdown hooks finish, so it exits 143 — the conventional code for a
process terminated by a signal, and what Kubernetes expects. All three log the
drain, so a container that was killed outright is distinguishable from one that
closed cleanly.

## Repository layout

```
bin/cli.js              Argument parsing and orchestration
lib/
├── constants.js        Ports, Node version, valid choices
├── versions.js         Every dependency version + the ceilings, with reasons
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
.github/workflows/
├── ci.yml              Lint, test, scaffold-smoke, image build — publishes nothing
├── release.yml         Tag-triggered: re-verifies, then publishes to npm
└── dependency-canary.yml   Weekly run against current releases
scripts/
├── smoke.js            Matrix smoke test (add --latest for the canary mode)
├── versions-report.js  Drift between the baseline and npm today
└── check-actions.js    Resolves every action reference in the generated workflow
tests/                  Unit tests for the generators
```

Anything byte-identical across projects lives in `templates/`. Anything that
depends on the wizard's answers is produced by a generator. Every generator
reads the same `options` object, so adding a wizard choice means touching one
shape rather than eight signatures.

## Requirements

- Node.js 22 or newer. Generated projects pin whatever LTS is current when you scaffold them.
- npm 10+
- Docker, only if you pick a database or want to build images

## Releasing

CI and CD are deliberately separate workflows:

|               | Trigger                    | Can publish?                                |
| ------------- | -------------------------- | ------------------------------------------- |
| `ci.yml`      | pull request, push to main | **No** — it has no write permissions at all |
| `release.yml` | `v*` tag                   | Yes, after re-verifying the tagged commit   |

Nothing a contributor can trigger reaches npm. A tag is not proof the code was
ever green — it can be pushed to any commit — so `release.yml` re-runs the
lint, audit, tests, packaging check and the full smoke matrix against the tagged
commit before publishing.

```bash
npm version minor        # bumps package.json and creates the tag
git push --follow-tags
```

The publish job runs in the `npm-publish` environment. Add a required reviewer
there to make every release need a human approval, and store `NPM_TOKEN` as an
environment secret rather than a repository secret so no other workflow can read
it. Publishing uses `--provenance`, which signs the package with a verifiable
link back to the workflow run.

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

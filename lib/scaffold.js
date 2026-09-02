'use strict';

const fs = require('fs');
const path = require('path');

const { copyDir, copyFile, writeFile, writeJson, run, commandExists } = require('./fs-utils');
const {
  generateRootPackageJson,
  generateBackendPackageJson,
  generateFrontendPackageJson,
} = require('./generators/manifest');
const {
  generateBackendDockerfile,
  generateFrontendDockerfile,
  generateNginxConfTemplate,
} = require('./generators/docker');
const { generateGitHubWorkflow } = require('./generators/ci');
const { generateDockerCompose } = require('./generators/compose');
const {
  generatePlaywrightConfig,
  generateBackendEnv,
  generateFrontendEnv,
  generateGitleaksConfig,
} = require('./generators/config');
const { generateReadme } = require('./generators/docs');
const { DB_TEMPLATE_DIR, NODE_VERSION } = require('./constants');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const TEMPLATES = path.join(PACKAGE_ROOT, 'templates');

/**
 * Writes an entire project to disk.
 *
 * Ordering matters in two places and nowhere else:
 *  - `git init` runs *before* `npm install`, because husky's `prepare` script
 *    can only install hooks into an existing repository.
 *  - the initial commit runs *after* the install, so the lockfile is committed.
 *
 * @param {object} options normalised options from `buildOptions`
 * @param {object} hooks   `{ onStep(message), onWarn(message) }`
 */
function scaffold(options, hooks = {}) {
  const step = hooks.onStep || (() => {});
  const warn = hooks.onWarn || (() => {});

  const { targetPath, isFullstack, backend, frontend, database } = options;
  const backendPath = isFullstack ? path.join(targetPath, 'backend') : targetPath;

  fs.mkdirSync(targetPath, { recursive: true });

  writeBackend(options, backendPath);
  step(`backend/ — ${backend} API with health probes and ${database} support`);

  if (isFullstack) {
    writeFrontend(options, path.join(targetPath, 'frontend'));
    step(`frontend/ — ${frontend} with a same-origin API proxy`);
  }

  writeSharedRoot(options);
  step('root config — editorconfig, nvmrc, prettier, gitleaks, husky hooks');

  writeTests(options);
  step('tests/e2e/ — Playwright browser and API contract suites');

  writeJson(path.join(targetPath, 'package.json'), generateRootPackageJson(options));
  writeFile(path.join(targetPath, 'playwright.config.js'), generatePlaywrightConfig(options));
  step('package.json + playwright.config.js');

  writeFile(
    path.join(targetPath, '.github', 'workflows', 'ci-cd.yml'),
    generateGitHubWorkflow(options)
  );
  step('.github/workflows/ci-cd.yml — gates pushes and pull requests');

  writeFile(path.join(targetPath, 'docker-compose.yml'), generateDockerCompose(options));
  writeFile(path.join(targetPath, 'README.md'), generateReadme(options));
  step('docker-compose.yml + README.md');

  return { backendPath, warn };
}

// ---------------------------------------------------------------------------

function writeBackend(options, backendPath) {
  const { backend, database, isFullstack, targetPath } = options;

  copyDir(path.join(TEMPLATES, 'backend', backend), backendPath);

  // The backend workspace gets its own manifest only in monorepo mode; in
  // single-package mode the root manifest already carries the backend scripts.
  if (isFullstack) {
    writeJson(path.join(backendPath, 'package.json'), generateBackendPackageJson(options));
  }

  writeDatabaseAdapter(options, backendPath);

  writeFile(path.join(backendPath, 'Dockerfile'), generateBackendDockerfile(options));

  const env = generateBackendEnv(options);
  writeFile(path.join(backendPath, '.env.example'), env);
  writeFile(path.join(backendPath, '.env'), env);

  // Express serves the shared landing page so a backend-only project still has
  // something to open in a browser.
  if (backend === 'express' && !isFullstack) {
    // index.html loads /app.js as a module, so both files have to land in the
    // static directory — the page is inert without the script.
    for (const asset of ['index.html', 'app.js']) {
      copyFile(
        path.join(TEMPLATES, 'frontend', 'vanilla', asset),
        path.join(backendPath, 'src', 'public', asset)
      );
    }
  }

  if (isFullstack) {
    // Compose reads these from a root .env to let ports be overridden.
    const rootEnv = `# Overrides for docker-compose.yml. Application configuration lives in
# backend/.env and frontend/.env.
BACKEND_PORT=3000
FRONTEND_PORT=5173
${database === 'postgres' ? 'POSTGRES_PORT=5432\n' : ''}${database === 'mongodb' ? 'MONGO_PORT=27017\n' : ''}`;
    writeFile(path.join(targetPath, '.env.example'), rootEnv);
    writeFile(path.join(targetPath, '.env'), rootEnv);
  }
}

/**
 * Drops in the database adapter that matches the chosen backend's module system
 * and language. Every variant exports the same three functions, so no route or
 * bootstrap code changes between databases.
 */
function writeDatabaseAdapter(options, backendPath) {
  const { backend, database } = options;
  const dbTemplate = path.join(TEMPLATES, 'db', DB_TEMPLATE_DIR[database]);

  if (backend === 'nestjs') {
    if (database !== 'none') {
      copyFile(
        path.join(dbTemplate, 'nest.service.ts'),
        path.join(backendPath, 'src', 'database', 'database.service.ts')
      );
    }
  } else {
    const isEsm = backend === 'hono';
    copyFile(
      path.join(dbTemplate, isEsm ? 'index.mjs' : 'index.js'),
      path.join(backendPath, 'src', 'db', 'index.js')
    );
  }

  if (database === 'postgres') {
    copyFile(
      path.join(TEMPLATES, 'db', 'prisma', 'schema.prisma'),
      path.join(backendPath, 'prisma', 'schema.prisma')
    );
  }

  if (database === 'mongodb' && backend !== 'nestjs') {
    const model = backend === 'hono' ? 'User.mjs' : 'User.js';
    copyFile(
      path.join(TEMPLATES, 'db', 'mongoose', 'models', model),
      path.join(backendPath, 'src', 'models', 'User.js')
    );
  }
}

function writeFrontend(options, frontendPath) {
  const { frontend } = options;

  copyDir(path.join(TEMPLATES, 'frontend', frontend), frontendPath);

  writeJson(path.join(frontendPath, 'package.json'), generateFrontendPackageJson(options));
  writeFile(path.join(frontendPath, 'Dockerfile'), generateFrontendDockerfile(options));

  if (frontend !== 'nextjs') {
    writeFile(path.join(frontendPath, 'nginx.conf.template'), generateNginxConfTemplate());
  }

  const env = generateFrontendEnv(options);
  writeFile(path.join(frontendPath, '.env.example'), env);
  writeFile(path.join(frontendPath, '.env'), env);
}

function writeSharedRoot(options) {
  const { targetPath } = options;

  copyDir(path.join(TEMPLATES, 'shared'), targetPath, { skip: ['gitignore', '.nvmrc'] });

  // .nvmrc follows whatever Node LTS was resolved at scaffold time, so it stays
  // correct years from now without anyone editing this repository.
  const nodeMajor = (options.node && options.node.major) || NODE_VERSION;
  writeFile(path.join(targetPath, '.nvmrc'), String(nodeMajor));

  // npm strips any file literally named ".gitignore" from a published tarball,
  // so the template is stored without the dot and renamed on the way out.
  // Without this, projects scaffolded from npm would have no .gitignore at all.
  copyFile(path.join(TEMPLATES, 'shared', 'gitignore'), path.join(targetPath, '.gitignore'));

  writeFile(path.join(targetPath, '.gitleaks.toml'), generateGitleaksConfig(options));
}

function writeTests(options) {
  const { targetPath, hasUi } = options;
  const e2eDir = path.join(targetPath, 'tests', 'e2e');

  copyFile(path.join(TEMPLATES, 'tests', 'e2e', 'api.spec.js'), path.join(e2eDir, 'api.spec.js'));

  if (hasUi) {
    copyFile(path.join(TEMPLATES, 'tests', 'e2e', 'app.spec.js'), path.join(e2eDir, 'app.spec.js'));
  }
}

// ---------------------------------------------------------------------------
// Post-generation automation
// ---------------------------------------------------------------------------

/**
 * `git init` must precede `npm install` so husky can install its hooks; the
 * commit must follow it so package-lock.json lands in the first commit.
 */
function initialiseGit(targetPath, { onStep, onWarn }) {
  if (!commandExists('git')) {
    onWarn('git is not installed — skipping repository initialisation.');
    return false;
  }

  if (fs.existsSync(path.join(targetPath, '.git'))) {
    onStep('Existing git repository detected — leaving it alone.');
    return true;
  }

  const init = run('git', ['init', '--initial-branch=main'], targetPath, { stdio: 'ignore' });
  if (!init.ok) {
    onWarn(`git init failed: ${init.reason}`);
    return false;
  }

  onStep('Initialised a git repository on branch main.');
  return true;
}

/**
 * @param {{ adviseManualRetry?: boolean }} opts pass false when a fallback will
 *   run next, so the user is not told to fix something that is about to be
 *   handled automatically.
 */
function installDependencies(targetPath, { onWarn }, { adviseManualRetry = true } = {}) {
  const result = run('npm', ['install'], targetPath);

  if (!result.ok) {
    onWarn(`npm install did not complete: ${result.reason}`);
    if (adviseManualRetry) {
      onWarn('Run "npm install" yourself once the problem above is resolved.');
    }
    return false;
  }

  return true;
}

/**
 * Runs Prettier over the generated tree so `npm run format:check` passes from
 * the very first commit. Generators emit readable code, not Prettier-exact
 * code, and a starter whose own format gate fails is worse than no gate.
 */
function normaliseFormatting(targetPath, { onWarn }) {
  const result = run('npm', ['run', 'format'], targetPath, { stdio: 'ignore' });

  if (!result.ok) {
    onWarn('Could not run Prettier over the new project — run "npm run format" yourself.');
    return false;
  }

  return true;
}

/**
 * Rewrites every manifest with the tested baseline and retries the install.
 *
 * Resolving current releases means a project can be generated against versions
 * this scaffolder has never seen. That is the point — but it also means a future
 * breaking release could land in someone's first install. Rather than hand them
 * a broken project, fall back to the set that is known to work and say so.
 *
 * @returns {boolean} whether the retry produced a working install
 */
function fallBackToPinnedVersions(options, { onStep, onWarn }) {
  const { targetPath, isFullstack, pinnedFallback } = options;

  if (!pinnedFallback) {
    return false;
  }

  onWarn('Install failed with current releases — retrying with the tested versions.');

  const pinned = {
    ...options,
    versions: pinnedFallback.versions,
    node: pinnedFallback.node,
  };

  writeJson(path.join(targetPath, 'package.json'), generateRootPackageJson(pinned));
  writeFile(path.join(targetPath, '.nvmrc'), String(pinned.node.major));

  if (isFullstack) {
    writeJson(path.join(targetPath, 'backend', 'package.json'), generateBackendPackageJson(pinned));
    writeJson(
      path.join(targetPath, 'frontend', 'package.json'),
      generateFrontendPackageJson(pinned)
    );
  }

  // A lockfile written from the failed attempt would pin the broken tree.
  fs.rmSync(path.join(targetPath, 'package-lock.json'), { force: true });
  fs.rmSync(path.join(targetPath, 'node_modules'), { recursive: true, force: true });

  const retry = run('npm', ['install'], targetPath);
  if (!retry.ok) {
    onWarn(`Retry also failed: ${retry.reason}`);
    onWarn('Run "npm install" yourself once the problem above is resolved.');
    return false;
  }

  onStep('Installed with the tested versions. Run "npm run versions:report" to see what differed.');
  return true;
}

function createInitialCommit(targetPath, { onWarn }) {
  const add = run('git', ['add', '.'], targetPath, { stdio: 'ignore' });
  if (!add.ok) {
    onWarn(`git add failed: ${add.reason}`);
    return false;
  }

  // --no-verify: the hooks this project just installed would lint files the
  // user has not seen yet, and a failing hook here is confusing noise.
  const commit = run(
    'git',
    ['commit', '--no-verify', '-m', 'feat: initial commit from laplateforme-starter'],
    targetPath,
    { stdio: 'ignore' }
  );

  if (!commit.ok) {
    onWarn(`git commit failed: ${commit.reason}`);
    onWarn('Your files are on disk — commit them manually when ready.');
    return false;
  }

  return true;
}

module.exports = {
  scaffold,
  initialiseGit,
  installDependencies,
  fallBackToPinnedVersions,
  normaliseFormatting,
  createInitialCommit,
};

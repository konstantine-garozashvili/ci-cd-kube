#!/usr/bin/env node
'use strict';

/**
 * Scaffolds a matrix of projects and runs each one's own quality gates against
 * it. This is the check that keeps the generator honest: a template can only
 * regress here, never in a user's first five minutes.
 *
 *   npm run smoke          full matrix
 *   npm run smoke:quick    two representative combinations
 *   node scripts/smoke.js --keep --only=nestjs-nextjs-postgres
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLI = path.join(REPO_ROOT, 'bin', 'cli.js');

const MATRIX = [
  { id: 'express-react-postgres', backend: 'express', frontend: 'react', database: 'postgres' },
  { id: 'express-vanilla-none', backend: 'express', frontend: 'vanilla', database: 'none' },
  { id: 'hono-vue-mongodb', backend: 'hono', frontend: 'vue', database: 'mongodb' },
  // Hono is ESM, so it uses a different Prisma adapter than the CommonJS
  // backends. Cover that pairing explicitly rather than inferring it from
  // hono+mongo and express+postgres passing separately.
  { id: 'hono-react-postgres', backend: 'hono', frontend: 'react', database: 'postgres' },
  { id: 'nestjs-nextjs-postgres', backend: 'nestjs', frontend: 'nextjs', database: 'postgres' },
  { id: 'express-api-only', backend: 'express', frontend: 'none', database: 'none' },
  { id: 'hono-api-only', backend: 'hono', frontend: 'none', database: 'mongodb' },
  { id: 'nestjs-api-only', backend: 'nestjs', frontend: 'none', database: 'none' },
];

const QUICK = ['express-react-postgres', 'hono-api-only'];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message) {
  console.log(message);
}

function exec(command, args, cwd, { capture = true } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    stdio: capture ? 'pipe' : 'inherit',
    env: { ...process.env, CI: 'true', npm_config_fund: 'false', npm_config_audit: 'false' },
  });

  const output = capture ? `${result.stdout || ''}${result.stderr || ''}` : '';
  return { ok: result.status === 0, status: result.status, output, error: result.error };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * The regression that broke every generated project historically: the workflow
 * called root npm scripts that only existed in single-package mode. Parse the
 * generated workflow and assert every `npm run <script>` it invokes is real.
 */
function checkWorkflowScriptsExist(projectDir) {
  const workflowPath = path.join(projectDir, '.github', 'workflows', 'ci-cd.yml');

  if (!fs.existsSync(workflowPath)) {
    return ['.github/workflows/ci-cd.yml was not generated'];
  }

  let workflow;
  try {
    workflow = yaml.load(fs.readFileSync(workflowPath, 'utf-8'));
  } catch (err) {
    return [`ci-cd.yml is not valid YAML: ${err.message}`];
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
  const scripts = new Set(Object.keys(manifest.scripts || {}));
  const problems = [];

  for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
    for (const step of job.steps || []) {
      if (typeof step.run !== 'string') {
        continue;
      }

      for (const match of step.run.matchAll(/npm run ([a-z0-9:_-]+)/g)) {
        if (!scripts.has(match[1])) {
          problems.push(`job "${jobName}" runs "npm run ${match[1]}" but no such script exists`);
        }
      }

      // `npm start` maps to the "start" script.
      if (/(^|\s|&&\s*)npm start\b/.test(step.run) && !scripts.has('start')) {
        problems.push(`job "${jobName}" runs "npm start" but no "start" script exists`);
      }
    }
  }

  return problems;
}

/** Every Dockerfile the workflow and compose file reference must exist. */
function checkReferencedFilesExist(projectDir) {
  const problems = [];
  const workflowPath = path.join(projectDir, '.github', 'workflows', 'ci-cd.yml');
  const workflow = yaml.load(fs.readFileSync(workflowPath, 'utf-8'));

  const dockerJob = workflow.jobs?.docker;
  for (const entry of dockerJob?.strategy?.matrix?.include || []) {
    if (!fs.existsSync(path.join(projectDir, entry.dockerfile))) {
      problems.push(`workflow builds "${entry.dockerfile}" but that file was not generated`);
    }
  }

  const composePath = path.join(projectDir, 'docker-compose.yml');
  if (fs.existsSync(composePath)) {
    const compose = yaml.load(fs.readFileSync(composePath, 'utf-8'));
    if (compose.version !== undefined) {
      problems.push('docker-compose.yml still has an obsolete top-level "version" key');
    }
    for (const [name, service] of Object.entries(compose.services || {})) {
      if (!service.build) {
        continue;
      }
      const dockerfile = service.build.dockerfile || 'Dockerfile';
      const context = service.build.context || '.';
      const resolved = path.join(projectDir, context, dockerfile);
      if (!fs.existsSync(resolved)) {
        problems.push(`compose service "${name}" builds "${dockerfile}" which does not exist`);
      }
    }
  }

  return problems;
}

/** Files a developer should always find in a fresh project. */
function checkExpectedFiles(projectDir, config) {
  const required = [
    'README.md',
    '.gitignore',
    '.editorconfig',
    '.nvmrc',
    '.prettierrc',
    '.gitleaks.toml',
    '.husky/pre-commit',
    '.husky/commit-msg',
    'playwright.config.js',
    'tests/e2e/api.spec.js',
    'package-lock.json',
  ];

  const problems = required
    .filter((file) => !fs.existsSync(path.join(projectDir, file)))
    .map((file) => `expected ${file} to be generated`);

  // The lockfile has to be committable — npm ci in CI depends on it.
  const gitignorePath = path.join(projectDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (/^\s*package-lock\.json\s*$/m.test(gitignore)) {
      problems.push('.gitignore excludes package-lock.json, which breaks "npm ci" in CI');
    }
  }

  if (
    config.database === 'postgres' &&
    !fs.existsSync(path.join(projectDir, dbSchemaPath(config)))
  ) {
    problems.push('a PostgreSQL project was generated without a Prisma schema');
  }

  return problems;
}

function dbSchemaPath(config) {
  return config.frontend === 'none'
    ? path.join('prisma', 'schema.prisma')
    : path.join('backend', 'prisma', 'schema.prisma');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function runCase(config, workDir, options) {
  const projectDir = path.join(workDir, config.id);
  const failures = [];

  log(`\n${colors.cyan}${colors.bright}▸ ${config.id}${colors.reset}`);

  const scaffoldResult = exec(
    process.execPath,
    [
      CLI,
      config.id,
      '--defaults',
      '--no-git',
      // Default to --pinned so a normal run is deterministic and exercises the
      // baseline the automatic fallback depends on. --latest is the canary mode.
      ...(options.latest ? [] : ['--pinned']),
      `--backend=${config.backend}`,
      `--frontend=${config.frontend}`,
      `--database=${config.database}`,
    ],
    workDir
  );

  if (!scaffoldResult.ok) {
    failures.push(`scaffolding failed:\n${indent(scaffoldResult.output)}`);
    return { id: config.id, failures };
  }
  log(`  ${colors.green}✔${colors.reset} scaffolded`);

  // Static checks first: they are instant and describe the failure precisely.
  for (const [label, check] of [
    ['expected files', () => checkExpectedFiles(projectDir, config)],
    ['workflow scripts resolve', () => checkWorkflowScriptsExist(projectDir)],
    ['referenced files exist', () => checkReferencedFilesExist(projectDir)],
  ]) {
    const problems = check();
    if (problems.length) {
      failures.push(`${label}:\n${indent(problems.join('\n'))}`);
      log(`  ${colors.red}✗${colors.reset} ${label}`);
    } else {
      log(`  ${colors.green}✔${colors.reset} ${label}`);
    }
  }

  // Then the project's own gates, exactly as a user would run them.
  const gates = [
    ['npm run lint', ['run', 'lint']],
    ['npm run format:check', ['run', 'format:check']],
    ['npm run build', ['run', 'build', '--if-present']],
    ['npm run test:unit', ['run', 'test:unit']],
    ['npm run test:integration', ['run', 'test:integration']],
  ];

  for (const [label, args] of gates) {
    const result = exec('npm', args, projectDir);
    if (result.ok) {
      log(`  ${colors.green}✔${colors.reset} ${label}`);
    } else {
      failures.push(`${label} failed:\n${indent(tail(result.output, 40))}`);
      log(`  ${colors.red}✗${colors.reset} ${label}`);
    }
  }

  if (options.e2e) {
    const result = exec('npm', ['run', 'test:e2e'], projectDir);
    if (result.ok) {
      log(`  ${colors.green}✔${colors.reset} npm run test:e2e`);
    } else {
      failures.push(`npm run test:e2e failed:\n${indent(tail(result.output, 40))}`);
      log(`  ${colors.red}✗${colors.reset} npm run test:e2e`);
    }
  }

  return { id: config.id, failures };
}

function indent(text) {
  return String(text)
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');
}

function tail(text, lines) {
  return String(text).split('\n').slice(-lines).join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const options = {
    quick: argv.includes('--quick'),
    keep: argv.includes('--keep'),
    e2e: argv.includes('--e2e'),
    // Scaffolds against current npm releases instead of the tested baseline.
    // The weekly canary uses this to find upstream breakage early; a plain run
    // stays pinned so results are reproducible.
    latest: argv.includes('--latest'),
    only: (argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length),
  };

  let cases = MATRIX;
  if (options.only) {
    const wanted = options.only.split(',');
    cases = MATRIX.filter((entry) => wanted.includes(entry.id));
  } else if (options.quick) {
    cases = MATRIX.filter((entry) => QUICK.includes(entry.id));
  }

  if (cases.length === 0) {
    console.error(`No matching cases. Available: ${MATRIX.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }

  const workDir = options.keep
    ? path.join(REPO_ROOT, '.smoke')
    : fs.mkdtempSync(path.join(os.tmpdir(), 'lp-smoke-'));

  fs.mkdirSync(workDir, { recursive: true });

  log(
    `${colors.bright}Scaffold smoke test${colors.reset} ${colors.dim}(${cases.length} combination${
      cases.length === 1 ? '' : 's'
    } in ${workDir})${colors.reset}`
  );

  if (options.latest) {
    log(
      `${colors.yellow}Resolving dependencies from npm rather than the tested baseline.${colors.reset}`
    );
  }

  const started = Date.now();
  const results = cases.map((config) => runCase(config, workDir, options));
  const elapsed = Math.round((Date.now() - started) / 1000);

  const failed = results.filter((result) => result.failures.length > 0);

  log(`\n${colors.bright}Summary${colors.reset} ${colors.dim}(${elapsed}s)${colors.reset}`);
  for (const result of results) {
    const icon =
      result.failures.length === 0
        ? `${colors.green}PASS${colors.reset}`
        : `${colors.red}FAIL${colors.reset}`;
    log(`  ${icon}  ${result.id}`);
  }

  if (failed.length > 0) {
    log(`\n${colors.red}${colors.bright}${failed.length} combination(s) failed${colors.reset}`);
    for (const result of failed) {
      log(`\n${colors.red}▸ ${result.id}${colors.reset}`);
      for (const failure of result.failures) {
        log(`    ${failure}`);
      }
    }
  }

  if (!options.keep) {
    fs.rmSync(workDir, { recursive: true, force: true });
  } else {
    log(`\n${colors.dim}Generated projects kept in ${workDir}${colors.reset}`);
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main();

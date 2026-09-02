const yaml = require('js-yaml');

const { buildOptions } = require('../lib/options');
const { generateRootPackageJson } = require('../lib/generators/manifest');
const { generateGitHubWorkflow } = require('../lib/generators/ci');
const { generateDockerCompose } = require('../lib/generators/compose');
const {
  generateBackendDockerfile,
  generateFrontendDockerfile,
} = require('../lib/generators/docker');
const { generatePlaywrightConfig, generateBackendEnv } = require('../lib/generators/config');
const { generateReadme } = require('../lib/generators/docs');
const { BACKENDS, FRONTENDS, DATABASES } = require('../lib/constants');

/** Every combination the wizard can produce. */
const COMBINATIONS = BACKENDS.filter((b) => b !== 'none').flatMap((backend) =>
  FRONTENDS.flatMap((frontend) =>
    DATABASES.map((database) => ({
      backend,
      frontend,
      database,
      label: `${backend} + ${frontend} + ${database}`,
    }))
  )
);

function optionsFor({ backend, frontend, database }) {
  return buildOptions({ targetPath: '/tmp/demo', name: 'demo', backend, frontend, database });
}

describe.each(COMBINATIONS)('$label', (combination) => {
  const options = optionsFor(combination);
  const manifest = generateRootPackageJson(options);
  const workflow = yaml.load(generateGitHubWorkflow(options));

  it('generates a workflow that is valid YAML with the expected jobs', () => {
    expect(Object.keys(workflow.jobs)).toEqual(
      expect.arrayContaining(['quality-gate', 'e2e', 'docker', 'notify'])
    );
  });

  /**
   * The historical failure mode: the workflow called root scripts that only
   * existed in single-package mode, so every generated monorepo failed CI on
   * the first push.
   */
  it('only invokes npm scripts that the root manifest defines', () => {
    const scripts = new Set(Object.keys(manifest.scripts));
    const missing = [];

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      for (const step of job.steps || []) {
        if (typeof step.run !== 'string') {
          continue;
        }
        for (const [, script] of step.run.matchAll(/npm run ([a-z0-9:_-]+)/g)) {
          if (!scripts.has(script)) {
            missing.push(`${jobName}: npm run ${script}`);
          }
        }
        if (/(^|\s|&&\s*)npm start\b/.test(step.run) && !scripts.has('start')) {
          missing.push(`${jobName}: npm start`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('builds only Dockerfiles that this combination actually generates', () => {
    const built = workflow.jobs.docker.strategy.matrix.include.map((entry) => entry.dockerfile);
    const generated = options.dockerTargets.map((target) => target.dockerfile);
    expect(built.sort()).toEqual(generated.sort());
  });

  it('gates pull requests, not just pushes to main', () => {
    expect(workflow.on.pull_request).toBeDefined();
  });

  it('produces compose services whose build files exist in the plan', () => {
    const compose = yaml.load(generateDockerCompose(options));
    expect(compose.version).toBeUndefined();

    const planned = new Set(options.dockerTargets.map((target) => target.dockerfile));
    for (const service of Object.values(compose.services)) {
      if (service.build) {
        expect(planned.has(service.build.dockerfile)).toBe(true);
      }
    }
  });

  it('never ships a wildcard CORS origin in the compose stack', () => {
    expect(generateDockerCompose(options)).not.toMatch(/CORS_ORIGIN:\s*\*/);
  });

  it('declares a Node engine range and a private manifest', () => {
    expect(manifest.private).toBe(true);
    expect(manifest.engines.node).toMatch(/^>=\d+/);
  });

  it('writes a Dockerfile that installs from the root lockfile', () => {
    const dockerfile = generateBackendDockerfile(options);
    expect(dockerfile).toContain('package-lock.json');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('HEALTHCHECK');
    // --omit=dev at install time would break Prisma's client generation and
    // any compile step, so dev dependencies are pruned after the build.
    expect(dockerfile).not.toMatch(/^RUN npm ci[^\n]*--omit=dev/m);
    expect(dockerfile).toContain('npm prune --omit=dev');
  });

  it('starts every server Playwright needs', () => {
    const config = generatePlaywrightConfig(options);
    const servers = config.match(/command: '([^']+)'/g) || [];
    expect(servers).toHaveLength(options.isFullstack ? 2 : 1);

    for (const server of servers) {
      const script = server.replace("command: 'npm run ", '').replace("'", '');
      expect(Object.keys(manifest.scripts)).toContain(script.trim());
    }
  });

  it('documents the project in a README that names the real choices', () => {
    const readme = generateReadme(options);
    expect(readme).toContain('# demo');
    expect(readme).toContain('/healthz');
    expect(readme).toContain('package-lock.json');
  });
});

describe('frontend Dockerfiles', () => {
  it.each(['react', 'vue', 'vanilla'])('serves the %s build through nginx', (frontend) => {
    const dockerfile = generateFrontendDockerfile(
      optionsFor({ backend: 'express', frontend, database: 'none' })
    );
    expect(dockerfile).toContain('nginx');
    expect(dockerfile).toContain('nginx.conf.template');
  });

  it('uses the Next.js standalone server instead of nginx', () => {
    const dockerfile = generateFrontendDockerfile(
      optionsFor({ backend: 'express', frontend: 'nextjs', database: 'none' })
    );
    expect(dockerfile).toContain('.next/standalone');
    expect(dockerfile).not.toContain('nginx');
  });
});

/**
 * The generated compose file used to carry a hardcoded database password, which
 * a secret scanner rightly flagged. The credential is generated per project now
 * and kept out of every committed file, so guard both halves of that.
 *
 * The needles below are assembled at runtime on purpose: writing them out as
 * literals would put credential-shaped strings back into a committed file and
 * trip the very scanners this guards against.
 */
describe('database credentials never appear in committed files', () => {
  const withDb = buildOptions({
    targetPath: '/tmp/demo',
    name: 'demo',
    backend: 'express',
    frontend: 'react',
    database: 'postgres',
  });

  const dbUser = 'post' + 'gres';

  it('compose carries no literal password', () => {
    const compose = generateDockerCompose(withDb);
    expect(compose).not.toContain(`POSTGRES_PASSWORD: ${dbUser}`);
    expect(compose).not.toContain(`${dbUser}:${dbUser}@`);
  });

  it('compose refuses to start when the password is unset', () => {
    expect(generateDockerCompose(withDb)).toContain('POSTGRES_PASSWORD:?');
  });

  it('the committed backend .env.example carries a placeholder, not a secret', () => {
    const example = generateBackendEnv(withDb, { dbPassword: 'replace-with-your-own' });
    expect(example).toContain('replace-with-your-own');
    expect(example).not.toContain(`${dbUser}:${dbUser}@`);
  });

  it('mongo runs with authentication enabled', () => {
    const mongo = buildOptions({
      targetPath: '/tmp/demo',
      name: 'demo',
      backend: 'hono',
      frontend: 'vue',
      database: 'mongodb',
    });
    const compose = generateDockerCompose(mongo);

    // Without root credentials the container accepts any connection at all,
    // which is worse than a weak password because nothing flags it.
    expect(compose).toContain('MONGO_INITDB_ROOT_USERNAME');
    expect(compose).toContain('MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:?}');
    expect(compose).toContain('authSource=admin');
  });

  it('a generated password reaches the mongo connection string', () => {
    const mongo = buildOptions({
      targetPath: '/tmp/demo',
      name: 'demo',
      backend: 'hono',
      frontend: 'vue',
      database: 'mongodb',
    });
    const token = 'unit-test-placeholder';
    expect(generateBackendEnv(mongo, { dbPassword: token })).toContain(
      `app:${token}@localhost:27017/app_db?authSource=admin`
    );
  });

  it('a generated password reaches the backend DATABASE_URL', () => {
    const token = 'unit-test-placeholder';
    expect(generateBackendEnv(withDb, { dbPassword: token })).toContain(
      `${dbUser}:${token}@localhost:5432/app_db`
    );
  });
});

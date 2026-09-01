#!/usr/bin/env node
'use strict';

/**
 * Resolves every `uses:` reference in the generated workflow against GitHub.
 *
 * A pinned tag that does not exist fails the very first pipeline run with a
 * message that points at the workflow rather than at the scaffolder, so this
 * check exists to catch it before anyone generates a project.
 *
 * Network-dependent, so it is a separate script rather than a unit test.
 *   node scripts/check-actions.js
 */

const yaml = require('js-yaml');
const { buildOptions } = require('../lib/options');
const { generateGitHubWorkflow } = require('../lib/generators/ci');
const { BACKENDS, FRONTENDS, DATABASES } = require('../lib/constants');

function collectActionRefs() {
  const refs = new Set();

  for (const backend of BACKENDS.filter((b) => b !== 'none')) {
    for (const frontend of FRONTENDS) {
      for (const database of DATABASES) {
        const options = buildOptions({
          targetPath: '/tmp/check',
          name: 'check',
          backend,
          frontend,
          database,
        });
        const workflow = yaml.load(generateGitHubWorkflow(options));

        for (const job of Object.values(workflow.jobs)) {
          for (const step of job.steps || []) {
            if (step.uses) {
              refs.add(step.uses);
            }
          }
        }
      }
    }
  }

  return [...refs].sort();
}

async function resolves(ref) {
  const [repo, version] = ref.split('@');
  const headers = { 'User-Agent': 'laplateforme-starter' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // A ref may be a tag or a branch; accept either.
  for (const kind of ['tags', 'heads']) {
    const res = await fetch(`https://api.github.com/repos/${repo}/git/ref/${kind}/${version}`, {
      headers,
    });
    if (res.ok) {
      return { ok: true, kind };
    }
    if (res.status === 403) {
      return { ok: false, reason: 'rate limited — set GITHUB_TOKEN and retry' };
    }
  }

  return { ok: false, reason: 'no matching tag or branch' };
}

async function main() {
  const refs = collectActionRefs();
  console.log(`Checking ${refs.length} action references from the generated workflow…\n`);

  const failures = [];

  for (const ref of refs) {
    const result = await resolves(ref);
    if (result.ok) {
      console.log(`  ✔ ${ref}`);
    } else {
      console.log(`  ✗ ${ref} — ${result.reason}`);
      failures.push(`${ref}: ${result.reason}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} action reference(s) do not resolve:`);
    failures.forEach((failure) => console.error(`  ${failure}`));
    process.exit(1);
  }

  console.log('\nAll action references resolve.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

/**
 * Reports drift between the tested BASELINE and what npm currently publishes.
 *
 * This is the maintenance signal for the scaffolder: it says which baselines
 * have quietly fallen behind, and — more importantly — which ceilings in
 * CONSTRAINED now have a newer major sitting behind them and might be liftable.
 *
 *   npm run versions:report
 *   npm run versions:report -- --fail-on-major   (used by the weekly canary)
 */

const { BASELINE, CONSTRAINED, fetchLatest, majorOf, isPrerelease } = require('../lib/versions');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function baseVersion(range) {
  return String(range).replace(/^[~^]/, '');
}

async function main() {
  const failOnMajor = process.argv.includes('--fail-on-major');
  const names = Object.keys(BASELINE).sort();

  console.log(
    `${colors.bright}Dependency drift${colors.reset} ${colors.dim}(${names.length} packages)${colors.reset}\n`
  );

  const results = await Promise.all(names.map(async (name) => [name, await fetchLatest(name)]));

  const current = [];
  const behind = [];
  const liftable = [];
  const unreachable = [];

  for (const [name, result] of results) {
    if (result.error) {
      unreachable.push(`${name} — ${result.error}`);
      continue;
    }

    const pinned = baseVersion(BASELINE[name]);
    const latest = result.version;
    const ceiling = CONSTRAINED[name];

    if (pinned === latest) {
      current.push(name);
      continue;
    }

    if (isPrerelease(latest)) {
      // Not drift: a prerelease on the latest tag is deliberately ignored.
      current.push(name);
      continue;
    }

    const majorJump = majorOf(latest) > majorOf(pinned);

    if (ceiling && majorOf(latest) > ceiling.max) {
      liftable.push({ name, pinned, latest, reason: ceiling.reason });
    } else {
      behind.push({ name, pinned, latest, majorJump });
    }
  }

  if (behind.length) {
    console.log(`${colors.yellow}${colors.bright}Behind${colors.reset}`);
    for (const entry of behind) {
      const marker = entry.majorJump
        ? `${colors.red}major${colors.reset}`
        : `${colors.dim}minor/patch${colors.reset}`;
      console.log(`  ${entry.name.padEnd(30)} ${entry.pinned} → ${entry.latest}  (${marker})`);
    }
    console.log();
  }

  if (liftable.length) {
    console.log(
      `${colors.cyan}${colors.bright}Held back by a ceiling${colors.reset} ${colors.dim}(re-test, then raise the ceiling in lib/versions.js)${colors.reset}`
    );
    for (const entry of liftable) {
      console.log(
        `  ${colors.bright}${entry.name}${colors.reset} ${entry.pinned} → ${entry.latest}`
      );
      console.log(`    ${colors.dim}${entry.reason}${colors.reset}`);
    }
    console.log();
  }

  if (unreachable.length) {
    console.log(`${colors.red}Unreachable${colors.reset}`);
    unreachable.forEach((line) => console.log(`  ${line}`));
    console.log();
  }

  console.log(
    `${colors.green}${current.length} current${colors.reset} · ` +
      `${colors.yellow}${behind.length} behind${colors.reset} · ` +
      `${colors.cyan}${liftable.length} held${colors.reset} · ` +
      `${unreachable.length} unreachable`
  );

  const majors = behind.filter((entry) => entry.majorJump);
  if (failOnMajor && majors.length > 0) {
    console.error(
      `\n${colors.red}A new major is available for: ${majors.map((m) => m.name).join(', ')}${colors.reset}`
    );
    console.error('Run the smoke matrix against it, then update BASELINE or add a ceiling.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

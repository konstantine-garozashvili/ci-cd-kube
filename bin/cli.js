#!/usr/bin/env node
'use strict';

const path = require('path');

const { colors, banner, success, warning, failure } = require('../lib/ui');
const { validateProjectName, buildOptions } = require('../lib/options');
const { BACKENDS, FRONTENDS, DATABASES } = require('../lib/constants');
const { isEffectivelyEmpty } = require('../lib/fs-utils');
const { runWizard, confirmOverwrite } = require('../lib/prompts');
const {
  scaffold,
  initialiseGit,
  installDependencies,
  normaliseFormatting,
  createInitialCommit,
} = require('../lib/scaffold');

const pkg = require('../package.json');

function printHelp() {
  console.log(`
${colors.bright}laplateforme-starter${colors.reset} — scaffold a production-ready project

${colors.bright}Usage${colors.reset}
  npx laplateforme-starter [directory] [options]

${colors.bright}Options${colors.reset}
  -y, --defaults        Accept every default without prompting
      --backend=<name>  ${BACKENDS.filter((b) => b !== 'none').join(' | ')}
      --frontend=<name> ${FRONTENDS.join(' | ')}
      --database=<name> ${DATABASES.join(' | ')}
      --no-install      Skip npm install
      --no-git          Skip git init and the initial commit
      --force           Scaffold into a non-empty directory without asking
  -v, --version         Print the version
  -h, --help            Show this message

${colors.bright}Examples${colors.reset}
  npx laplateforme-starter my-app
  npx laplateforme-starter my-api --backend=hono --frontend=none --database=none
  npx laplateforme-starter . --defaults
`);
}

/** Parses argv into flags plus a positional target directory. */
function parseArgs(argv) {
  const flags = {
    defaults: false,
    install: true,
    git: true,
    force: false,
    help: false,
    version: false,
  };
  const choices = {};
  const positional = [];

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      flags.help = true;
    } else if (arg === '-v' || arg === '--version') {
      flags.version = true;
    } else if (arg === '-y' || arg === '--defaults' || arg === '--yes') {
      flags.defaults = true;
    } else if (arg === '--no-install') {
      flags.install = false;
    } else if (arg === '--no-git') {
      flags.git = false;
    } else if (arg === '--force') {
      flags.force = true;
    } else if (arg.startsWith('--backend=')) {
      choices.backend = arg.slice('--backend='.length);
    } else if (arg.startsWith('--frontend=')) {
      choices.frontend = arg.slice('--frontend='.length);
    } else if (arg.startsWith('--database=')) {
      choices.database = arg.slice('--database='.length);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option "${arg}". Run with --help to see what is available.`);
    } else if (arg !== 'init' && arg !== 'create') {
      positional.push(arg);
    }
  }

  return { flags, choices, target: positional[0] };
}

function nextSteps(options) {
  const { projectName, targetPath, isFullstack, database, frontend } = options;
  const lines = [];
  let n = 1;

  if (path.resolve(process.cwd()) !== path.resolve(targetPath)) {
    lines.push(
      `  ${n++}. ${colors.cyan}cd ${path.relative(process.cwd(), targetPath)}${colors.reset}`
    );
  }

  if (database !== 'none') {
    const service = database === 'postgres' ? 'postgres' : 'mongodb';
    lines.push(
      `  ${n++}. ${colors.cyan}docker compose up -d ${service}${colors.reset}${colors.dim}   start the database${colors.reset}`
    );
  }

  if (database === 'postgres') {
    lines.push(
      `  ${n++}. ${colors.cyan}npm run db:push${colors.reset}${colors.dim}                apply the Prisma schema${colors.reset}`
    );
  }

  lines.push(
    `  ${n++}. ${colors.cyan}npm run dev${colors.reset}${colors.dim}                    ${
      isFullstack ? 'API on :3000, UI on :5173' : 'API on :3000'
    }${colors.reset}`
  );
  lines.push(
    `  ${n++}. ${colors.cyan}npm test && npm run test:e2e${colors.reset}${colors.dim}   verify everything passes${colors.reset}`
  );

  return `
${colors.green}${colors.bright}🎉 ${projectName} is ready.${colors.reset}

${colors.bright}Next steps${colors.reset}
${lines.join('\n')}

${colors.dim}Read README.md for the full pipeline, health probe and Docker reference.
Frontend: ${frontend}. Everything is proxied same-origin, so there is no CORS to configure.${colors.reset}
`;
}

async function main() {
  const { flags, choices, target } = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    return 0;
  }

  if (flags.version) {
    console.log(pkg.version);
    return 0;
  }

  console.log(banner());

  // Without a TTY there is nobody to answer questions, so treat it as --defaults
  // rather than hanging forever on a prompt.
  const interactive = process.stdin.isTTY && !flags.defaults;

  let answers;
  if (interactive) {
    answers = await runWizard({ name: target || 'my-laplateforme-app' });
  } else {
    const nameCheck = validateProjectName(target || 'my-laplateforme-app');
    if (!nameCheck.ok) {
      throw new Error(nameCheck.reason);
    }
    answers = {
      name: nameCheck.name,
      backend: choices.backend || 'express',
      frontend: choices.frontend || 'react',
      database: choices.database || 'postgres',
      install: flags.install,
      git: flags.git,
    };
  }

  // Explicit flags always win over wizard answers.
  const backend = choices.backend || answers.backend;
  const frontend = choices.frontend || answers.frontend;
  const database = choices.database || answers.database;

  const targetPath =
    answers.name === '.' ? process.cwd() : path.resolve(process.cwd(), answers.name);

  const options = buildOptions({ targetPath, name: answers.name, backend, frontend, database });

  if (!isEffectivelyEmpty(targetPath) && !flags.force) {
    if (!interactive) {
      throw new Error(
        `${targetPath} is not empty. Re-run with --force to scaffold into it anyway.`
      );
    }
    const proceed = await confirmOverwrite(targetPath);
    if (!proceed) {
      console.log(warning('Cancelled — nothing was written.'));
      return 1;
    }
  }

  console.log(
    `\n${colors.cyan}${colors.bright}⚙️  Scaffolding into ${targetPath}${colors.reset}\n`
  );

  scaffold(options, {
    onStep: (message) => console.log(success(message)),
    onWarn: (message) => console.log(warning(message)),
  });

  const log = {
    onStep: (message) => console.log(success(message)),
    onWarn: (message) => console.log(warning(message)),
  };

  // git init precedes npm install so husky can install its hooks.
  const wantsGit = interactive ? answers.git : flags.git;
  const gitReady = wantsGit ? initialiseGit(targetPath, log) : false;

  let installed = false;
  const wantsInstall = interactive ? answers.install : flags.install;
  if (wantsInstall) {
    console.log(`\n${colors.cyan}📦 Installing dependencies…${colors.reset}\n`);
    installed = installDependencies(targetPath, log);
    if (installed) {
      console.log(success('Dependencies installed.'));
      if (normaliseFormatting(targetPath, log)) {
        console.log(success('Formatted the project with Prettier.'));
      }
    }
  } else {
    console.log(warning('Skipped npm install — run it before starting the app.'));
  }

  // Commit last so the lockfile from the install is part of the first commit.
  if (gitReady) {
    if (createInitialCommit(targetPath, log)) {
      console.log(success('Created the initial commit.'));
    }
  }

  console.log(nextSteps(options));
  return 0;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`\n${failure(err.message)}\n`);
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
      process.exit(1);
    });
}

module.exports = { main, parseArgs };

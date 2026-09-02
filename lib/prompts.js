'use strict';

const readline = require('readline');
const { colors } = require('./ui');
const { validateProjectName } = require('./options');

function createInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function question(rl, text) {
  return new Promise((resolve) => rl.question(text, (answer) => resolve(answer.trim())));
}

/**
 * Asks until the answer validates, instead of silently falling back to a
 * default when someone types "9" or a name npm will later reject.
 */
async function ask(rl, { label, defaultValue, validate }) {
  for (;;) {
    const answer = await question(
      rl,
      `${colors.yellow}?${colors.reset} ${label} ${colors.dim}(${defaultValue})${colors.reset}: `
    );

    const value = answer || defaultValue;
    const result = validate ? validate(value) : { ok: true, value };

    if (result.ok) {
      return result.value !== undefined ? result.value : value;
    }

    console.log(`  ${colors.red}✗${colors.reset} ${result.reason}`);
  }
}

function renderChoices(title, choices) {
  console.log(`\n${colors.bright}${title}${colors.reset}`);
  choices.forEach((choice, index) => {
    console.log(
      `  ${colors.cyan}${index + 1}${colors.reset}. ${choice.label.padEnd(16)}${colors.dim}${choice.hint}${colors.reset}`
    );
  });
}

function selectValidator(choices) {
  return (input) => {
    const index = Number.parseInt(input, 10);
    if (!Number.isInteger(index) || index < 1 || index > choices.length) {
      return { ok: false, reason: `Enter a number between 1 and ${choices.length}.` };
    }
    return { ok: true, value: choices[index - 1].value };
  };
}

function booleanValidator(input) {
  const normalised = String(input).trim().toLowerCase();
  if (['y', 'yes'].includes(normalised)) {
    return { ok: true, value: true };
  }
  if (['n', 'no'].includes(normalised)) {
    return { ok: true, value: false };
  }
  return { ok: false, reason: 'Answer y or n.' };
}

const BACKEND_CHOICES = [
  { value: 'express', label: 'Express', hint: 'Battle-tested, minimal, JavaScript' },
  { value: 'hono', label: 'Hono', hint: 'Ultrafast, Web Standards, ESM' },
  { value: 'nestjs', label: 'NestJS', hint: 'Modular enterprise architecture, TypeScript' },
];

const FRONTEND_CHOICES = [
  { value: 'react', label: 'React + Vite', hint: 'SPA with a live endpoint explorer' },
  { value: 'vue', label: 'Vue 3 + Vite', hint: 'SPA with a live endpoint explorer' },
  { value: 'vanilla', label: 'Vanilla', hint: 'HTML + Vite, no framework' },
  { value: 'nextjs', label: 'Next.js', hint: 'App Router, TypeScript, SSR-ready' },
];

const DATABASE_CHOICES = [
  { value: 'postgres', label: 'PostgreSQL', hint: 'Prisma ORM + CI service container' },
  { value: 'mongodb', label: 'MongoDB', hint: 'Mongoose + CI service container' },
  { value: 'none', label: 'None', hint: 'Stateless service' },
];

const NO_FRONTEND = { value: 'none', label: 'None', hint: 'REST API only' };

/** Runs the interactive wizard and returns the raw answers. */
async function runWizard(defaults) {
  const rl = createInterface();

  try {
    console.log(`${colors.bright}📦 Project${colors.reset}`);
    const name = await ask(rl, {
      label: 'Project name (use "." for the current directory)',
      defaultValue: defaults.name,
      validate: (input) => {
        const result = validateProjectName(input);
        return result.ok ? { ok: true, value: result.name } : result;
      },
    });

    renderChoices('⚡ Backend framework', BACKEND_CHOICES);
    const backend = await ask(rl, {
      label: `Choose backend [1-${BACKEND_CHOICES.length}]`,
      defaultValue: '1',
      validate: selectValidator(BACKEND_CHOICES),
    });

    const frontendChoices = [...FRONTEND_CHOICES, NO_FRONTEND];
    renderChoices('🎨 Frontend framework', frontendChoices);
    const frontend = await ask(rl, {
      label: `Choose frontend [1-${frontendChoices.length}]`,
      defaultValue: '1',
      validate: selectValidator(frontendChoices),
    });

    renderChoices('🗄️  Database', DATABASE_CHOICES);
    const database = await ask(rl, {
      label: `Choose database [1-${DATABASE_CHOICES.length}]`,
      defaultValue: '1',
      validate: selectValidator(DATABASE_CHOICES),
    });

    console.log(`\n${colors.bright}🚀 Automation${colors.reset}`);
    const install = await ask(rl, {
      label: 'Run npm install now? [y/n]',
      defaultValue: 'y',
      validate: booleanValidator,
    });
    const git = await ask(rl, {
      label: 'Initialise a git repository? [y/n]',
      defaultValue: 'y',
      validate: booleanValidator,
    });

    return { name, backend, frontend, database, install, git };
  } finally {
    rl.close();
  }
}

/** Confirmation used when the target directory already has files in it. */
async function confirmOverwrite(directory) {
  const rl = createInterface();
  try {
    console.log(
      `\n${colors.yellow}⚠${colors.reset}  ${colors.bright}${directory}${colors.reset} is not empty. Existing files with the same names will be overwritten.`
    );
    return await ask(rl, {
      label: 'Continue anyway? [y/n]',
      defaultValue: 'n',
      validate: booleanValidator,
    });
  } finally {
    rl.close();
  }
}

module.exports = {
  runWizard,
  confirmOverwrite,
  BACKEND_CHOICES,
  FRONTEND_CHOICES,
  DATABASE_CHOICES,
};

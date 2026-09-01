#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { generateGitHubWorkflow, generateDockerfile } = require('../templates/generator');

// ANSI Color Codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function printBanner() {
  console.log(`
${colors.cyan}${colors.bright}┌──────────────────────────────────────────────────────────────────┐
│  🚀 DEVSECOPS GOLDEN STARTER — Dynamic Project Scaffolder        │
│  Enterprise Shift-Left Security, CI/CD & Testing Boilerplate     │
└──────────────────────────────────────────────────────────────────┘${colors.reset}
`);
}

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question, defaultAnswer) {
  return new Promise((resolve) => {
    rl.question(`${question} ${colors.dim}(default: ${defaultAnswer})${colors.reset}: `, (answer) => {
      resolve(answer.trim() || defaultAnswer);
    });
  });
}

async function runWizard() {
  printBanner();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bright}Usage:${colors.reset}
  node bin/cli.js [options]
  npm run init

${colors.bright}Options:${colors.reset}
  --defaults     Generate project with default Express.js + DevSecOps stack
  --help, -h     Show this help message
`);
    process.exit(0);
  }

  const isDefaults = args.includes('--defaults');
  const rl = createPrompt();

  let framework = 'express';
  let database = 'none';
  let appName = 'my-devsecops-app';

  if (!isDefaults) {
    console.log(`${colors.bright}📦 Step 1: Project Metadata${colors.reset}`);
    appName = await ask(rl, `${colors.yellow}?${colors.reset} Project Name`, 'my-devsecops-app');

    console.log(`\n${colors.bright}⚡ Step 2: Backend Framework Selection${colors.reset}`);
    console.log(`  1. Express.js   ${colors.dim}(Battle-tested, lightweight, minimal)${colors.reset}`);
    console.log(`  2. Hono         ${colors.dim}(Ultrafast, modern Web Standards, TypeScript-first)${colors.reset}`);
    console.log(`  3. NestJS       ${colors.dim}(Enterprise architecture, TypeScript, modular)${colors.reset}`);
    console.log(`  4. Next.js      ${colors.dim}(Fullstack React, App Router, SSR & APIs)${colors.reset}`);
    const fwChoice = await ask(rl, `${colors.yellow}?${colors.reset} Choose Framework [1-4]`, '1');

    const frameworkMap = { '1': 'express', '2': 'hono', '3': 'nestjs', '4': 'nextjs' };
    framework = frameworkMap[fwChoice] || 'express';

    console.log(`\n${colors.bright}🗄️ Step 3: Database & ORM Selection${colors.reset}`);
    console.log(`  1. None         ${colors.dim}(In-memory / Stateless API)${colors.reset}`);
    console.log(`  2. PostgreSQL   ${colors.dim}(Prisma ORM + CI Service Container)${colors.reset}`);
    console.log(`  3. MongoDB      ${colors.dim}(Mongoose / Mongo CI Service)${colors.reset}`);
    const dbChoice = await ask(rl, `${colors.yellow}?${colors.reset} Choose Database [1-3]`, '1');

    const dbMap = { '1': 'none', '2': 'postgres', '3': 'mongodb' };
    database = dbMap[dbChoice] || 'none';
  }

  rl.close();

  const features = ['gitleaks', 'eslint', 'npm-audit', 'semgrep', 'unit', 'integration', 'playwright', 'owasp', 'trivy', 'google-chat'];

  console.log(`\n${colors.cyan}${colors.bright}⚙️ Generating Tailored Configuration...${colors.reset}`);

  // 1. Generate .github/workflows/ci-cd.yml
  const workflowContent = generateGitHubWorkflow({ framework, database, features });
  const workflowDir = path.join(process.cwd(), '.github', 'workflows');
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }
  fs.writeFileSync(path.join(workflowDir, 'ci-cd.yml'), workflowContent.trim() + '\n', 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Generated ${colors.bright}.github/workflows/ci-cd.yml${colors.reset} (with DB services: ${database})`);

  // 2. Generate Dockerfile
  const dockerContent = generateDockerfile({ framework });
  fs.writeFileSync(path.join(process.cwd(), 'Dockerfile'), dockerContent.trim() + '\n', 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Generated ${colors.bright}Dockerfile${colors.reset} (${framework} multi-stage optimized)`);

  // 3. Update .env.example
  const envContent = `# Application Environment Configuration
PORT=3000
NODE_ENV=development
APP_NAME=${appName}
APP_VERSION=1.0.0

CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
${database === 'postgres' ? 'DATABASE_URL=postgresql://test_user:test_password@localhost:5432/test_db?schema=public\n' : ''}${database === 'mongodb' ? 'MONGODB_URI=mongodb://localhost:27017/test_db\n' : ''}`;
  fs.writeFileSync(path.join(process.cwd(), '.env.example'), envContent, 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Configured ${colors.bright}.env.example${colors.reset}`);

  console.log(`\n${colors.green}${colors.bright}🎉 Project Scaffolding Complete!${colors.reset}`);
  console.log(`
${colors.bright}Next Steps:${colors.reset}
  1. ${colors.cyan}npm run dev${colors.reset}              - Start local development server
  2. ${colors.cyan}npm test${colors.reset}                 - Run Unit & Integration tests
  3. ${colors.cyan}npm run test:e2e${colors.reset}         - Run Playwright E2E browser tests
  4. ${colors.cyan}git push origin main${colors.reset}     - Trigger automated DevSecOps CI/CD pipeline!
`);
}

if (require.main === module) {
  runWizard().catch((err) => {
    console.error(`\n${colors.red}❌ Error running scaffolder:${colors.reset}`, err);
    process.exit(1);
  });
}

module.exports = { runWizard };

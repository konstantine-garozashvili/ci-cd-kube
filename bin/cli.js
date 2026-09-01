#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { generateGitHubWorkflow, generateDockerfile } = require('../templates/generator');

// ANSI Colors
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
│  🏛️  LA PLATEFORME — Enterprise DevSecOps Scaffolder              │
│  Zero-Config Security, CI/CD, Testing & Cloud-Native Boilerplate │
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

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function runWizard() {
  printBanner();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bright}Usage:${colors.reset}
  npx laplateforme init [target-dir]
  npx create-laplateforme [target-dir]
  npm create laplateforme-app [target-dir]

${colors.bright}Options:${colors.reset}
  --defaults     Scaffold project with default Express.js + DevSecOps stack
  --help, -h     Show this help message
`);
    process.exit(0);
  }

  const isDefaults = args.includes('--defaults');
  const targetDirInput = args.find((a) => !a.startsWith('-') && a !== 'init');

  const rl = createPrompt();

  let appName = targetDirInput || 'laplateforme-app';
  let framework = 'express';
  let database = 'none';

  if (!isDefaults) {
    console.log(`${colors.bright}📦 Step 1: Project Metadata${colors.reset}`);
    appName = await ask(rl, `${colors.yellow}?${colors.reset} Project Name / Target Directory`, appName);

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
    console.log(`  2. PostgreSQL   ${colors.dim}(Prisma ORM + CI Test Service Container)${colors.reset}`);
    console.log(`  3. MongoDB      ${colors.dim}(Mongoose / Mongo CI Service)${colors.reset}`);
    const dbChoice = await ask(rl, `${colors.yellow}?${colors.reset} Choose Database [1-3]`, '1');

    const dbMap = { '1': 'none', '2': 'postgres', '3': 'mongodb' };
    database = dbMap[dbChoice] || 'none';
  }

  rl.close();

  const targetPath = appName === '.' ? process.cwd() : path.resolve(process.cwd(), appName);
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  console.log(`\n${colors.cyan}${colors.bright}⚙️ Scaffolding DevSecOps Project into ${targetPath}...${colors.reset}`);

  // Package Root Path
  const packageRoot = path.resolve(__dirname, '..');

  // Copy Core Source & Tests
  const directoriesToCopy = ['src', 'tests', 'templates'];
  for (const dir of directoriesToCopy) {
    const srcDir = path.join(packageRoot, dir);
    const destDir = path.join(targetPath, dir);
    if (fs.existsSync(srcDir) && srcDir !== destDir) {
      copyDirRecursive(srcDir, destDir);
    }
  }

  // Copy Configuration Files
  const filesToCopy = [
    '.eslintrc.json',
    '.prettierrc',
    '.gitleaks.toml',
    '.semgrepignore',
    '.dockerignore',
    'jest.config.js',
    'playwright.config.js',
  ];

  for (const file of filesToCopy) {
    const srcFile = path.join(packageRoot, file);
    const destFile = path.join(targetPath, file);
    if (fs.existsSync(srcFile) && srcFile !== destFile) {
      fs.copyFileSync(srcFile, destFile);
    }
  }

  // 1. Generate customized .github/workflows/ci-cd.yml
  const features = ['gitleaks', 'eslint', 'npm-audit', 'semgrep', 'unit', 'integration', 'playwright', 'owasp', 'trivy', 'google-chat'];
  const workflowContent = generateGitHubWorkflow({ framework, database, features });
  const workflowDir = path.join(targetPath, '.github', 'workflows');
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }
  fs.writeFileSync(path.join(workflowDir, 'ci-cd.yml'), workflowContent.trim() + '\n', 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Generated ${colors.bright}.github/workflows/ci-cd.yml${colors.reset}`);

  // 2. Generate customized Dockerfile
  const dockerContent = generateDockerfile({ framework });
  fs.writeFileSync(path.join(targetPath, 'Dockerfile'), dockerContent.trim() + '\n', 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Generated ${colors.bright}Dockerfile${colors.reset} (${framework} multi-stage)`);

  // 3. Generate package.json for target project
  if (targetPath !== packageRoot) {
    const projectPackageJson = {
      name: path.basename(targetPath),
      version: '1.0.0',
      description: 'Cloud-Native microservice bootstrapped with La Plateforme DevSecOps',
      main: 'src/server.js',
      scripts: {
        start: 'node src/server.js',
        dev: 'node --watch src/server.js',
        lint: 'eslint "src/**/*.js" "tests/**/*.js"',
        'lint:fix': 'eslint "src/**/*.js" "tests/**/*.js" --fix',
        test: 'npm run test:unit && npm run test:integration',
        'test:unit': 'jest tests/unit --runInBand',
        'test:integration': 'jest tests/integration --runInBand',
        'test:e2e': 'playwright test',
        'scan:secrets': 'gitleaks detect --verbose',
        'scan:sast': 'semgrep scan --config="p/owasp-top-ten" src',
      },
      dependencies: {
        cors: '^2.8.5',
        dotenv: '^16.4.5',
        express: '^4.19.2',
        'express-rate-limit': '^7.2.0',
        helmet: '^7.1.0',
      },
      devDependencies: {
        '@playwright/test': '^1.44.0',
        eslint: '^8.57.0',
        jest: '^29.7.0',
        prettier: '^3.2.5',
        supertest: '^7.0.0',
      },
    };

    fs.writeFileSync(
      path.join(targetPath, 'package.json'),
      JSON.stringify(projectPackageJson, null, 2) + '\n',
      'utf-8'
    );
    console.log(`  ${colors.green}✔${colors.reset} Generated ${colors.bright}package.json${colors.reset}`);
  }

  // 4. Generate .env.example
  const envContent = `# Application Environment Configuration
PORT=3000
NODE_ENV=development
APP_NAME=${path.basename(targetPath)}
APP_VERSION=1.0.0

CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
${database === 'postgres' ? 'DATABASE_URL=postgresql://test_user:test_password@localhost:5432/test_db?schema=public\n' : ''}${database === 'mongodb' ? 'MONGODB_URI=mongodb://localhost:27017/test_db\n' : ''}`;
  fs.writeFileSync(path.join(targetPath, '.env.example'), envContent, 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Configured ${colors.bright}.env.example${colors.reset}`);

  // 5. Generate .gitignore
  const gitignoreContent = `# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local

# Test & Coverage artifacts
coverage/
playwright-report/
test-results/

# System
.DS_Store
*.log
`;
  fs.writeFileSync(path.join(targetPath, '.gitignore'), gitignoreContent, 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Configured ${colors.bright}.gitignore${colors.reset}`);

  console.log(`\n${colors.green}${colors.bright}🎉 Project successfully created at ${targetPath}!${colors.reset}`);
  console.log(`
${colors.bright}Next Steps:${colors.reset}
  ${appName !== '.' ? `1. ${colors.cyan}cd ${appName}${colors.reset}\n  2. ` : '1. '}${colors.cyan}npm install${colors.reset}
  ${appName !== '.' ? '3. ' : '2. '}${colors.cyan}npm run dev${colors.reset}
  ${appName !== '.' ? '4. ' : '3. '}${colors.cyan}git init && git add . && git commit -m "initial commit"${colors.reset}
  ${appName !== '.' ? '5. ' : '4. '}${colors.cyan}git push origin main${colors.reset} (triggers automated DevSecOps CI/CD!)
`);
}

if (require.main === module) {
  runWizard().catch((err) => {
    console.error(`\n${colors.red}❌ Error running scaffolder:${colors.reset}`, err);
    process.exit(1);
  });
}

module.exports = { runWizard };

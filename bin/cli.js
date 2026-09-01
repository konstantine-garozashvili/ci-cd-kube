#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
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
│  Zero-Config Security, CI/CD, Testing & Fullstack Monorepos      │
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
  npx laplateforme-starter [target-dir]
  npx laplateforme-starter init [target-dir]

${colors.bright}Options:${colors.reset}
  --defaults     Scaffold project with default Express.js + DevSecOps stack
  --help, -h     Show this help message
`);
    process.exit(0);
  }

  const isDefaults = args.includes('--defaults');
  const targetDirInput = args.find((a) => !a.startsWith('-') && a !== 'init');

  const rl = createPrompt();

  let appName = targetDirInput || 'my-laplateforme-app';
  let backendFw = 'express';
  let frontendFw = 'react';
  let database = 'postgres';
  let autoInstall = 'y';
  let autoGit = 'y';

  if (!isDefaults) {
    console.log(`${colors.bright}📦 Step 1: Project Setup${colors.reset}`);
    appName = await ask(rl, `${colors.yellow}?${colors.reset} Project Name / Directory`, appName);

    console.log(`\n${colors.bright}⚡ Step 2: Backend Framework Selection${colors.reset}`);
    console.log(`  1. Express.js   ${colors.dim}(Battle-tested, lightweight, minimal)${colors.reset}`);
    console.log(`  2. Hono         ${colors.dim}(Ultrafast, modern Web Standards, TypeScript-first)${colors.reset}`);
    console.log(`  3. NestJS       ${colors.dim}(Enterprise modular architecture, TypeScript)${colors.reset}`);
    console.log(`  4. None / Serverless API${colors.reset}`);
    const beChoice = await ask(rl, `${colors.yellow}?${colors.reset} Choose Backend [1-4]`, '1');
    const beMap = { '1': 'express', '2': 'hono', '3': 'nestjs', '4': 'none' };
    backendFw = beMap[beChoice] || 'express';

    console.log(`\n${colors.bright}🎨 Step 3: Frontend Framework Selection${colors.reset}`);
    console.log(`  1. React + Vite ${colors.dim}(Fast Single Page Application SPA with Dashboard UI)${colors.reset}`);
    console.log(`  2. Vue 3 + Vite ${colors.dim}(Modern Vue 3 SPA with Endpoint Explorer)${colors.reset}`);
    console.log(`  3. Vanilla UI   ${colors.dim}(HTML5 + CSS Interactive Endpoint Explorer)${colors.reset}`);
    console.log(`  4. Next.js      ${colors.dim}(Fullstack React, SSR & App Router)${colors.reset}`);
    console.log(`  5. None         ${colors.dim}(Pure REST API / Backend Microservice only)${colors.reset}`);
    const feChoice = await ask(rl, `${colors.yellow}?${colors.reset} Choose Frontend [1-5]`, '1');
    const feMap = { '1': 'react', '2': 'vue', '3': 'vanilla', '4': 'nextjs', '5': 'none' };
    frontendFw = feMap[feChoice] || 'react';

    console.log(`\n${colors.bright}🗄️ Step 4: Database & ORM Selection${colors.reset}`);
    console.log(`  1. PostgreSQL   ${colors.dim}(Prisma ORM + Automated CI Test Service Container)${colors.reset}`);
    console.log(`  2. MongoDB      ${colors.dim}(Mongoose / Mongo CI Service)${colors.reset}`);
    console.log(`  3. None         ${colors.dim}(Stateless / In-Memory)${colors.reset}`);
    const dbChoice = await ask(rl, `${colors.yellow}?${colors.reset} Choose Database [1-3]`, '1');
    const dbMap = { '1': 'postgres', '2': 'mongodb', '3': 'none' };
    database = dbMap[dbChoice] || 'postgres';

    console.log(`\n${colors.bright}🚀 Step 5: Automation & Environment${colors.reset}`);
    autoInstall = await ask(rl, `${colors.yellow}?${colors.reset} Automatically run 'npm install' now? (Y/n)`, 'Y');
    autoGit = await ask(rl, `${colors.yellow}?${colors.reset} Initialize a git repository? (Y/n)`, 'Y');
  }

  rl.close();

  const targetPath = appName === '.' ? process.cwd() : path.resolve(process.cwd(), appName);
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  console.log(`\n${colors.cyan}${colors.bright}⚙️ Scaffolding DevSecOps Monorepo into ${targetPath}...${colors.reset}`);

  const packageRoot = path.resolve(__dirname, '..');
  const isFullstack = frontendFw !== 'none' && backendFw !== 'none';

  // 1. SCAFFOLD BACKEND FOLDER
  const backendPath = isFullstack ? path.join(targetPath, 'backend') : targetPath;
  if (!fs.existsSync(backendPath)) {
    fs.mkdirSync(backendPath, { recursive: true });
  }

  if (backendFw === 'hono') {
    copyDirRecursive(path.join(packageRoot, 'templates', 'backend', 'hono'), backendPath);
  } else {
    // Default Express Backend
    copyDirRecursive(path.join(packageRoot, 'src'), path.join(backendPath, 'src'));
    copyDirRecursive(path.join(packageRoot, 'tests', 'unit'), path.join(backendPath, 'tests', 'unit'));
    copyDirRecursive(path.join(packageRoot, 'tests', 'integration'), path.join(backendPath, 'tests', 'integration'));

    const backendPackageJson = {
      name: isFullstack ? 'backend' : path.basename(targetPath),
      version: '1.0.0',
      description: `Backend API microservice (${backendFw}) with Shift-Left Security`,
      main: 'src/server.js',
      scripts: {
        start: 'node src/server.js',
        dev: 'node --watch src/server.js',
        lint: 'eslint "src/**/*.js" "tests/**/*.js"',
        'lint:fix': 'eslint "src/**/*.js" "tests/**/*.js" --fix',
        test: 'npm run test:unit && npm run test:integration',
        'test:unit': 'jest tests/unit --runInBand',
        'test:integration': 'jest tests/integration --runInBand',
        'scan:secrets': 'gitleaks detect --verbose',
        'scan:sast': 'semgrep scan --config="p/owasp-top-ten" src',
      },
      dependencies: {
        cors: '^2.8.5',
        dotenv: '^16.4.5',
        express: '^4.19.2',
        'express-rate-limit': '^7.2.0',
        helmet: '^7.1.0',
        ...(database === 'mongodb' ? { mongoose: '^8.3.4' } : {}),
      },
      devDependencies: {
        eslint: '^8.57.0',
        jest: '^29.7.0',
        prettier: '^3.2.5',
        supertest: '^7.0.0',
        ...(database === 'postgres' ? { prisma: '^5.13.0', '@prisma/client': '^5.13.0' } : {}),
      },
    };

    fs.writeFileSync(
      path.join(backendPath, 'package.json'),
      JSON.stringify(backendPackageJson, null, 2) + '\n',
      'utf-8'
    );
  }

  // Copy Database Schema / Helpers
  if (database === 'postgres') {
    copyDirRecursive(path.join(packageRoot, 'templates', 'db', 'prisma'), path.join(backendPath, 'prisma'));
  } else if (database === 'mongodb') {
    const dbDir = path.join(backendPath, 'src', 'db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.copyFileSync(path.join(packageRoot, 'templates', 'db', 'mongoose', 'db.js'), path.join(dbDir, 'db.js'));
  }

  // Backend Dockerfile
  const backendDockerfile = generateDockerfile({ framework: backendFw });
  fs.writeFileSync(path.join(backendPath, 'Dockerfile'), backendDockerfile.trim() + '\n', 'utf-8');

  // Backend .env and .env.example
  const backendEnv = `# Backend Environment Configuration
PORT=3000
NODE_ENV=development
APP_NAME=${path.basename(targetPath)}-api
APP_VERSION=1.0.0
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
${database === 'postgres' ? 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db?schema=public\n' : ''}${database === 'mongodb' ? 'MONGODB_URI=mongodb://localhost:27017/app_db\n' : ''}`;
  fs.writeFileSync(path.join(backendPath, '.env.example'), backendEnv, 'utf-8');
  fs.writeFileSync(path.join(backendPath, '.env'), backendEnv, 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Created ${colors.bright}backend/${colors.reset} (${backendFw} API + ${database} database support)`);

  // 2. SCAFFOLD FRONTEND FOLDER (IF APPLICABLE)
  if (isFullstack) {
    const frontendPath = path.join(targetPath, 'frontend');
    if (!fs.existsSync(frontendPath)) {
      fs.mkdirSync(frontendPath, { recursive: true });
    }

    if (frontendFw === 'react') {
      copyDirRecursive(path.join(packageRoot, 'templates', 'frontend', 'react'), frontendPath);
    } else if (frontendFw === 'vue') {
      copyDirRecursive(path.join(packageRoot, 'templates', 'frontend', 'vue'), frontendPath);
    } else {
      // Vanilla UI
      const feSrc = path.join(frontendPath, 'public');
      if (!fs.existsSync(feSrc)) {
        fs.mkdirSync(feSrc, { recursive: true });
      }
      fs.copyFileSync(path.join(packageRoot, 'src', 'public', 'index.html'), path.join(feSrc, 'index.html'));
      
      const vanillaPackageJson = {
        name: 'frontend',
        version: '1.0.0',
        scripts: {
          dev: 'npx serve public -p 5173',
          start: 'npx serve public -p 5173',
        },
      };
      fs.writeFileSync(path.join(frontendPath, 'package.json'), JSON.stringify(vanillaPackageJson, null, 2) + '\n');
    }

    // Frontend .env and .env.example
    const frontendEnv = `# Frontend Environment Configuration
VITE_API_URL=http://localhost:3000
`;
    fs.writeFileSync(path.join(frontendPath, '.env.example'), frontendEnv, 'utf-8');
    fs.writeFileSync(path.join(frontendPath, '.env'), frontendEnv, 'utf-8');
    console.log(`  ${colors.green}✔${colors.reset} Created ${colors.bright}frontend/${colors.reset} (${frontendFw} application with live endpoint explorer)`);
  }

  // 3. SCAFFOLD ROOT FILES & WORKSPACES
  // Root Playwright E2E Tests
  const rootTestsDir = path.join(targetPath, 'tests', 'e2e');
  if (!fs.existsSync(rootTestsDir)) {
    fs.mkdirSync(rootTestsDir, { recursive: true });
  }
  fs.copyFileSync(
    path.join(packageRoot, 'tests', 'e2e', 'home.spec.js'),
    path.join(rootTestsDir, 'home.spec.js')
  );

  // Root Configs
  const rootFiles = [
    '.eslintrc.json',
    '.prettierrc',
    '.gitleaks.toml',
    '.semgrepignore',
    '.dockerignore',
    'jest.config.js',
    'playwright.config.js',
  ];

  for (const file of rootFiles) {
    const srcFile = path.join(packageRoot, file);
    const destFile = path.join(targetPath, file);
    if (fs.existsSync(srcFile) && srcFile !== destFile) {
      fs.copyFileSync(srcFile, destFile);
    }
  }

  // Root package.json
  if (targetPath !== packageRoot) {
    let rootPackageJson;
    if (isFullstack) {
      rootPackageJson = {
        name: path.basename(targetPath),
        version: '1.0.0',
        private: true,
        workspaces: ['backend', 'frontend'],
        scripts: {
          dev: 'concurrently -k -n "API,UI" -c "cyan,magenta" "npm run dev --workspace=backend" "npm run dev --workspace=frontend"',
          'dev:backend': 'npm run dev --workspace=backend',
          'dev:frontend': 'npm run dev --workspace=frontend',
          build: 'npm run build --workspaces',
          test: 'npm test --workspace=backend',
          'test:e2e': 'playwright test',
          lint: 'npm run lint --workspaces',
        },
        devDependencies: {
          '@playwright/test': '^1.44.0',
          concurrently: '^8.2.2',
        },
      };
    } else {
      rootPackageJson = {
        name: path.basename(targetPath),
        version: '1.0.0',
        description: `Cloud-Native microservice (${backendFw}) with DevSecOps`,
        main: 'src/server.js',
        scripts: {
          start: 'node src/server.js',
          dev: 'node --watch src/server.js',
          lint: 'eslint "src/**/*.js" "tests/**/*.js"',
          test: 'npm run test:unit && npm run test:integration',
          'test:unit': 'jest tests/unit --runInBand',
          'test:integration': 'jest tests/integration --runInBand',
          'test:e2e': 'playwright test',
        },
        devDependencies: {
          '@playwright/test': '^1.44.0',
        },
      };
    }

    fs.writeFileSync(
      path.join(targetPath, 'package.json'),
      JSON.stringify(rootPackageJson, null, 2) + '\n',
      'utf-8'
    );
    console.log(`  ${colors.green}✔${colors.reset} Generated ${colors.bright}package.json${colors.reset} (NPM Workspaces)`);
  }

  // Root CI/CD Workflow
  const features = ['gitleaks', 'eslint', 'npm-audit', 'semgrep', 'unit', 'integration', 'playwright', 'owasp', 'trivy', 'google-chat'];
  const workflowContent = generateGitHubWorkflow({ framework: backendFw, database, features });
  const workflowDir = path.join(targetPath, '.github', 'workflows');
  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }
  fs.writeFileSync(path.join(workflowDir, 'ci-cd.yml'), workflowContent.trim() + '\n', 'utf-8');
  console.log(`  ${colors.green}✔${colors.reset} Generated ${colors.bright}.github/workflows/ci-cd.yml${colors.reset}`);

  // Root docker-compose.yml
  if (isFullstack) {
    copyDirRecursive(path.join(packageRoot, 'templates', 'compose'), targetPath);
    console.log(`  ${colors.green}✔${colors.reset} Generated ${colors.bright}docker-compose.yml${colors.reset} (Fullstack Dev Stack)`);
  }

  // Root .env.example and .gitignore
  const rootEnv = `# Unified Root Environment
NODE_ENV=development
PORT=3000
VITE_API_URL=http://localhost:3000
${database === 'postgres' ? 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db\n' : ''}`;
  fs.writeFileSync(path.join(targetPath, '.env.example'), rootEnv, 'utf-8');
  fs.writeFileSync(path.join(targetPath, '.env'), rootEnv, 'utf-8');

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
  console.log(`  ${colors.green}✔${colors.reset} Configured ${colors.bright}.env${colors.reset} & ${colors.bright}.gitignore${colors.reset}`);

  // 4. AUTOMATED NPM INSTALL (NPM Workspaces installs both backend + frontend at once)
  if (autoInstall.toLowerCase().startsWith('y')) {
    console.log(`\n${colors.cyan}📦 Installing all dependencies (backend + frontend) via npm install...${colors.reset}`);
    try {
      spawnSync('npm', ['install'], { cwd: targetPath, stdio: 'inherit' });
      console.log(`  ${colors.green}✔${colors.reset} Monorepo dependencies installed successfully.`);
    } catch (err) {
      console.warn(`  ${colors.yellow}⚠️ Failed to run npm install automatically:${colors.reset}`, err.message);
    }
  }

  // 5. AUTOMATED GIT INITIALIZATION
  if (autoGit.toLowerCase().startsWith('y')) {
    console.log(`\n${colors.cyan}🔧 Initializing git repository in ${targetPath}...${colors.reset}`);
    try {
      spawnSync('git', ['init'], { cwd: targetPath, stdio: 'inherit' });
      spawnSync('git', ['add', '.'], { cwd: targetPath, stdio: 'inherit' });
      spawnSync('git', ['commit', '-m', 'feat: initial commit with La Plateforme Fullstack DevSecOps starter'], {
        cwd: targetPath,
        stdio: 'inherit',
      });
      console.log(`  ${colors.green}✔${colors.reset} Git repository initialized with initial commit.`);
    } catch (err) {
      console.warn(`  ${colors.yellow}⚠️ Git initialization skipped or failed:${colors.reset}`, err.message);
    }
  }

  console.log(`\n${colors.green}${colors.bright}🎉 Monorepo successfully created and initialized at ${targetPath}!${colors.reset}`);
  console.log(`
${colors.bright}Folder Structure Created:${colors.reset}
  📁 ${appName}/
  ├── 📂 .github/workflows/ci-cd.yml  - Automated Shift-Left DevSecOps CI/CD
  ├── 📂 backend/                     - ${backendFw} API Service & Probes
  ├── 📂 frontend/                    - ${frontendFw} Application & Endpoint Explorer
  ├── 📂 tests/e2e/                   - Playwright Browser User Journey Tests
  ├── 📄 docker-compose.yml           - Local multi-service dev orchestration
  └── 📄 package.json                 - NPM Workspaces Root

${colors.bright}Get Started:${colors.reset}
  ${appName !== '.' ? `1. ${colors.cyan}cd ${appName}${colors.reset}\n  2. ` : '1. '}${colors.cyan}npm run dev${colors.reset}              - Start both Backend (port 3000) & Frontend (port 5173)
  ${appName !== '.' ? '3. ' : '2. '}${colors.cyan}npm test${colors.reset}                 - Run Unit & Integration tests
  ${appName !== '.' ? '4. ' : '3. '}${colors.cyan}npm run test:e2e${colors.reset}         - Run Playwright E2E browser tests
  ${appName !== '.' ? '5. ' : '4. '}${colors.cyan}git push origin main${colors.reset}     - Trigger automated DevSecOps CI/CD!
`);
}

if (require.main === module) {
  runWizard().catch((err) => {
    console.error(`\n${colors.red}❌ Error running scaffolder:${colors.reset}`, err);
    process.exit(1);
  });
}

module.exports = { runWizard };

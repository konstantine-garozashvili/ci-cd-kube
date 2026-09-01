/**
 * Dynamic Workflow Generator for GitHub Actions
 * Generates `.github/workflows/ci-cd.yml` customized for the selected framework, database, and security features.
 */
function generateGitHubWorkflow({ framework: _framework, database, features }) {
  const hasPostgres = database === 'postgres';
  const hasMongo = database === 'mongodb';
  const hasPlaywright = features.includes('playwright');
  const hasOwasp = features.includes('owasp');
  const hasTrivy = features.includes('trivy');
  const hasGitleaks = features.includes('gitleaks');

  let dbServicesSection = '';
  if (hasPostgres) {
    dbServicesSection = `
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5`;
  } else if (hasMongo) {
    dbServicesSection = `
    services:
      mongodb:
        image: mongo:7-jammy
        ports:
          - 27017:27017`;
  }

  return `name: 🚀 DevSecOps CI/CD Pipeline

on:
  push:
    branches: [main]
    tags: ['v*']

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  packages: write
  issues: write

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  # ==========================================
  # PHASE 1: Shift-Left Security & Full CI Gate
  # ==========================================
  ci-quality-gate:
    name: 🛡️ Shift-Left Security & Testing Gate
    runs-on: ubuntu-latest${dbServicesSection}
    steps:
      - name: 📥 1.1 Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
${hasGitleaks ? `
      - name: 🔑 1.2 Scan for Leaked Secrets & Credentials
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
` : ''}
      - name: ⚙️ 1.3 Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: 📦 1.4 Clean Dependencies Install
        run: npm ci

      - name: 🧹 1.5 Code Linting & Style Standards
        run: npm run lint

      - name: 🛡️ 1.6 Dependency Vulnerability Audit (SCA)
        run: npm audit --audit-level=high

      - name: 🔍 1.7 SAST Security Scan (Semgrep OWASP Top 10)
        run: |
          python3 -m pip install --quiet semgrep
          semgrep scan --config="p/owasp-top-ten" src --error --metrics=off

      - name: 🧪 1.8 Execute Automated Unit Tests
        run: npm run test:unit

      - name: 🔄 1.9 Execute API Integration Tests
        run: npm run test:integration
${hasPlaywright ? `
      - name: 🎭 1.10 Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: 🎭 1.11 Execute Playwright E2E Tests
        run: npm run test:e2e
` : ''}${hasOwasp ? `
      - name: ⚡ 1.12 Start Web Server for DAST Probe
        run: |
          npm start &
          npx --yes wait-on http://127.0.0.1:3000/healthz --timeout 30000

      - name: ⚡ 1.13 OWASP ZAP DAST Live Vulnerability Scan
        uses: zaproxy/action-baseline@v0.14.0
        with:
          target: 'http://localhost:3000'
          fail_action: false
          allow_issue_writing: false
          token: \${{ secrets.GITHUB_TOKEN }}
` : ''}

  # ==========================================
  # PHASE 2: Secure Build, CVE Scan & GHCR
  # ==========================================
  docker-build-push:
    name: 🐳 Docker Build & Container Registry
    needs: [ci-quality-gate]
    runs-on: ubuntu-latest
    steps:
      - name: 📥 2.1 Checkout Code
        uses: actions/checkout@v4

      - name: 🐳 2.2 Hadolint Dockerfile Linter
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: Dockerfile
          failure-threshold: error

      - name: 🛠️ 2.3 Setup Docker Buildx Engine
        uses: docker/setup-buildx-action@v3

      - name: 🏷️ 2.4 Compute Dynamic Tags (Dev vs Prod)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=dev-{{sha}},enable=\${{ github.ref == 'refs/heads/main' }}
            type=raw,value=dev-latest,enable=\${{ github.ref == 'refs/heads/main' }}
            type=semver,pattern={{version}},enable=\${{ startsWith(github.ref, 'refs/tags/v') }}
            type=raw,value=latest,enable=\${{ startsWith(github.ref, 'refs/tags/v') }}

      - name: 🔐 2.5 Login to GitHub Container Registry (GHCR)
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: 🏗️ 2.6 Multi-Stage Docker Image Build
        uses: docker/build-push-action@v5
        with:
          context: .
          load: true
          tags: \${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
${hasTrivy ? `
      - name: 🛡️ 2.7 Trivy Container Vulnerability Scan (CVEs)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: \${{ fromJSON(steps.meta.outputs.json).tags[0] }}
          format: 'table'
          exit-code: '0'
          ignore-unfixed: true
          severity: 'CRITICAL,HIGH'
` : ''}
      - name: 🚀 2.8 Push Verified Container Image to GHCR
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}

  # ==========================================
  # PHASE 3: SOAR Monitoring & Alerting
  # ==========================================
  notify:
    name: 📢 Google Chat SOAR Alerting
    needs: [ci-quality-gate, docker-build-push]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: 📢 Dispatch Google Chat Status Card
        if: env.GOOGLE_CHAT_WEBHOOK != ''
        env:
          GOOGLE_CHAT_WEBHOOK: \${{ secrets.GOOGLE_CHAT_WEBHOOK_URL }}
          BUILD_RESULT: \${{ needs.docker-build-push.result }}
          GH_REPO: \${{ github.repository }}
          GH_SHA: \${{ github.sha }}
          GH_ACTOR: \${{ github.actor }}
          GH_REF_NAME: \${{ github.ref_name }}
          GH_RUN_ID: \${{ github.run_id }}
        run: |
          if [ "$BUILD_RESULT" = "success" ]; then
            PIPELINE_STATUS="SUCCESS"
            STATUS_ICON="🟢"
          else
            PIPELINE_STATUS="FAILURE"
            STATUS_ICON="🔴"
          fi

          curl -s -X POST -H 'Content-Type: application/json' "$GOOGLE_CHAT_WEBHOOK" -d "{
            \\"cardsV2\\": [{
              \\"cardId\\": \\"pipelineStatusCard\\",
              \\"card": {
                \\"header\\": {
                  \\"title\\": \\"$STATUS_ICON CI/CD Pipeline $PIPELINE_STATUS\\",
                  \\"subtitle\\": \\"Repository: $GH_REPO\\"
                },
                \\"sections\\": [{
                  \\"widgets\\": [
                    { \\"decoratedText\\": { \\"topLabel\\": \\"Commit\\", \\"text\\": \\"$GH_SHA\\" } },
                    { \\"decoratedText\\": { \\"topLabel\\": \\"Author\\", \\"text\\": \\"$GH_ACTOR\\" } },
                    { \\"decoratedText\\": { \\"topLabel\\": \\"Ref\\", \\"text\\": \\"$GH_REF_NAME\\" } },
                    { \\"buttonList\\": { \\"buttons\\": [{ \\"text\\": \\"View Action Run\\", \\"onClick\\": { \\"openLink\\": { \\"url\\": \\"https://github.com/$GH_REPO/actions/runs/$GH_RUN_ID\\" } } }] } }
                  ]
                }]
              }
            }]
          }" || true
`;
}

/**
 * Dynamic Multi-Stage Dockerfile Generator
 */
function generateDockerfile({ framework }) {
  if (framework === 'nestjs' || framework === 'nextjs') {
    return `# ========================================================
# Stage 1: Build & Compilation Stage
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build && npm prune --production

# ========================================================
# Stage 2: Minimal Production Runtime
# ========================================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Security Hardening: Run as non-root user
USER node

# Copy only production dependencies & build artifacts
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/src/public ./src/public 2>/dev/null || true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://127.0.0.1:3000/healthz', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/server.js"]
`;
  }

  // Default Express / Hono / Fastify Dockerfile
  return `# ========================================================
# Stage 1: Build & Dependencies Stage
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# ========================================================
# Stage 2: Minimal Production Runtime Stage
# ========================================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Security Hardening: Run as non-root user
USER node

# Copy production node_modules from builder
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src/ ./src/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://127.0.0.1:3000/healthz', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
`;
}

module.exports = {
  generateGitHubWorkflow,
  generateDockerfile,
};

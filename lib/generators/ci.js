'use strict';

const { BACKEND_PORT, NODE_VERSION } = require('../constants');

/**
 * Builds `.github/workflows/ci-cd.yml`.
 *
 * Two rules keep this generator honest:
 *  1. It only ever calls npm scripts that `generateRootPackageJson` defines, in
 *     both monorepo and single-package mode. That is why every step below uses
 *     root-level script names rather than reaching into a workspace directory.
 *  2. Gates that claim to block actually block. Steps that are advisory (DAST,
 *     which is noisy on a fresh project) say so in a comment instead of quietly
 *     passing with `exit-code: 0`.
 */
function generateGitHubWorkflow(options) {
  const { database, projectName, dockerTargets, sastPaths, hasUi } = options;

  return `name: 🚀 DevSecOps CI/CD Pipeline

# Pull requests are gated too — a quality gate that only runs after merge is
# not a gate. Tags starting with v cut a release image.
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}
  NODE_VERSION: '${NODE_VERSION}'

jobs:
  # =========================================================================
  # PHASE 1 — Shift-left security and the full test suite
  # =========================================================================
  quality-gate:
    name: 🛡️ Security & Test Gate
    runs-on: ubuntu-latest
    timeout-minutes: 20
${servicesBlock(database)}
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4
        with:
          # gitleaks needs history to scan the commits in this push/PR.
          fetch-depth: 0

      - name: 🔑 Secret scan (gitleaks)
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

      - name: ⚙️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: 📦 Install dependencies
        run: npm ci

      - name: 🎨 Check formatting
        run: npm run format:check

      - name: 🧹 Lint
        run: npm run lint

      # Dev-only advisories cannot be exploited in production, so the gate is
      # scoped to what actually ships. Run \`npm audit\` locally for the rest.
      - name: 🛡️ Dependency audit (production tree)
        run: npm audit --omit=dev --audit-level=high

      - name: 🔍 SAST scan (Semgrep, OWASP Top 10)
        run: |
          python3 -m pip install --quiet semgrep
          semgrep scan --config="p/owasp-top-ten" --error --metrics=off ${sastPaths}
${migrationStep(database)}
      - name: 🧪 Unit tests
        run: npm run test:unit
${testEnvBlock(database)}
      - name: 🔄 Integration tests
        run: npm run test:integration
${testEnvBlock(database)}
  # =========================================================================
  # PHASE 2 — Browser end-to-end journey
  # =========================================================================
  e2e:
    name: 🎭 End-to-End Tests
    runs-on: ubuntu-latest
    needs: [quality-gate]
    timeout-minutes: 20
${servicesBlock(database)}
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: ⚙️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: 📦 Install dependencies
        run: npm ci

      - name: 🎭 Install Playwright browsers
        run: npx playwright install --with-deps chromium
${migrationStep(database)}${buildStepForE2e(hasUi)}
      - name: 🎭 Run Playwright suite
        run: npm run test:e2e
${testEnvBlock(database, true)}
      - name: 📊 Upload Playwright report
        if: \${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  # =========================================================================
  # PHASE 3 — Build, scan and publish container images
  # =========================================================================
  docker:
    name: 🐳 Build & Scan (\${{ matrix.service }})
    runs-on: ubuntu-latest
    needs: [quality-gate, e2e]
    timeout-minutes: 30
    permissions:
      contents: read
      packages: write
      security-events: write
    strategy:
      fail-fast: false
      matrix:
        include:
${dockerMatrix(dockerTargets)}
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 🐳 Lint Dockerfile (hadolint)
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: \${{ matrix.dockerfile }}
          failure-threshold: error

      - name: 🛠️ Setup Buildx
        uses: docker/setup-buildx-action@v3

      - name: 🏷️ Compute image tags
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}/\${{ matrix.service }}
          tags: |
            type=ref,event=pr
            type=raw,value=dev-\${{ github.sha }},enable=\${{ github.ref == 'refs/heads/main' }}
            type=raw,value=dev-latest,enable=\${{ github.ref == 'refs/heads/main' }}
            type=semver,pattern={{version}}
            type=raw,value=latest,enable=\${{ startsWith(github.ref, 'refs/tags/v') }}

      # Build locally first so Trivy can inspect the image before anyone can
      # pull it. Publishing an image and *then* scanning it is backwards.
      - name: 🏗️ Build image (load into local daemon)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: \${{ matrix.dockerfile }}
          load: true
          push: false
          tags: \${{ matrix.service }}:ci
          cache-from: type=gha,scope=\${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=\${{ matrix.service }}

      - name: 🛡️ Container CVE scan (Trivy)
        uses: aquasecurity/trivy-action@0.24.0
        with:
          image-ref: \${{ matrix.service }}:ci
          format: 'table'
          severity: 'CRITICAL,HIGH'
          ignore-unfixed: true
          # Blocking on purpose. If a base-image CVE has no fix yet it is
          # skipped by ignore-unfixed; to accept a specific finding, add it to
          # a .trivyignore file rather than disabling the gate.
          exit-code: '1'

      - name: 🔐 Login to GHCR
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: 📤 Publish image
        # Never publish from a pull request: the PR branch is untrusted and
        # GITHUB_TOKEN is read-only there anyway.
        if: github.event_name != 'pull_request'
        uses: docker/build-push-action@v5
        with:
          context: .
          file: \${{ matrix.dockerfile }}
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=\${{ matrix.service }}

  # =========================================================================
  # PHASE 4 — Dynamic scan of the running application (advisory)
  # =========================================================================
  dast:
    name: ⚡ OWASP ZAP Baseline (advisory)
    runs-on: ubuntu-latest
    needs: [quality-gate]
    if: github.event_name == 'push'
    timeout-minutes: 20
${servicesBlock(database)}
    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: ⚙️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: 📦 Install dependencies
        run: npm ci
${migrationStep(database)}
      - name: 🚀 Start the API
        run: |
          npm start &
          npx --yes wait-on http://127.0.0.1:${BACKEND_PORT}/healthz --timeout 60000
${testEnvBlock(database)}
      # Report-only: the ZAP baseline flags header and cookie findings that are
      # expected on a fresh project. Read the artifact, then tighten what
      # matters — do not treat a green tick here as a clean bill of health.
      - name: ⚡ ZAP baseline scan
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: 'http://127.0.0.1:${BACKEND_PORT}'
          fail_action: false
          allow_issue_writing: false
          cmd_options: '-a'

  # =========================================================================
  # PHASE 5 — Notify
  # =========================================================================
  notify:
    name: 📢 Pipeline Notification
    runs-on: ubuntu-latest
    needs: [quality-gate, e2e, docker]
    if: always() && github.event_name == 'push'
    steps:
      - name: 📢 Post status card to Google Chat
        env:
          # Read at the job step level, then checked in the script. A step's own
          # \`env:\` block is not visible to that step's \`if:\` expression, so
          # guarding with \`if: env.WEBHOOK != ''\` would silently never run.
          WEBHOOK: \${{ secrets.GOOGLE_CHAT_WEBHOOK_URL }}
          GATE_RESULT: \${{ needs.quality-gate.result }}
          E2E_RESULT: \${{ needs.e2e.result }}
          BUILD_RESULT: \${{ needs.docker.result }}
          GH_REPO: \${{ github.repository }}
          GH_SHA: \${{ github.sha }}
          GH_ACTOR: \${{ github.actor }}
          GH_REF: \${{ github.ref_name }}
          GH_RUN_ID: \${{ github.run_id }}
        run: |
          set -euo pipefail

          if [ -z "\${WEBHOOK:-}" ]; then
            echo "ℹ️  GOOGLE_CHAT_WEBHOOK_URL is not set — skipping notification."
            echo "   Add it under Settings → Secrets and variables → Actions to enable."
            exit 0
          fi

          if [ "$GATE_RESULT" = "success" ] && [ "$E2E_RESULT" = "success" ] && [ "$BUILD_RESULT" = "success" ]; then
            STATUS="SUCCESS"; ICON="🟢"
          else
            STATUS="FAILURE"; ICON="🔴"
          fi

          # Built with jq so branch names and commit metadata can never break
          # out of the JSON string they are placed in.
          jq -n \\
            --arg title "$ICON ${projectName} pipeline $STATUS" \\
            --arg subtitle "$GH_REPO@$GH_REF" \\
            --arg sha "$GH_SHA" \\
            --arg actor "$GH_ACTOR" \\
            --arg gate "$GATE_RESULT" \\
            --arg e2e "$E2E_RESULT" \\
            --arg build "$BUILD_RESULT" \\
            --arg url "https://github.com/$GH_REPO/actions/runs/$GH_RUN_ID" \\
            '{
              cardsV2: [{
                cardId: "pipeline-status",
                card: {
                  header: { title: $title, subtitle: $subtitle },
                  sections: [{
                    widgets: [
                      { decoratedText: { topLabel: "Commit", text: $sha } },
                      { decoratedText: { topLabel: "Author", text: $actor } },
                      { decoratedText: { topLabel: "Quality gate", text: $gate } },
                      { decoratedText: { topLabel: "End-to-end", text: $e2e } },
                      { decoratedText: { topLabel: "Image build", text: $build } },
                      { buttonList: { buttons: [
                        { text: "View run", onClick: { openLink: { url: $url } } }
                      ] } }
                    ]
                  }]
                }
              }]
            }' > payload.json

          curl -sS --fail-with-body -X POST \\
            -H 'Content-Type: application/json' \\
            -d @payload.json "$WEBHOOK"
`;
}

/** Database service containers, indented to sit inside a job definition. */
function servicesBlock(database) {
  if (database === 'postgres') {
    return `    services:
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
          --health-retries 5
`;
  }

  if (database === 'mongodb') {
    return `    services:
      mongodb:
        image: mongo:7-jammy
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --quiet --eval 'db.runCommand({ ping: 1 })'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
`;
  }

  return '';
}

/** `env:` block attached to any step that touches the database. */
function testEnvBlock(database, includeBaseUrl = false) {
  const lines = [];

  if (database === 'postgres') {
    lines.push(
      'DATABASE_URL: postgresql://test_user:test_password@localhost:5432/test_db?schema=public'
    );
  } else if (database === 'mongodb') {
    lines.push('MONGODB_URI: mongodb://localhost:27017/test_db');
  }

  if (includeBaseUrl) {
    lines.push('CI: "true"');
  }

  if (lines.length === 0) {
    return '';
  }

  return `        env:\n${lines.map((line) => `          ${line}`).join('\n')}\n`;
}

/** Applies the schema before anything reads from the database. */
function migrationStep(database) {
  if (database !== 'postgres') {
    return '';
  }

  return `
      - name: 🗄️ Apply database schema
        run: npm run db:push -- --skip-generate --accept-data-loss
${testEnvBlock(database)}`;
}

/** Static frontends must be built before Playwright can preview them. */
function buildStepForE2e(hasUi) {
  if (!hasUi) {
    return '';
  }

  return `
      - name: 🏗️ Build the application
        run: npm run build --if-present
`;
}

function dockerMatrix(targets) {
  return targets
    .map(
      (target) =>
        `          - service: ${target.service}\n            dockerfile: ${target.dockerfile}`
    )
    .join('\n');
}

module.exports = { generateGitHubWorkflow };

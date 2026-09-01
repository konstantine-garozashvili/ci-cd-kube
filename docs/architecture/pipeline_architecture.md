# 🏗️ CI/CD & DevSecOps Pipeline Architecture

## 📌 Overview
This document specifies the technical architecture and workflow logic of the **Continuous Integration (CI) and Secure Container Publishing** pipeline for the `ci-cd-kube` project. The automated pipeline enforces **Shift-Left Security**, a full **Testing Pyramid** (Unit, Integration, and **Playwright E2E browser testing** before any build), Docker multi-stage builds, container vulnerability scanning, **GitHub Container Registry (GHCR)** publication, and real-time **Google Chat** alerting.

*(Note: Kubernetes deployment stages are maintained as a subsequent roadmap milestone).*

---

## 📊 UML Activity Diagram (DevSecOps & Full Testing Pipeline)

```mermaid
flowchart TD
    StartNode(["● Start: Git Push or Tag"]) --> SecretGate

    subgraph PHASE1 ["Phase 1: Shift-Left Security & Full Testing Gate (CI)"]
        SecretGate["1.1 🔑 Gitleaks: Secret Detection"]
        SecretGate --> Lint["1.2 🧹 ESLint & Code Standards"]
        Lint --> DepAudit["1.3 📦 Dependency Audit (npm audit / SCA)"]
        DepAudit --> SAST["1.4 🔍 SAST Security Scan (Semgrep)"]
        SAST --> UnitTests["1.5 🧪 Unit Tests (Jest)"]
        UnitTests --> IntegrationTests["1.6 🔄 Integration Tests (Supertest)"]
        IntegrationTests --> PlaywrightE2E["1.7 🎭 Playwright E2E Tests (Headless Browser Scenarios)"]
        PlaywrightE2E --> Phase1Dec{"All Tests & Security Passed?"}
    end

    subgraph PHASE2 ["Phase 2: Secure Containerization & GHCR Push"]
        Hadolint["2.1 🐳 Hadolint: Dockerfile Security Lint"]
        Hadolint --> CheckTrigger{"Trigger Type?"}
        CheckTrigger -->|"Push 'main'"| DevTag["Dev Strategy: dev-sha, dev-latest"]
        CheckTrigger -->|"Tag 'v*'"| ProdTag["Prod Strategy: vX.Y.Z, latest"]
        DevTag --> DockerBuild["2.2 🏗️ Multi-Stage Docker Build"]
        ProdTag --> DockerBuild
        DockerBuild --> TrivyScan["2.3 🛡️ Trivy: Container Image CVE Scan"]
        TrivyScan --> PushGHCR["2.4 🏷️ Authenticate & Push to GHCR"]
        PushGHCR --> Phase2Dec{"Build & CVE Scan Success?"}
    end

    subgraph PHASE3 ["Phase 3: SOAR Monitoring & Google Chat Alerting"]
        FailAlert["🔴 Dispatch Google Chat Failure Alert<br/>• Failed Check: Gitleaks / Lint / Unit / Integration / Playwright / Trivy<br/>• Error Logs & Diagnostic Summary<br/>• Commit SHA, Author & Branch/Tag"] --> TermFail(["● Terminated"])
        SuccAlert["🟢 Dispatch Google Chat Success Alert<br/>• Security & Tests (Unit + Integration + Playwright): 100% Clear<br/>• Image Published to GHCR<br/>• SemVer / Dev Tag & Digest"] --> TermSucc(["◎ Pipeline Succeeded"])
    end

    %% Success Transitions
    Phase1Dec -->|"Yes (All 3 Test Tiers + Security Clean)"| Hadolint
    Phase2Dec -->|"Yes (Zero Critical CVEs & Pushed)"| SuccAlert

    %% Fail-Fast Transitions (Immediate Alert & Terminate)
    Phase1Dec -->|"No (Gitleaks / Lint / Unit / Integ / Playwright Fail)"| FailAlert
    Phase2Dec -->|"No (Dockerfile Lint / Container CVE / Push Fail)"| FailAlert
```

---

## 🧪 Testing Pyramid Matrix (All Pre-Build in Phase 1)

| Testing Layer | Framework | Scope & Execution | Why Pre-Build? |
|---|---|---|---|
| **1. 🧪 Unit Tests** | **Jest** | Tests individual functions, utilities, and business calculations in isolation. | Instant feedback (< 5s). |
| **2. 🔄 Integration Tests** | **Supertest / Jest** | Tests HTTP routes (`GET /`, `GET /healthz`), middleware, payload structure, and headers. | Validates API contract before UI testing. |
| **3. 🎭 E2E Browser Tests** | **Playwright** | Launches headless browser (Chromium), executes user journeys, tests DOM rendering & live interactions. | **Fail-Fast**: Stops pipeline before expensive Docker builds if UI flows break. |

---

## 🛡️ Security & Quality Gates Breakdown

1. **🔑 Gitleaks**: Secret detection running on commit diffs before any artifact build.
2. **🧹 ESLint & Prettier**: Enforces syntax quality and static linting rules.
3. **📦 Dependency Audit (SCA)**: Scans third-party packages for known CVEs.
4. **🔍 SAST (Semgrep)**: Static analysis scanning for security anti-patterns (injection, hardcoded configs).
5. **🐳 Hadolint**: Validates Dockerfile against CIS security benchmarks (non-root user, pinned versions).
6. **🛡️ Trivy**: Container vulnerability scanning blocking High/Critical OS and library CVEs.
7. **📢 Google Chat Alerting**: Webhook dispatching rich failure diagnostics with exact error logs and stage name.

# 🏗️ CI/CD & DevSecOps Pipeline Architecture

## 📌 Overview
This document specifies the technical architecture and workflow logic of the **Continuous Integration (CI) and Secure Container Publishing** pipeline for the `ci-cd-kube` project. The automated pipeline enforces **Shift-Left Security**, a full **Testing Pyramid** (Unit, Integration, and live container E2E tests), Docker multi-stage builds, container vulnerability scanning, **GitHub Container Registry (GHCR)** publication, and real-time **Google Chat** alerting.

*(Note: Kubernetes deployment stages are maintained as a subsequent roadmap milestone).*

---

## 📊 UML Activity Diagram (DevSecOps & Full Testing Pipeline)

```mermaid
flowchart TD
    StartNode(["● Start: Git Push or Tag"]) --> SecretGate

    subgraph PHASE1 ["Phase 1: Shift-Left Security, Unit & Integration CI"]
        SecretGate["1.1 🔑 Gitleaks: Secret Detection"]
        SecretGate --> Lint["1.2 🧹 ESLint & Code Standards"]
        Lint --> DepAudit["1.3 📦 Dependency Audit (npm audit / SCA)"]
        DepAudit --> SAST["1.4 🔍 SAST Security Scan (Semgrep)"]
        SAST --> UnitTests["1.5 🧪 Automated Unit Tests"]
        UnitTests --> IntegrationTests["1.6 🔄 API Integration Tests (Supertest)"]
        IntegrationTests --> Phase1Dec{"CI & Quality Gate Passed?"}
    end

    subgraph PHASE2 ["Phase 2: Secure Build, E2E Container Test & GHCR"]
        Hadolint["2.1 🐳 Hadolint: Dockerfile Lint"]
        Hadolint --> CheckTrigger{"Trigger Type?"}
        CheckTrigger -->|"Push 'main'"| DevTag["Dev Strategy: dev-sha, dev-latest"]
        CheckTrigger -->|"Tag 'v*'"| ProdTag["Prod Strategy: vX.Y.Z, latest"]
        DevTag --> DockerBuild["2.2 🏗️ Multi-Stage Docker Build"]
        ProdTag --> DockerBuild
        DockerBuild --> E2ETests["2.3 🌐 E2E Live Container Tests (docker run + API suite)"]
        E2ETests --> TrivyScan["2.4 🛡️ Trivy: Container Image CVE Scan"]
        TrivyScan --> PushGHCR["2.5 🏷️ Authenticate & Push to GHCR"]
        PushGHCR --> Phase2Dec{"Build & E2E Validation Success?"}
    end

    subgraph PHASE3 ["Phase 3: SOAR Monitoring & Google Chat Alerting"]
        FailAlert["🔴 Dispatch Google Chat Failure Alert<br/>• Failed Level: Unit / Integration / E2E / Gitleaks / Trivy<br/>• Detailed Logs & Traceback<br/>• Commit, Author & Trigger"] --> TermFail(["● Terminated"])
        SuccAlert["🟢 Dispatch Google Chat Success Alert<br/>• Unit + Integration + E2E: 100% Passed<br/>• Security Checks: Clean<br/>• Image Published to GHCR"] --> TermSucc(["◎ Pipeline Succeeded"])
    end

    %% Success Transitions
    Phase1Dec -->|"Yes (All Unit & Integration OK)"| Hadolint
    Phase2Dec -->|"Yes (E2E & CVE Scans Passed)"| SuccAlert

    %% Fail-Fast Transitions
    Phase1Dec -->|"No (Unit / Integration / Security Fail)"| FailAlert
    Phase2Dec -->|"No (E2E / Docker / CVE / Push Fail)"| FailAlert
```

---

## 🧪 Comprehensive Testing Pyramid Strategy

### 1. The 3 Testing Levels
| Testing Level | Execution Stage | Scope & Purpose | Tooling |
|---|---|---|---|
| **🧪 1. Unit Testing** | Phase 1 (Pre-Build) | Tests individual modules and pure functions in complete isolation. Fast execution (< 5s). | Jest / Node Test Runner |
| **🔄 2. Integration Testing** | Phase 1 (Pre-Build) | Tests HTTP API endpoints (`GET /`, `GET /healthz`), middleware, error handlers, and payload structures. | Supertest / Jest |
| **🌐 3. E2E / Container Testing** | Phase 2 (Post-Build) | Spins up the newly built Docker image (`docker run -d -p 3000:3000 ...`) and executes end-to-end HTTP requests against the live container to guarantee zero missing runtime dependencies. | Newman / Custom E2E Suite / curl |

---

## 🛡️ Security & Quality Gates Breakdown

1. **🔑 Gitleaks**: Secret detection running on commit diffs before any artifact build.
2. **🧹 ESLint**: Enforces linting standards, static type checks, and formatting rules.
3. **📦 Dependency Audit (SCA)**: Scans third-party packages for known CVEs.
4. **🔍 SAST (Semgrep)**: Static analysis scanning for security anti-patterns (injection, hardcoded configs).
5. **🐳 Hadolint**: Validates Dockerfile against CIS security benchmarks (non-root user, pinned versions).
6. **🛡️ Trivy**: Container vulnerability scanning blocking High/Critical OS and library CVEs.
7. **📢 Google Chat Alerting**: Webhook dispatching rich failure diagnostics with exact error logs and stage name.

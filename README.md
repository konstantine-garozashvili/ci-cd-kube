# 🚀 CI/CD & DevSecOps Pipeline (`ci-cd-kube`)

![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=github-actions&logoColor=white)
![Security-Gitleaks](https://img.shields.io/badge/Security-Gitleaks-critical?logo=git&logoColor=white)
![Tests-Pyramid](https://img.shields.io/badge/Tests-Unit_%7C_Integration_%7C_E2E-success?logo=jest&logoColor=white)
![Security-Trivy](https://img.shields.io/badge/Security-Trivy_CVE_Scan-blue?logo=aquasecurity&logoColor=white)
![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker&logoColor=white)
![Registry](https://img.shields.io/badge/Registry-GHCR-181717?logo=github&logoColor=white)
![Alerting](https://img.shields.io/badge/Alerts-Google_Chat-00AC47?logo=googlechat&logoColor=white)

Enterprise Continuous Integration (CI) and Secure Containerization pipeline enforcing **Shift-Left DevSecOps quality gates** (Gitleaks, Linting, SCA, SAST, **Unit Tests**, **Integration Tests**, Hadolint, **E2E Container Tests**, Trivy CVE scan), versioned GHCR image publishing, and real-time Google Chat alerting.

---

## 📑 Architecture & UML Activity Diagram

For a complete breakdown and printable presentation view:
- 📖 **Architecture Document**: [docs/architecture/pipeline_architecture.md](docs/architecture/pipeline_architecture.md)
- 🖨️ **Printable / PDF Exportable HTML Diagram**: [docs/architecture/pipeline_diagram.html](docs/architecture/pipeline_diagram.html)

### 📊 DevSecOps & Testing Pyramid Workflow

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

## 🧪 Testing Pyramid Matrix

| Test Layer | Execution Phase | Scope | Framework |
|---|---|---|---|
| **1. 🧪 Unit Tests** | Phase 1 (Pre-Build) | Isolated functions and core business logic. | Jest |
| **2. 🔄 Integration Tests** | Phase 1 (Pre-Build) | HTTP routes (`/`, `/healthz`), headers, middleware. | Supertest / Jest |
| **3. 🌐 E2E Container Tests** | Phase 2 (Post-Build) | Spins up the container image (`docker run`) and validates live HTTP responses. | Automated Runner / curl |

---

## 🎯 Image Versioning Strategy

| Git Trigger | Target Git Ref | Generated Image Tag(s) | Target Environment |
|---|---|---|---|
| **Branch Push** | `refs/heads/main` | `ghcr.io/<owner>/ci-cd-kube:dev-<sha>`<br/>`ghcr.io/<owner>/ci-cd-kube:dev-latest` | **Development** |
| **Git Tag** | `refs/tags/v*` (e.g. `v1.0.0`) | `ghcr.io/<owner>/ci-cd-kube:1.0.0`<br/>`ghcr.io/<owner>/ci-cd-kube:latest` | **Production** |

---

## 📋 Implementation Roadmap & Kanban Board
Track project progress on the [GitHub Project Kanban Board](https://github.com/users/konstantine-garozashvili/projects/21).

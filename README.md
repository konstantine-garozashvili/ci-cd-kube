# 🚀 CI/CD & DevSecOps Pipeline (`ci-cd-kube`)

![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=github-actions&logoColor=white)
![Security-Gitleaks](https://img.shields.io/badge/Security-Gitleaks-critical?logo=git&logoColor=white)
![Security-Trivy](https://img.shields.io/badge/Security-Trivy_CVE_Scan-blue?logo=aquasecurity&logoColor=white)
![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker&logoColor=white)
![Registry](https://img.shields.io/badge/Registry-GHCR-181717?logo=github&logoColor=white)
![Alerting](https://img.shields.io/badge/Alerts-Google_Chat-00AC47?logo=googlechat&logoColor=white)

Enterprise Continuous Integration (CI) and Secure Containerization pipeline enforcing **Shift-Left DevSecOps quality gates** (Gitleaks, Linting, SCA, SAST, Unit Tests, Hadolint, Trivy CVE scan), versioned GHCR image publishing, and real-time Google Chat alerting.

---

## 📑 Architecture & UML Activity Diagram

For a complete breakdown and printable presentation view:
- 📖 **Architecture Document**: [docs/architecture/pipeline_architecture.md](docs/architecture/pipeline_architecture.md)
- 🖨️ **Printable / PDF Exportable HTML Diagram**: [docs/architecture/pipeline_diagram.html](docs/architecture/pipeline_diagram.html)

### 📊 DevSecOps Pipeline Workflow

```mermaid
flowchart TD
    StartNode(["● Start: Git Push or Tag"]) --> SecretGate

    subgraph PHASE1 ["Phase 1: Shift-Left Security & Quality Gate (CI)"]
        SecretGate["1.1 🔑 Gitleaks: Scan for Exposed Secrets & Keys"]
        SecretGate --> Lint["1.2 🧹 Code Quality & Linting (ESLint / Formatter)"]
        Lint --> DepAudit["1.3 📦 Dependency Vulnerability Audit (npm audit / SCA)"]
        DepAudit --> SAST["1.4 🔍 SAST Static Code Analysis (Semgrep)"]
        SAST --> UnitTests["1.5 🧪 Automated Unit Tests & Coverage Check"]
        UnitTests --> Phase1Dec{"Quality Gate Passed?"}
    end

    subgraph PHASE2 ["Phase 2: Secure Containerization & GHCR Push"]
        Hadolint["2.1 🐳 Hadolint: Dockerfile Security & Best Practices"]
        Hadolint --> CheckTrigger{"Trigger Type?"}
        CheckTrigger -->|"Push 'main'"| DevTag["Dev Strategy: dev-sha, dev-latest"]
        CheckTrigger -->|"Tag 'v*'"| ProdTag["Prod Strategy: vX.Y.Z, latest"]
        DevTag --> DockerBuild["2.2 🏗️ Multi-Stage Docker Image Build"]
        ProdTag --> DockerBuild
        DockerBuild --> TrivyScan["2.3 🛡️ Trivy: Container Image CVE Scan"]
        TrivyScan --> PushGHCR["2.4 🏷️ Authenticate & Push to GHCR"]
        PushGHCR --> Phase2Dec{"Build & Push Success?"}
    end

    subgraph PHASE3 ["Phase 3: SOAR Monitoring & Google Chat Alerting"]
        FailAlert["🔴 Dispatch Google Chat Failure Alert<br/>• Offending Stage: Gitleaks / Lint / Tests / Docker / Trivy<br/>• Error Logs & Diagnostic Summary<br/>• Commit SHA, Author & Branch/Tag"] --> TermFail(["● Terminated"])
        SuccAlert["🟢 Dispatch Google Chat Success Alert<br/>• Security Checks: 100% Clear<br/>• Image Published to GHCR<br/>• SemVer / Dev Tag & Digest"] --> TermSucc(["◎ Pipeline Succeeded"])
    end

    %% Success Transitions
    Phase1Dec -->|"Yes (All Checks Passed)"| Hadolint
    Phase2Dec -->|"Yes (Zero Critical CVEs & Pushed)"| SuccAlert

    %% Fail-Fast Transitions (Immediate Alert & Terminate)
    Phase1Dec -->|"No (Secret Leak / Lint / CVE / Test Failure)"| FailAlert
    Phase2Dec -->|"No (Dockerfile Lint / Image CVE / Push Error)"| FailAlert
```

---

## 🎯 Image Versioning Strategy

| Git Trigger | Target Git Ref | Generated Image Tag(s) | Target Environment |
|---|---|---|---|
| **Branch Push** | `refs/heads/main` | `ghcr.io/<owner>/ci-cd-kube:dev-<sha>`<br/>`ghcr.io/<owner>/ci-cd-kube:dev-latest` | **Development** |
| **Git Tag** | `refs/tags/v*` (e.g. `v1.0.0`) | `ghcr.io/<owner>/ci-cd-kube:1.0.0`<br/>`ghcr.io/<owner>/ci-cd-kube:latest` | **Production** |

---

## 📋 Implementation Roadmap & Kanban Board
Track project progress on the [GitHub Project Kanban Board](https://github.com/users/konstantine-garozashvili/projects/21).

# 🚀 CI/CD Pipeline & Kubernetes Deployment (`ci-cd-kube`)

![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?logo=github-actions&logoColor=white)
![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-326CE5?logo=kubernetes&logoColor=white)
![Registry](https://img.shields.io/badge/Registry-GHCR-181717?logo=github&logoColor=white)
![Alerting](https://img.shields.io/badge/Alerts-Google_Chat-00AC47?logo=googlechat&logoColor=white)

Comprehensive Continuous Integration (CI) and Continuous Deployment (CD) pipeline automating code quality gates, container builds, versioned registry publishing, Kubernetes cluster deployment, and real-time Google Chat alerting.

---

## 📑 Architecture & UML Activity Diagram

For a complete breakdown and printable presentation view:
- 📖 **Architecture Document**: [docs/architecture/pipeline_architecture.md](docs/architecture/pipeline_architecture.md)
- 🖨️ **Printable / PDF Exportable HTML Diagram**: [docs/architecture/pipeline_diagram.html](docs/architecture/pipeline_diagram.html)

### 📊 Master Pipeline Workflow

```mermaid
flowchart TD
    %% Global Styling
    classDef startEnd fill:#1e293b,stroke:#38bdf8,stroke-width:2.5px,color:#f8fafc,font-weight:bold;
    classDef action fill:#0f172a,stroke:#38bdf8,stroke-width:1.5px,color:#e2e8f0;
    classDef decision fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#ffffff,font-weight:bold;
    classDef fail fill:#450a0a,stroke:#ef4444,stroke-width:2px,color:#fee2e2;
    classDef success fill:#052e16,stroke:#22c55e,stroke-width:2px,color:#dcfce7;
    classDef branch fill:#172554,stroke:#60a5fa,stroke-width:1.5px,color:#dbeafe;

    %% Phase 1: CI & Quality Gate
    subgraph P1 ["🔹 PHASE 1: Trigger & Continuous Integration (CI)"]
        direction LR
        StartNode((● Start)):::startEnd --> Trigger[Git Event:<br/>Push 'main' OR Tag 'v*']:::action
        Trigger --> Checkout[1.1 Checkout Code<br/>actions/checkout@v4]:::action
        Checkout --> Setup[1.2 Setup Node.js &<br/>Cache Dependencies]:::action
        Setup --> Install[1.3 Install Deps<br/>npm ci]:::action
        Install --> Test[1.4 Execute Unit Tests<br/>npm test]:::action
        Test --> TestDec{Tests<br/>Passed?}:::decision
    end

    %% Phase 2: Containerization & Registry
    subgraph P2 ["🔹 PHASE 2: Multi-Stage Container Build & GHCR Push"]
        direction LR
        CheckType{Trigger<br/>Type?}:::decision -->|"Branch 'main'"| DevTag["Development Image<br/>Tags: dev-&lt;sha&gt;, dev-latest"]:::branch
        CheckType -->|"Tag 'v*'"| ProdTag["Production Image<br/>Tags: &lt;vX.Y.Z&gt;, latest"]:::branch
        DevTag --> Buildx[2.1 Docker Buildx<br/>Multi-Stage & Cache]:::action
        ProdTag --> Buildx
        Buildx --> PushGHCR[2.2 Auth & Push<br/>to ghcr.io]:::action
        PushGHCR --> BuildDec{Build & Push<br/>Success?}:::decision
    end

    %% Phase 3: Kubernetes CD
    subgraph P3 ["🔹 PHASE 3: Kubernetes Continuous Deployment (CD)"]
        direction LR
        K8sAuth[3.1 Authenticate Cluster<br/>via KUBECONFIG]:::action --> ApplyK8s[3.2 Apply Manifests<br/>Deploy / Service / Ingress]:::action
        ApplyK8s --> SetImg[3.3 Update Container<br/>Image Tag on Cluster]:::action
        SetImg --> Rollout[3.4 Monitor Rollout<br/>kubectl rollout status (120s)]:::action
        Rollout --> RolloutDec{Rollout<br/>Healthy?}:::decision
    end

    %% Phase 4: SOAR Monitoring & Alerts
    subgraph P4 ["🔹 PHASE 4: Monitoring, Alerting & Terminal State"]
        direction LR
        FailAlert[🔴 Dispatch Google Chat Failure Alert<br/>- Error logs & stack trace<br/>- Offending step & author]:::fail --> TermFail((● Terminated)):::fail
        
        SuccAlert[🟢 Dispatch Google Chat Success Alert<br/>- Commit SHA & Author<br/>- Image digest & K8s rollout status]:::success --> TermSucc((◎ Succeeded)):::startEnd
    end

    %% Phase Interconnections (Success Flow)
    TestDec -->|✅ Passed| CheckType
    BuildDec -->|✅ Succeeded| K8sAuth
    RolloutDec -->|✅ Healthy| SuccAlert

    %% Fail-Fast Connections
    TestDec -->|❌ Failed (Fail-Fast)| FailAlert
    BuildDec -->|❌ Failed| FailAlert
    RolloutDec -->|❌ Failed (Timeout)| FailAlert
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

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
    StartNode(["● Start"]) --> Trigger["Git Event: Push on 'main' OR Tag 'v*'"]
    Trigger --> GHATrigger["Trigger GitHub Actions Workflow"]

    subgraph CI ["1. Continuous Integration & Quality Gate"]
        GHATrigger --> Checkout["1.1 Checkout Code (actions/checkout@v4)"]
        Checkout --> Setup["1.2 Setup Node.js & Cache Dependencies"]
        Setup --> Install["1.3 Install Dependencies (npm ci)"]
        Install --> Test["1.4 Execute Unit Tests (npm test)"]
        Test --> TestDec{"Tests Passed?"}
    end

    subgraph BUILD ["2. Multi-Stage Docker Build & GHCR Push"]
        CheckType{"Trigger Type?"}
        CheckType -->|"Push 'main'"| DevTag["Dev Strategy: dev-sha, dev-latest"]
        CheckType -->|"Tag 'v*'"| ProdTag["Prod Strategy: vX.Y.Z, latest"]
        DevTag --> Buildx["2.1 Setup Buildx & Cache"]
        ProdTag --> Buildx
        Buildx --> PushGHCR["2.2 Build Image & Push to GHCR"]
        PushGHCR --> BuildDec{"Build & Push Success?"}
    end

    subgraph K8S ["3. Kubernetes Continuous Deployment"]
        K8sAuth["3.1 Cluster Auth (KUBECONFIG)"]
        K8sAuth --> ApplyK8s["3.2 Apply Manifests (Deploy / Svc / Ingress)"]
        ApplyK8s --> SetImg["3.3 Update Container Image Tag"]
        SetImg --> Rollout["3.4 Wait for Rollout (kubectl rollout status)"]
        Rollout --> RolloutDec{"Rollout Healthy?"}
    end

    subgraph ALERTS ["4. Google Chat Notifications"]
        FailAlert["🔴 Send Google Chat Failure Alert (Logs, Step, Commit, Author)"] --> TermFail(["● Terminated"])
        SuccAlert["🟢 Send Google Chat Success Alert (Digest, Version, Status)"] --> TermSucc(["◎ Succeeded"])
    end

    TestDec -->|"Yes (Pass)"| CheckType
    BuildDec -->|"Yes (Success)"| K8sAuth
    RolloutDec -->|"Yes (Healthy)"| SuccAlert

    TestDec -->|"No (Fail-Fast)"| FailAlert
    BuildDec -->|"No (Error)"| FailAlert
    RolloutDec -->|"No (Timeout)"| FailAlert
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

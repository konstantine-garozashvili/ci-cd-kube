# 🏗️ CI/CD Pipeline Architecture & UML Activity Diagram

## 📌 Overview
This document specifies the technical architecture and workflow logic of the **Continuous Integration (CI) and Continuous Deployment (CD)** pipeline for the `ci-cd-kube` project. The automated pipeline is powered by **GitHub Actions**, containerized with **Docker**, stored in **GitHub Container Registry (GHCR)**, deployed to **Kubernetes**, and monitored with automated **Google Chat** notifications.

---

## 📊 UML Activity Diagram (Master Architecture)

The workflow is structured into **4 sequential execution phases**, combining horizontal phase progression with clear failure & recovery paths.

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

## 🔄 Detailed Pipeline Stages & Logic

### 1. Triggers & Event Filtering
| Trigger Event | Git Ref | Target Image Tags | Environment Target |
|---|---|---|---|
| **Code Push** | `refs/heads/main` | `ghcr.io/.../app:dev-<sha>`, `ghcr.io/.../app:dev-latest` | `development` |
| **Release Tag** | `refs/tags/v*` (e.g. `v1.0.0`) | `ghcr.io/.../app:1.0.0`, `ghcr.io/.../app:latest` | `production` |

---

### 2. Stage-by-Stage Breakdown

#### **Phase 1: Checkout & Automated Testing (CI Quality Gate)**
- **Fail-Fast Mechanism**: If any unit/integration test fails, execution halts immediately with exit code `1`.
- Subsequent build and deploy jobs are skipped.
- An alert is immediately prepared for dispatch.

#### **Phase 2: Containerization & Registry Push**
- Multi-stage `Dockerfile` ensures the production runtime container contains only compiled production assets and no dev-dependencies.
- GitHub Actions cache (`type=gha`) accelerates layer builds.
- Authentication against GitHub Container Registry (`ghcr.io`) utilizes GitHub's native scoped `GITHUB_TOKEN`.

#### **Phase 3: Kubernetes Continuous Deployment (CD)**
- Cluster authentication using secured `KUBECONFIG` secret.
- Application manifests deployed:
  - `Deployment`: Manages pod replicas, zero-downtime rolling updates, resource requests/limits, and health probes (`livenessProbe`, `readinessProbe`).
  - `Service`: Exposes pods internally within cluster (`ClusterIP`).
  - `Ingress`: Routes HTTP traffic from external ingress controller.
  - `ConfigMap` / `Secret`: Injects environment variables.
- Verification command: `kubectl rollout status deployment/ci-cd-kube-app --timeout=120s`.

#### **Phase 4: Google Chat Webhook Alerting**
- Executed on `if: always()` condition to guarantee dispatch regardless of job status.
- **Success Card (🟢)**: Includes Commit SHA, author name, branch/tag name, image digest, deployed namespace, and link to workflow run.
- **Failure Card (🔴)**: Highlights the specific stage that broke (Tests, Docker, K8s), error log extract, author to notify, and workflow link for immediate triage.

---

## 🛡️ SOAR & Resilience Principles Applied
1. **Automated Rollback Safeguard**: If `kubectl rollout status` fails within the 120s window, Kubernetes maintains traffic on previous healthy pods.
2. **Immutable Artifacts**: Production container tags match explicit SemVer Git tags (`v1.0.0`), guaranteeing reproducibility.
3. **Secret Isolation**: Sensitive credentials (`KUBECONFIG`, `GOOGLE_CHAT_WEBHOOK_URL`) are isolated within GitHub Actions Secrets and masked from console output.

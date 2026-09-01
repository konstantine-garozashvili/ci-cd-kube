# 🏗️ CI/CD Pipeline Architecture & UML Activity Diagram

## 📌 Overview
This document specifies the technical architecture and workflow logic of the **Continuous Integration (CI) and Continuous Deployment (CD)** pipeline for the `ci-cd-kube` project. The automated pipeline is powered by **GitHub Actions**, containerized with **Docker**, stored in **GitHub Container Registry (GHCR)**, deployed to **Kubernetes**, and monitored with automated **Google Chat** notifications.

---

## 📊 UML Activity Diagram (Balanced Landscape Architecture)

The workflow is structured into **4 sequential execution phases**, combining horizontal phase progression with clear failure & recovery paths.

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

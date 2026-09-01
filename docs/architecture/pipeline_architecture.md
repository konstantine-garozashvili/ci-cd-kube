# 🏗️ CI/CD Pipeline Architecture & UML Activity Diagram

## 📌 Overview
This document specifies the technical architecture and workflow logic of the **Continuous Integration (CI) and Continuous Deployment (CD)** pipeline for the `ci-cd-kube` project. The automated pipeline is powered by **GitHub Actions**, containerized with **Docker**, stored in **GitHub Container Registry (GHCR)**, deployed to **Kubernetes**, and monitored with automated **Google Chat** notifications.

---

## 📊 UML Activity Diagram

The diagram below maps all actors, swimlanes, execution steps, conditional branches (Fail-Fast testing, Dev vs Prod tagging), registry publishing, cluster deployment, and notification webhooks.

```mermaid
flowchart TD
    %% Styling Classes
    classDef startEnd fill:#1e293b,stroke:#0ea5e9,stroke-width:3px,color:#f8fafc,font-weight:bold;
    classDef action fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0;
    classDef decision fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#ffffff,font-weight:bold;
    classDef fail fill:#450a0a,stroke:#ef4444,stroke-width:2px,color:#fee2e2;
    classDef success fill:#052e16,stroke:#22c55e,stroke-width:2px,color:#dcfce7;
    classDef branch fill:#172554,stroke:#60a5fa,stroke-width:2px,color:#dbeafe;

    %% Initial Trigger
    StartNode((● Start)):::startEnd --> TriggerNode[Developer pushes commit to 'main' OR creates Git tag 'v*']:::action
    
    TriggerNode --> GHATrigger[GitHub Actions Runner Triggered]:::action
    
    %% Stage 1: Checkout & Test
    subgraph STAGE_1 ["Stage 1: Checkout & Automated Testing (CI)"]
        GHATrigger --> Checkout[1.1 Checkout Code via actions/checkout@v4]:::action
        Checkout --> SetupEnv[1.2 Setup Node.js / Runtime & Restore Dependencies Cache]:::action
        SetupEnv --> InstallDeps[1.3 Install Dependencies via npm ci]:::action
        InstallDeps --> RunTests[1.4 Execute Automated Test Suite npm test]:::action
        RunTests --> TestDecision{Tests Passed?}:::decision
    end

    %% Test Decision Branches
    TestDecision -- ❌ No (Fail-Fast) --> PrepareTestFail[Collect Test Error Logs & Failure Stack Trace]:::fail
    PrepareTestFail --> SendFailNotif[Send Google Chat Failure Card 🔴]:::fail
    SendFailNotif --> EndFail((● Pipeline Terminated)):::fail

    TestDecision -- ✅ Yes --> Stage2Entry[Proceed to Build Stage]:::action

    %% Stage 2 & 3: Containerization & Registry Push
    subgraph STAGE_2_3 ["Stage 2 & 3: Container Build & GHCR Push"]
        Stage2Entry --> CheckTriggerType{Trigger Type?}:::decision
        
        CheckTriggerType -- "Push on 'main'" --> DevTagging["Strategy: Development<br/>Tags: dev-&lt;sha&gt;, dev-latest<br/>Target Env: Development"]:::branch
        CheckTriggerType -- "Git Tag 'v*'" --> ProdTagging["Strategy: Production<br/>Tags: &lt;vX.Y.Z&gt;, latest<br/>Target Env: Production"]:::branch
        
        DevTagging --> SetupBuildx[Setup Docker Buildx & Cache Layer]:::action
        ProdTagging --> SetupBuildx
        
        SetupBuildx --> AuthGHCR[Authenticate with GHCR via GITHUB_TOKEN]:::action
        AuthGHCR --> DockerBuildPush[Build Multi-Stage Docker Image & Push to GHCR]:::action
        DockerBuildPush --> BuildDecision{Build & Push Succeeded?}:::decision
    end

    %% Build Decision Branches
    BuildDecision -- ❌ No --> PrepareBuildFail[Collect Docker Build & Push Error Logs]:::fail
    PrepareBuildFail --> SendFailNotif

    BuildDecision -- ✅ Yes --> Stage4Entry[Proceed to Deployment Stage]:::action

    %% Stage 4: Kubernetes Continuous Deployment
    subgraph STAGE_4 ["Stage 4: Kubernetes Deployment (CD)"]
        Stage4Entry --> AuthK8s[Authenticate with Kubernetes Cluster via KUBECONFIG]:::action
        AuthK8s --> ApplyManifests[Apply K8s Manifests: Deployment, Service, Ingress, Config]:::action
        ApplyManifests --> SetImage[Update Deployment Image Tag to Newly Pushed Image]:::action
        SetImage --> RolloutWait[Execute kubectl rollout status --timeout=120s]:::action
        RolloutWait --> RolloutDecision{Rollout Healthy?}:::decision
    end

    %% Rollout Decision Branches
    RolloutDecision -- ❌ No (Timeout/CrashLoop) --> PrepareK8sFail[Fetch Failed Pod Logs & describe deployment]:::fail
    PrepareK8sFail --> SendFailNotif

    RolloutDecision -- ✅ Yes --> PrepareSuccess[Generate Pipeline Summary: Commit, Author, Image Digest, URL]:::success
    
    %% Stage 5: Notification & Final State
    subgraph STAGE_5 ["Stage 5: Notification & Completion"]
        PrepareSuccess --> SendSuccessNotif[Send Google Chat Success Card 🟢]:::success
        SendSuccessNotif --> EndSuccess((◎ Pipeline Finished Successfully)):::startEnd
    end
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

```mermaid
gantt
    title CI/CD Pipeline Execution Timeline
    dateFormat  X
    axisFormat %s s
    section Stage 1: CI & Quality Gate
    Checkout & Cache Restore : 0, 5
    Install Dependencies      : 5, 12
    Execute Tests (Fail-Fast) : 12, 22
    section Stage 2: Containerization
    Docker Buildx Setup       : 22, 25
    GHCR Login               : 25, 27
    Multi-stage Image Build  : 27, 45
    GHCR Image Push          : 45, 55
    section Stage 3: Kubernetes CD
    Cluster Auth             : 55, 58
    Manifest Apply / Update  : 58, 63
    Rollout Status Check     : 63, 75
    section Stage 4: Alerting
    Google Chat Webhook Card : 75, 78
```

#### **Stage 1: Checkout & Automated Testing (CI Quality Gate)**
- **Fail-Fast Mechanism**: If any unit/integration test fails, execution halts immediately with exit code `1`.
- Subsequent build and deploy jobs are skipped.
- An alert is immediately prepared for dispatch.

#### **Stage 2: Containerization & Registry Push**
- Multi-stage `Dockerfile` ensures the production runtime container contains only compiled production assets and no dev-dependencies.
- GitHub Actions cache (`type=gha`) accelerates layer builds.
- Authentication against GitHub Container Registry (`ghcr.io`) utilizes GitHub's native scoped `GITHUB_TOKEN`.

#### **Stage 3: Kubernetes Continuous Deployment (CD)**
- Cluster authentication using secured `KUBECONFIG` secret.
- Application manifests deployed:
  - `Deployment`: Manages pod replicas, zero-downtime rolling updates, resource requests/limits, and health probes (`livenessProbe`, `readinessProbe`).
  - `Service`: Exposes pods internally within cluster (`ClusterIP`).
  - `Ingress`: Routes HTTP traffic from external ingress controller.
  - `ConfigMap` / `Secret`: Injects environment variables.
- Verification command: `kubectl rollout status deployment/ci-cd-kube-app --timeout=120s`.

#### **Stage 4: Google Chat Webhook Alerting**
- Executed on `if: always()` condition to guarantee dispatch regardless of job status.
- **Success Card (🟢)**: Includes Commit SHA, author name, branch/tag name, image digest, deployed namespace, and link to workflow run.
- **Failure Card (🔴)**: Highlights the specific stage that broke (Tests, Docker, K8s), error log extract, author to notify, and workflow link for immediate triage.

---

## 🛡️ SOAR & Resilience Principles Applied
1. **Automated Rollback Safeguard**: If `kubectl rollout status` fails within the 120s window, Kubernetes maintains traffic on previous healthy pods.
2. **Immutable Artifacts**: Production container tags match explicit SemVer Git tags (`v1.0.0`), guaranteeing reproducibility.
3. **Secret Isolation**: Sensitive credentials (`KUBECONFIG`, `GOOGLE_CHAT_WEBHOOK_URL`) are isolated within GitHub Actions Secrets and masked from console output.

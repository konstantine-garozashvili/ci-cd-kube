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

### 📊 Pipeline Workflow

```mermaid
flowchart TD
    StartNode((● Start)) --> TriggerNode[Event: Git Push on 'main' OR Git Tag 'v*']
    TriggerNode --> GHATrigger[Trigger GitHub Actions Workflow]

    subgraph STAGE_1 ["Stage 1: Checkout & Automated Testing (CI)"]
        GHATrigger --> Checkout[1.1 Checkout Code via actions/checkout@v4]
        Checkout --> SetupEnv[1.2 Setup Runtime & Cache Dependencies]
        SetupEnv --> InstallDeps[1.3 Install Dependencies]
        InstallDeps --> RunTests[1.4 Execute Automated Test Suite]
        RunTests --> TestDecision{Tests Passed?}
    end

    TestDecision -- ❌ No (Fail-Fast) --> PrepareTestFail[Extract Failure Logs & Stack Trace]
    PrepareTestFail --> SendFailNotif[Send Google Chat Failure Card 🔴]
    SendFailNotif --> EndFail((● Pipeline Terminated))

    TestDecision -- ✅ Yes --> Stage2Entry[Proceed to Build Stage]

    subgraph STAGE_2_3 ["Stage 2 & 3: Container Build & GHCR Push"]
        Stage2Entry --> CheckTriggerType{Trigger Type?}
        
        CheckTriggerType -- "Push on 'main'" --> DevTagging["Dev Strategy<br/>Tags: dev-&lt;sha&gt;, dev-latest<br/>Target: Development"]
        CheckTriggerType -- "Git Tag 'v*'" --> ProdTagging["Prod Strategy<br/>Tags: &lt;vX.Y.Z&gt;, latest<br/>Target: Production"]
        
        DevTagging --> SetupBuildx[Setup Docker Buildx & Cache]
        ProdTagging --> SetupBuildx
        
        SetupBuildx --> AuthGHCR[Authenticate with GHCR via GITHUB_TOKEN]
        AuthGHCR --> DockerBuildPush[Build Multi-Stage Docker Image & Push to GHCR]
        DockerBuildPush --> BuildDecision{Build & Push Succeeded?}
    end

    BuildDecision -- ❌ No --> PrepareBuildFail[Extract Docker Build Errors]
    PrepareBuildFail --> SendFailNotif

    BuildDecision -- ✅ Yes --> Stage4Entry[Proceed to Deployment Stage]

    subgraph STAGE_4 ["Stage 4: Kubernetes Deployment (CD)"]
        Stage4Entry --> AuthK8s[Authenticate to Kubernetes via KUBECONFIG]
        AuthK8s --> ApplyManifests[Apply Manifests: Deployment, Service, Ingress]
        ApplyManifests --> SetImage[Update Deployment Image Tag on Cluster]
        SetImage --> RolloutWait[Execute kubectl rollout status --timeout=120s]
        RolloutWait --> RolloutDecision{Rollout Healthy?}
    end

    RolloutDecision -- ❌ No --> PrepareK8sFail[Fetch Pod Logs & describe deployment]
    PrepareK8sFail --> SendFailNotif

    RolloutDecision -- ✅ Yes --> PrepareSuccess[Generate Pipeline Summary Payload]
    
    subgraph STAGE_5 ["Stage 5: Notification & Completion"]
        PrepareSuccess --> SendSuccessNotif[Send Google Chat Success Card 🟢]
        SendSuccessNotif --> EndSuccess((◎ Pipeline Succeeded))
    end
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

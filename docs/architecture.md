# MedGuard System Architecture

This document defines the production architecture for MedGuard's microservices platform.

---

## 1. Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["React SPA<br/>(Vite)"]
    end

    subgraph "Network Boundary"
        NGINX["NGINX<br/>Reverse Proxy<br/>SSL/TLS Termination"]
    end

    subgraph "Application Layer"
        MS1["ms1-core-api<br/>Express.js<br/>Port 4000"]
        MS2["ms2-agent-service<br/>FastAPI + LangGraph<br/>Port 8000"]
    end

    subgraph "Data Layer"
        PG[("PostgreSQL 16<br/>System of Record")]
        S3["File Storage<br/>(S3 / Local Disk)"]
    end

    subgraph "External Services"
        SES["AWS SES<br/>Email"]
        LLM["OpenAI Vision API<br/>GPT-4o"]
    end

    subgraph "Observability"
        OTEL["OpenTelemetry<br/>Collector"]
        JAEGER["Jaeger<br/>Trace Viewer"]
    end

    Browser -->|"HTTPS"| NGINX
    NGINX -->|"/ (frontend)"| Browser
    NGINX -->|"/api/*"| MS1
    MS1 -->|"Internal HTTP"| MS2
    MS1 --> PG
    MS1 --> S3
    MS1 --> SES
    MS2 --> LLM
    MS1 -.-> OTEL
    MS2 -.-> OTEL
    OTEL --> JAEGER

    style MS2 fill:#2d1b69,stroke:#7c3aed,color:#fff
    style MS1 fill:#1e3a5f,stroke:#3b82f6,color:#fff
    style PG fill:#0d3320,stroke:#22c55e,color:#fff
    style NGINX fill:#4a3728,stroke:#f59e0b,color:#fff
```

---

## 2. Service Responsibilities

### ms1-core-api (Express.js)
> **Owns**: Database, Auth, Deterministic Logic, Side-effects

| Responsibility | Details |
|:---|:---|
| Authentication | JWT login/refresh with `patient`, `caregiver`, `admin` roles |
| Medicine lifecycle | CRUD on `medicines` table, status management |
| Interaction engine | Deterministic lookup against `interaction_kb` — pure, tested module |
| Caregiver flows | Invitation, linking, permission tiers |
| Email dispatch | AWS SES for alerts, confirmations, weekly summaries |
| Admin dashboard API | Review queue, versioned KB/brand-map editors |
| DPDP compliance | Consent logging, data deletion |
| File storage | Upload handling (multer), photo ID management |

### ms2-agent-service (FastAPI + LangGraph)
> **Owns**: AI Extraction, Natural Language Generation

| Responsibility | Details |
|:---|:---|
| Prescription Assessment Graph | Vision extraction → confidence scoring → follow-up question |
| Brand-to-Generic Resolution | Mapping lookup against DB data (passed by ms1) |
| Lab Report Extraction Graph | Parse lab values from report photos |
| Visit-Brief Writer Graph | Generate plain-language brief with suggested questions |

> [!IMPORTANT]
> ms2 is **strictly internal**. It never writes to the database, sends emails, or performs any side-effects. It receives data, processes it, and returns structured JSON to ms1.

---

## 3. Network Topology

```mermaid
graph LR
    subgraph "Public (frontend-net)"
        NGINX
        FE["Frontend :3000"]
        MS1["ms1 :4000"]
    end

    subgraph "Internal (backend)"
        MS1b["ms1 :4000"]
        MS2["ms2 :8000"]
        PG["PostgreSQL :5432"]
    end

    Internet -->|":80/:443"| NGINX
    NGINX --> FE
    NGINX --> MS1
    MS1 --- MS1b
    MS1b --> MS2
    MS1b --> PG

    style MS2 fill:#2d1b69,stroke:#7c3aed,color:#fff
    style PG fill:#0d3320,stroke:#22c55e,color:#fff
```

- **frontend-net**: Bridge network connecting NGINX, frontend, and ms1
- **backend**: Internal bridge network (no external access) connecting ms1, ms2, and PostgreSQL
- ms2 and PostgreSQL are **never directly reachable** from the internet

---

## 4. Data Flow — Medicine Add

```mermaid
sequenceDiagram
    participant U as Patient (Browser)
    participant N as NGINX
    participant M1 as ms1-core-api
    participant M2 as ms2-agent-service
    participant DB as PostgreSQL
    participant E as AWS SES

    U->>N: POST /api/medicines/upload (photo)
    N->>M1: Forward request
    M1->>M1: Store photo (disk/S3)
    M1->>M2: POST /api/extract/prescription (photo)
    M2->>M2: Vision LLM extraction
    M2->>M2: Brand-to-generic resolution

    alt Low confidence (<85%)
        M2-->>M1: needs_follow_up = true
        M1-->>U: Follow-up question
        U->>M1: User answer
    end

    alt Unresolved brand
        M2-->>M1: resolution_status = generic_unresolved
        M1->>DB: Insert to admin review queue
    end

    M2-->>M1: Structured extraction result
    M1->>DB: INSERT INTO medicines
    M1->>M1: Deterministic interaction check
    M1->>DB: SELECT active medicines + interaction_kb

    alt Interaction found
        M1->>DB: INSERT INTO interaction_flags
        M1->>E: Send alert email (patient + caregiver)
        M1-->>U: Alert with plain-language explanation
    end

    M1-->>U: Success response
```

---

## 5. Database Schema Overview

See [schema.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/schema.md) for full table definitions.

```mermaid
erDiagram
    users ||--o{ medicines : has
    users ||--o{ caregiver_links : "patient/caregiver"
    users ||--o{ lab_reports : uploads
    users ||--o{ visits : schedules
    users ||--o{ consent_records : grants

    medicines ||--o{ interaction_flags : triggers
    interaction_kb ||--o{ interaction_flags : references

    lab_reports ||--o{ lab_values : contains
    visits ||--o| briefs : generates

    users {
        uuid id PK
        varchar name
        varchar email
        varchar password_hash
        enum role
    }

    medicines {
        uuid id PK
        uuid patient_id FK
        varchar brand_name
        varchar generic_name
        enum resolution_status
        enum status
    }

    interaction_kb {
        uuid id PK
        varchar generic_a
        varchar generic_b
        enum severity
        text explanation
    }

    interaction_flags {
        uuid id PK
        uuid patient_id FK
        uuid new_medicine_id FK
        uuid kb_entry_id FK
        enum status
    }
```

---

## 6. Security Boundaries

| Control | Implementation |
|:---|:---|
| **Authentication** | JWT with role claims (`patient`, `caregiver`, `admin`) |
| **Authorization** | Role-based middleware on every route |
| **Network isolation** | ms2 + PostgreSQL on internal Docker network |
| **Upload limits** | 8MB max (NGINX + Express) |
| **DPDP compliance** | Explicit consent at signup, audit log, delete-my-data route |
| **EXIF stripping** | Removed in ms2 before processing |
| **Append-only data** | `interaction_kb` and `brand_generic_map` have DB triggers preventing UPDATE/DELETE |
| **HTTPS** | Certbot SSL/TLS at NGINX (production) |

---

## 7. Observability

| Component | Tool |
|:---|:---|
| Distributed tracing | OpenTelemetry SDK in ms1 + ms2 |
| Trace visualization | Jaeger (self-hosted in docker-compose) |
| Span attributes | `cost_per_check`, `confidence_score`, `model_name` |
| Logging | morgan (ms1) + uvicorn (ms2) → stdout |

---

## 8. Directory Structure

```
MedGuard/
├── ms1-core-api/          # Express.js — auth, DB, deterministic logic
│   ├── src/
│   │   ├── config/        # DB pool, env loading
│   │   ├── middleware/     # auth, errors, validation
│   │   ├── routes/        # Express routers
│   │   ├── services/      # Business logic modules
│   │   ├── models/        # DB query helpers
│   │   └── utils/         # Shared utilities
│   ├── tests/
│   └── Dockerfile
│
├── ms2-agent-service/     # FastAPI + LangGraph — AI extraction
│   ├── app/
│   │   ├── api/           # FastAPI routers
│   │   ├── graphs/        # LangGraph graph definitions
│   │   ├── services/      # Brand resolution, extraction
│   │   └── schemas/       # Pydantic models
│   ├── tests/
│   └── Dockerfile
│
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── pages/         # Route-level components
│   │   ├── components/    # Reusable UI
│   │   ├── context/       # Auth state
│   │   └── services/      # API client
│   └── Dockerfile
│
├── infra/
│   ├── nginx/nginx.conf   # Reverse proxy
│   └── db/init.sql        # PostgreSQL schema v1
│
├── docs/                  # Project documentation
├── skills/                # Agent skills
├── docker-compose.yml     # Full stack orchestration
└── .github/workflows/     # CI pipeline
```

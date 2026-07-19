# MedGuard Project Directory Structure

This document provides a detailed breakdown of all files and folders in the MedGuard workspace.

---

## 📁 Repository Overview

```
MedGuard/
├── docs/                    # System & API documentation
├── frontend/                # React Vite Frontend SPA
│   ├── public/              # Static public assets
│   ├── src/                 # React source code
│   │   ├── assets/          # Theme assets & images
│   │   ├── components/      # UI components & form reviews
│   │   │   └── ui/          # Generic visual building blocks (Shadcn)
│   │   ├── context/         # React Auth context
│   │   ├── hooks/           # Custom React hooks (Queue, SSE)
│   │   ├── lib/             # Helper libraries & payload builders
│   │   ├── pages/           # View portals & static boxes
│   │   └── services/        # Axios API clients
│   └── vercel.json          # Vercel client-routing & proxy configuration
│
├── ms1-core-api/            # Node.js Express Backend
│   ├── src/
│   │   ├── config/          # DB connection & Redis pools
│   │   ├── middleware/      # Auth, security, limiting, consent
│   │   ├── migrations/      # DB Schema migration version scripts
│   │   ├── routes/          # Express REST API routes
│   │   ├── services/        # Background queue workers & AI resolvers
│   │   ├── templates/       # HTML email templates
│   │   └── utils/           # Math trends, logger, email client
│   └── tests/               # Test suites (Jest)
│
├── ms2-agent-service/       # Python FastAPI + LangGraph AI Service
│   ├── app/
│   │   ├── api/             # FastAPI extract & chat router endpoints
│   │   ├── graphs/          # LangGraph execution workflow nodes
│   │   ├── schemas/         # Pydantic data schemas
│   │   └── services/        # Client connections & retries
│   └── requirements.txt     # Python package dependencies
│
├── infra/                   # Operations & Infrastructure Config
│   ├── db/                  # SQL schema & seeds
│   └── nginx/               # Reverse proxy config files
│
└── scripts/                 # Administration scripts
```

---

## 🔍 Detailed File Guide

### 1. Root Configuration Files
- **[docker-compose.yml](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docker-compose.yml)**: Multi-container orchestration configurations for MS1, MS2, NGINX, PostgreSQL, and Redis.
- **[.gitignore](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/.gitignore)**: Enforces rules to keep logs, local secrets, scratch files, and media out of repository versions.
- **[README.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/README.md)**: Master introduction, port map, quick start, and production AWS/Vercel deployment guides.
- **[.env.example](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/.env.example)**: Reference file documenting required secrets and API keys.

---

### 2. Documentation Directory (`docs/`)
- **[architecture.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/architecture.md)**: System topology, security specifications, and AWS/Vercel guides.
- **[appflow.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/appflow.md)**: Sequential data paths (Auth, AI uploads, Safety alerts, Briefs).
- **[ms1-core-api.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/ms1-core-api.md)**: Node backend architecture.
- **[ms2-agent-service.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/ms2-agent-service.md)**: FastAPI Python LangGraph flow designs.
- **[frontend.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/frontend.md)**: React routing and page structures.
- **[schema.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/schema.md)**: Database schemas and data normalization details.
- **[prd.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/prd.md)**: Core Product Requirements Document.

---

### 3. React Frontend SPA (`frontend/`)
- **[vercel.json](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/vercel.json)**: Rewrites client paths to `index.html` on Vercel and proxies requests.
- **`src/context/`**:
  - **[AuthContext.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/context/AuthContext.jsx)**: Manages patient/caregiver JWT session stores.
- **`src/services/`**:
  - **[api.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/services/api.js)**: Axios interceptor that injects authorization headers and handles token rotation.
- **`src/components/`**:
  - **[MgNavbar.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/MgNavbar.jsx)**: Menu routing bar with alert highlights.
  - **[MedicineReviewTable.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/MedicineReviewTable.jsx)**: Table for verifying brand/dosage.
  - **[LabReportReviewForm.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/LabReportReviewForm.jsx)**: Form for validating numerical lab values.
  - **[UploadQueueList.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/UploadQueueList.jsx)**: Upload pipeline progress list.
  - **[VisitLinkPanel.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/VisitLinkPanel.jsx)**: Suggests linking prescriptions to visits.
- **`src/pages/`**:
  - **[Login.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Login.jsx)**: Dual-token login and verification OTP page.
  - **[Dashboard.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Dashboard.jsx)**: Unified status dashboard.
  - **[Upload.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Upload.jsx)**: Multi-document parallel processing portal.
  - **[MedicineList.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/MedicineList.jsx)**: Medicine list with discontinue controls.
  - **[LabReports.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/LabReports.jsx)**: Lab value trends with clinician color mappings.
  - **[Alerts.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Alerts.jsx)**: Clinical warnings and caregiver acknowledgments.
  - **[Calendar.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Calendar.jsx)**: Visit schedule.
  - **[WriteBrief.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/WriteBrief.jsx)**: Pre-visit summary writer.
  - **[PrivacyPolicy.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/PrivacyPolicy.jsx)**, **[Terms.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Terms.jsx)**, **[ClinicalGuidelines.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/ClinicalGuidelines.jsx)**, **[Support.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Support.jsx)**: Compact information pages in white card boxes.

---

### 4. Node.js Core Backend (`ms1-core-api/`)
- **`src/config/`**:
  - **[db.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/config/db.js)**: Database client connections.
  - **[redis.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/config/redis.js)**: Redis cache and queue client.
- **`src/middleware/`**:
  - **[auth.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/auth.js)**: Guards and verification routes.
  - **[security.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/security.js)**: Escaping, schema validation, and upload handler.
  - **[consent.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/consent.js)**: Verification of patient consents.
  - **[rateLimiter.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/rateLimiter.js)**: Custom Express rate limiting.
- **`src/routes/`**:
  - **[auth.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/auth.js)**: Register, log in, MFA, refresh tokens.
  - **[medicines.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/medicines.js)**: CRUD operations and Postgres transactions (`FOR UPDATE`).
  - **[labReports.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/labReports.js)**: Uploads and confirmations.
  - **[alerts.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/alerts.js)**: Clinical safety interactions alerts.
  - **[calendar.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/calendar.js)**: Patient schedule planner.
  - **[caregivers.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/caregivers.js)**: Linking caregiver accounts.
  - **[jobs.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/jobs.js)**: Server-Sent Events (SSE) streaming connections.
- **`src/services/`**:
  - **[queueService.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/services/queueService.js)**: BullMQ queues and background workers.
  - **[brandResolutionService.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/services/brandResolutionService.js)**: Manages brand mappings, caching, and retry logic.
- **`src/utils/`**:
  - **[interactionEngine.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/interactionEngine.js)**: Interaction check logic.
  - **[trendCalculator.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/trendCalculator.js)**: Lab value trends checker.
  - **[email.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/email.js)**: AWS SES email client.
  - **[logger.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/logger.js)**: Structured log formatter.

---

### 5. Python Agent Service (`ms2-agent-service/`)
- **`app/api/`**:
  - **[extract.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/api/extract.py)**: Router API endpoints for extraction, briefs, and research.
- **`app/graphs/`**:
  - **[prescription_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/prescription_graph.py)**: LangGraph prescription parsing and consensus validation.
  - **[lab_report_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/lab_report_graph.py)**: LangGraph lab result parsing.
  - **[critique_research_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/critique_research_graph.py)**: Interaction research loop and critique.
  - **[brief_writer_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/brief_writer_graph.py)**: Visit briefs compiler.
  - **[trend_explainer_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/trend_explainer_graph.py)**: Neutral trend descriptors.
  - **[shared_nodes.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/shared_nodes.py)**: Common OCR and auto-linking logic.
- **`app/services/`**:
  - **[client.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/services/client.py)**: Resilient model client with API key rotation.
  - **[retry.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/services/retry.py)**: Retry wrapper.

---

### 6. Operations Config (`infra/`)
- **[init.sql](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/infra/db/init.sql)**: Persistent SQL schema initialization and clinical seed definitions.
- **[nginx.conf](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/infra/nginx/nginx.conf)**: Proxy paths, request boundaries, and security headers.

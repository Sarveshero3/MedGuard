# 🛡️ MedGuard

> AI-powered medication safety and visit-preparation platform for chronic-condition patients and their long-distance family caregivers.

Photograph every prescription — get warned before a dangerous drug combination reaches you.

---

## 🎯 What It Does

1. **Medication Safety**: Upload a prescription photo → AI extracts medicine details → resolves Indian brand names to generics → checks interactions against a curated knowledge base → alerts patient + caregiver in plain language.

2. **Visit Preparation** *(Phase 2)*: Upload lab reports → track trends over time → generate a one-page brief with questions to bring to your next doctor visit.

---

## 🏗️ Architecture

| Service | Tech | Port | Role |
|---------|------|------|------|
| **ms1-core-api** | Express.js | 4000 | Auth, DB, deterministic logic, email |
| **ms2-agent-service** | FastAPI + LangGraph | 8000 | AI extraction, brand resolution, brief generation |
| **frontend** | React + Vite | 3000 | Patient/caregiver/admin UI |
| **PostgreSQL** | PostgreSQL 16 | 5432 | System of record |
| **NGINX** | nginx:alpine | 80 | Reverse proxy, SSL termination |

See [`docs/architecture.md`](docs/architecture.md) for full system diagrams.

---

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js 20+](https://nodejs.org/) (for local development)
- [Python 3.12+](https://python.org/) (for local development)

### Run with Docker (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/Sarveshero3/MedGuard.git
cd MedGuard

# 2. Copy environment template
cp .env.example .env

# 3. Boot all services
docker-compose up --build

# 4. Open in browser
# Frontend:  http://localhost:3000
# API:       http://localhost:4000/api/health
# Agent:     http://localhost:8000/health
# NGINX:     http://localhost (routes to frontend + API)
```

### Run Services Individually

```bash
# ms1 — Express.js
cd ms1-core-api
cp .env.example .env
npm install
npm run dev

# ms2 — FastAPI
cd ms2-agent-service
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend — React
cd frontend
npm install
npm run dev
```

---

## 📁 Project Structure

```
MedGuard/
├── ms1-core-api/          # Express.js backend
├── ms2-agent-service/     # FastAPI + LangGraph backend
├── frontend/              # React + Vite SPA
├── infra/
│   ├── nginx/             # Reverse proxy config
│   └── db/                # PostgreSQL schema
├── docs/                  # Project documentation
├── skills/                # AI agent skills
├── docker-compose.yml     # Full stack orchestration
└── .github/workflows/     # CI pipeline
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`docs/prd.md`](docs/prd.md) | Product Requirements Document |
| [`docs/techspec.md`](docs/techspec.md) | Technical Specification |
| [`docs/architecture.md`](docs/architecture.md) | System Architecture & Diagrams |
| [`docs/schema.md`](docs/schema.md) | Database Schema |
| [`docs/design.md`](docs/design.md) | API Contracts & Error Conventions |
| [`docs/appflow.md`](docs/appflow.md) | End-to-End Application Flow |
| [`docs/implementation.md`](docs/implementation.md) | MVP Scope & Timeline |
| [`docs/tracker.md`](docs/tracker.md) | Milestone Tracker |
| [`docs/rules.md`](docs/rules.md) | Coding Standards |

---

## 🔐 Security

- **JWT auth** with role-based access (patient/caregiver/admin)
- **DPDP-aligned consent** with audit logging and data deletion
- **Append-only** knowledge bases (DB triggers prevent UPDATE/DELETE)
- **EXIF stripping** on uploaded photos
- **Network isolation** — ms2 and PostgreSQL are internal-only
- **8MB upload limit** enforced at NGINX and Express

---

## 🧪 CI/CD

GitHub Actions runs on every push/PR to `main`:
1. Lint + test ms1 (ESLint, Jest)
2. Lint ms2 (flake8)
3. Lint frontend (ESLint)
4. Docker Compose build validation

---

## 📜 License

[MIT](LICENSE)
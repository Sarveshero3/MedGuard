# MedGuard Handover Notes

## Milestone 1 — Completed

### What was built
- Complete monorepo scaffold with 3 services (ms1-core-api, ms2-agent-service, frontend)
- PostgreSQL schema v1 with all 11 tables, ENUMs, indexes, and append-only triggers
- Docker Compose orchestration with NGINX reverse proxy
- GitHub Actions CI pipeline (lint/test/build)
- 6 UI wireframes for core screens
- Architecture documentation with Mermaid diagrams
- Skills directory (55 agent skills) committed and pushed

### Key decisions
- **Network isolation**: ms2 and PostgreSQL are on an internal Docker network, not exposed externally
- **Append-only**: `brand_generic_map` and `interaction_kb` tables have DB triggers preventing UPDATE/DELETE
- **Vite over CRA**: Faster dev server, modern defaults
- **Multi-stage Dockerfiles**: Non-root users, health checks, Alpine-based

### What's next (Milestone 2: Days 3–4)
- JWT authentication with role-based middleware
- Seed data for brand-generic mappings and interaction knowledge base
- DPDP consent screen implementation
- AWS SES setup
- EC2 deployment with HTTPS

### Open items
- Vision LLM extraction spike (10 real prescription photos) — pending
- `docker-compose up --build` verification — pending Docker Desktop

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
- Seed data for brand-generic mappings and interaction knowledge base
- AWS SES setup
- EC2 deployment with HTTPS

### Completed Security & Auth Hardening (Milestone 1 Extension)
- **JWT & Role Claims**: Robust login, registration, email verification, and password reset flows with role claims and token expiry.
- **IDOR Protection**: Database ownership validation middleware on all resource routes.
- **Email Gated Privileged Actions**: Gated upload and write actions to verified emails only.
- **Abuse & Rate Limiting**: Express-rate-limit configured for auth, register, upload, and general API routes.
- **Strict Input Validation**: HTML escaping, UUID path checks, strict file mime/size upload validations.
- **Mock Email Gating**: Gated mock log outputs containing tokens behind `NODE_ENV=development`.
- **Infrastructure Lockdown**: Restricted Postgres port exposure to `127.0.0.1`. Added CSP security headers to NGINX.

### Open items
- Vision LLM extraction spike (10 real prescription photos) — pending
- `docker-compose up --build` verification — pending Docker Desktop

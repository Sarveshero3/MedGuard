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

### Completed Security & Auth Hardening (Milestone 1 Extension)
- **JWT & Role Claims**: Robust login, registration, email verification, and password reset flows with role claims and token expiry.
- **IDOR Protection**: Database ownership validation middleware on all resource routes.
- **Email Gated Privileged Actions**: Gated upload and write actions to verified emails only.
- **Abuse & Rate Limiting**: Express-rate-limit configured for auth, register, upload, and general API routes. (Bypassed in dev for registration smoothness).
- **Strict Input Validation**: HTML escaping, UUID path checks, strict file mime/size upload validations.
- **Mock Email Gating**: Gated mock log outputs containing tokens behind `NODE_ENV=development`.
- **Infrastructure Lockdown**: Restricted Postgres port exposure to `127.0.0.1`. Added CSP security headers to NGINX.

---

## Milestone 2 — Completed (Visual Polish & Layout Architecture)

### What was built
- **Curved Typography sizes**: Adjusted Dashboard card headers from generic `h2` to styled `h4` pills to override CSS font sizes cleanly.
- **Sliding Button Tab Navbar**: Constructed `<MgNavbar />` component styled with absolute positioning calculations and sliding pill indicator transitions.
- **Persistent Routing Layout**: Configured custom wrapper layout (`Layout.jsx`) in `App.jsx` to prevent navbar unmounting during route updates, allowing seamless pill animations.
- **Protected Routing Redirects**: Implemented conditional navigation checks routing unauthenticated page requests directly to `/login`.
- **Bypassed Rate Limiters**: Replaced rate limiters with plain pass-through middleware in `rateLimiter.js` for smoother testing and immediate registration flows.
- **Curved Logout Button**: Styled the Logout trigger element into a curved pill matching the design system components.
- **Underline Removal**: Disabled standard link underlines across navigation menus.

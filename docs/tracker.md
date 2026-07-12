# MedGuard Project Tracker

## Milestone Checkboxes

- [x] **Days 1–2: Monorepo Scaffold & Infrastructure Setup**
  - [x] Setup monorepo folder layout (`/ms1-core-api`, `/ms2-agent-service`, `/frontend`, `/infra`, `/docs`).
  - [x] Create Dockerfiles for `ms1`, `ms2`, and `frontend`.
  - [x] Write `docker-compose.yml` linking all services with NGINX and PostgreSQL.
  - [x] Initialize PostgreSQL schema v1 (tables matching `schema.md`).
  - [x] Configure GitHub Actions CI pipeline (linting and testing checks).
  - [ ] Perform vision-LLM extraction spike against 10 real prescription photos in `ms2`.
  - [ ] *Proof It Works*: Stack boots with one command (`docker-compose up --build`); vision model extracts medicine names reliably.

- [ ] **Days 3–4: Core Authentication, Deployment Skeleton & Seed Data**
  - [ ] Implement JWT login/refresh token authentication with `patient`, `caregiver`, and `admin` roles in `ms1`.
  - [ ] Write deployment shell scripts and configure NGINX reverse-proxy routes with Certbot SSL/TLS.
  - [ ] Configure AWS SES verified domain / sandbox setup.
  - [ ] Seed PostgreSQL with initial subset of 50–150 brand-to-generic mappings and 50–150 interaction pairs.
  - [ ] Build basic DPDP consent opt-in screen at signup and implement a working "delete my record" route.
  - [ ] *Proof It Works*: Login, registration, consent screen, and photo upload work from a phone on the live domain.

- [ ] **Days 5–7: LangGraph Assessment Graph & Deterministic Engine**
  - [ ] Implement LangGraph Prescription Assessment Graph in `ms2` (Image upload → Vision extraction → Confidence scoring).
  - [ ] Add the single follow-up question logic for ambiguous handwriting or dosages.
  - [ ] Implement brand-to-generic resolution layer in `ms2` matching against seeded DB mapping table.
  - [ ] Create deterministic interaction-lookup module in `ms1` as a pure, unit-tested module.
  - [ ] Build plain-language interaction alert panel in React frontend.
  - [ ] *Proof It Works*: An uploaded prescription photo returns a structured entry and, if relevant, a flagged interaction in the UI.

- [ ] **Days 8–9: Caregiver Integration & Email Notifications**
  - [ ] Implement caregiver email invitation flow in `ms1` (sends verified email via SES).
  - [ ] Create read-plus-acknowledge caregiver views in the React frontend.
  - [ ] Wire up real-time SES email alerts for new medicine additions and flagged interactions.
  - [ ] *Proof It Works*: Inviting a caregiver produces a working linked account that sees the same alerts and can acknowledge them.

- [ ] **Days 10–11: Admin Review Dashboard & Versioned Editors**
  - [ ] Implement admin review queue in React dashboard, showing raw photo side-by-side with extracted values.
  - [ ] Create append-only management interface for brand-to-generic mappings and interaction rules.
  - [ ] *Proof It Works*: Admin corrects a low-confidence extraction in the dashboard, appending a versioned row, and changes reflect system-wide.

- [ ] **Day 12: OpenTelemetry Tracing & Telemetry**
  - [ ] Instrument `ms1` and `ms2` with OpenTelemetry.
  - [ ] Propagate trace headers across service boundaries (React → ms1 → ms2).
  - [ ] Add cost-per-check attributes to span telemetries.
  - [ ] Configure self-hosted Jaeger instance in docker-compose.
  - [ ] *Proof It Works*: One trace spans the entire medicine-add pipeline (upload → vision → brand resolution → interaction check) with cost attributes visible.

- [ ] **Days 13–14: Hardening, Rejections & Final Demo**
  - [ ] Build irrelevant/bad photo rejection filters in `ms2`.
  - [ ] Implement EXIF and location metadata stripping on uploaded images in `ms2`.
  - [ ] Enforce NGINX and backend upload body limits (8MB).
  - [ ] Design robust empty states across all UI screens.
  - [ ] Create final `README.md` and record a video demo.
  - [ ] *Proof It Works*: End-to-end demo of photo upload → extraction → interaction detection → caregiver notification.

---

## Deliverables Added (Milestone 1)

| Deliverable | Location | Status |
|:---|:---|:---|
| Monorepo scaffold | Root | ✅ |
| Express.js backend | `ms1-core-api/` | ✅ |
| FastAPI backend | `ms2-agent-service/` | ✅ |
| React + Vite frontend | `frontend/` | ✅ |
| PostgreSQL schema v1 | `infra/db/init.sql` | ✅ |
| Docker Compose | `docker-compose.yml` | ✅ |
| NGINX config | `infra/nginx/nginx.conf` | ✅ |
| GitHub Actions CI | `.github/workflows/ci.yml` | ✅ |
| Architecture docs | `docs/architecture.md` | ✅ |
| Wireframes (6 screens) | `docs/wireframes.md` | ✅ |
| README | `README.md` | ✅ |
| Skills directory | `skills/` | ✅ Pushed |
| Vertical winding flowchart | `frontend/src/components/MedGuardFlowchart.jsx` | ✅ |
| Flowchart styles | `frontend/src/components/MedGuardFlowchart.css` | ✅ |
| UI/UX design document | `docs/ui-ux-design.md` | ✅ |

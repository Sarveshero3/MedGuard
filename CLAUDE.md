# MedGuard Developer Guidelines

Welcome to the MedGuard codebase. Below are common commands and references for development.

## Build and Run

- **Start all services**: `docker-compose up --build`
- **Stop all services**: `docker-compose down`

## Services Structure
- `/ms1-core-api` (Express.js backend)
- `/ms2-agent-service` (FastAPI + LangGraph backend)
- `/frontend` (React web application)
- `/infra` (NGINX configuration, deployment scripts)

## Agent skills

### Issue tracker

Issues for this repo live as GitHub issues. PRs as a request surface: no. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage maps roles (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix) to canonical labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one CONTEXT.md + docs/adr/ at root. See `docs/agents/domain.md`.

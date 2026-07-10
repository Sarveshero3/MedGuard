# MedGuard Coding Standards and Rules

This document outlines the development guidelines and architecture principles for the MedGuard project.

---

### 1. Service Boundaries

*   **LangGraph Graphs**: Live in `ms2-agent-service` (FastAPI) **only**.
*   **Deterministic Logic**: Lives in `ms1-core-api` (Express.js) **only**, implemented as pure, tested modules.
*   `ms2` is strictly internal. It is responsible for parsing documents and generating briefs, returning structured output and confidence scores. It does **not** communicate with the database directly, nor does it perform side-effects like sending emails or notifying users. All of this must be handled by `ms1`.

---

### 2. Naming Conventions

*   **Backend (ms1) & Frontend**: Standard `camelCase` for variable and function names. `PascalCase` for React components.
*   **Backend (ms2)**: Standard Python conventions (`snake_case` for variables/functions, `PascalCase` for classes).
*   **Database Tables**: `snake_case` plural names (e.g., `brand_generic_map`, `interaction_kb`).
*   **Environment Variables**: `UPPER_SNAKE_CASE` (e.g., `DATABASE_URL`, `JWT_SECRET`).

---

### 3. PR & Git Conventions

*   **Work on Feature Branches**: Do not commit directly to `main`. Develop on branches named like `feature/issue-number-description` or `feature/milestone-name`.
*   **Push Early**: Push the feature branch to remote as soon as it is created. Do not wait for the ticket to be completed before pushing.
*   **Pull Requests (PR)**: Open a PR when a ticket is ready.
*   **Merge Requirement**: Merge only after the `/code-review` run and the GitHub Actions CI workflow both pass.

---

### 4. Definition of Done (DoD)

A ticket is considered "Done" only when:
1.  All unit tests pass, and code builds and lints without errors.
2.  The "Proof It Works" criteria defined in `implementation.md` is demonstrated.
3.  The changes are mapped to one of the Section 13 Evaluation Criteria:
    *   **Core Product Loop (25%)**: End-to-end prescription addition and interaction flag flow.
    *   **Agentic Quality (ms2) (20%)**: LangGraph structure, follow-up loop, bad-photo rejection.
    *   **Architecture & Code Quality (20%)**: Clear ms1/ms2 boundaries, versioned database tables, pure tested modules.
    *   **Infrastructure & Deployment (20%)**: Docker configs, NGINX TLS routing, OpenTelemetry trace spans.
    *   **Security & Correctness (10%)**: Role separation, EXIF stripping, DPDP consent/deletion flow.
    *   **Extras (5%)**: API documentation, rate limiting, tests.

---

### 5. Model Routing Rules

Default to Flash for this project. Switch to Claude 4.6 and say so explicitly when you do, for:

- Designing the interaction-safety engine logic and the confidence-routing rules. This is safety-critical, get it wrong once and the whole trust model breaks.
- The three LangGraph graph designs themselves (assessment, lab trend, brief writer), especially the ambiguity follow-up loop and the confidence-tier branching.
- `/grill-with-docs` and `/domain-modeling` sessions.
- `/code-review` runs.
- Anything touching auth, JWT, secrets handling, or the DPDP consent/deletion flow.
- Any bug that survives two Flash attempts, hand it to `/diagnosing-bugs` on Claude instead of trying a third time on Flash.

Everything else, standard CRUD routes, React components, Docker/CI config following an established pattern, test scaffolding, stays on Flash.

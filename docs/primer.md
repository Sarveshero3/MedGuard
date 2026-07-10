# MedGuard Product Primer

MedGuard is an AI-powered medication safety and visit-preparation platform designed to protect patients—especially the elderly—who manage chronic conditions across multiple independent doctors. By uploading photos of prescriptions, the system structures and resolves brand names to generic molecules to flag potentially dangerous drug-drug interactions, sharing these alerts with linked family caregivers. Additionally, the platform tracks clinical lab values over time, calculating trends to generate non-diagnostic appointment preparation briefs with suggested questions for the doctor.

## Mandated Technology Stack

The platform is designed as a single GitHub monorepo consisting of:
- **ms1-core-api**: Express.js microservice handling auth, roles, patient/caregiver linking, medicine list and alert lifecycle, visit records, SES dispatch, and admin dashboard data.
- **ms2-agent-service**: FastAPI + LangGraph microservice handling image preprocessing, prescription assessment, lab trend, and visit-brief generation graphs. Accessible only internally.
- **frontend**: React client application for patients, caregivers, and admins.
- **Database**: PostgreSQL (System of record storing users, links, medicines, brand-to-generic maps, interactions, lab reports, and consent logs).
- **Authentication**: Custom JWT Auth (patient, caregiver, admin claims).
- **Email**: AWS SES for confirmation and alert dispatch.
- **Infrastructure**: AWS EC2 instance running docker-compose, using NGINX as a reverse proxy with Certbot SSL/HTTPS termination.
- **CI/CD**: GitHub Actions workflows.
- **Observability**: OpenTelemetry tracing propagated across ms1 and ms2, feeding a self-hosted Jaeger instance.

## Non-Negotiable Core Rule (Section 10.2)

> [!IMPORTANT]
> **The LLM only extracts and drafts prose.**
> Every determination that actually matters—such as whether a combination of medicines is dangerous or whether a lab value has changed meaningfully—must run as **deterministic, versioned code in ms1**. It must **never** be an LLM judgment call. This ensures all alerts are explainable, auditable, and immune to prompt-injection attacks contained within uploaded documents.

# MedGuard Implementation & MVP Scope
## Section 11: MVP Scope — 2 Weeks

The core focus of this MVP is **Phase 1: Medication Safety Guardian** (prescription photo upload → extract brand → resolve to generic → deterministic interaction check against active list → alert patient & caregiver). 

**Phase 2: Longitudinal Visit Prep** (lab report trends and visit briefs) is treated as a stretch goal to be built if time allows, or scheduled as the immediate next milestone post-MVP.

---

### 11.1 In Scope (Phase 1 — MVP)

*   **Multimodal Upload**: 1–3 photos uploaded from phone browser → prescription assessment graph → structured medicine entry with confidence score (max 1 follow-up question for ambiguity).
*   **Brand Mapping Subset**: Hand-built catalog of 50–150 common Indian brand names resolved to their generic molecules, seeded from open datasets.
*   **Interaction Knowledge Base**: Hand-curated database of 50–150 interaction pairs covering chronic conditions (diabetes, hypertension, cholesterol), seeded from DDInter.
*   **Deterministic Engine**: Pure, unit-tested module in `ms1` performing interaction lookups based on active generics list.
*   **Caregiver Linkage**: Patient invites caregiver via email. Caregiver gets read-only access + alert acknowledgments.
*   **SES Notifications**: Confirmation email on success, immediate email on critical interaction flags, weekly summary.
*   **Admin Dashboard**: Clinical queue showing raw photo side-by-side with low-confidence extractions, unresolved brands, and borderline flags. Versioned append-only brand-generic editor.
*   **DPDP-Aligned Consent**: Opt-in data processing screen at signup, audit logging of consent, and functional "delete my record" action (data wipe + anonymized audit logs).
*   **Core Infrastructure**: Dockerized monorepo, NGINX routing/TLS, EC2 deployment with HTTPS, CI/CD pipeline, and OpenTelemetry tracing (React → ms1 → ms2).

---

### 11.2 Stretch Goals / Next Milestones

*   Lab report upload and extraction (6.6)
*   Deterministic trend calculation (6.6)
*   Visit-brief writer graph and question generator (6.7)
*   Google OAuth integration
*   Rate limiting on upload endpoint (cost control)
*   API documentation (OpenAPI for ms2 / Swagger for ms1)

---

### 11.3 Two-Week Plan

| Days | Milestone | Proof It Works |
| :--- | :--- | :--- |
| **1–2** | Monorepo scaffold, Docker + compose (`ms1`, `ms2`, Postgres, NGINX), schema v1, CI pipeline; vision-LLM spike on 10 real prescription photos. | Stack boots with one command; the model extracts medicine names reliably from test photos. |
| **3–4** | JWT auth (patient/caregiver/admin); deploy skeleton to EC2 with HTTPS + domain; SES verification started; interaction KB and brand-mapping subset drafted; consent screen built. | Login and photo upload work from a phone on the live domain. |
| **5–7** | Assessment graph in `ms2`: vision → follow-up (≤1) → brand resolution → structured entry + confidence; interaction-lookup module in `ms1` (pure, tested); alert screen with plain-language reasoning. | An uploaded prescription photo returns a structured entry and, if relevant, a flagged interaction. |
| **8–9** | Caregiver invite + linked view; SES alert and confirmation emails. | Inviting a caregiver produces a working linked account that sees the same alerts. |
| **10–11** | Admin dashboard: review queue with AI reasoning shown, knowledge base and brand-mapping editor with versioning. | Admin corrects a low-confidence extraction and it's reflected system-wide. |
| **12** | OTel traces across upload → vision → brand resolution → interaction-check → alert; cost-per-check visible. | One trace spans the full medicine-add pipeline with cost attributes. |
| **13–14** | Hardening: irrelevant/bad photo rejection, EXIF stripping, upload limits, empty states; final deploy, README + demo video; start on Phase 2 if time remains. | End-to-end demo: photo → structured medicine → interaction check → alert → caregiver notified. |

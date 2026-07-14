# Handoff Document — Milestone 2 (v2)

This document provides a status snapshot and design decisions for Milestone 2, which focuses on the frontend screens, ms1 routes/services layer, DPDP privacy consent, and mock vision extraction seams.

## Status Snapshot

All Milestone 2 requirements have been fully implemented, verified, and are ready for deployment/PR review:

- **Backend (ms1)**:
  - Created a single mock OCR/LLM Vision Service interface in `visionService.js`.
  - Added interaction engine checks, email logging alerts, and transaction flow when adding medicines.
  - Implemented the DPDP consent checking middleware `enforceConsent()` and routes to manage consent logs.
  - Wrote integration test suite `m2-integration.test.js` validating end-to-end functionality.
- **Frontend**:
  - **Dashboard.jsx**: Fetches active medicines, interaction alert count, and upcoming visits.
  - **Upload.jsx**: Renders confidence meters and displays the edit/confirm flow for low-confidence files.
  - **MedicineList.jsx**: Supports viewing active/discontinued medicines and reactivating/discontinuing them.
  - **Alerts.jsx**: Surfaces severity-coded warnings with action buttons to acknowledge them.
  - **CaregiverDashboard.jsx**: Supports selecting linked patients and restricts patient medical details access depending on permission levels.
  - **PrivacySettings.jsx**: New page allowing users to grant/revoke DPDP consent and request account deletion.
  - Mounted `/privacy` route in `App.jsx` and verified compile/build.

## Key Design Decisions & ADRs

- **ADR 0001: Patient-Facing Inline Confirmation**:
  - *Decision*: Since the Admin Review Queue was removed from the product scope, we surface low-confidence extractions (`< 85%` or unresolved brand-to-generic mappings) directly to the patient during the prescription upload flow.
  - *Consequence*: The patient is presented with an editable form to verify/correct the fields. Brand updates write directly to the database with `source = 'user_confirmed'`.
- **Consent Gate Middleware**:
  - Added `enforceConsent('health_data_processing')` middleware to block data access/updates if the user has revoked their DPDP consent.

## File Map

### New Files
- **[PrivacySettings.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/PrivacySettings.jsx)**: UI for DPDP settings, consent toggle, and account deletion confirmation.
- **[0001-patient-inline-confirmation.md](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/docs/adr/0001-patient-inline-confirmation.md)**: Architectural decision record for the patient-facing inline verification loop.
- **[consent.js middleware](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/consent.js)**: Enforces active DPDP consent at the route level.
- **[consent.js route](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/consent.js)**: APIs to query and toggle consent (`health_data_processing`).
- **[visionService.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/services/visionService.js)**: Stubbed extraction results. Files containing `"low"`, `"unresolved"`, or `"crocin"` return low-confidence and follow-up data.
- **[email.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/email.js)**: Logger stub for sending AWS SES email notifications.
- **[interactionEngine.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/interactionEngine.js)**: Local medicine safety analyzer.
- **[m2-integration.test.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/tests/m2-integration.test.js)**: Integration test suite for Milestone 2 features.

### Modified Files
- **[App.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/App.jsx)**: Mounted the new `/privacy` route.
- **[index.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/index.js)**: Mounted the consent router.
- **[init.sql](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/infra/db/init.sql)**: Setup schema with `consent_records` and new columns.
- **[auth.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/auth.js)**: Extended registration transactional insert to include `health_data_processing` consent and added account deletion cascade.
- **[medicines.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/medicines.js)**: Integrated OCR upload parsing and interaction engine checks.

## How to Resume & Test

### Running the application
Start the development stack from the root:
```bash
docker-compose up --build
```
Or start the backend and frontend separately:
- **Backend (ms1)**: `cd ms1-core-api && npm run dev` (runs on http://localhost:4000)
- **Frontend**: `cd frontend && npm run dev` (runs on http://localhost:5173)

### Running tests
Verify the integration tests in the backend folder:
```bash
cd ms1-core-api
npm run test
```

### Simulating Low-Confidence
To test the patient-facing verification form in the frontend, upload any image file with `"low"`, `"unresolved"`, or `"crocin"` in the filename (e.g. `crocin_prescription.png`). This triggers the mock vision service to return a `72%` confidence score and displays the editable form fields.

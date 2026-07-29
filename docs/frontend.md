# React Frontend Service Details

The MedGuard frontend is a React single-page app (SPA) built using Vite and styled with Vanilla CSS and Tailwind utility tokens.

---

## 1. Directory Structure

### Contexts (`src/context/`)
- **[AuthContext.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/context/AuthContext.jsx)**:
  - Manages the user's active session state. Handles login, registration, MFA code entry, and logout.
  - Stores the generated JWT access and refresh tokens in `localStorage`.

### Services (`src/services/`)
- **[api.js](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/services/api.js)**:
  - Configures Axios with a base URL of `/api` (proxied by NGINX in production).
  - Uses request interceptors to automatically attach the `Authorization: Bearer <token>` header to all outbound HTTP requests.
  - Implements response interceptors to catch 401 errors, queuing concurrent requests while performing a token refresh transaction.

### Reusable Components (`src/components/`)
- **[MgNavbar.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/components/MgNavbar.jsx)**:
  - Global navigation header bar displaying menu links (Dashboard, Upload, Medicines, Lab Reports, Alerts, Calendar, Privacy) and the Logout button.
  - Automatically queries active safety warnings on mount and displays a red indicator dot next to the Alerts tab if unresolved flags are present.
- **[MedicineReviewTable.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/components/MedicineReviewTable.jsx)**:
  - Interactive table allowing patients to edit or correct extracted medication details (dosage, frequency, duration, lifetime usage, or brand mappings) before saving.
- **[LabReportReviewForm.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/components/LabReportReviewForm.jsx)**:
  - Form displaying extracted laboratory values. Decodes and cleans HTML entities (e.g., converting `mg&#x2F;dL` back to `mg/dL`).

---

## 2. Page Portals (`src/pages/`)

- **[Upload.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/pages/Upload.jsx)**:
  - Document upload portal handling PDF and image uploads.
  - Leverages the `useUploadQueue` hook to process parallel files, starts an SSE connection to track BullMQ jobs, and renders review forms dynamically upon completion.
- **[MedicineList.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/pages/MedicineList.jsx)**:
  - Displays the patient's active prescriptions (Active Prescriptions tab) and historical medications (History tab).
  - Integrates checkboxes for selecting multiple items and triggers bulk deletions via `POST /api/medicines/batch-delete`.
  - Fixes custom `h4` tags for medicine titles to prevent oversized heading overrides from global stylesheets.
- **[LabReports.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/pages/LabReports.jsx)**:
  - Displays laboratory timelines. Translates raw metrics into clinical status categories (Normal vs. Outside normal range) using standard healthy clinical ranges.
- **[Alerts.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/pages/Alerts.jsx)**:
  - Displays drug-drug safety alerts in a plain-English, non-alarmist format, with detailed clinical notes expandable on demand.
- **[PrivacyPolicy.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/pages/PrivacyPolicy.jsx)**, **[Terms.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/pages/Terms.jsx)**, **[ClinicalGuidelines.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/pages/ClinicalGuidelines.jsx)**, **[Support.jsx](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/frontend/src/pages/Support.jsx)**:
  - Static information pages. Styled inside premium white container boxes (`bg-white border border-slate-200 rounded-xl p-8 md:p-10 shadow-sm`) with clean, compact typography.

---

## 3. Production Serving Configuration (NGINX)

In the production environment, the frontend React application is compiled and served as a Docker container reverse-proxied by NGINX. NGINX exposes ports `80` (HTTP) and `443` (HTTPS with TLS terminated via Let's Encrypt certificates).

The NGINX configuration handles routing as follows:
- **`/`**: Serves the React SPA.
- **`/api/*`**: Proxies requests directly to the Express backend (`ms1-core-api` container) on port `4000`.
- **`/api/status/stream/*`**: Proxies SSE status streams to the backend with buffering and caching disabled.

This unified reverse-proxy setup on the EC2 host eliminates CORS issues and secures client-server transit (TLS 1.3).

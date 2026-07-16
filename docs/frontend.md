# MedGuard Frontend SPA Documentation

The MedGuard frontend is a modern React SPA built using Vite. It implements dynamic views for patients and caregivers, handles multi-document parallel file uploads (images and PDFs), establishes real-time Server-Sent Events (SSE) connections to monitor extraction progress, and styles elements using vanilla CSS and Tailwind variables.

---

## General Architectural Flow

1. **Authentication & Routing**:
   - `App.jsx` registers SPA paths using `react-router-dom`.
   - `AuthContext.jsx` manages global user session state (login, registration, MFA, and logout) by checking tokens against `localStorage`. Unauthenticated routes redirect patients back to the `/login` portal.
2. **Document Upload & AI extraction validation**:
   - `Upload.jsx` coordinates document queue storage.
   - When files are selected, the app creates temporary previews and enqueues uploads via `POST /api/documents/upload`.
   - It listens to `/api/status/stream/:jobId` relative SSE streams. Nginx proxy routing bypasses CSP errors.
   - Once completed, the payload specifies `docType` and extracted data, rendering the corresponding form dynamically. Mismatch/unresolved flags prompt patient confirmation steps before committing.
3. **Dashboards & Alerts**:
   - `Dashboard.jsx` loads active prescriptions, calendar visits, and clinical alerts.
   - `Alerts.jsx` displays drug-drug interactions with severity ratings, enabling acknowledgment flows.
   - `MedicineList.jsx` provides tabbed lists filtering active medications versus patient histories.

---

## Directory Structure & Important Files

### `src/context/`
Global React context providers.
- **[AuthContext.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/context/AuthContext.jsx)**: Exposes authentication wrappers, storing active tokens and routing MFA verification gates.

### `src/services/`
- **[api.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/services/api.js)**: Configures Axios with a base URL matching relative `/api` paths. Automatically attaches `Authorization: Bearer <token>` headers on outgoing calls.

### `src/components/`
- **[MgNavbar.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/MgNavbar.jsx)**: Navigation header bar, handling profile links and displaying caregiver view alerts if active.
- **`ui/`**: General reusable widgets:
  - **[MgTabs.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/ui/MgTabs.jsx)**: Selection tabs. Styles active tabs using the `--mg-accent` primary token from `index.css`.
  - **[button.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/ui/button.jsx)**, **[card.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/ui/card.jsx)**, **[checkbox.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/ui/checkbox.jsx)**: Low-level UI design components.

### `src/pages/`
SPA Page components.
- **[Home.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Home.jsx)**: Clinical landing page.
- **[Login.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Login.jsx)**: Credentials portal supporting registration, MFA entry, and role selection.
- **[Dashboard.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Dashboard.jsx)**: Main patient metrics board housing visit summaries, upcoming physician events, and quick links.
- **[Upload.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Upload.jsx)**: Batch document queue processor. Resolves automatic doc-type classifications and validates consensus results.
- **[MedicineList.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/MedicineList.jsx)**: Medication dashboard showing active prescriptions and histories.
- **[Alerts.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Alerts.jsx)**: Clinical safety interactions screen.
- **[Calendar.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Calendar.jsx)**: Visits scheduler.
- **[PrivacySettings.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/PrivacySettings.jsx)**: Consent management page allowing users to configure data sharing and caregiver relationships.

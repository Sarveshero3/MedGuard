# MedGuard Data Flow & File Interactions

This document explains in simple words how data flows between files and functions across the frontend and backend of MedGuard.

---

## 1. Authentication Flow (MFA & Email Verification)

```
[Browser Form] ──(1) submit credentials──> [auth.js (Route)]
                                                  │
                                          (2) generate code
                                                  │
                                          [email.js (Util)] ──(3) send via SES──> [Patient Inbox]
```

1. **Email Code Gating**:
   - The user inputs credentials on the login screen.
   - [auth.js (Route)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/auth.js) handles the login request. If the user's email is unverified, it generates a code and uses `sendEmail()` inside [email.js (Util)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/email.js) to dispatch it via AWS SES.
   - The user enters the code to confirm, which calls `/auth/verify-email`. The route updates `users.is_email_verified = true` in PostgreSQL.
2. **Access Security**:
   - On successful login/MFA, [auth.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/auth.js) issues a JWT access token (15 mins) and refresh token (7 days).
   - [auth.js (Middleware)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/auth.js) intercepts subsequent requests using `authenticateUser` to verify the JWT and `enforceEmailVerified` to block unverified actions.

---

## 2. Ingestion & AI Extraction Flow (Prescriptions & Lab Reports)

```
[Upload.jsx (Page)] ──(1) upload photo──> [medicines.js (Route)]
                                                    │
                                            (2) save file & queue
                                                    │
                                            [queueService.js (Worker)]
                                                    │
                                            (3) HTTP POST /extract
                                                    │
                                            [extract.py (FastAPI Route)]
                                                    │
                                            (4) run LangGraph
                                                    │
                                            [prescription_graph.py] / [lab_report_graph.py]
```

1. **Uploading the Document**:
   - The patient selects a photo in [Upload.jsx (Page)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Upload.jsx).
   - The file is uploaded via `POST /api/medicines/upload` or `/api/lab-reports/upload`.
   - [security.js (Middleware)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/security.js) intercepts the upload using Multer, saves the file to the local `uploads/` folder, and enforces file limits (max 8MB, JPEG/PNG only).
2. **Enqueuing and Status Broadcasting**:
   - [medicines.js (Route)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/medicines.js) or [labReports.js (Route)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/labReports.js) calculates the file's SHA-256 hash to prevent duplicate uploads.
   - It enqueues a job into BullMQ using `extractionQueue.add` inside [queueService.js (Service)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/services/queueService.js) and returns the Job ID to the browser.
   - [Upload.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Upload.jsx) opens a Server-Sent Events (SSE) stream to `/api/status/stream/:jobId` (defined in [jobs.js Route](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/jobs.js)) to receive real-time status updates from the queue worker.
3. **Processing the Queue**:
   - The BullMQ worker in [queueService.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/services/queueService.js) runs.
   - It triggers an HTTP POST request to `ms2-agent-service` using `extractDocumentData()`, forwarding the file to the FastAPI routes in [extract.py (Route)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/api/extract.py).
4. **AI Parsing (LangGraph)**:
   - [extract.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/api/extract.py) routes the file buffer to the appropriate graph:
     - Prescriptions: parsed by [prescription_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/prescription_graph.py).
     - Lab Reports: parsed by [lab_report_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/lab_report_graph.py).
   - Mismatch/low-confidence results flag `needs_follow_up = true` or `needs_classification_confirmation = true` to trigger verification prompts in the browser.
   - On completion, the worker cleans up the local file using `fs.unlinkSync()`, broadcasts `status: 'completed'` over the SSE stream, and returns the structured extraction payload back to the browser review form.

---

## 3. Saving & Drug Safety Check Flow

```
[Review Form] ──(1) save confirmed data──> [medicines.js (Route)]
                                                    │
                                            (2) check interaction
                                                    │
                                            [interactionEngine.js (Util)]
                                                    │
                                            (3) flag / alert via SES
```

1. **Data Confirmation**:
   - The user reviews the extracted fields in [MedicineReviewTable.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/MedicineReviewTable.jsx) or [LabReportReviewForm.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/components/LabReportReviewForm.jsx) and clicks **Save**.
   - The frontend sends the payload to `POST /api/medicines` or `POST /api/lab-reports/confirm`.
2. **PostgreSQL Transactions & Locking**:
   - [medicines.js (Route)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/medicines.js) runs the save block inside a database transaction (`BEGIN` / `COMMIT`).
   - It performs a row-level lock using `SELECT ... FOR UPDATE` on the patient's existing active medicines to block simultaneous writes, preventing duplicate additions or race conditions.
3. **Safety Calculations**:
   - Before committing, `ms1` calls `checkInteractions()` in [interactionEngine.js (Util)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/interactionEngine.js).
   - This function compares the new medication generic name against active patient generics and searches the `interaction_kb` database table.
   - If an interaction is found:
     - `ms1` writes a record to the `interaction_flags` table.
     - `ms1` queries linked caregivers using [caregivers.js (Route)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/caregivers.js).
     - It dispatches plain-English interaction alert emails to both patient and caregiver using AWS SES.
   - The transaction commits (`COMMIT`), and the medicine is saved.

---

## 4. Lab Trend Explanation & Visit Prep Flow

1. **Trend Evaluation**:
   - When lab values are saved, `ms1` calls [trendCalculator.js (Util)](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/trendCalculator.js) to compare the new value against historical records.
   - Out-of-bounds statuses are calculated on the frontend using standardized clinician thresholds.
2. **Visit Brief Compilation**:
   - When a patient clicks "Generate Visit Brief" in [Dashboard.jsx](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/frontend/src/pages/Dashboard.jsx), the frontend requests `/api/visits/:id/brief`.
   - `ms1` fetches the patient's active medicines, active flags, and lab trends, sending them to `ms2` at `/api/visit-brief`.
   - `ms2` runs [brief_writer_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/brief_writer_graph.py) to compile a patient-friendly summary sheet and questions for the physician.
   - The brief is saved in PostgreSQL and rendered for printing or sharing.

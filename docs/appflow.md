# MedGuard End-to-End Application Flow

This document combines the user-facing journey (Section 7) with the system-level implementation flows (Section 10.2) to show exactly how the system processes data at each stage.

---

### Phase 0: Account Creation & Login (Dual-Token Auth & OTP)

*   **User Action**: Ramesh signs up with his email and password, verifies his email via OTP, and later logs in.
*   **System Action**:
    1.  On signup, `ms1` generates a one-time code and triggers **AWS SES** to email it.
    2.  Ramesh enters the code; `ms1` verifies it, marks the account `is_email_verified = true`, and issues an `accessToken` (15 min TTL) and a `refreshToken` (7 day TTL).
    3.  On subsequent logins, successful MFA verification issues both tokens. The client stores the `refreshToken` in localStorage.
    4.  An Axios response interceptor intercepts any 401 response and silently rotates the tokens via `POST /auth/refresh` using a shared-promise queue to prevent concurrent races.

---

### Phase 1: Prescription Upload & Extraction

*   **User Action**: Ramesh photographs his new prescription from his cardiologist and uploads it via the React app.
*   **System Action**:
    1.  The `frontend` sends the image to `ms1-core-api` at `/api/documents/upload` or `/api/medicines/upload` (handling uploads up to 8MB).
    2.  During saving/confirming, `ms1` starts a transaction (`BEGIN`) and locks the patient's existing medicines using `SELECT ... FOR UPDATE` to prevent concurrent write race conditions.
    2.  `ms1` stores the raw image and issues a request to the internal-only `ms2-agent-service` endpoint.
    3.  `ms2` runs the **Prescription Assessment Graph**:
        *   Pre-processes the image (contrast adjustment, resizing).
        *   Calls a vision-LLM model to extract structured fields: `brand_name`, `dosage`, `frequency`, and `prescribing_doctor`.
        *   Calculates a confidence score per field.
    4.  `ms2` maps the extracted brand name against `brand_generic_map`.
        *   *If resolved successfully*: returns the generic name with confidence scores.
        *   *If unresolved / low confidence (<85%)*: flags the record with `resolution_status = 'generic_unresolved'` and triggers the user inline correction loop in Phase 2.

---

### Phase 2: Ambiguity Follow-up Loop & Inline Correction

*   **User Action**: Ramesh sees a follow-up question on his screen: *"Is the dosage clearly 5mg?"* and clicks **Yes**. If the brand name itself was extracted with low confidence, he's shown the raw photo next to the guessed name and can correct it directly, right here — there is no separate review step later.
*   **System Action**:
    1.  If the vision-LLM in `ms2` finds handwriting ambiguous (dosage, frequency, brand name, or duration), it sets the confidence low and drafts a structured follow-up question for the specific field in question.
    2.  `ms1` serves this question to the React `frontend` before confirming the entry.
    3.  If the low-confidence field is the brand name, the user's correction is written directly to `brand_generic_map` as a new row with `source = 'user_confirmed'`, a bumped `version`, and a new `effective_date` — in the same request, no separate queue.
    4.  When the user submits all answers, `ms1` saves the medicine to the `medicines` table with `status = 'active'`, sets `resolution_status = 'resolved'`, and computes `course_end_date` from the (now-confirmed) `duration_text` if resolvable.

---

### Phase 3: Deterministic Interaction Check

*   **User Action**: System flags a moderate interaction with a medicine Ramesh's endocrinologist prescribed, displaying a plain-language warning.
*   **System Action**:
    1.  `ms1` initiates a deterministic check. It queries the active medicines for Ramesh (`medicines` table where `status = 'active'`).
    2.  For each pair (the new generic vs. existing generics), it queries the `interaction_kb` table.
    3.  If a match is found, `ms1` writes an entry to the `interaction_flags` table with the corresponding `severity`, `explanation`, and `kb_entry_id` (representing the KB version).
    4.  If the interaction severity is high or approved, `ms1` updates the frontend UI to display the explanation (e.g., *"Avoid taking Glycomet alongside this new medicine because..."*).

---

### Phase 4: Caregiver Notification

*   **User Action**: Priya (Ramesh's linked caregiver) receives the alert via email. She calls her father to discuss it before his next doctor visit.
*   **System Action**:
    1.  Upon writing a new flag to `interaction_flags`, `ms1` checks the `caregiver_links` table for active links.
    2.  `ms1` triggers AWS SES to send alert emails to the patient (Ramesh) and the caregiver (Priya) — the same SES sender identity used for OTP in Phase 0.
    3.  Priya logs into her React dashboard, which queries `ms1` using her caregiver JWT claims. She sees Ramesh's active medicine list and active alerts in a read-only timeline.

---

### Phase 5: Lab Report Timeline & Trend Calculation

*   **User Action**: A few weeks later, Ramesh uploads a PDF/photo of a new blood sugar lab report. The system extracts the values and flags a rising trend.
*   **System Action**:
    1.  `frontend` uploads the document to `ms1`, which sends it to `ms2`.
    2.  `ms2` runs the **Lab Report Extraction Graph** to parse the values (e.g., `HbA1c = 7.2%`, `LDL = 130 mg/dL`) and returns them to `ms1`.
    3.  `ms1` saves these in `lab_values` and triggers a deterministic trend check:
        *   It compares the new value to the last two historical records.
        *   If the value has increased significantly (e.g., a relative increase >10% or absolute increase >0.3 for HbA1c), it flags the trend as a meaningful change.

---

### Phase 6: Visit Prep Brief Generation

*   **User Action**: With an appointment scheduled for next week, Ramesh generates his "Visit Prep Brief". The system outputs a one-page overview.
*   **System Action**:
    1.  The `frontend` calls `/api/visits/:id/brief` on `ms1`.
    2.  `ms1` aggregates the patient's active medicines, active interaction flags, and recent lab value trends, and passes them to `ms2`.
    3.  `ms2` runs the **Visit-Brief Writer Graph**:
        *   Organizes the medication list and highlighted trends.
        *   Drafts 3-4 questions for the patient to ask, framed around *concern and cause*, never around a specific treatment or dosage action (e.g., *"My HbA1c increased from 6.8 to 7.2 over the last 3 months — is this something to be concerned about, and what could be causing it?"*, not *"should we adjust my dosage?"*). The graph is constrained by a dedicated system prompt (see `docs/prompts/visit-brief-writer.md`) that hard-blocks any medication-change suggestion.
        *   Appends the mandatory disclaimer: *"Discuss this with your doctor — this is not a diagnosis."*
    4.  `ms1` saves the output in `briefs` and returns it to the client for rendering, printing, or email delivery.

---

### Phase 7: Medicine Course & Appointment Calendar

*   **User Action**: Ramesh opens his calendar view and sees his current medicine courses laid out with end dates, plus an upcoming cardiology appointment he added himself.
*   **System Action**:
    1.  During Phase 1 extraction, `ms2` also extracts a `duration_text` field from the prescription (e.g., "for 5 days," "ongoing"). If it's ambiguous, this is asked as a follow-up question in the same Phase 2 loop as dosage/frequency — not a new mechanism.
    2.  Once resolved, `ms1` computes `course_end_date` from `added_at` + `duration_text` and stores it on the `medicines` row.
    3.  The user can independently add a doctor appointment (date, note) directly through the app, stored in `visits` with `visit_type = 'user_added'`.
    4.  The frontend calendar view (`GET /api/calendar`) merges active medicine course end dates with the user's `visits` entries into one timeline — no separate table, just a combined read.

# MedGuard End-to-End Application Flow

This document combines the user-facing journey (Section 7) with the system-level implementation flows (Section 10.2) to show exactly how the system processes data at each stage.

---

### Phase 1: Prescription Upload & Extraction

*   **User Action**: Ramesh photographs his new prescription from his cardiologist and uploads it via the React app.
*   **System Action**:
    1.  The `frontend` sends the image to `ms1-core-api` at `/api/medicines/upload` (handling uploads up to 8MB).
    2.  `ms1` stores the raw image and issues a request to the internal-only `ms2-agent-service` endpoint.
    3.  `ms2` runs the **Prescription Assessment Graph**:
        *   Pre-processes the image (contrast adjustment, resizing).
        *   Calls a vision-LLM model to extract structured fields: `brand_name`, `dosage`, `frequency`, and `prescribing_doctor`.
        *   Calculates a confidence score per field.
    4.  `ms2` maps the extracted brand name against `brand_generic_map`.
        *   *If resolved successfully*: returns the generic name with confidence scores.
        *   *If unresolved / low confidence (<85%)*: flags the record with `resolution_status = 'generic_unresolved'` and sends it to the admin review queue.

---

### Phase 2: Ambiguity Follow-up Loop

*   **User Action**: Ramesh sees a follow-up question on his screen: *"Is the dosage clearly 5mg?"* and clicks **Yes**.
*   **System Action**:
    1.  If the vision-LLM in `ms2` finds handwriting ambiguous (e.g. 5mg vs. 50mg), it sets the confidence low and drafts a structured follow-up question.
    2.  `ms1` serves this question to the React `frontend` before confirming the entry.
    3.  When the user submits the answer, `ms1` saves the medicine to the `medicines` table with `status = 'active'` and updates `resolution_status` to `'resolved'`.

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
    2.  `ms1` triggers AWS SES to send alert emails to the patient (Ramesh) and the caregiver (Priya).
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
        *   Drafts 3-4 specific questions for the patient to ask (e.g., *"My HbA1c increased from 6.8 to 7.2 over the last 3 months, should we adjust my dosage?"*).
        *   Appends the mandatory disclaimer: *"Discuss this with your doctor — this is not a diagnosis."*
    4.  `ms1` saves the output in `briefs` and returns it to the client for rendering, printing, or email delivery.

---

### Phase 7: Clinical Review (Admin Dashboard)

*   **User Action**: Dr. Sana logs into the admin panel and corrects a low-confidence brand extraction.
*   **System Action**:
    1.  Dr. Sana's client requests pending reviews from `ms1` at `/api/admin/review-queue` (requires admin JWT role).
    2.  The dashboard displays the raw uploaded photo side-by-side with the LLM-extracted values.
    3.  Dr. Sana edits a misspelling and clicks **Confirm**.
    4.  `ms1` writes a new row to `brand_generic_map` with `source = 'reviewer_confirmed'`, `version = 'v2'`, and a new `effective_date`.
    5.  The system re-runs the resolution logic for that patient's medicine in the background, updating the medicines and active flags without modifying historical logs.

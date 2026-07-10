# MedGuard Backend Design Decisions

This document outlines backend-only decisions regarding API contracts, error handling, confidence thresholds, and reference data versioning.

---

### 1. API Contracts (Response Shapes)

#### `POST /api/medicines/upload`
Initial endpoint for patient prescription upload.
*   **Request**: `multipart/form-data` with `photo` binary.
*   **Response**:
    ```json
    {
      "success": true,
      "data": {
        "source_photo_id": "photo_uuid_12345",
        "raw_extraction": {
          "brand_name": "Dolo 650",
          "dosage": "650mg",
          "frequency": "Three times a day",
          "prescribing_doctor": "Dr. A. K. Sharma"
        },
        "confidence_scores": {
          "brand_name": 0.92,
          "dosage": 0.89,
          "frequency": 0.74,
          "prescribing_doctor": 0.95
        },
        "resolution": {
          "status": "resolved",
          "generic_name": "Paracetamol"
        },
        "needs_follow_up": false,
        "follow_up_question": null
      }
    }
    ```

#### `GET /api/visits/:id/brief`
Retrieves the visit preparation brief.
*   **Response**:
    ```json
    {
      "success": true,
      "data": {
        "visit_id": 42,
        "scheduled_date": "2026-07-17T10:00:00Z",
        "patient_id": 101,
        "brief": {
          "content": "Patient Ramesh has a cardiologist visit. Recommended discussion items based on clinical trends.",
          "active_medicines": [
            { "brand_name": "Dolo 650", "generic_name": "Paracetamol", "dosage": "650mg" },
            { "brand_name": "Glycomet", "generic_name": "Metformin", "dosage": "500mg" }
          ],
          "flagged_interactions": [
            {
              "generic_a": "Metformin",
              "generic_b": "Contrast Agent",
              "severity": "avoid_combination",
              "explanation": "Combining Metformin with iodinated contrast agents can cause lactic acidosis."
            }
          ],
          "flagged_trends": [
            {
              "test_type": "HbA1c",
              "recent_values": [
                { "value": 6.8, "unit": "%", "recorded_at": "2026-04-10" },
                { "value": 7.0, "unit": "%", "recorded_at": "2026-05-15" },
                { "value": 7.2, "unit": "%", "recorded_at": "2026-07-10" }
              ],
              "direction": "rising",
              "message": "HbA1c has steadily risen from 6.8% to 7.2% over 3 months."
            }
          ],
          "suggested_questions": [
            "My blood sugar (HbA1c) has been trending upward from 6.8 to 7.2 over the last 3 months. Should we adjust my medication?",
            "Is it safe to continue taking Metformin if we plan to run contrast imaging tests?"
          ],
          "disclaimer": "Discuss this with your doctor — this is not a diagnosis."
        }
      }
    }
    ```

---

### 2. Error Conventions

The API will return standard HTTP statuses accompanied by structured JSON error responses:
*   **Format**:
    ```json
    {
      "success": false,
      "error": {
        "code": "ERROR_CODE",
        "message": "Human readable error description",
        "details": []
      }
    }
    ```
*   **Common Codes**:
    *   `UNAUTHORIZED`: Invalid or expired JWT token.
    *   `FORBIDDEN`: User lacks the necessary role claim (e.g. caregiver trying to add a medicine).
    *   `INSUFFICIENT_CONSENT`: Action attempted without an active DPDP consent record.
    *   `FILE_TOO_LARGE`: Prescription upload exceeded the 8MB limit.
    *   `UNPROCESSABLE_IMAGE`: Image lacks recognizable text or is invalid.

---

### 3. Confidence-Tier Thresholds (Section 16.3)

*   **High Confidence (>= 85%)**: Extracted fields scoring >= 0.85 are processed automatically. Medicine resolution is attempted immediately.
*   **Low Confidence / Ambiguous (< 85%)**:
    *   If `brand_name` or `dosage` falls below `0.85`, the extraction is routed to the Admin Review Queue.
    *   If the LLM flags ambiguity in OCR, the system prompts the user with one follow-up clarification before completing the upload.
    *   An unresolved brand name or low-confidence dosage must **never** reach the deterministic interaction checker silently.

---

### 4. Reference Data Versioning (Append-Only)

To guarantee that historical alerts remain explainable and auditable, the `interaction_kb` and `brand_generic_map` tables are strictly **append-only**.

*   **Rule**: Never run an `UPDATE` or `DELETE` on these tables.
*   **Structure**: Every row features a composite unique key (e.g., `brand_name` + `version` or `generic_a` + `generic_b` + `version`) along with `effective_date`.
*   **Resolution Process**:
    *   When an administrator corrects a brand mapping, a new row is appended (e.g., `version = 'v2'`, `source = 'reviewer_confirmed'`, `effective_date = NOW()`).
    *   Active checkers always query the row with the **latest `effective_date`** relative to when the medicine was added.
    *   Historical interaction flags maintain a foreign key reference (`kb_entry_id`) pointing to the exact version of the rule that triggered the flag.

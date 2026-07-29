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

    | Code | HTTP Status | Trigger |
    |:---|:---|:---|
    | `UNAUTHORIZED` | 401 | Missing/invalid/expired JWT token |
    | `FORBIDDEN` | 403 | User lacks the necessary role for the route (RBAC) |
    | `EMAIL_UNVERIFIED` | 403 | Unverified user attempts a verification-locked action (medicine add/update/delete/upload) |
    | `VALIDATION_ERROR` | 400 | Request body fails schema validation (bad email format, weak password, missing required fields, invalid UUID) |
    | `EMAIL_ALREADY_IN_USE` | 409 | Registration attempt with a duplicate email address |
    | `INVALID_TOKEN` | 400 | Invalid or expired email verification / password reset token |
    | `RATE_LIMIT_EXCEEDED` | 429 | IP exceeded rate limit on auth (5/15min), register (3/1hr), upload (5/10min), or general API (100/15min) |
    | `NOT_FOUND` | 404 | Requested resource (medicine, alert, caregiver link, endpoint) does not exist |
    | `BAD_REQUEST` | 400 | Missing required fields (e.g. `patient_id`, `photo` file) |
    | `BAD_GATEWAY` | 502 | ms2 agent service unreachable or returned an error during extraction |
    | `INSUFFICIENT_CONSENT` | 403 | Action attempted without an active DPDP consent record |
    | `FILE_TOO_LARGE` | 413 | Prescription upload exceeded the 8MB limit |
    | `UNPROCESSABLE_IMAGE` | 422 | Image lacks recognizable text or is invalid |
    | `INTERNAL_ERROR` | 500 | Uncaught server error (details never leaked to client) |

### 2b. Authentication Token Schema

`ms1-core-api` issues a dual-token pair upon successful registration, login, and MFA verification:

#### 1. Access Token (`accessToken`)
Signed JWT containing full authorization claims for the request lifecycle.
- **Access token TTL**: 15 minutes (configured via `JWT_ACCESS_TTL`).
- **Format**:
  ```json
  {
    "sub": "user-uuid-v4",
    "userId": "user-uuid-v4",
    "email": "user@example.com",
    "role": "patient | caregiver",
    "name": "John Doe",
    "iat": 1720000000,
    "exp": 1720000900
  }
  ```

#### 2. Refresh Token (`refreshToken`)
Minimal-claim JWT used solely to rotate and request new token pairs.
- **Refresh token TTL**: 7 days (configured via `JWT_REFRESH_TTL`).
- **Format**:
  ```json
  {
    "userId": "user-uuid-v4",
    "jti": "random-uuid-v4",
    "iat": 1720000000,
    "exp": 1720604800
  }
  ```

#### 3. Database Hash Gating (`refresh_tokens` table)
- To prevent replay attacks and secure the refresh flow, the SHA-256 hash of the `refreshToken` is saved in the `refresh_tokens` table.
- A database-level transaction (`BEGIN` / `SELECT ... FOR UPDATE` / `COMMIT`) gates the rotation endpoint (`POST /auth/refresh`). On rotation, the old refresh token is marked revoked (`revoked_at = NOW()`) and a fresh token pair is issued.

| Property | Notes |
|:---|:---|
| Signing algorithm | HS256 |
| Secret | `JWT_SECRET` env var (minimum 64 chars, never committed) |
| `is_email_verified` | Re-checked against DB on every `enforceEmailVerified` call, not trusted from the token |

---

### 3. Confidence-Tier Thresholds (Section 16.3)

The extraction pipeline uses a **dual-model consensus approach**, not a single numeric threshold, to determine confidence. Two separate Groq models (`orchestrator_model` = `llama-3.3-70b-versatile`, `disambiguation_model` = `llama-3.1-8b-instant`) independently extract fields from OCR text. Their outputs are compared field-by-field:

*   **Agreement (models agree on all fields)**: Synthetic confidence scores assigned:
    *   **Prescriptions**: `brand_name: 0.95`, `dosage: 0.95`, `frequency: 0.95`, `prescribing_doctor: 0.98`
    *   **Lab Reports**: `test_type: 0.96`, `value: 0.95`, `unit: 0.98`
    *   `needs_follow_up` is set to `false`. Medicine resolution proceeds immediately.

*   **Disagreement (mismatch detected on any field)**: Synthetic confidence scores are reduced:
    *   **Prescriptions**: `brand_name: 0.70`, `dosage: 0.70`, `frequency: 0.70`, `prescribing_doctor: 0.95`
    *   **Lab Reports**: `test_type: 0.70`, `value: 0.70`, `unit: 0.95`
    *   `needs_follow_up` is set to `true`. A follow-up question describing the specific disagreement is surfaced to the user.

*   **Document classification confidence**: If the classifier's confidence that a document is a prescription vs. lab report is `< 0.80`, `needs_classification_confirmation` is set to `true`, prompting the user to confirm the document type before extraction proceeds.

*   **Safety invariant**: An unresolved brand name or a disagreement-flagged field must **never** reach the deterministic interaction checker silently. The user must confirm before any interaction check runs.

---

### 4. Reference Data Versioning (Append-Only)

To guarantee that historical alerts remain explainable and auditable, the `interaction_kb` and `brand_generic_map` tables are strictly **append-only**.

*   **Rule**: Never run an `UPDATE` or `DELETE` on these tables.
*   **Structure**: Every row features a composite unique key (e.g., `brand_name` + `version` or `generic_a` + `generic_b` + `version`) along with `effective_date`.
*   **Resolution Process**:
    *   When a patient or caregiver corrects a brand mapping during the Phase 2 follow-up, a new row is appended (e.g., `version = 'v2'`, `source = 'user_confirmed'`, `effective_date = NOW()`).
    *   Active checkers always query the row with the **latest `effective_date`** relative to when the medicine was added.
    *   Historical interaction flags maintain a foreign key reference (`kb_entry_id`) pointing to the exact version of the rule that triggered the flag.

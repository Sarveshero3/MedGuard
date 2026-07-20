# MedGuard Database Schema

The PostgreSQL database acts as the system of record. Below are all 15 active tables defined in the schema:

### 1. `users`
Stores user profile information, credentials, verification, and consent/MFA states.
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `email` (VARCHAR, Unique)
- `password_hash` (VARCHAR)
- `role` (Enum: `patient`, `caregiver`)
- `is_email_verified` (Boolean)
- `email_verification_token` (VARCHAR, Nullable)
- `password_reset_token` (VARCHAR, Nullable)
- `password_reset_expires` (Timestamp, Nullable)
- `linking_otp` (VARCHAR, Nullable caregiver-patient OTP code)
- `linking_otp_expires_at` (Timestamp, Nullable)
- `mfa_code` (VARCHAR, Nullable login MFA OTP code)
- `mfa_expires_at` (Timestamp, Nullable)
- `consent_given_at` (Timestamp, Nullable) — **Enforces DPDP compliance directly on the user record. If NULL, health data processing is blocked.**
- `created_at` (Timestamp)

### 2. `caregiver_links`
Establishes active/revoked links between patient and caregiver.
- `id` (UUID, Primary Key)
- `patient_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `caregiver_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `permission_level` (VARCHAR, e.g. `full_view`, `alerts_only`)
- `status` (Enum: `active`, `revoked`)
- `created_at` (Timestamp)
- *Constraint*: Unique pair (`patient_id`, `caregiver_id`).

### 3. `brand_generic_map`
Versioned, append-only lookup table translating brand names to generic names/compositions.
- `id` (UUID, Primary Key)
- `brand_name` (VARCHAR, Indexed)
- `generic_name` (VARCHAR)
- `composition` (TEXT, Nullable — active composition formula)
- `source` (VARCHAR, e.g. `kaggle_seed`, `user_confirmed`)
- `version` (VARCHAR)
- `effective_date` (Timestamp)
- `resolution_status` (VARCHAR, e.g. `resolved`, `not_found_unconfirmed`, `unresolved_error`)
- `resolution_source` (VARCHAR)
- `resolved_at` (Timestamp)
- *Note*: Protected by before-update/before-delete database triggers to ensure it remains append-only.

### 4. `visits`
Scheduled doctor appointments.
- `id` (UUID, Primary Key)
- `patient_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `doctor_name` (VARCHAR, Nullable)
- `specialty` (VARCHAR, Nullable)
- `disease_type` (VARCHAR, Nullable)
- `scheduled_date` (Timestamp)
- `visit_type` (Enum: `user_added`, `system_suggested`)
- `brief_id` (UUID, Foreign Key -> `briefs.id` ON DELETE SET NULL)
- `created_at` (Timestamp)

### 5. `medicines`
Active and historical prescription medicines per patient.
- `id` (UUID, Primary Key)
- `patient_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `visit_id` (UUID, Foreign Key -> `visits.id` ON DELETE SET NULL)
- `brand_name` (VARCHAR)
- `generic_name` (VARCHAR, Nullable)
- `dosage` (VARCHAR)
- `frequency` (VARCHAR)
- `source_photo_id` (VARCHAR, Nullable) — **Placeholder field for photo storage reference.**
- `resolution_status` (Enum: `resolved`, `generic_unresolved`, `manually_resolved`)
- `duration_text` (VARCHAR, Nullable)
- `course_end_date` (DATE, Nullable)
- `added_at` (Timestamp)
- `status` (Enum: `active`, `discontinued`)

### 6. `interaction_kb`
Versioned, append-only database of drug-drug interactions.
- `id` (UUID, Primary Key)
- `generic_a` (VARCHAR)
- `generic_b` (VARCHAR)
- `severity` (Enum: `avoid_combination`, `monitor_closely`, `minor`, `no_action`)
- `explanation` (TEXT)
- `source` (VARCHAR, e.g. `DDInter`)
- `version` (VARCHAR)
- `effective_date` (Timestamp)
- *Note*: Protected by before-update/before-delete database triggers to ensure it remains append-only.

### 7. `interaction_flags`
Alerts generated when active medications trigger a drug-drug interaction warning.
- `id` (UUID, Primary Key)
- `patient_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `new_medicine_id` (UUID, Foreign Key -> `medicines.id` ON DELETE CASCADE)
- `existing_medicine_id` (UUID, Foreign Key -> `medicines.id` ON DELETE CASCADE)
- `kb_entry_id` (UUID, Foreign Key -> `interaction_kb.id`)
- `severity` (VARCHAR)
- `confidence` (DECIMAL, defaults to `1.0`)
- `status` (Enum: `shown`, `acknowledged_by_patient`, `acknowledged_by_caregiver`)
- `created_at` (Timestamp)

### 8. `lab_reports`
Uploaded laboratory result documents.
- `id` (UUID, Primary Key)
- `patient_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `visit_id` (UUID, Foreign Key -> `visits.id` ON DELETE SET NULL)
- `source_photo_id` (VARCHAR, Nullable) — **Placeholder field for photo storage reference.**
- `raw_docling_output` (JSONB, Nullable — raw parsed markdown output cached from Docling)
- `uploaded_at` (Timestamp)

### 9. `lab_values`
Metrics extracted from a lab report.
- `id` (UUID, Primary Key)
- `report_id` (UUID, Foreign Key -> `lab_reports.id` ON DELETE CASCADE)
- `test_type` (VARCHAR, Indexed canonical test type)
- `panel_name` (VARCHAR, Nullable)
- `value` (DECIMAL)
- `unit` (VARCHAR)
- `resolution_status` (Enum: `resolved`, `generic_unresolved`, `manually_resolved`)
- `confidence` (DECIMAL, defaults to `1.0`)
- `recorded_at` (Timestamp)

### 10. `briefs`
Non-diagnostic appointment prep briefs generated for visits.
- `id` (UUID, Primary Key)
- `patient_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `visit_id` (UUID, Foreign Key -> `visits.id` ON DELETE CASCADE)
- `content` (JSONB) — Contains active meds, safety concerns, and suggested questions.
- `generated_at` (Timestamp)

### 11. `test_type_normalization`
Versioned, append-only normalization lookup translating test variants to canonical types (e.g. `Hb A1c` -> `HbA1c`).
- `id` (UUID, Primary Key)
- `test_variant` (VARCHAR)
- `canonical_type` (VARCHAR)
- `source` (VARCHAR)
- `version` (VARCHAR)
- `effective_date` (Timestamp)
- *Note*: Protected by before-update/before-delete database triggers.

### 12. `refresh_tokens`
Tracks active and rotated JWT refresh tokens to secure refresh token rotation workflows.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `token_hash` (VARCHAR, Unique SHA-256 hash of the refresh token)
- `expires_at` (Timestamp)
- `revoked_at` (Timestamp, Nullable)
- `created_at` (Timestamp)

### 13. `lab_medicine_rules`
Deterministic safety threshold rules linking active medicines to lab values.
- `id` (UUID, Primary Key)
- `generic_name` (VARCHAR)
- `test_type` (VARCHAR)
- `condition` (VARCHAR, e.g. `>` or `<`)
- `threshold` (DECIMAL)
- `unit` (VARCHAR)
- `severity` (Enum: `avoid_combination`, `monitor_closely`, `minor`, `no_action`)
- `rationale` (TEXT)
- `source` (VARCHAR)
- `version` (VARCHAR)
- `effective_date` (Timestamp)
- *Note*: Protected by before-update/before-delete database triggers.

### 14. `lab_medicine_flags`
Alerts generated when a patient's lab value violates a lab-medicine rule.
- `id` (UUID, Primary Key)
- `patient_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `medicine_id` (UUID, Foreign Key -> `medicines.id` ON DELETE CASCADE)
- `lab_value_id` (UUID, Foreign Key -> `lab_values.id` ON DELETE CASCADE)
- `rule_id` (UUID, Foreign Key -> `lab_medicine_rules.id`)
- `severity` (VARCHAR)
- `status` (Enum: `shown`, `acknowledged_by_patient`, `acknowledged_by_caregiver`)
- `created_at` (Timestamp)

### 15. `adherence_logs`
Logs patient adherence tracking records.
- `id` (UUID, Primary Key)
- `patient_id` (UUID, Foreign Key -> `users.id` ON DELETE CASCADE)
- `medicine_id` (UUID, Foreign Key -> `medicines.id` ON DELETE CASCADE)
- `scheduled_date` (DATE)
- `status` (VARCHAR, e.g. `taken`)
- `logged_at` (Timestamp)
- *Constraint*: Unique combination of (`patient_id`, `medicine_id`, `scheduled_date`).

---

## Relationships Summary

*   A **patient** (in `users` table) can have multiple **medicines** (brand names resolved to generics via `brand_generic_map`).
*   Adding a medicine generates **interaction_flags** checked against the **interaction_kb**.
*   A **patient** has many **lab_reports**, each containing multiple extracted **lab_values** (mapped via `test_type_normalization`).
*   These **lab_values** are trended over time and compiled into **briefs** linked to upcoming **visits**.
*   A patient's **medicines** each carry a `course_end_date` (when resolvable), and together with their own **visits** (appointments they've added), form the basis of the medicine/appointment calendar.
*   **caregiver_links** grant designated caregivers read-plus-acknowledge access to the patient's medicines, flags, and trends.
*   The `consent_records` table does not exist; instead, DPDP consent is tracked directly on the `users.consent_given_at` field and verified by Express API middleware.

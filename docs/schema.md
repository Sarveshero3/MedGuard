# MedGuard Database Schema
## Section 10.3: Basic Data Schema

The PostgreSQL database acts as the system of record. Below are the core tables and their fields:

### 1. `users`
Stores user profile information and login credentials.
- `id` (Primary Key)
- `name` (String)
- `email` (String, Unique)
- `password_hash` (String)
- `role` (Enum: `patient`, `caregiver`)
- `is_email_verified` (Boolean)
- `email_verification_token` (String, Nullable)
- `password_reset_token` (String, Nullable)
- `password_reset_expires` (Timestamp, Nullable)
- `created_at` (Timestamp)

### 2. `caregiver_links`
Establishes the link between a patient and their caregiver with permission tiers.
- `id` (Primary Key)
- `patient_id` (Foreign Key -> `users.id`)
- `caregiver_id` (Foreign Key -> `users.id`)
- `permission_level` (Enum: `full_view`, `alerts_only`)
- `status` (Enum: `pending`, `active`, `revoked`)
- *Note*: Read-plus-acknowledge access rules.

### 3. `brand_generic_map`
Versioned resolution lookup from Indian brand names to generic names.
- `id` (Primary Key)
- `brand_name` (String, Indexed)
- `generic_name` (String)
- `composition` (Text)
- `source` (String, e.g., `kaggle_seed`, `user_confirmed`)
- `version` (String)
- `effective_date` (Timestamp)
- *Note*: Versioned and append-only; never edited in place.

### 4. `medicines`
Active and historical prescription medicine list per patient.
- `id` (Primary Key)
- `patient_id` (Foreign Key -> `users.id`)
- `brand_name` (String)
- `generic_name` (String, Nullable)
- `dosage` (String)
- `frequency` (String)
- `source_photo_id` (String, Reference to disk/S3 storage)
- `resolution_status` (Enum: `resolved`, `generic_unresolved`, `manually_resolved`)
- `duration_text` (String, Nullable — raw extracted duration, e.g. "5 days", "2 weeks", "ongoing")
- `course_end_date` (Date, Nullable — computed from `added_at` + `duration_text` when unambiguous; null if duration is "ongoing" or still unresolved)
- `added_at` (Timestamp)
- `status` (Enum: `active`, `discontinued`)

### 5. `interaction_kb`
Curated versioned database of drug-drug interactions.
- `id` (Primary Key)
- `generic_a` (String)
- `generic_b` (String)
- `severity` (Enum: `avoid_combination`, `monitor_closely`, `minor`, `no_action`)
- `explanation` (Text, plain-language description)
- `source` (String, e.g., `DDInter`)
- `version` (String)
- `effective_date` (Timestamp)
- *Note*: Versioned and append-only; never edited in place.

### 6. `interaction_flags`
Incident alerts generated when an active medicine matches an interaction pair.
- `id` (Primary Key)
- `patient_id` (Foreign Key -> `users.id`)
- `new_medicine_id` (Foreign Key -> `medicines.id`)
- `existing_medicine_id` (Foreign Key -> `medicines.id`)
- `kb_entry_id` (Foreign Key -> `interaction_kb.id`)
- `severity` (String)
- `confidence` (Decimal)
- `status` (Enum: `shown`, `acknowledged_by_patient`, `acknowledged_by_caregiver`)
- `created_at` (Timestamp)

### 7. `lab_reports`
Uploaded patient lab result records.
- `id` (Primary Key)
- `patient_id` (Foreign Key -> `users.id`)
- `source_photo_id` (String, Reference to disk/S3 storage)
- `uploaded_at` (Timestamp)

### 8. `lab_values`
Individual clinical metrics parsed from a lab report.
- `id` (Primary Key)
- `report_id` (Foreign Key -> `lab_reports.id`)
- `test_type` (Enum/String: `HbA1c`, `TSH`, `LDL`, etc.)
- `value` (Decimal)
- `unit` (String)
- `recorded_at` (Timestamp)

### 9. `visits`
Scheduled doctor appointments.
- `id` (Primary Key)
- `patient_id` (Foreign Key -> `users.id`)
- `scheduled_date` (Timestamp)
- `visit_type` (Enum: `user_added`, `system_suggested`, default `user_added`)
- `brief_id` (Foreign Key -> `briefs.id`, Nullable)

### 10. `briefs`
Non-diagnostic appointment prep briefs generated before a visit.
- `id` (Primary Key)
- `patient_id` (Foreign Key -> `users.id`)
- `visit_id` (Foreign Key -> `visits.id`)
- `content` (JSON/Text, trends, active medicines, suggested questions)
- `generated_at` (Timestamp)

### 11. `consent_records`
Opt-in and deletion consent audits (DPDP compliance logging).
- `id` (Primary Key)
- `user_id` (Foreign Key -> `users.id`)
- `consent_type` (String, e.g., `health_data_processing`)
- `granted_at` (Timestamp, Nullable)
- `revoked_at` (Timestamp, Nullable)

---

## Relationships Summary

*   A **patient** (in `users` table) can have multiple **medicines** (resolved via `brand_generic_map`).
*   Adding a medicine generates **interaction_flags** checked against the **interaction_kb**.
*   A **patient** has many **lab_reports**, each containing multiple extracted **lab_values**.
*   These **lab_values** are trended over time and compiled into **briefs** linked to upcoming **visits**.
*   A patient's **medicines** each carry a `course_end_date` (when resolvable), and together with their own **visits** (appointments they've added), form the basis of the medicine/appointment calendar.
*   **caregiver_links** grant designated caregivers read-plus-acknowledge access to the patient's medicines, flags, and trends.

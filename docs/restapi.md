# MedGuard Backend Core API Reference

The MedGuard Core API runs on port 4000 (`http://localhost:4000/api`) and exposes endpoints for authentication, prescription processing, medicine regimen management, clinical alerts, calendar timelines, and privacy consents.

---

## Authentication Endpoints (`/auth`)

### 1. Register User
- **Endpoint**: `POST /auth/register`
- **Description**: Registers a new patient or caregiver account.
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "securePassword123!",
    "role": "patient",
    "consentGranted": true,
    "recaptchaToken": "reCAPTCHA_TOKEN_STRING"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "JWT_ACCESS_TOKEN_STRING",
      "refreshToken": "JWT_REFRESH_TOKEN_STRING",
      "user": {
        "id": "user-uuid-v4",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "role": "patient",
        "isEmailVerified": false
      }
    }
  }
  ```

### 2. Login User
- **Endpoint**: `POST /auth/login`
- **Description**: Authenticates a user credentials. Initiates the 2-step verification (MFA) flow.
- **Request Body**:
  ```json
  {
    "email": "john.doe@example.com",
    "password": "securePassword123!",
    "recaptchaToken": "reCAPTCHA_TOKEN_STRING"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "requiresMfa": true,
      "mfaToken": "JWT_MFA_PENDING_TOKEN_STRING"
    }
  }
  ```

### 3. Verify MFA Code
- **Endpoint**: `POST /auth/verify-mfa`
- **Description**: Verifies the 6-digit one-time passcode sent to the user's email.
- **Request Body**:
  ```json
  {
    "mfaToken": "JWT_MFA_PENDING_TOKEN_STRING",
    "otp": "123456"
  }
  ```
- **Response**: Returns the final `accessToken` and `refreshToken` pair.

### 4. Refresh Access Token
- **Endpoint**: `POST /auth/refresh`
- **Description**: Rotates the refresh token and issues a new access + refresh token pair.
- **Request Body**:
  ```json
  {
    "refreshToken": "JWT_REFRESH_TOKEN_STRING"
  }
  ```
- **Response**: Returns a new `accessToken` and `refreshToken` pair.

### 5. Logout User
- **Endpoint**: `POST /auth/logout`
- **Description**: Explicitly revokes the refresh token in the database.
- **Request Body**:
  ```json
  {
    "refreshToken": "JWT_REFRESH_TOKEN_STRING"
  }
  ```
- **Response**: Success message.

---

## Regimen & Ingestion Endpoints (`/documents`, `/medicines`)

### 1. Unified Document Upload (Prescription or Lab Report)
- **Endpoint**: `POST /api/documents/upload`
- **Description**: Uploads a medical document photo or PDF, hashes it for deduplication, and enqueues a background extraction job.
- **Request Parameters**: Multipart form data with a `photo` file and `patient_id`.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "jobId": "job-id-string"
    }
  }
  ```

### 2. Stream Job Status (Server-Sent Events)
- **Endpoint**: `GET /api/status/stream/:jobId`
- **Description**: Real-time event stream tracking extraction progress. Yields `queued`, `active`, and `completed` events (with final extraction payload).

### 3. Save Medicines Batch
- **Endpoint**: `POST /api/medicines/batch`
- **Description**: Confirms and saves reviewed medicine extraction results.
- **Request Body**:
  ```json
  {
    "patient_id": "patient-uuid-v4",
    "medicines": [
      {
        "brand_name": "Lipitor",
        "generic_name": "atorvastatin",
        "dosage": "10mg",
        "frequency": "Once daily",
        "duration_text": "30 days"
      }
    ]
  }
  ```

### 4. Batch Delete Medicines
- **Endpoint**: `POST /api/medicines/batch-delete`
- **Description**: Deletes multiple active medicines at once.
- **Request Body**:
  ```json
  {
    "ids": ["medicine-uuid-1", "medicine-uuid-2"]
  }
  ```

### 5. Check Active Medicine List
- **Endpoint**: `GET /api/medicines`
- **Query Parameters**: `patient_id` (string)

---

## Lab Reports & Norm Endpoints (`/lab-reports`)

### 1. Confirm Lab Report
- **Endpoint**: `POST /api/lab-reports/confirm`
- **Description**: Saves parsed lab values and calculates trend comparisons.
- **Request Body**:
  ```json
  {
    "patient_id": "patient-uuid-v4",
    "panel_name": "Complete Glycation Panel",
    "values": [
      {
        "test_type": "HbA1c",
        "value": 7.2,
        "unit": "%",
        "ref_range": "4.0 - 5.6"
      }
    ]
  }
  ```

### 2. Get Lab reports
- **Endpoint**: `GET /api/lab-reports`
- **Query Parameters**: `patient_id`

---

## Clinical Alerts & Briefs Endpoints (`/alerts`, `/briefs`)

### 1. Get Drug Alerts
- **Endpoint**: `GET /api/alerts`
- **Query Parameters**: `patient_id`

### 2. Generate Visit Prep Brief
- **Endpoint**: `POST /api/briefs`
- **Description**: Compiles a visit brief based on active medicines, safety warnings, and lab value trends.
- **Request Body**:
  ```json
  {
    "patient_id": "patient-uuid-v4",
    "visit_date": "2026-07-20"
  }
  ```

### 3. Get Visit Prep Briefs
- **Endpoint**: `GET /api/briefs`
- **Query Parameters**: `patient_id`

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
    "consentGranted": true
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
        "id": "1",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "role": "patient",
        "isEmailVerified": true
      }
    }
  }
  ```

### 2. Login User
- **Endpoint**: `POST /auth/login`
- **Description**: Authenticates a user and returns a signed JWT.
- **Request Body**:
  ```json
  {
    "email": "john.doe@example.com",
    "password": "securePassword123!"
  }
  ```
- **Response**: Same as registration (or returns `requiresMfa: true` and `mfaToken` if 2FA is pending).

### 3. Refresh Access Token
- **Endpoint**: `POST /auth/refresh`
- **Description**: Rotates the refresh token and issues a new access + refresh token pair.
- **Request Body**:
  ```json
  {
    "refreshToken": "JWT_REFRESH_TOKEN_STRING"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "NEW_JWT_ACCESS_TOKEN_STRING",
      "refreshToken": "NEW_JWT_REFRESH_TOKEN_STRING"
    }
  }
  ```

### 4. Logout / Revoke Token
- **Endpoint**: `POST /auth/logout`
- **Description**: Explicitly revokes the refresh token on the server side.
- **Request Body**:
  ```json
  {
    "refreshToken": "JWT_REFRESH_TOKEN_STRING"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Logged out successfully."
    }
  }
  ```

---

## Regimen & Prescription Endpoints (`/medicines`, `/prescriptions`)

### 1. Upload Prescription
- **Endpoint**: `POST /prescriptions/upload`
- **Description**: Uploads a prescription image/PDF to extract regimen information.
- **Request Parameters**: Multipart form data with a `prescription` file and optional `patient_id`.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "extracted_data": {
        "brand_name": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "Three times daily",
        "duration_text": "7 days",
        "visit_type": "general",
        "course_end_date": "2026-07-22"
      }
    }
  }
  ```

### 2. Retrieve Medicines List
- **Endpoint**: `GET /medicines`
- **Query Parameters**: `patient_id` (string)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "1",
        "brand_name": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "Three times daily",
        "status": "active",
        "course_end_date": "2026-07-22"
      }
    ]
  }
  ```

### 3. Update Medicine Status
- **Endpoint**: `PUT /medicines/:id/status`
- **Request Body**:
  ```json
  {
    "status": "active" | "discontinued"
  }
  ```
- **Response**:
  ```json
  {
    "success": true
  }
  ```

---

## Clinical Alerts & Timeline Endpoints (`/alerts`, `/calendar`, `/appointments`)

### 1. Retrieve Active Alerts
- **Endpoint**: `GET /alerts`
- **Query Parameters**: `patient_id` (string)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "1",
        "severity": "monitor_closely",
        "trigger_cause": "Amoxicillin and Ibuprofen interaction",
        "status": "shown",
        "created_at": "2026-07-14T12:00:00Z"
      }
    ]
  }
  ```

### 2. Acknowledge Alert
- **Endpoint**: `PUT /alerts/:id/acknowledge`
- **Response**:
  ```json
  {
    "success": true
  }
  ```

### 3. Retrieve Calendar Timeline
- **Endpoint**: `GET /calendar`
- **Query Parameters**: `patient_id` (string)
- **Response**: Returns merged appointments and course-end timeline actions.

### 4. Book Appointment
- **Endpoint**: `POST /appointments`
- **Request Body**:
  ```json
  {
    "patient_id": "1",
    "doctor_name": "Dr. Sarah Smith",
    "visit_type": "general",
    "scheduled_date": "2026-07-20T14:30:00Z",
    "notes": "Follow-up consultation"
  }
  ```
- **Response**:
  ```json
  {
    "success": true
  }
  ```

### 5. Generate Visit Prep Brief
- **Endpoint**: `GET /visits/:id/brief`
- **Description**: Generates or retrieves a cached clinical prep brief for the given visit. Pass `?regenerate=true` to bypass cache.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "brief": {
        "id": "brief-uuid-string",
        "patient_id": "patient-uuid-string",
        "visit_id": "visit-uuid-string",
        "content": {
          "visit_type": "Cardiology",
          "generated_at": "2026-07-16T21:37:34.000Z",
          "active_medicines": [
            "Glycomet 500mg (Metformin) — 500mg, Twice daily after meals",
            "Coumadin 5mg (Warfarin) — 5mg, Once daily at bedtime"
          ],
          "warnings": [],
          "lab_trends": [
            "📈 HbA1c: 7.2 → 7.6 %",
            "📈 Creatinine: 1.1 → 1.5 mg/dL"
          ],
          "suggested_questions": [
            "My HbA1c and Creatinine values have been rising — what could be causing this?"
          ],
          "disclaimer": "Discuss this with your doctor — this is not a diagnosis."
        }
      },
      "cached": false
    }
  }
  ```

---

## Consent & Privacy Endpoints (`/consent`)

### 1. Get Consent Settings
- **Endpoint**: `GET /consent`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "consentGranted": true
    }
  }
  ```

### 2. Update Consent Settings
- **Endpoint**: `PUT /consent`
- **Request Body**:
  ```json
  {
    "consentGranted": false
  }
  ```
- **Response**: Same as GET.

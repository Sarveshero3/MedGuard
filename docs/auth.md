# MedGuard Authentication, Security, and Rate Limiting Reference

This document details the security model, authentication flows, rate limiters, and infrastructural lock-downs implemented across the MedGuard ecosystem.

---

## Authentication & Authorization Model

MedGuard uses a token-based authentication scheme utilizing JSON Web Tokens (JWT) to secure client-server communication.

### 1. JWT Structure and Claims
Upon successful login or registration, the backend signs a JWT with the following payload claims:
- `sub` / `userId`: Unique database ID of the user.
- `email`: Registered email address of the user.
- `role`: Role of the user (`patient` or `caregiver`).
- `name`: Full name of the user (e.g. for greetings).

### 2. Token Lifecycle & Rotation
- Access tokens (`accessToken`) are short-lived JWTs valid for **15 minutes** (configured via `JWT_ACCESS_TTL`). They contain the user claims (`sub`, `userId`, `email`, `role`, `name`).
- Refresh tokens (`refreshToken`) are long-lived JWTs valid for **7 days** (configured via `JWT_REFRESH_TTL`) and contain only minimal claims (`userId` and a unique `jti`).
- Refresh tokens are stored securely on the client in `localStorage` as `medguard_refresh_token`. The SHA-256 hash of the refresh token is stored in the database.
- **Token Rotation**: On each `/auth/refresh` request, the server revokes the old refresh token (`revoked_at = NOW()`) and issues a new access token and a rotated refresh token. This uses database transactions with `FOR UPDATE` locking to prevent race conditions.
- **Shared Interceptor**: The frontend `api.js` client wraps refresh requests in a shared in-flight promise to prevent concurrent 401s from triggering multiple racing refresh requests.
- On logout, a call to `/auth/logout` explicitly revokes the refresh token on the server side.

### 3. Two-Step MFA Login (Gmail-Style 2FA)
- Logging in triggers a verification flow where the user must supply a 6-digit one-time passcode (OTP).
- The code is dispatched via AWS SES (or logged to the backend console in development mock mode) with a 5-minute expiry.
- A "Resend Code" utility allows the user to re-trigger OTP dispatch directly from the login screen without losing form states.
- 401 Unauthorized responses on MFA routes are bypassed by Axios interceptors to prevent page-reload resets.

### 4. Caregiver-Patient OTP Linking (Single-Use Guarantee)
- Caregivers link to patients by inputting a patient's unique `linking_otp` code during registration.
- Once registered, the caregiver-patient association is written to `caregiver_links` with status `active` and the patient's `linking_otp` is immediately cleared (invalidated) to guarantee single-use.

### 5. Role-Based Access Control (RBAC)
- Routes are gated depending on user roles:
  - **Caregivers** are allowed to switch contexts, view linked patient statistics, and read regimen entries in a clinical, read-only mode.
  - **Patients** have access to upload prescriptions, edit metadata, and modify calendar visits.
  - Caregiver access to patient data is strictly validated against links configured in the caregiver-link mapping table.

---

## Rate Limiting & Abuse Prevention

The system uses `express-rate-limit` handlers to mitigate brute-force and Denial-of-Service (DoS) abuse:

### 1. Configured Limiters (`src/middleware/rateLimiter.js`)
- **API Limiter (`apiLimiter`)**: Max 100 requests per 15 minutes per IP.
- **Authentication Limiter (`authLimiter`)**: Max 5 login/MFA verification attempts per 15 minutes per IP.
- **Registration Limiter (`registerLimiter`)**: Max 3 account registrations per hour per IP.
- **Upload Limiter (`uploadLimiter`)**: Max 5 document uploads per 10 minutes per IP.

### 2. Implementation & Production Enforcement
- Rate limits are fully enabled in both development and production. Violations log `RATE_LIMIT_EXCEEDED` warnings via the system logger and return a standardized `429 Too Many Requests` JSON response.

---

## Security Hardening & Defenses

MedGuard implements strict defensive patterns to satisfy clinical security guidelines:

### 1. Insecure Direct Object Reference (IDOR) Protection
- Database queries do NOT rely solely on client-supplied route variables (like `patient_id` or `id`).
- Authorization middleware validates that the authenticated `req.user.id` matches the owner of the resource being requested (e.g. medicines, calendar, or privacy).

### 2. Email-Gated Actions
- Privileged operations (like uploading prescriptions or writing data) check if the user's `isEmailVerified` flag is `true`.
- Unverified accounts are restricted to basic dashboard reading.

### 3. Database Port Lockdown
- PostgreSQL is restricted to listen strictly on `127.0.0.1` and internal docker network interfaces, preventing external port scanning or unauthorized connections from the public Internet.

### 4. NGINX Content Security Policy (CSP)
- The reverse proxy configures strict headers to block Cross-Site Scripting (XSS) and Clickjacking:
  - `Content-Security-Policy`: Restricts scripts, frames, and style sources to trusted origins only.
  - `X-Frame-Options: DENY`: Prevents rendering MedGuard inside external frames.
  - `X-Content-Type-Options: nosniff`: Mitigates mime-type sniffing.

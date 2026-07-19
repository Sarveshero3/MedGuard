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
- The code is dispatched via **AWS SES** in production (using `sendEmail()` from `src/utils/email.js`) or logged to the backend console in development mode.
- **SES Sandbox limitation**: As of July 2025, the AWS SES account is in Sandbox mode (support case ID 178446489800777 pending). Until production access is approved, SES only delivers to email addresses manually verified in the SES console (ap-south-1 region). Sandbox rejection errors are logged distinctly as `EMAIL_SEND_FAILED` with `isSandboxRejection: true`.
- Email send failures are caught and logged but do **not** crash the auth endpoint — the user still receives their MFA token and can use the "Resend Code" button.
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

### 6. Server-Side reCAPTCHA v3 Verification
- Both `/auth/login` and `/auth/register` verify the client-supplied `recaptchaToken` against Google's `siteverify` API before processing business logic.
- Verification is performed by `src/utils/recaptcha.js`, which:
  - POSTs the token + `RECAPTCHA_SECRET_KEY` (from env) to `https://www.google.com/recaptcha/api/siteverify`
  - Rejects if `success` is `false` or `score < 0.5` (configurable threshold)
  - Logs action mismatches as warnings but does not reject on mismatch alone
- Verification can be bypassed in development by setting `RECAPTCHA_ENABLED=false` in the environment.
- The frontend (`Login.jsx`) no longer silently falls back to a fake `'mock_token'` — if the reCAPTCHA provider fails to initialize, form submission is blocked with a user-facing error message.
- The reCAPTCHA site key is read from `VITE_RECAPTCHA_SITE_KEY` (with a hardcoded fallback) in `main.jsx`. Since Vite bakes `VITE_`-prefixed vars at build time, any key change requires a fresh production build/deploy (Vercel redeploy).

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

## Email Dispatch (`src/utils/email.js`)

The `sendEmail({ to, subject, body })` utility handles all outbound emails across the application:

- **Development/Test**: Logs the email content to the console (mock mode) — no actual email sent.
- **Production**: Sends via AWS SES (`@aws-sdk/client-ses` SDK v3) using `SendEmailCommand`.
  - Required env vars: `AWS_SES_REGION`, `AWS_SES_FROM_ADDRESS`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - Sending identity: `noreply@medguard.living` (DKIM-verified)
  - **Sandbox limitation**: See section 3 above. Sandbox rejection errors (`MessageRejected`) are logged distinctly with the support case ID for easy diagnosis.

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


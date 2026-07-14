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

### 2. Token Lifecycle
- Tokens are stored in the client's `localStorage` as `medguard_token`.
- An Axios interceptor automatically appends this token in the `Authorization: Bearer <token>` header of every outgoing `/api` call.
- On the server, `ms1-core-api/src/middleware/auth.js` intercepts, validates the signature, decodes the claims, queries the database to confirm user existence, and populates `req.user`.

### 3. Role-Based Access Control (RBAC)
Routes are gated depending on user roles:
- **Caregivers** are allowed to switch contexts, view linked patient statistics, and read regimen entries in a clinical, read-only mode.
- **Patients** have access to upload prescriptions, edit metadata, and modify calendar visits.
- Caregiver access to patient data is strictly validated against links configured in the caregiver-link mapping table.

---

## Rate Limiting & Abuse Prevention

The system uses `express-rate-limit` handlers to mitigate brute-force and Denial-of-Service (DoS) abuse:

### 1. Configured Limiters (`src/middleware/rateLimiter.js`)
- **Authentication Limiter**: Restricts `/api/auth/login` and `/api/auth/register` to a maximum of 5 requests per 15-minute window per IP.
- **Upload Limiter**: Restricts prescription uploads to 10 files per hour.
- **General API Limiter**: Applies a global threshold of 100 requests per 15-minute window.

### 2. Development/Testing Pass-Through
- To facilitate fluid user registration and testing, rate limiting is currently bypassed via pass-through middleware in `rateLimiter.js` which immediately invokes `next()`.
- **Production Enablement**: Simply restore the respective rate limit middleware exports to lock down these routes.

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

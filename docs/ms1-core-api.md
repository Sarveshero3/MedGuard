# ms1-core-api Service Details

The `ms1-core-api` service manages the application state, databases, authentication, and background worker queues. It is written in Node.js using Express.

---

## 1. Configurations (`src/config/`)

- **[db.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/config/db.js)**:
  - Establishes connection pools to PostgreSQL using the `pg` library.
  - Exposes a `query()` utility for parameterizing queries and a `testConnection()` function that runs at startup to verify database health.
  - Connection pool limits are configured via `DB_POOL_MAX` (defaults to 20 connections) to support high concurrent transactions.
- **[redis.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/config/redis.js)**:
  - Connects to the Redis cache cluster via the `ioredis` library.
  - Serves as the message broker for BullMQ worker queues and stores API rate limiter states.
  - Automatically falls back to an in-memory mock client if `REDIS_URL` is omitted, making local development functional without running Redis.

---

## 2. Security & Guard Middleware (`src/middleware/`)

- **[auth.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/auth.js)**:
  - `authenticateUser`: Inspects incoming requests for a `Bearer` JWT token in the `Authorization` header, decodes it, and binds `req.user` context.
  - `enforcePatientAccess`: Handles ownership verification (IDOR protection) by checking if `patient_id` matches the token user ID, or if the token belongs to an actively linked caregiver.
  - `enforceEmailVerified`: Blocks modifying actions (saving medications, uploading files) if the user's `is_email_verified` flag is false in the database.
- **[consent.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/consent.js)**:
  - Verifies that the patient has recorded consent choices (specifically `health_data_processing`) in the database before routing requests to handle clinical data.
- **[security.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/security.js)**:
  - Sanitizes user input to prevent Cross-Site Scripting (XSS) by escaping special characters.
  - Configures `multer` disk storage to handle file uploads: limits sizes to 8MB, limits file count to 1 per request, restricts types to JPEG/PNG/PDF, and renames files using secure UUIDs.
- **[rateLimiter.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/rateLimiter.js)**:
  - Enforces IP-based request limits using `express-rate-limit`. Applies specific bounds: auth endpoints limit to 5 per 15 minutes, document uploads limit to 5 per 10 minutes.

---

## 3. Workflow Services (`src/services/`)

- **[queueService.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/services/queueService.js)**:
  - Configures BullMQ `Queue` and `Worker` instances for background tasks.
  - Handles the `extract` queue worker: dispatches multipart form data containing document files to the Python AI service, unlinks the local file from disk after completion, and publishes progress logs.
  - Handles the `research` queue worker: triggers background internet research for drug interactions and saves findings to the clinical knowledge base.
  - Manages the `sseClients` Map to handle active server-sent event connections.

---

## 4. API Endpoints (`src/routes/`)

- **[auth.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/auth.js)**:
  - Handles `/auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/resend-verification`, and `/auth/refresh` token rotation.
- **[medicines.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/medicines.js)**:
  - Handles medication operations. When saving medications manually or confirming extraction:
    - Wraps queries in a transaction (`BEGIN` / `COMMIT`).
    - Uses `SELECT ... FOR UPDATE` to lock existing patient medications, preventing concurrent insertion race conditions.
  - Dispatches interaction alerts via AWS SES if interactions are found.
- **[labReports.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/labReports.js)**:
  - Manages lab report uploads and confirms values parsed by the AI.
- **[alerts.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/alerts.js)**:
  - Serves safety warning lists and records patient/caregiver acknowledgments.
- **[calendar.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/calendar.js)**:
  - Merges active medication end dates and user appointments into a unified chronological calendar.
- **[caregivers.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/caregivers.js)**:
  - Generates single-use caregiver link codes and verifies caregiver linkages.

---

## 5. Core Utilities (`src/utils/`)

- **[interactionEngine.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/interactionEngine.js)**:
  - Core module that queries the `interaction_kb` database table using sorted generic names to determine if a combination of drugs has a known interaction.
- **[trendCalculator.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/trendCalculator.js)**:
  - Compares lab values against historical measurements.
- **[email.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/email.js)**:
  - Integrates with AWS SES client SDK (`@aws-sdk/client-ses`) to send transactional emails. Logs emails to the console in development/testing modes.

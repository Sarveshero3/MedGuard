# MedGuard ms1-core-api Service Documentation

The `ms1-core-api` is the central Node.js Express service for MedGuard. It coordinates authentication, stores patient profiles, manages clinical consent, manages doctor visits/calendars, tracks medication records and lab reports, runs background processing jobs via BullMQ (Redis), and routes extraction/analysis to the AI agent service `ms2-agent-service`.

---

## General Architectural Flow

1. **Client Request Routing**: The React frontend makes API calls starting with `/api` which are reverse-proxied by Nginx to the `ms1-core-api` service on port 4000.
2. **Security & Validation Middleware**: Requests pass through security headers, CORS, body size limits, rate limiting (`rateLimiter.js`), authentication verification (`auth.js`), input sanitization, and consent verification (`consent.js`).
3. **Primary Databases**:
   - **PostgreSQL**: Stores persistent application state, including patient information, login credentials, caregiver links, doctor visits, clinical consent choices, medication records, lab values, and interaction alerts.
   - **Redis**: Acts as the message broker for BullMQ job queues and stores cache keys for API rate limits and idempotency check mappings.
4. **Asynchronous Jobs**:
   - For file uploads, the file is temporarily written locally, validated for mimetype/hash, mapped for idempotency, and enqueued into a BullMQ worker queue (`queueService.js`).
   - The queue worker picks up the job, dispatches extraction requests to `ms2-agent-service` (`visionService.js`), and broadcasts real-time execution status streams directly to the frontend via Server-Sent Events (SSE) `/api/status/stream/:jobId`.

---

## Directory Structure & Important Files

### `src/config/`
Configuration for datastores and database pools.
- **[db.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/config/db.js)**: Configures and exports the PostgreSQL connection pool using pg. Contains connection checks.
- **[redis.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/config/redis.js)**: Configures and exports the Redis connection client. Supports in-memory mocking fallback mode if Redis is down.

### `src/middleware/`
Request-intercepting guards enforcing validation, auth, rate limiting, and compliance.
- **[auth.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/auth.js)**: Verifies user JWT tokens, verifies caregiver patient-access roles, and verifies that the patient email is verified.
- **[consent.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/consent.js)**: Ensures the user has active consent records in the database before routing requests to process their clinical/health details.
- **[security.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/security.js)**: Handles input sanitization, UUID structure validation, body schema validation, and configures the Multer file upload storage (supporting JPEG, PNG, and PDF).
- **[rateLimiter.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/rateLimiter.js)**: Enforces IP-based express rate limits for standard API and upload endpoints to protect against brute-force or abuse.
- **[errorHandler.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/middleware/errorHandler.js)**: Catch-all express route middleware that logs unexpected errors and formats response payloads into standard clean API error objects.

### `src/services/`
Core workflow handlers bridging data routing between databases, workers, and external microservices.
- **[queueService.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/services/queueService.js)**: Declares the BullMQ extraction queue, instantiates background workers, performs file unlinking, and tracks the active `sseClients` stream connections mapped to active Job IDs.
- **[visionService.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/services/visionService.js)**: Connects node processing to `ms2` microservice endpoints, sending files inside `FormData` HTTP POST streams for automated document type classification and detail extraction.

### `src/routes/`
REST endpoints defining business processes.
- **[auth.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/auth.js)**: Handles registration, user login, MFA code verification, and JWT session generation.
- **[medicines.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/medicines.js)**: Handles adding/updating/deleting medications, drug interaction lookups, and unified file upload parsing (`POST /api/documents/upload`).
- **[labReports.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/labReports.js)**: Handles retrieving, adding, and saving lab reports and their associated lab values.
- **[alerts.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/alerts.js)**: Serves clinical safety alerts (drug interactions) and handles user/caregiver acknowledgement actions.
- **[calendar.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/calendar.js)**: Manages patient schedule tracking for physician visits.
- **[caregivers.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/caregivers.js)**: Manages link verification and invitations between patients and caregivers.
- **[consent.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/consent.js)**: Manages recording patient clinical consent options.
- **[jobs.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/jobs.js)**: Hosts the Server-Sent Events `/api/status/stream/:jobId` streaming endpoint.
- **[health.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/routes/health.js)**: Heartbeat ping endpoint checking PostgreSQL connection health.

### `src/utils/`
- **[interactionEngine.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/interactionEngine.js)**: Resolves drug interaction checks by query-matching active generics against database records in `interaction_kb`.
- **[trendCalculator.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/trendCalculator.js)**: Computes historical clinical lab result trend changes.
- **[testNormalizer.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/testNormalizer.js)**: Helper mapping user-input test labels to database canonical standards (e.g., TSH, HbA1c).
- **[email.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/email.js)**: Log-mocked email sender interface for MFA and safety alerts.
- **[logger.js](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms1-core-api/src/utils/logger.js)**: Standardized logger outputting to console and tracking audit actions.

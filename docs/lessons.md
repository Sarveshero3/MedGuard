# MedGuard Lessons Learned

## Milestone 1

### What went well
- Skills directory provides structured agent expertise for each domain (Docker, React, FastAPI, etc.)
- Schema-first approach ensures all services agree on data contracts before writing code
- Mermaid diagrams in architecture docs make system flows immediately understandable

### What to watch for
- **Docker Compose networking**: The `backend` network is marked `internal: true` — this means ms1 must be on _both_ networks (frontend-net and backend) to bridge the gap
- **Append-only triggers**: The `prevent_mutation()` trigger will block migrations that try to UPDATE reference tables — always INSERT new versioned rows instead
- **JWT in localStorage**: Current approach stores JWT in localStorage for simplicity. For production, consider httpOnly cookies to prevent XSS token theft
- **CORS on ms2**: Currently allows all origins because it's internal-only. If ms2 is ever exposed, lock this down immediately

---

## Milestone 2 (Visual Polish & Layout State)

### What went well
- **Persistent Navbar State via React Router Layouts**: Moving `<MgNavbar />` into a persistent route wrapper (`Layout.jsx`) instead of instantiating it inside every single page component allows React to maintain navbar state across route changes. This enables smooth CSS transitions for the sliding tab indicator without unmount/remount glitches.
- **Strict Styling for Native Elements**: Buttons and anchors have browser-default appearances (rigid square borders, underlines) that can break modern designs. Explicit utility classes like `no-underline`, `border border-slate-200`, and `rounded-full` ensure clean design integration.

### What to watch for
- **Global Typography Specificity**: Global stylesheet overrides on generic tags (like `h2`) have high specificity and can easily break local Tailwind sizing classes (`text-xs`). Shift generic card subheadings to alternative tags (like `h4` or `div`) to allow local utility overrides to take effect.
- **In-Memory Seed Resetting**: Restarts of development servers (e.g. nodemon) reset transient mock database seeds. Direct routing checks need robust redirect fallback protections to handle session token expirations gracefully.

---

## Milestone 2+ (Deployment Hardening Pass)

### What went well
- **Dual-Token Refresh Flow**: Short-lived access tokens (15 minutes) coupled with longer-lived refresh tokens (7 days) provide optimal security. Tracking the SHA-256 hash of refresh tokens in the database allows server-side revocation on logout.
- **Shared Interceptor Promises**: Standardizing frontend API calls with a module-level `refreshTokenPromise` ensures multiple concurrent 401s do not trigger racing refresh requests, which would fail due to token rotation.
- **Transaction-Safe Concurrency**: Locking rows with `SELECT ... FOR UPDATE` inside Postgres transactions (`BEGIN`/`COMMIT`) protects patient medicine modifications against race conditions during concurrent prescription confirmations.

### What to watch for
- **Side Effect Placement**: Sending emails or triggering background LLM agents must happen *strictly after* transaction commits. Triggering them before `COMMIT` can result in orphan notifications/research tasks if the transaction rolls back due to a constraint or duplicate conflict.
- **AWS SES Configuration**: AWS SES will fail loudly in production if `AWS_SES_REGION` and `AWS_SES_FROM_ADDRESS` are not configured in the host environment. Validating these checks early during boot or invocation prevents silent failure logs.
- **Connection Pool Scaling**: Configurable connection pools via `DB_POOL_MAX` should scale proportionally with application replica instances and expected concurrent transaction lock queues.
- **External API Connection Timeouts (ms2)**: When uploading files for OCR, the Python agent service (`ms2`) calls external NVIDIA AI Foundation endpoints (`integrate.api.nvidia.com`). Transient network latency or slow model generation can exceed the default request timeouts (60s), throwing `requests.exceptions.ReadTimeout`. Unhandled, this crashes the FastAPI endpoint and returns a generic `500 Internal Server Error` to `ms1` and the frontend. Solution: wrap external model calls in an exponential backoff retry loop and handle timeout exceptions cleanly.



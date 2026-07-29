# MedGuard Deep Audit & Cleanup Report

**Date**: July 30, 2026  
**Scope**: Entire Repository (`frontend`, `ms1-core-api`, `ms2-agent-service`, root configuration, `infra`, `scripts`, `docs`, and test suites)

---

## 1. Architectural Issues (LOGGED ONLY)

> [!IMPORTANT]
> The following architectural issues were identified during analysis and logged. In accordance with audit directives, no code modifications were made to target files for architectural issues.

| Issue ID | File Path | Architectural Description | Severity | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ARCH-01** | `ms2-agent-service/app/api/extract.py` | **Safety-Critical Logic Boundary Split**: Brand resolution (`resolve_brand`) and web-search grounding (`_search_web_grounding`) are performed in `ms2-agent-service`, while core drug-drug interaction safety checking lives in `ms1-core-api` (`src/utils/interactionEngine.js`). Suggestions from AI model inference are returned to client prior to human user confirmation. | Architectural | Logged Only |
| **ARCH-02** | `ms1-core-api/src/services/brandResolutionService.js` | **Cache & Database Write Boundary**: `BrandResolutionService` performs database reads/writes (`brand_generic_map`) within `ms1`, but invokes external HTTP requests to `ms2-agent-service` synchronously during resolution attempts. | Architectural | Logged Only |
| **ARCH-03** | `ms2-agent-service/app/services/client.py` | **External AI Service Dependency**: Groq model invocation key rotation relies on environment key parsing and HTTP calls directly from the agent worker nodes. | Architectural | Logged Only |
| **ARCH-04** | `ms1-core-api/src/middleware/auth.js` | **Patient Access Control Scope**: `enforcePatientAccess` permits authorized patient/caregiver roles based on `patient_id` param validation. Caregiver link validation relies on PostgreSQL lookup per request. | Architectural | Logged Only |

---

## 2. Full Issue Log (Fixed vs Logged Only)

| File Path | Description | Severity | Status |
| :--- | :--- | :--- | :--- |
| `ms2-agent-service/app/main.py` | Deprecated `@app.on_event("startup")` / `@app.on_event("shutdown")` used. Replaced with FastAPI `lifespan` context manager. | Minor | **Fixed** |
| `ms2-agent-service/app/main.py` | Startup check blocked process execution on external API failure (`sys.exit(1)`). Refactored to non-blocking warning log. | Major | **Fixed** |
| `ms2-agent-service/app/api/extract.py` | Inline imports (`import re`, `import asyncio`, `import urllib.request`, `from fastapi import HTTPException`) inside endpoint function bodies. Hoisted to top level. | Minor | **Fixed** |
| `ms2-agent-service/app/graphs/prescription_graph.py` | Inline `import re` inside `for` loop in `ocr_vlm_extraction_node`. Hoisted to module level. | Minor | **Fixed** |
| `ms1-core-api/src/index.js` | Database reset `initSqlPath` checked hardcoded `../infra/db/init.sql` relative path. Added fallback resolution for local dev and container paths. | Minor | **Fixed** |
| `frontend/src/services/api.js` | Axio interceptor properly handles single-flight refresh token rotation and immediate 429 rejection. | Minor | Verified / Preserved |
| `ms1-core-api/tests/auth.test.js` | Verified Jest unit test suite covering refresh token rotation and logout revocation. | Minor | Verified / Preserved |
| `ms1-core-api/tests/medicines.test.js` | Verified Jest unit test suite covering transaction locking and email dispatch sequence. | Minor | Verified / Preserved |
| `ms2-agent-service/test_duration_parser.py` | Verified unit test suite covering range duration parsing (`3-5 days` -> `5`). | Minor | Verified / Preserved |

---

## 3. Deleted Legacy & Redundant Artifacts Ledger

Every file and directory deleted was searched across the entire repository using `grep` prior to removal to ensure zero active code references.

| File / Folder Path | Type | Reason for Deletion | Grep Verification Proof |
| :--- | :--- | :--- | :--- |
| `prompt.txt` | File | Superseded task prompt text file. | `grep_search("prompt.txt")` -> **0 matches** |
| `skills.txt` | File | Scratch text file generated during previous prompt step. | `grep_search("skills.txt")` -> **0 matches** |
| `frontend_dev.log` | File | Stale local dev log artifact. | `grep_search("frontend_dev.log")` -> **0 matches** |
| `ms1_dev.log` | File | Stale local dev log artifact. | `grep_search("ms1_dev.log")` -> **0 matches** |
| `ms2_dev.log` | File | Stale local dev log artifact. | `grep_search("ms2_dev.log")` -> **0 matches** |
| `frontend/Scroll_Animation.zip` | File | 17.4MB unreferenced zip archive. | `grep_search("Scroll_Animation.zip")` -> **0 matches** |
| `samples/1 - Copy.png` | File | Duplicate asset file of `1.png`. | `grep_search("1 - Copy.png")` -> **0 matches** |
| `samples/WhatsApp Image 2026-07-17 at 13.06.57 - Copy.jpeg` | File | Duplicate asset file of original sample image. | `grep_search("13.06.57 - Copy.jpeg")` -> **0 matches** |
| `scratch/` | Directory | Temporary scratch directory containing 7 throwaway scripts (`list_models.py`, `migration.sql`, `read_logs.py`, `test_brand.py`, `test_safety.js`, `test_search.py`, `verify_test.js`). | `grep_search("scratch")` -> **0 code matches** (referenced only as temporary directory in `docs/directory_structure.md`) |
| `ms2-agent-service/test_google.py` | File | Hardcoded one-off scratch script scraping Google HTML. | `grep_search("test_google")` -> **0 matches** |
| `ms2-agent-service/test_tavily_grounding.py` | File | Redundant duplicate test script. | `grep_search("test_tavily_grounding")` -> **0 matches** |
| `ms2-agent-service/test_image.jpeg` | File | Unreferenced test image in service root. | `grep_search("test_image.jpeg")` -> **0 code matches** |
| `ms1-core-api/infra` | Directory | Empty directory inside `ms1-core-api`. | Directory contents -> **Empty** |

---

## 4. Verification & Validation Summary

- **Node.js Core API Unit Tests**: 2 test suites passed, 5 unit tests passed cleanly (`npm test`).
- **Python Agent Service Unit Tests**: Duration parser suite executed cleanly (`python test_duration_parser.py`).
- **Clean Workspace**: All legacy and redundant files safely removed without breaking any build pipelines or imports.

# MedGuard Technical Specification
## Section 10: System Architecture

### 10.1 Components

*   **Frontend (React)**: Handles the patient/caregiver upload flow (prescription or report photo upload → follow-up Q&A → medicine list view / alert timeline / visit-brief screen) and a medicine/appointment calendar view. It communicates exclusively with `ms1`'s public API.
*   **ms1 — Core API (Express.js)**: Manages authentication with two roles (patient, caregiver), patient-caregiver linking and consent, medicine list and alert lifecycle management, visit scheduling/history and the medicine-course calendar, and AWS SES email dispatch. It owns the PostgreSQL database schema and runs the deterministic safety logic.
*   **ms2 — Agent Service (FastAPI + LangGraph)**: Responsible for image preprocessing, the prescription assessment graph (including consensus-based extraction), the lab report extraction/trend graph, and the visit-brief writer graph. It returns structured data and confidence scores to `ms1`. It is strictly internal and never directly executes side-effects like sending emails or storing final database state.
*   **PostgreSQL**: Serves as the system of record. Stores users, caregiver links, medicines, brand-to-generic mappings, interaction flags, lab reports, lab values, visits, briefs, and consent states. Keeps historical medicine entries versioned and never overwritten.
*   **NGINX**: Handles SSL/TLS termination, routing (`/` to the React build, `/api` to `ms1`), large-upload handling, and acts as the secure network boundary keeping `ms2` hidden from external public access.
*   **OpenTelemetry & Jaeger**: Provides end-to-end distributed tracing across the medicine-add and visit-brief pipelines, propagating trace context from the React client to `ms1` and down to `ms2`.

---

### 10.2 Key Flows

#### Medicine-Add Flow

```
Photo upload 
  └─► ms2: vision extraction (consensus check between orchestrator and disambiguation models)
        └─► [If mismatch?] ──► Sets confidence to 0.70 & prompts follow-up Q&A in browser
        └─► [If agreed] ──► Sets confidence >= 0.95 and returns extraction
        └─► [Confirm batch] ──► ms1: resolves brand to generic via ms2 /api/extract/resolve-brand
              ├─► [Cache Hit] ──► Loads mapping directly from brand_generic_map
              └─► [Cache Miss] ──► ms2 LLM + Tavily Search Grounding + Fuzzy pass ──► Saves on user confirmation
        └─► [Safety Evaluation] ──► ms1: deterministic interaction check (new generic vs. active list)
              ├─► [Interaction match] ──► Writes flag + Caregiver Alert email (SES)
              └─► [No match] ──► Saves medicine quietly
```

#### Visit-Prep Flow

```
Lab report photo upload
  └─► ms2: value extraction, consensus check, and visit proximity linking
        └─► ms1: normalizes values (test_type_normalization) and computes historical trends
              └─► On upcoming logged visit:
                    └─► User requests brief:
                          └─► ms2: brief-writer graph drafts brief (active meds + warnings + trends + doctor questions)
                                └─► Deliver brief in-app (printable dashboard view)
```

---

### Core Design Rule

> [!IMPORTANT]
> **Deterministic Logic vs. Probabilistic Extraction**
> The LLM is strictly confined to extracting/structuring data (medicine names, dosages, lab values) and drafting natural language prose (the visit brief).
> Every critical medical determination—such as whether a drug combination is dangerous or whether a lab value has changed significantly—runs as **deterministic, versioned code in ms1**, never as an LLM judgment call. This ensures all alerts are explainable, auditable, and immune to prompt-injection attacks contained within uploaded documents.

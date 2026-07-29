# ms2-agent-service Service Details

The `ms2-agent-service` is a FastAPI Python microservice that executes LangGraph AI workflows to handle clinical information extraction, generic-name resolution, and patient brief generation.

---

## 1. Web Endpoints (`app/api/`)

- **[extract.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/api/extract.py)**:
  - Exposes the primary AI processing endpoints:
    - `/api/extract/document`: Unified document ingestion endpoint. It extracts raw text using `docling` (or falls back to `pypdf` + character-level OCR via the configured `vision_model` if needed), classifies the document as a "prescription" or "lab_report" using the `orchestrator_model`, and routes it to the corresponding LangGraph.
    - `/api/extract/prescription`: Parses prescription text and image data.
    - `/api/extract/lab-report`: Parses laboratory metrics.
    - `/api/extract/resolve-brand`: Authenticated endpoint (requires `x-internal-auth` header) resolving brand names to generic active ingredients/compositions using a 3-tier lookup:
      1. Direct LLM query using the safety-locked `brand_resolution_model`.
      2. Web search grounding fallback via Tavily.
      3. Tier 3 clinical pharmacist OCR/handwriting fuzzy pass.
    - `/api/research-interaction`: Triggers a literature lookup and critique graph to verify interactions for new drug combinations.
    - `/api/visit-brief`: Merges medication lists, alerts, and lab trends to generate doctor-visit prep guides.
    - `/api/chat`: Answers patient questions about prescriptions.
  - All endpoints under `/api/extract/*` are protected by internal request authorization middleware checking the `x-internal-auth` header against `MS2_INTERNAL_SECRET`.
- **[health.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/api/health.py)**:
  - Serves an internal health check endpoint.

---

## 2. Agent Workflows (`app/graphs/`)

- **[prescription_graph.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/graphs/prescription_graph.py)**:
  - Parses prescription structures using LangGraph state chains:
    - Extracts raw text using OCR.
    - Performs consensus matching: runs extraction using both `orchestrator_model` and `disambiguation_model` independently. If they agree, fields are automatically accepted. If there are mismatches, synthetic confidence is lowered to `0.70` and a follow-up question is generated.
    - Links to any existing visits scheduled within ±3 days (`proximity_auto_link_node`).
- **[lab_report_graph.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/graphs/lab_report_graph.py)**:
  - Extracts lab test types, values, and units from reports. Runs consensus checks and proximity visit linking.
- **[critique_research_graph.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/graphs/critique_research_graph.py)**:
  - Performs drug-drug interaction research using the configured `disambiguation_model`.
  - A **Senior Medical Reviewer Agent** evaluates the findings over **up to 2 critique iterations** to verify safety warnings and translate technical jargon into layperson-friendly patient summaries prefixed with `Patient Summary:`.
- **[brief_writer_graph.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/graphs/brief_writer_graph.py)**:
  - Merges active medication records, warnings, and lab value changes.
  - Drafts a single-page doctor visit brief, framing all questions in a neutral, non-diagnostic tone (focused on concern and cause rather than recommending specific dosage changes), and appends a mandatory medical disclaimer.
- **[qa_graph.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/graphs/qa_graph.py)**:
  - Manages conversational context to answer patient questions regarding active prescriptions and drug-safety guidelines.
- **[trend_explainer_graph.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/graphs/trend_explainer_graph.py)**:
  - Explains lab report trends (elevated metrics, healthy parameters) in plain language.

---

## 3. Services (`app/services/`)

- **[client.py](file:///Users/sahil/Desktop/Bootcamp/Hackathon/MedGuard/ms2-agent-service/app/services/client.py)**:
  - Defines the `RateResilientChatOpenAI` wrapper that implements API key rotation across multiple Groq keys (loaded via comma-separated list or direct `.env` parsing) and handles rate limits (429) automatically.

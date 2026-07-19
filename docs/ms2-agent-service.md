# ms2-agent-service Service Details

The `ms2-agent-service` is a FastAPI Python microservice that executes LangGraph AI workflows to handle clinical information extraction, generic-name resolution, and patient brief generation.

---

## 1. Web Endpoints (`app/api/`)

- **[extract.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/api/extract.py)**:
  - Exposes the primary AI processing endpoints:
    - `/api/extract/document`: Parses uploaded files (PDFs or photos). It first uses direct text parsers (`pypdf` for PDFs) or character-level OCR (`NVIDIA Nemotron OCR v2`), classifies the document type using an LLM, and runs the corresponding LangGraph extraction.
    - `/api/extract/prescription`: Parses prescription text and image data.
    - `/api/extract/lab-report`: Parses laboratory metrics.
    - `/api/research-interaction`: Triggers a literature lookup and critique graph to verify interactions for new drug combinations.
    - `/api/visit-brief`: Merges medication lists, alerts, and lab trends to generate doctor-visit prep guides.
    - `/api/chat`: Answers patient questions about prescriptions.
- **[health.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/api/health.py)**:
  - Serves an internal health check endpoint.

---

## 2. Agent Workflows (`app/graphs/`)

- **[prescription_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/prescription_graph.py)**:
  - Parses prescription structures using LangGraph state chains:
    - Extracts raw text using character OCR.
    - Runs a vision LLM (`minimax-m3-preview`) directly on the image.
    - Performs consensus matching: high-agreement fields are automatically accepted; fields with conflicting parse results have their confidence score reduced to trigger a verification question for the user.
    - Maps brand names to generics using database tables passed by `ms1`.
- **[lab_report_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/lab_report_graph.py)**:
  - Extracts lab test types, values, and units from reports. Ensures values match healthy normal ranges and standard canonical test names.
- **[critique_research_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/critique_research_graph.py)**:
  - Conducts internet search queries via Llama 3.1 8B to find peer-reviewed studies regarding drug interactions.
  - A **Senior Medical Reviewer Agent** evaluates the search findings over **1 to 2 critique iterations** to verify safety warnings and translate technical jargon into clear, plain-English patient summaries (prefixed with `Patient Summary:`).
- **[brief_writer_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/brief_writer_graph.py)**:
  - Merges active medication records, warnings, and lab value changes.
  - Drafts a single-page doctor visit brief, framing all questions in a neutral, non-diagnostic tone (focused on concern and cause rather than recommending specific dosage changes), and appends a mandatory medical disclaimer.
- **[qa_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/qa_graph.py)**:
  - Manages conversational context to answer patient questions regarding active prescriptions and drug-safety guidelines.
- **[trend_explainer_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/trend_explainer_graph.py)**:
  - Explains lab report trends (elevated metrics, healthy parameters) in plain language.

---

## 3. Brand & Context Services (`app/services/`)

- **[client.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/services/client.py)**:
  - Wraps model clients and implements retry resilience and fallbacks forvision and text model endpoints.

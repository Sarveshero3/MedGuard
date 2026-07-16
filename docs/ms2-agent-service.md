# MedGuard ms2-agent-service Service Documentation

The `ms2-agent-service` is an internal Python microservice built using FastAPI and LangGraph. It is responsible for AI document extraction, generic-name resolution consensus, drug interaction research loops, doctor visit brief generation, lab report trend explanations, and patient follow-up Q&A.

It communicates with LangChain models (NVIDIA NIM APIs including GLM-5.2, Nemotron OCR v2, and MiniMax M3 Preview).

---

## General Architectural Flow

1. **Extraction Pipeline**:
   - `ms1` enqueues document jobs. The worker reads the file and hits `POST /api/extract/document` on `ms2`.
   - `ms2` extracts raw text from the file (via direct PDF parser `pypdf` or character-level OCR `nvidia/nemotron-ocr-v2`).
   - The document is classified as a `prescription` or `lab_report` using a dedicated LLM prompt (`glm-5.2`).
   - If classification confidence is high, it automatically runs the corresponding extraction graph (`prescription_graph` or `lab_report_graph`).
   - If confidence is low, it returns `needs_classification_confirmation = True` to verify the document type with the patient.
2. **AI Consensus Extraction**:
   - Compares parsing output from a character OCR + Llama-3.1-8B pipeline against direct VLM extraction (`minimax/minimax-m3-preview`).
   - High-agreement fields are accepted; mismatches flag lower confidence (`0.70`) and construct confirmation questions for the patient.
3. **Research & Brief Generation (Senior Medical Reviewer Agent)**:
   - Interaction Research runs literature lookup agents via Llama-3.1-8B.
   - A **Senior Medical Reviewer Agent** acts as a critic, evaluating the generated findings over **1 to 2 refinement iterations** to verify accuracy, drug-class alignment, and clinical safety warnings.
   - This research execution runs asynchronously as a background task, keeping user operations instant while pushing live notifications upon resolution.

---

## Directory Structure & Important Files

### `app/`
- **[main.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/main.py)**: Application entry point. Configures FastAPI, sets up CORS middleware (locked down to core API), registers routes, and triggers startup/shutdown logging.
- **[config.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/config.py)**: Loads configuration from environment variables, establishing defaults for ports, model endpoints, and NVIDIA base URLs.

### `app/api/`
- **[extract.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/api/extract.py)**: Houses FastAPI routes. Implements `/api/extract/document`, `/api/chat`, `/api/explain-trends`, `/api/visit-brief`, and `/api/research-interaction`. Handles writing uploaded files to temporary locations for local reading by nodes.
- **[health.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/api/health.py)**: Hosts the internal health check endpoint.

### `app/graphs/`
LangGraph workflow states executing sequential clinical extraction tasks.
- **[prescription_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/prescription_graph.py)**: Coordinates prescription parsing. Nodes extract text, match OCR/VLM outputs for brand/dosage/frequency consensus, and resolve auto-linking to visits within a 3-day proximity window.
- **[lab_report_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/lab_report_graph.py)**: Manages lab report value extraction. Verifies consensus on test types and values.
- **[critique_research_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/critique_research_graph.py)**: Research loop that looks up interaction details for novel generic combinations and critiques its own references for safety validation.
- **[brief_writer_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/brief_writer_graph.py)**: Drafts structured doctor-visit briefs, formatting medical questions in a neutral, non-diagnostic tone.
- **[qa_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/qa_graph.py)**: Answers patient queries regarding their current active prescriptions and safety alerts.
- **[trend_explainer_graph.py](file:///c:/Users/Sarvesh/Desktop/hackathon/MedGuard/ms2-agent-service/app/graphs/trend_explainer_graph.py)**: Explains laboratory changes (direction, magnitude) in plain text.

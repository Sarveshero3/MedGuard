import json
import shutil
import tempfile
import os
import base64
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Dict, Any
from pypdf import PdfReader
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings
from app.services.retry import invoke_with_retry

from app.graphs import (
    prescription_graph,
    lab_report_graph,
    critique_research_graph,
    brief_writer_graph,
    qa_graph,
    trend_explainer_graph,
)

router = APIRouter()

# ── Pydantic Request Models ───────────────────────────────────


class ChatRequest(BaseModel):
    question: str
    active_medicines: List[Dict[str, Any]] = []
    interaction_flags: List[Dict[str, Any]] = []


class TrendRequest(BaseModel):
    test_type: str
    values: List[float]
    dates: List[str] = []


class BriefRequest(BaseModel):
    active_medicines: List[Dict[str, Any]]
    interaction_flags: List[Dict[str, Any]]
    lab_trends: List[Dict[str, Any]]
    reason_for_visit: str | None = None


class InteractionRequest(BaseModel):
    generic_a: str
    generic_b: str

# ── Endpoints ─────────────────────────────────────────────────


def _extract_text_from_file(file_path: str, filename: str) -> str:
    """Extract raw text from a file. Attempts to use docling if available, falling back to pypdf/ChatNVIDIA VLM."""
    try:
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert(file_path)
        text = result.document.export_to_markdown()
        if text.strip():
            return text.strip()
    except Exception:
        pass

    is_pdf = filename.lower().endswith(".pdf")
    if is_pdf:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                text += page_text + "\n"
            else:
                # Scanned PDF: extract page images and OCR them
                try:
                    for img_file in page.images:
                        img_data = img_file.data
                        img_b64 = base64.b64encode(img_data).decode("utf-8")
                        ocr_client = get_client(settings.vision_model)
                        ocr_response = invoke_with_retry(ocr_client, [
                            SystemMessage(
                                content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
                            HumanMessage(content=[
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                            ])
                        ])
                        ocr_text = ocr_response.content.strip()
                        if ocr_text:
                            text += ocr_text + "\n"
                except Exception as e:
                    print("Failed to run OCR on PDF page image:", e)
        return text.strip()
    else:
        with open(file_path, "rb") as f:
            img_bytes = f.read()
            print(f"Reading file for OCR: {file_path}, size: {len(img_bytes)} bytes", flush=True)
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        # Use the separate vision model for OCR since the orchestrator (glm-5.2) is not a vision model
        ocr_client = get_client(settings.vision_model)
        ocr_response = invoke_with_retry(ocr_client, [
            SystemMessage(
                content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
            HumanMessage(content=[
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
            ])
        ])
        return ocr_response.content.strip()


@router.post("/extract/document")
async def extract_document(
    photo: UploadFile = File(...),
    existing_visits: str = Form("[]")
):
    """
    Unified document extraction endpoint.
    1. Extracts raw text via OCR/pypdf.
    2. Classifies the document as 'prescription' or 'lab_report' with a confidence score.
    3. Routes to the correct extraction graph.
    4. Returns docType, classification_confidence, and extracted data.
       If classification_confidence < 0.80, sets needs_classification_confirmation = True.
    """
    try:
        visits_list = json.loads(existing_visits)
    except Exception:
        visits_list = []

    suffix = os.path.splitext(photo.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        photo.file.seek(0)
        shutil.copyfileobj(photo.file, tmp)
        tmp_path = tmp.name
        print(
            f"Created temp file for document extract: {tmp_path}, size: {os.path.getsize(tmp_path)} bytes", flush=True)

    try:
        # Step 1: Extract raw text
        raw_text = _extract_text_from_file(tmp_path, photo.filename)

        # Step 2: Classify using the orchestrator model
        classifier = get_client(settings.orchestrator_model)
        classify_prompt = """You are a medical document classifier. Given the text extracted from a medical document, classify it as either "prescription" or "lab_report".

A prescription typically contains:
- Doctor/physician name, patient name
- Medicine/drug names, dosages, frequencies
- Directions like "Take twice daily", "After meals"

A lab report typically contains:
- Test names (e.g. HbA1c, TSH, CBC, Lipid Panel)
- Numerical values with units (e.g. 7.2%, 3.4 uIU/mL)
- Reference ranges, panel names

Return ONLY a JSON object with:
- "doc_type": "prescription" or "lab_report"
- "confidence": a float between 0.0 and 1.0 indicating how certain you are
- "reasoning": a brief one-sentence explanation

Do not include markdown formatting. Return only the raw JSON object."""

        classify_res = classifier.invoke([
            SystemMessage(content=classify_prompt),
            HumanMessage(content=f"Document text:\n\n{raw_text[:4000]}")
        ])

        # Parse classification result
        classify_text = classify_res.content.strip()
        if classify_text.startswith("```"):
            lines = classify_text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            classify_text = "\n".join(lines).strip()
        try:
            classification = json.loads(classify_text)
        except Exception:
            start = classify_text.find("{")
            end = classify_text.rfind("}")
            if start != -1 and end != -1:
                try:
                    classification = json.loads(classify_text[start:end + 1])
                except Exception:
                    classification = {"doc_type": "prescription",
                                      "confidence": 0.5, "reasoning": "Parse failed, defaulting"}
            else:
                classification = {"doc_type": "prescription",
                                  "confidence": 0.5, "reasoning": "Parse failed, defaulting"}

        doc_type = classification.get("doc_type", "prescription")
        classification_confidence = float(classification.get("confidence", 0.5))
        needs_confirmation = classification_confidence < 0.80

        # Step 3: Route to the correct graph
        state_input = {
            "photo_path": tmp_path,
            "filename": photo.filename,
            "existing_visits": visits_list,
        }

        if doc_type == "lab_report":
            result = await lab_report_graph.ainvoke(state_input)
        else:
            result = await prescription_graph.ainvoke(state_input)

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    return {
        "success": True,
        "data": {
            "docType": doc_type,
            "classification_confidence": classification_confidence,
            "classification_reasoning": classification.get("reasoning", ""),
            "needs_classification_confirmation": needs_confirmation,
            **result,
        },
    }


@router.post("/extract/prescription")
async def extract_prescription(
    photo: UploadFile = File(...),
    existing_visits: str = Form("[]")
):
    """
    Invokes the Prescription Assessment Graph (OCR+VLM) to parse prescriptions.
    """
    try:
        visits_list = json.loads(existing_visits)
    except Exception:
        visits_list = []

    # Write upload to temporary file to allow local file reads by graph nodes
    suffix = os.path.splitext(photo.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        photo.file.seek(0)
        shutil.copyfileobj(photo.file, tmp)
        tmp_path = tmp.name
        print(
            f"Created temp file for prescription extract: {tmp_path}, size: {os.path.getsize(tmp_path)} bytes", flush=True)

    try:
        state_input = {
            "photo_path": tmp_path,
            "filename": photo.filename,
            "existing_visits": visits_list,
        }
        result = await prescription_graph.ainvoke(state_input)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    return {
        "success": True,
        "data": result,
    }


@router.post("/extract/lab-report")
async def extract_lab_report(
    photo: UploadFile = File(...),
    existing_visits: str = Form("[]")
):
    """
    Invokes the Lab Report Extraction Graph (OCR+VLM) to parse clinical lab results.
    """
    try:
        visits_list = json.loads(existing_visits)
    except Exception:
        visits_list = []

    # Write upload to temporary file to allow local file reads by graph nodes
    suffix = os.path.splitext(photo.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        photo.file.seek(0)
        shutil.copyfileobj(photo.file, tmp)
        tmp_path = tmp.name
        print(
            f"Created temp file for lab report extract: {tmp_path}, "
            f"size: {os.path.getsize(tmp_path)} bytes", flush=True
        )

    try:
        state_input = {
            "photo_path": tmp_path,
            "filename": photo.filename,
            "existing_visits": visits_list,
        }
        result = await lab_report_graph.ainvoke(state_input)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    return {
        "success": True,
        "data": result,
    }


@router.post("/chat")
async def chat_qa(req: ChatRequest):
    """
    Invokes the Q&A graph for non-diagnostic queries.
    """
    state_input = {
        "question": req.question,
        "active_medicines": req.active_medicines,
        "interaction_flags": req.interaction_flags,
    }
    result = await qa_graph.ainvoke(state_input)
    return {
        "success": True,
        "data": result,
    }


@router.post("/explain-trends")
async def explain_trends_route(req: TrendRequest):
    """
    Invokes the Trend Explainer graph for neutral test trends description.
    """
    state_input = {
        "test_type": req.test_type,
        "values": req.values,
        "dates": req.dates,
    }
    result = await trend_explainer_graph.ainvoke(state_input)
    return {
        "success": True,
        "data": result,
    }


@router.post("/visit-brief")
async def visit_brief_route(req: BriefRequest):
    """
    Invokes the Visit-Brief Writer graph to compile physician discussion summaries.
    """
    state_input = {
        "active_medicines": req.active_medicines,
        "interaction_flags": req.interaction_flags,
        "lab_trends": req.lab_trends,
        "reason_for_visit": req.reason_for_visit,
    }
    result = await brief_writer_graph.ainvoke(state_input)
    return {
        "success": True,
        "data": result["brief_output"],
    }


@router.post("/research-interaction")
async def research_interaction_route(req: InteractionRequest):
    """
    Invokes the Critique Interaction Research graph to perform bounded research on drug-drug warnings.
    """
    state_input = {
        "generic_a": req.generic_a,
        "generic_b": req.generic_b,
        "critique_iterations": 0,
        "is_valid": False,
        "explanation": "",
        "research_summary": "",
    }
    result = await critique_research_graph.ainvoke(state_input)
    return {
        "success": True,
        "data": result,
    }

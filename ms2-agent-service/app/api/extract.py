import json
import shutil
import tempfile
import os
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Dict, Any

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
        shutil.copyfileobj(photo.file, tmp)
        tmp_path = tmp.name

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
        shutil.copyfileobj(photo.file, tmp)
        tmp_path = tmp.name

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

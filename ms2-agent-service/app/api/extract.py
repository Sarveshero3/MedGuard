"""
Extraction API — placeholder router for prescription and lab report extraction.
Endpoints will be wired to LangGraph graphs in Milestone 2.
"""

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel

router = APIRouter()


class ExtractionResponse(BaseModel):
    """Structured extraction result from vision model."""
    brand_name: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    prescribing_doctor: str | None = None
    confidence_scores: dict = {}
    needs_follow_up: bool = False
    follow_up_question: str | None = None


@router.post("/extract/prescription")
async def extract_prescription(photo: UploadFile = File(...)):
    """
    Accept a prescription photo and return structured extraction.
    Currently returns a placeholder; will be wired to the
    Prescription Assessment Graph in Milestone 2.
    """
    return {
        "success": True,
        "data": {
            "message": "Extraction endpoint ready — LangGraph integration pending",
            "filename": photo.filename,
            "content_type": photo.content_type,
        },
    }


@router.post("/extract/lab-report")
async def extract_lab_report(photo: UploadFile = File(...)):
    """
    Accept a lab report photo and return extracted values.
    Placeholder for Lab Report Extraction Graph.
    """
    return {
        "success": True,
        "data": {
            "message": "Lab report extraction endpoint ready — LangGraph integration pending",
            "filename": photo.filename,
        },
    }

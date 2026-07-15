from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
import datetime


class PrescriptionState(TypedDict):
    photo_path: str
    filename: str
    existing_visits: List[Dict[str, Any]]
    raw_extraction: Dict[str, Any]
    confidence_scores: Dict[str, float]
    resolution: Dict[str, Any]
    needs_follow_up: bool
    follow_up_question: str | None
    proposed_visit_id: str | None
    visit_link_confidence: float
    needs_visit_link_resolution: bool
    candidate_visits: List[Dict[str, Any]]


def ocr_vlm_extraction_node(state: PrescriptionState) -> Dict[str, Any]:
    # Simulate VLM extraction (or use ChatOpenAI if configured)
    filename = state.get("filename", "").lower()
    is_low = "low" in filename or "unresolved" in filename or "crocin" in filename

    if is_low:
        return {
            "raw_extraction": {
                "brand_name": "Croc1n",
                "dosage": "650mg",
                "frequency": "Three times daily",
                "prescribing_doctor": "Dr. Ramesh Kumar",
                "duration_text": "5 days",
            },
            "confidence_scores": {
                "brand_name": 0.72,
                "dosage": 0.88,
                "frequency": 0.65,
                "prescribing_doctor": 0.92,
            },
            "resolution": {
                "status": "generic_unresolved",
                "generic_name": None,
            },
            "needs_follow_up": True,
            "follow_up_question": "Is the brand name intended to be Crocin?",
        }
    else:
        return {
            "raw_extraction": {
                "brand_name": "Glycomet",
                "dosage": "500mg",
                "frequency": "Once daily",
                "prescribing_doctor": "Dr. Ramesh Kumar",
                "duration_text": "30 days",
            },
            "confidence_scores": {
                "brand_name": 0.96,
                "dosage": 0.95,
                "frequency": 0.92,
                "prescribing_doctor": 0.98,
            },
            "resolution": {
                "status": "resolved",
                "generic_name": "Metformin",
            },
            "needs_follow_up": False,
            "follow_up_question": None,
        }


def proximity_auto_link_node(state: PrescriptionState) -> Dict[str, Any]:
    existing_visits = state.get("existing_visits", [])
    if not existing_visits:
        return {
            "proposed_visit_id": None,
            "visit_link_confidence": 0.0,
            "needs_visit_link_resolution": True,
            "candidate_visits": []
        }

    today = datetime.datetime.now()
    three_days_delta = datetime.timedelta(days=3)

    close_visit = None
    for visit in existing_visits:
        visit_date_str = visit.get("scheduled_date")
        if not visit_date_str:
            continue

        try:
            # Parse ISO date string
            clean_date_str = visit_date_str.replace("Z", "+00:00")
            visit_date = datetime.datetime.fromisoformat(
                clean_date_str).replace(tzinfo=None)
        except ValueError:
            continue

        if abs(today - visit_date) <= three_days_delta:
            close_visit = visit
            break

    if close_visit:
        return {
            "proposed_visit_id": close_visit.get("id"),
            "visit_link_confidence": 0.95,
            "needs_visit_link_resolution": False,
            "candidate_visits": [close_visit]
        }

    return {
        "proposed_visit_id": None,
        "visit_link_confidence": 0.50,
        "needs_visit_link_resolution": True,
        "candidate_visits": existing_visits
    }


# Build workflow graph
workflow = StateGraph(PrescriptionState)
workflow.add_node("ocr_vlm_extraction", ocr_vlm_extraction_node)
workflow.add_node("proximity_auto_link", proximity_auto_link_node)

workflow.set_entry_point("ocr_vlm_extraction")
workflow.add_edge("ocr_vlm_extraction", "proximity_auto_link")
workflow.add_edge("proximity_auto_link", END)

prescription_graph = workflow.compile()

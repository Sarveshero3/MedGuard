from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings
from app.graphs.shared_nodes import parse_json_safely, perform_ocr_extraction, proximity_auto_link_node


class PrescriptionState(TypedDict):
    photo_path: str
    filename: str
    existing_visits: List[Dict[str, Any]]
    raw_extraction: Dict[str, Any]
    confidence_scores: Dict[str, Any]
    resolution: Dict[str, Any]
    needs_follow_up: bool
    follow_up_question: str
    proposed_visit_id: Any
    visit_link_confidence: float
    needs_visit_link_resolution: bool
    candidate_visits: List[Dict[str, Any]]


def ocr_vlm_extraction_node(state: PrescriptionState) -> Dict[str, Any]:
    photo_path = state.get("photo_path", "")
    filename = state.get("filename", "")

    ocr_text = perform_ocr_extraction(photo_path, filename)

    orchestrator = get_client(settings.orchestrator_model)

    prompt = """
    Extract prescribing doctor and all medicines details from the raw OCR text. Return a JSON object with:
    - prescribing_doctor: string or null
    - medicines: a list of objects, each containing:
      - brand_name: string or null
      - dosage: string or null
      - frequency: string or null
      - duration_text: string or null

    Return ONLY the raw JSON object. Do not include markdown code block formatting.
    """

    struct_a_res = orchestrator.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Raw OCR text:\n\n{ocr_text}")
    ])
    structured_a = parse_json_safely(struct_a_res.content)

    disambiguate_client = get_client(settings.disambiguation_model)

    struct_b_res = disambiguate_client.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"Document text:\n\n{ocr_text}")
    ])
    structured_b = parse_json_safely(struct_b_res.content)

    fields = ["brand_name", "dosage", "frequency", "duration_text"]
    mismatch_fields = []

    def clean_str(val):
        if not val:
            return ""
        return str(val).strip().lower().replace(" ", "")

    meds_a = structured_a.get("medicines") or []
    meds_b = structured_b.get("medicines") or []
    if not isinstance(meds_a, list):
        meds_a = [meds_a]
    if not isinstance(meds_b, list):
        meds_b = [meds_b]

    meds_a = [m for m in meds_a if isinstance(m, dict)]
    meds_b = [m for m in meds_b if isinstance(m, dict)]

    if len(meds_a) != len(meds_b):
        mismatch_fields.append("medicines_count")
    else:
        for idx in range(len(meds_b)):
            m_a = meds_a[idx]
            m_b = meds_b[idx]
            for fld in fields:
                val_a = m_a.get(fld)
                val_b = m_b.get(fld)
                if clean_str(val_a) != clean_str(val_b):
                    mismatch_fields.append(fld)

    primary_meds = meds_b if meds_b else meds_a
    raw_medicines = []
    for med in primary_meds:
        brand = med.get("brand_name")
        raw_medicines.append({
            "brand_name": brand,
            "generic_name": None,
            "dosage": med.get("dosage"),
            "frequency": med.get("frequency"),
            "duration_text": med.get("duration_text"),
            "resolution_status": "generic_unresolved"
        })

    if mismatch_fields:
        brands_a = [m.get("brand_name") or "Unknown" for m in meds_a]
        brands_b = [m.get("brand_name") or "Unknown" for m in meds_b]
        follow_up_question = f"Model disagreement detected on {', '.join(set(mismatch_fields))}. Model A extracted '{', '.join(brands_a)}' and Model B extracted '{', '.join(brands_b)}'. Please confirm correct values."

        return {
            "raw_extraction": {
                "prescribing_doctor": structured_b.get("prescribing_doctor") or structured_a.get("prescribing_doctor"),
                "medicines": raw_medicines
            },
            "confidence_scores": {
                "brand_name": 0.70,
                "dosage": 0.70,
                "frequency": 0.70,
                "prescribing_doctor": 0.95,
            },
            "resolution": {
                "status": "generic_unresolved",
                "generic_name": None,
            },
            "needs_follow_up": True,
            "follow_up_question": follow_up_question,
        }
    else:
        return {
            "raw_extraction": {
                "prescribing_doctor": structured_b.get("prescribing_doctor") or structured_a.get("prescribing_doctor"),
                "medicines": raw_medicines
            },
            "confidence_scores": {
                "brand_name": 0.95,
                "dosage": 0.95,
                "frequency": 0.95,
                "prescribing_doctor": 0.98,
            },
            "needs_follow_up": False,
            "follow_up_question": None,
        }


# Build workflow graph
workflow = StateGraph(PrescriptionState)
workflow.add_node("ocr_vlm_extraction", ocr_vlm_extraction_node)
workflow.add_node("proximity_auto_link", proximity_auto_link_node)

workflow.set_entry_point("ocr_vlm_extraction")
workflow.add_edge("ocr_vlm_extraction", "proximity_auto_link")
workflow.add_edge("proximity_auto_link", END)

prescription_graph = workflow.compile()

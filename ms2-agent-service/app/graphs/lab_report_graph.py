from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings
from app.graphs.shared_nodes import parse_json_safely, perform_ocr_extraction, proximity_auto_link_node


class LabReportState(TypedDict):
    photo_path: str
    filename: str
    existing_visits: List[Dict[str, Any]]
    raw_extraction: Dict[str, Any]
    confidence_scores: Dict[str, Any]
    needs_follow_up: bool
    follow_up_question: str
    proposed_visit_id: Any
    visit_link_confidence: float
    needs_visit_link_resolution: bool
    candidate_visits: List[Dict[str, Any]]


def ocr_vlm_lab_extraction_node(state: LabReportState) -> Dict[str, Any]:
    photo_path = state.get("photo_path", "")
    filename = state.get("filename", "")

    ocr_text = perform_ocr_extraction(photo_path, filename)

    orchestrator = get_client(settings.orchestrator_model)

    prompt = """
    Extract laboratory test details from the provided document text or image.
    You must return a JSON object with the following fields:
    - test_type: string (e.g. "HbA1c", "TSH", "LDL") or null
    - value: string (e.g. "7.2", "3.4") or null
    - unit: string (e.g. "%", "uIU/mL") or null
    - panel_name: string (e.g. "Complete Glycation Panel", "Thyroid Profile") or null

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

    fields = ["test_type", "value"]
    mismatch_fields = []

    def clean_str(val):
        if not val:
            return ""
        return str(val).strip().lower().replace(" ", "")

    for fld in fields:
        val_a = structured_a.get(fld)
        val_b = structured_b.get(fld)
        if clean_str(val_a) != clean_str(val_b):
            mismatch_fields.append(fld)

    if mismatch_fields:
        type_a = structured_a.get("test_type") or "Unknown"
        type_b = structured_b.get("test_type") or "Unknown"
        val_a = structured_a.get("value") or "Unknown"
        val_b = structured_b.get("value") or "Unknown"

        follow_up_question = f"Model disagreement detected on {', '.join(mismatch_fields)}. Model A extracted '{type_a}: {val_a}' and Model B extracted '{type_b}: {val_b}'. Please confirm correct values."

        return {
            "raw_extraction": {
                "test_type": structured_b.get("test_type") or structured_a.get("test_type"),
                "value": structured_b.get("value") or structured_a.get("value"),
                "unit": structured_b.get("unit") or structured_a.get("unit"),
                "panel_name": structured_b.get("panel_name") or structured_a.get("panel_name"),
            },
            "confidence_scores": {
                "test_type": 0.70 if "test_type" in mismatch_fields else 0.95,
                "value": 0.70 if "value" in mismatch_fields else 0.95,
                "unit": 0.95,
            },
            "needs_follow_up": True,
            "follow_up_question": follow_up_question,
        }
    else:
        return {
            "raw_extraction": structured_b,
            "confidence_scores": {
                "test_type": 0.96,
                "value": 0.95,
                "unit": 0.98,
            },
            "needs_follow_up": False,
            "follow_up_question": None,
        }


# proximity_auto_link_node is imported from shared_nodes


# Build workflow graph
workflow = StateGraph(LabReportState)
workflow.add_node("ocr_vlm_lab_extraction", ocr_vlm_lab_extraction_node)
workflow.add_node("proximity_auto_link", proximity_auto_link_node)

workflow.set_entry_point("ocr_vlm_lab_extraction")
workflow.add_edge("ocr_vlm_lab_extraction", "proximity_auto_link")
workflow.add_edge("proximity_auto_link", END)

lab_report_graph = workflow.compile()

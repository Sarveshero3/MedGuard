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
    Extract all laboratory test details from the provided document text or image.
    You must return a JSON object with the following fields:
    - panel_name: string (e.g. "Complete Glycation Panel", "Thyroid Profile") or null
    - tests: a list of objects, each containing:
      - test_type: string (e.g. "HbA1c", "Creatinine", "Potassium") or null
      - value: string (e.g. "7.2", "1.1") or null
      - unit: string (e.g. "%", "mg/dL") or null
      - ref_range: string (e.g. "4.0 - 5.6", "0.7 - 1.3") or null

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

    tests_a = structured_a.get("tests") or []
    tests_b = structured_b.get("tests") or []

    if not isinstance(tests_a, list):
        tests_a = [tests_a] if tests_a else []
    if not isinstance(tests_b, list):
        tests_b = [tests_b] if tests_b else []

    tests_a = [t for t in tests_a if isinstance(t, dict)]
    tests_b = [t for t in tests_b if isinstance(t, dict)]

    mismatch_fields = []

    def clean_str(val):
        if not val:
            return ""
        return str(val).strip().lower().replace(" ", "")

    if len(tests_a) != len(tests_b):
        mismatch_fields.append("tests_count")
    else:
        for idx in range(len(tests_b)):
            t_a = tests_a[idx]
            t_b = tests_b[idx]
            for fld in ["test_type", "value"]:
                val_a = t_a.get(fld)
                val_b = t_b.get(fld)
                if clean_str(val_a) != clean_str(val_b):
                    mismatch_fields.append(f"{fld}_at_index_{idx}")

    primary_tests = tests_b if tests_b else tests_a
    raw_tests = []
    for t in primary_tests:
        raw_tests.append({
            "test_type": t.get("test_type"),
            "value": t.get("value"),
            "unit": t.get("unit"),
            "ref_range": t.get("ref_range")
        })

    if mismatch_fields:
        follow_up_question = f"Model disagreement detected on {', '.join(mismatch_fields)}. Model A extracted {len(tests_a)} tests and Model B extracted {len(tests_b)} tests. Please confirm all test values."

        return {
            "raw_extraction": {
                "panel_name": structured_b.get("panel_name") or structured_a.get("panel_name"),
                "tests": raw_tests
            },
            "confidence_scores": {
                "test_type": 0.70,
                "value": 0.70,
                "unit": 0.95
            },
            "needs_follow_up": True,
            "follow_up_question": follow_up_question,
        }
    else:
        return {
            "raw_extraction": {
                "panel_name": structured_b.get("panel_name") or structured_a.get("panel_name"),
                "tests": raw_tests
            },
            "confidence_scores": {
                "test_type": 0.96,
                "value": 0.95,
                "unit": 0.98
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

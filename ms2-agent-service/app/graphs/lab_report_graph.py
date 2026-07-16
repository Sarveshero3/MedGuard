import os
import base64
import json
from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
import datetime
from pypdf import PdfReader
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings

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

def parse_json_safely(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end+1])
            except Exception:
                pass
        return {}

def ocr_vlm_lab_extraction_node(state: LabReportState) -> Dict[str, Any]:
    photo_path = state.get("photo_path", "")
    filename = state.get("filename", "").lower()
    is_pdf = filename.endswith(".pdf")
    
    ocr_text = ""
    try:
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert(photo_path)
        ocr_text = result.document.export_to_markdown().strip()
    except Exception:
        pass

    if not ocr_text:
        if is_pdf:
            reader = PdfReader(photo_path)
            for page in reader.pages:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    ocr_text += page_text + "\n"
                else:
                    # Scanned PDF: extract page images and OCR them
                    try:
                        for img_file in page.images:
                            img_data = img_file.data
                            img_b64 = base64.b64encode(img_data).decode("utf-8")
                            ocr_client = ChatNVIDIA(
                                model=settings.vision_model,
                                api_key=settings.nvidia_api_key,
                                temperature=0.0
                            )
                            ocr_response = ocr_client.invoke([
                                SystemMessage(content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
                                HumanMessage(content=[
                                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                                ])
                            ])
                            ocr_text += ocr_response.content.strip() + "\n"
                    except Exception as e:
                        print("Failed to run OCR on PDF page image in lab report graph:", e)
            ocr_text = ocr_text.strip()
        else:
            with open(photo_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")
            
            ocr_client = ChatNVIDIA(
                model=settings.vision_model,
                api_key=settings.nvidia_api_key,
                temperature=0.0
            )
            ocr_response = ocr_client.invoke([
                SystemMessage(content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
                HumanMessage(content=[
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                ])
            ])
            ocr_text = ocr_response.content.strip()

    orchestrator = ChatNVIDIA(
        model=settings.orchestrator_model,
        api_key=settings.nvidia_api_key,
        temperature=0.0
    )
    
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

    disambiguate_client = ChatNVIDIA(
        model=settings.disambiguation_model,
        api_key=settings.nvidia_api_key,
        temperature=0.0
    )
    
    if is_pdf:
        struct_b_res = disambiguate_client.invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=f"Document text:\n\n{ocr_text}")
        ])
    else:
        with open(photo_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")
        struct_b_res = disambiguate_client.invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=[
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
            ])
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


def proximity_auto_link_node(state: LabReportState) -> Dict[str, Any]:
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
workflow = StateGraph(LabReportState)
workflow.add_node("ocr_vlm_lab_extraction", ocr_vlm_lab_extraction_node)
workflow.add_node("proximity_auto_link", proximity_auto_link_node)

workflow.set_entry_point("ocr_vlm_lab_extraction")
workflow.add_edge("ocr_vlm_lab_extraction", "proximity_auto_link")
workflow.add_edge("proximity_auto_link", END)

lab_report_graph = workflow.compile()

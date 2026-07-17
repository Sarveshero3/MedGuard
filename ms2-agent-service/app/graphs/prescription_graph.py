import os
import base64
import json
from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
import datetime
from pypdf import PdfReader
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings

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

def resolve_brand_to_generic(brand_name: str) -> str | None:
    if not brand_name:
        return None
    try:
        resolver_client = get_client(settings.orchestrator_model)
        resolve_prompt = f"""You are an expert clinical pharmacist. Resolve the commercial medicine brand name "{brand_name}" to its active generic pharmaceutical ingredient (molecule name).
Examples of mapping:
- "Glycomet" -> "Metformin"
- "Crocin" -> "Paracetamol"
- "Amoxil" -> "Amoxicillin"
- "Lipitor" -> "Atorvastatin"

If the brand name is completely unrecognizable, invalid, or cannot be resolved, return "generic_unresolved".
Otherwise, return ONLY the exact generic ingredient name (e.g. "Paracetamol", "Metformin") without any additional text, markdown, or punctuation."""
        
        resolve_res = resolver_client.invoke([
            SystemMessage(content=resolve_prompt),
            HumanMessage(content=f"Brand: {brand_name}")
        ])
        res_content = resolve_res.content.strip()
        if "generic_unresolved" not in res_content.lower() and len(res_content) < 50:
            return res_content
    except Exception:
        pass
    return None


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

def ocr_vlm_extraction_node(state: PrescriptionState) -> Dict[str, Any]:
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
                            ocr_client = get_client(settings.vision_model)
                            ocr_response = ocr_client.invoke([
                                SystemMessage(content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
                                HumanMessage(content=[
                                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                                ])
                            ])
                            ocr_text += ocr_response.content.strip() + "\n"
                    except Exception as e:
                        print("Failed to run OCR on PDF page image in prescription graph:", e)
            ocr_text = ocr_text.strip()
        else:
            with open(photo_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")
            
            ocr_client = get_client(settings.vision_model)
            ocr_response = ocr_client.invoke([
                SystemMessage(content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
                HumanMessage(content=[
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                ])
            ])
            ocr_text = ocr_response.content.strip()

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
    if not isinstance(meds_a, list): meds_a = [meds_a]
    if not isinstance(meds_b, list): meds_b = [meds_b]
    
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
        generic = resolve_brand_to_generic(brand)
        raw_medicines.append({
            "brand_name": brand,
            "generic_name": generic or "generic_unresolved",
            "dosage": med.get("dosage"),
            "frequency": med.get("frequency"),
            "duration_text": med.get("duration_text"),
            "resolution_status": "resolved" if generic else "generic_unresolved"
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
        all_resolved = all(m.get("generic_name") != "generic_unresolved" for m in raw_medicines)
        
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
            "resolution": {
                "status": "resolved" if all_resolved else "generic_unresolved",
                "generic_name": raw_medicines[0].get("generic_name") if len(raw_medicines) == 1 else None,
            },
            "needs_follow_up": not all_resolved,
            "follow_up_question": "Could not map brand name to generic name for one or more medicines. Please verify generic mapping." if not all_resolved else None,
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

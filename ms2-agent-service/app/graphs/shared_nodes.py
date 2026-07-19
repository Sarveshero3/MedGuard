import base64
import json
import logging
import datetime
from typing import Dict, Any
from pypdf import PdfReader
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage
from app.config import settings

logger = logging.getLogger("ms2.shared_nodes")


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
                return json.loads(text[start:end + 1])
            except Exception:
                pass
        return {}


def perform_ocr_extraction(photo_path: str, filename: str) -> str:
    is_pdf = filename.lower().endswith(".pdf")
    ocr_text = ""
    
    # Try docling first
    try:
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert(photo_path)
        ocr_text = result.document.export_to_markdown().strip()
    except Exception as e:
        logger.warning(f"Docling conversion failed, falling back to PDF/VLM OCR: {str(e)}")

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
                                SystemMessage(
                                    content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
                                HumanMessage(content=[
                                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                                ])
                            ])
                            ocr_text += ocr_response.content.strip() + "\n"
                    except Exception as err:
                        logger.error(f"Failed to run OCR on PDF page image: {str(err)}")
                        raise err
            ocr_text = ocr_text.strip()
        else:
            try:
                with open(photo_path, "rb") as f:
                    img_b64 = base64.b64encode(f.read()).decode("utf-8")

                ocr_client = get_client(settings.vision_model)
                ocr_response = ocr_client.invoke([
                    SystemMessage(
                        content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
                    HumanMessage(content=[
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                    ])
                ])
                ocr_text = ocr_response.content.strip()
            except Exception as err:
                logger.error(f"Failed to run OCR on image file: {str(err)}")
                raise err

    return ocr_text


def proximity_auto_link_node(state: Dict[str, Any]) -> Dict[str, Any]:
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

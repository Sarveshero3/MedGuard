import json
import shutil
import tempfile
import logging
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
        import asyncio
        # Step 1: Extract raw text
        raw_text = await asyncio.to_thread(_extract_text_from_file, tmp_path, photo.filename)

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

        classify_res = await asyncio.to_thread(classifier.invoke, [
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

    except Exception as e:
        logger.error(f"Error during document extraction: {str(e)}")
        # Check if rate limit error
        error_msg = str(e)
        if "rate_limit" in error_msg.lower() or "429" in error_msg:
            friendly_message = "The AI service is temporarily busy (API Rate Limit). Please wait 1-2 minutes and try again."
        else:
            friendly_message = f"Analysis failed: {error_msg}. You can skip to manual entry."
        
        # Return success=False with friendly error details
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail={"message": friendly_message}
        )

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


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
    try:
        result = await critique_research_graph.ainvoke(state_input)
        return {
            "success": True,
            "data": result,
        }
    except Exception as e:
        logger.error(f"Error researching interaction between '{req.generic_a}' and '{req.generic_b}': {str(e)}")
        # Graceful fallback response to prevent pipeline crash
        return {
            "success": True,
            "data": {
                "generic_a": req.generic_a,
                "generic_b": req.generic_b,
                "severity": "unknown",
                "explanation": "Research could not be completed at this time due to temporary API rate limits or network issues. Please monitor patient symptoms closely.",
                "research_summary": "Fallback generated due to research API exception.",
                "critique_iterations": 0,
                "is_valid": True
            }
        }


class ResolveBrandRequest(BaseModel):
    brand_name: str


logger = logging.getLogger("ms2")

RESOLUTION_METRICS = {
    "resolved": 0,
    "not_found": 0,
    "unresolved_error": 0
}


def clean_brand_name(brand: str) -> str:
    import re
    # Remove common dosage form prefixes (case-insensitive)
    cleaned = re.sub(r'^(tab\b|cap\b|syp\b|tablet\b|capsule\b|syrup\b|inj\b|injection\b|ors\b|dr\b|dtr\b)\.?\s*', '', brand, flags=re.IGNORECASE)
    # Remove strength numbers and parenthetical noise e.g. (1mg), (Electral), (200), (;)
    cleaned = re.sub(r'\s*\([^\)]*\)?', '', cleaned)
    cleaned = re.sub(r'\b\d+(\.\d+)?\s*(mg|g|mcg|ml|l|iu|units?|sachet|tabs?|caps?)\b', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'[\(\[\{\-\:\;\,\.\+\*\/]+$', '', cleaned)
    return cleaned.strip()


async def _search_web_grounding(query: str) -> str:
    """Run one Tavily basic search and format its agent-ready evidence using standard urllib."""
    if not settings.tavily_api_key:
        logger.error("TAVILY_API_KEY is not configured; web grounding is unavailable.")
        return "No results found."

    import urllib.request
    import urllib.parse
    import asyncio

    url = "https://api.tavily.com/search"
    payload = {
        "api_key": settings.tavily_api_key,
        "query": query,
        "search_depth": "basic",
        "include_answer": False,
        "max_results": 5
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    
    try:
        def fetch():
            with urllib.request.urlopen(req, timeout=8.0) as response:
                return json.loads(response.read().decode("utf-8"))
        res_data = await asyncio.to_thread(fetch)
        
        results = res_data.get("results", [])
        evidence = []
        for result in results:
            title = str(result.get("title", "Untitled result")).strip()
            url = str(result.get("url", "")).strip()
            content = str(result.get("content", "")).strip()
            evidence.append(f"Title: {title}\nURL: {url}\nEvidence: {content}")
        return "\n\n".join(evidence) if evidence else "No results found."
    except Exception as exc:
        logger.error(f"Tavily search failed for query '{query}': {exc}")
        return "No results found."


@router.post("/extract/resolve-brand")
async def resolve_brand(req: ResolveBrandRequest):
    """
    Resolves a brand name to its generic ingredient(s) using VLM/LLM research with search engine grounding.
    """
    from app.services.client import get_client
    from langchain_core.messages import SystemMessage, HumanMessage
    
    brand = req.brand_name.strip()
    logger.info(f"Resolving brand: '{brand}'")
    if not brand:
        return {"success": True, "generic_name": "no such medicine found", "exists": False}
        
    client = get_client(settings.brand_resolution_model)
    cleaned_brand = clean_brand_name(brand)
    
    def parse_llm_json(content_str: str) -> dict:
        cleaned = content_str.strip()
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        if start_idx != -1 and end_idx != -1:
            json_str = cleaned[start_idx:end_idx + 1]
            return json.loads(json_str)
        return json.loads(cleaned)

    # 1. Ask LLM directly
    direct_prompt = f"""
    You are a clinical pharmacist assistant. Resolve the active pharmaceutical ingredient (generic name) of the brand medicine name: '{brand}' (Cleaned: '{cleaned_brand}').
    
    Clinical Instructions:
    - Account for OCR typos or spelling variations (e.g. 'Disprn' -> 'aspirin', 'Crocn' -> 'paracetamol').
    - Strip form prefixes like 'Cap', 'Tab', 'Syp' or strength annotations when identifying the core brand.
    - If '{brand}' or '{cleaned_brand}' is a real brand name (or recognizable typo/abbreviation), identify its active generic ingredient(s).
    
    You must answer in a JSON format with exactly two keys:
    1. "generic_name": The lowercase canonical generic name (active ingredient) of this medicine (e.g. "cefixime", "paracetamol", "aspirin", "mebeverine", "racecadotril"). If it's a combination medicine, list the main ingredients separated by " + " (e.g. "ferrous ascorbate + folic acid + zinc"). If there is NO such medicine or it is not a real brand, write "no such medicine found".
    2. "exists": boolean (true if it's a real medicine brand or recognizable typo, false if not).
    
    Example:
    {{
        "generic_name": "cefixime",
        "exists": true
    }}
    """
    
    parsed = {}
    try:
        messages = [
            SystemMessage(content="You are a clinical pharmacist assistant who resolves brand names to their active generic ingredients. Be extremely precise and objective. Return ONLY valid JSON."),
            HumanMessage(content=direct_prompt)
        ]
        response = client.invoke(messages)
        content = response.content.strip()
        logger.info(f"Direct LLM response for '{brand}': {content}")
        
        try:
            parsed = parse_llm_json(content)
        except Exception as parse_err:
            logger.warning(f"Initial JSON parsing failed: {str(parse_err)}. Retrying once with strict instructions.")
            retry_prompt = direct_prompt + "\n\nCRITICAL: Return ONLY valid JSON. Your previous response failed to parse as valid JSON."
            retry_messages = [
                SystemMessage(content="You are a clinical pharmacist assistant. Return ONLY valid JSON."),
                HumanMessage(content=retry_prompt)
            ]
            retry_response = client.invoke(retry_messages)
            retry_content = retry_response.content.strip()
            parsed = parse_llm_json(retry_content)
            
    except Exception as e:
        logger.error(f"Direct LLM resolution call failed: {str(e)}")

    generic_name = parsed.get("generic_name")
    exists = parsed.get("exists", False)
    
    generic_name_str = str(generic_name or "no such medicine found").lower()
    is_confident = (exists is True) and (generic_name_str != "no such medicine found")
    
    # 2. Fallback to Tavily Search Grounding if direct LLM not confident
    if not is_confident:
        search_query_term = cleaned_brand if cleaned_brand else brand
        logger.info(f"Direct LLM was not confident for '{brand}'. Falling back to Tavily search for '{search_query_term}'.")
        query = f"{search_query_term} medicine composition active generic ingredient"
        search_context = await _search_web_grounding(query)
        logger.info(f"Search results context for '{search_query_term}': {search_context}")
        
        search_prompt = f"""
        You are a clinical pharmacist assistant. Resolve the active pharmaceutical ingredient (generic name) of the brand medicine name: '{brand}' (Cleaned: '{cleaned_brand}').
        
        We performed a real-time web search for '{search_query_term} medicine composition active generic ingredient':
        ---
        {search_context}
        ---
        
        Based on the search results and your clinical knowledge, resolve the active generic ingredient of '{brand}'.
        
        You must answer in a JSON format with exactly two keys:
        1. "generic_name": The lowercase canonical generic name (active ingredient) of this medicine (e.g. "cefixime", "aspirin", "racecadotril", "ferrous ascorbate + folic acid + zinc"). If it's a combination medicine, list the main ingredients separated by " + ". If there is NO such medicine, write "no such medicine found".
        2. "exists": boolean (true if it's a real medicine brand, false if not).
        """
        
        try:
            messages = [
                SystemMessage(content="You are a clinical pharmacist assistant using web search grounding to resolve brand names. Return ONLY valid JSON."),
                HumanMessage(content=search_prompt)
            ]
            response = client.invoke(messages)
            content = response.content.strip()
            logger.info(f"Search-grounded LLM response for '{brand}': {content}")
            
            try:
                parsed = parse_llm_json(content)
            except Exception as parse_err:
                logger.warning(f"Search-grounded JSON parsing failed: {str(parse_err)}.")
                retry_prompt = search_prompt + "\n\nCRITICAL: Return ONLY valid JSON."
                retry_messages = [
                    SystemMessage(content="You are a clinical pharmacist assistant. Return ONLY valid JSON."),
                    HumanMessage(content=retry_prompt)
                ]
                retry_response = client.invoke(retry_messages)
                retry_content = retry_response.content.strip()
                parsed = parse_llm_json(retry_content)
                
        except Exception as e:
            logger.error(f"Search-grounded LLM call failed: {str(e)}")
            
        generic_name = parsed.get("generic_name")
        exists = parsed.get("exists", False)
        generic_name_str = str(generic_name or "no such medicine found").lower()

    # 3. Final Fallback: Clinical Pharmacist Handwriting & OCR Typos Pass
    if (generic_name_str == "no such medicine found" or not exists) and cleaned_brand:
        logger.info(f"Exact lookup failed for '{brand}'. Trying Tier 3 OCR/phonetic fuzzy matching pass.")
        fuzzy_prompt = f"""
        You are a senior clinical pharmacist expert in global and Indian pharmaceuticals (1mg, Netmeds, PharmEasy).
        The brand name '{brand}' (Cleaned: '{cleaned_brand}') was extracted from a doctor's handwritten prescription.
        
        It may contain a minor OCR typo, handwriting misreading, or regional trade brand variant.
        Identify the most probable active generic ingredient(s) or composition for this prescription medication.
        
        Example matches:
        - "Zugut XT" / "Zigut XT" / "Zuvit XT" -> "ferrous ascorbate + folic acid + zinc"
        - "Disprn" -> "aspirin"
        - "Taxim-OF" -> "cefixime + ofloxacin"
        - "Dexarab DSR" -> "dexlansoprazole + domperidone"
        - "Redotil" -> "racecadotril"
        
        Return ONLY a JSON with:
        1. "generic_name": The lowercase generic active ingredient(s) (e.g. "ferrous ascorbate + folic acid + zinc" or "cefixime"). Only return "no such medicine found" if it is completely non-medical gibberish.
        2. "exists": boolean (true if it's a real medicine brand or recognizable typo, false if not).
        """
        try:
            messages = [
                SystemMessage(content="You are an expert clinical pharmacist in prescription brand resolution. Return ONLY valid JSON."),
                HumanMessage(content=fuzzy_prompt)
            ]
            response = client.invoke(messages)
            fuzzy_parsed = parse_llm_json(response.content.strip())
            f_generic = str(fuzzy_parsed.get("generic_name", "")).lower()
            f_exists = fuzzy_parsed.get("exists", False)
            if f_generic and f_generic != "no such medicine found" and f_exists:
                generic_name_str = f_generic
                exists = True
                logger.info(f"Tier 3 OCR/Fuzzy pass successfully resolved '{brand}' -> '{generic_name_str}'")
        except Exception as f_err:
            logger.warning(f"Tier 3 fuzzy resolution pass failed: {f_err}")

    # Final validation & metrics update
    if generic_name_str == "no such medicine found" or not exists:
        final_generic_name = "no such medicine found"
        final_exists = False
        RESOLUTION_METRICS["not_found"] += 1
    else:
        final_generic_name = generic_name_str
        final_exists = True
        RESOLUTION_METRICS["resolved"] += 1
        
    logger.info(f"Final resolution for '{brand}': generic_name='{final_generic_name}', exists={final_exists}")
    logger.info(f"Metrics -> Resolved: {RESOLUTION_METRICS['resolved']}, Not Found: {RESOLUTION_METRICS['not_found']}, Errors: {RESOLUTION_METRICS['unresolved_error']}")
        
    return {
        "success": True,
        "generic_name": final_generic_name,
        "exists": final_exists
    }

from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
import json
from app.config import settings
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage


class BriefWriterState(TypedDict):
    active_medicines: List[Dict[str, Any]]
    interaction_flags: List[Dict[str, Any]]
    lab_trends: List[Dict[str, Any]]
    reason_for_visit: str | None
    brief_output: Dict[str, Any]


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


def write_visit_brief_node(state: BriefWriterState) -> Dict[str, Any]:
    active_meds = state.get("active_medicines", [])
    flags = state.get("interaction_flags", [])
    trends = state.get("lab_trends", [])
    reason = state.get("reason_for_visit", "")

    client = get_client(settings.orchestrator_model)

    prompt = f"""
    You are a clinical preparation assistant. Write a doctor visit preparation brief for a patient.
    
    Reason for Visit: {reason}
    Active Medicines: {json.dumps(active_meds)}
    Interaction Alerts: {json.dumps(flags)}
    Laboratory Trends: {json.dumps(trends)}
    
    Draft a brief in JSON format containing:
    1. "summary": A concise plain-language summary of active medications.
    2. "changes_since_last_visit": A summary of recent changes or safety warnings flagged (such as drug interactions or lab trend shifts).
    3. "questions": Exactly 3 to 4 neutral preparation questions for the patient to ask their doctor.
       CRITICAL SAFETY RULES FOR QUESTIONS:
       - Questions must strictly address concern or cause (e.g. "Is this difference worth being concerned about?", "Why did this trend happen?").
       - Questions must NEVER suggest specific treatment changes (do NOT ask "Should we adjust the dosage?", "Should I stop taking X?", "Should we change my prescription?").
    4. "disclaimer": Must be exactly: "Discuss this with your doctor — this is not a diagnosis."
    
    Return ONLY the raw JSON object. Do not include markdown code block formatting.
    """

    response = client.invoke([
        SystemMessage(
            content="You are a clinical preparation writer. You structure patient briefs with concern-framed, non-actionable questions for their doctor."),
        HumanMessage(content=prompt)
    ])

    parsed = parse_json_safely(response.content)

    questions = parsed.get("questions", [])
    if not isinstance(questions, list) or len(questions) < 3:
        questions = [
            "Are there any precautions I should take when combining my current medicines?",
            "Is the recent change in my lab test values something to be concerned about?",
            "What indicators should we monitor closely before my next appointment?"
        ]

    return {
        "brief_output": {
            "summary": parsed.get("summary") or "Active regimen review complete.",
            "changes_since_last_visit": parsed.get("changes_since_last_visit") or "Regimen review complete.",
            "questions": questions[:4],
            "disclaimer": "Discuss this with your doctor — this is not a diagnosis."
        }
    }


workflow = StateGraph(BriefWriterState)
workflow.add_node("write_brief", write_visit_brief_node)
workflow.set_entry_point("write_brief")
workflow.add_edge("write_brief", END)

brief_writer_graph = workflow.compile()

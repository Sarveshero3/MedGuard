from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
import json
from app.config import settings
from langchain_openai import ChatOpenAI
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
                return json.loads(text[start:end+1])
            except Exception:
                pass
        return {}


def write_visit_brief_node(state: BriefWriterState) -> Dict[str, Any]:
    active_meds = state.get("active_medicines", [])
    flags = state.get("interaction_flags", [])
    trends = state.get("lab_trends", [])
    reason = state.get("reason_for_visit", "")

    # MOCK FALLBACK
    mock_questions = []
    if flags:
        mock_questions.append("Are there any precautions I should take when combining my current medicines?")
    if trends:
        for tr in trends[:2]:
            mock_questions.append(f"My {tr.get('test_type')} was recorded at {tr.get('value')} {tr.get('unit')} — is this within a normal range for me?")
    if len(mock_questions) < 3:
        mock_questions.append("What indicators should we monitor closely before my next appointment?")
    if len(mock_questions) < 3:
        mock_questions.append("What lifestyle or dietary modifications could help support my current vitals?")
    mock_questions = mock_questions[:4]

    mock_brief = {
        "brief_output": {
            "summary": "Current regimen includes: " + ", ".join([f"{m.get('brand_name')} ({m.get('generic_name')})" for m in active_meds]) if active_meds else "No active medicines.",
            "changes_since_last_visit": "Upstream interaction warnings detected." if flags else "No significant changes.",
            "questions": mock_questions,
            "disclaimer": "Discuss this with your doctor — this is not a diagnosis."
        }
    }

    if not settings.nvidia_api_key:
        return mock_brief

    try:
        client = ChatOpenAI(
            model=settings.orchestrator_model,
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url,
            temperature=0.0
        )
        
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
            SystemMessage(content="You are a clinical preparation writer. You structure patient briefs with concern-framed, non-actionable questions for their doctor."),
            HumanMessage(content=prompt)
        ])
        
        parsed = parse_json_safely(response.content)
        
        questions = parsed.get("questions", [])
        if not isinstance(questions, list) or len(questions) < 3 or len(questions) > 4:
            questions = mock_questions
            
        return {
            "brief_output": {
                "summary": parsed.get("summary") or mock_brief["brief_output"]["summary"],
                "changes_since_last_visit": parsed.get("changes_since_last_visit") or mock_brief["brief_output"]["changes_since_last_visit"],
                "questions": questions[:4],
                "disclaimer": "Discuss this with your doctor — this is not a diagnosis."
            }
        }
    except Exception:
        return mock_brief


workflow = StateGraph(BriefWriterState)
workflow.add_node("write_brief", write_visit_brief_node)
workflow.set_entry_point("write_brief")
workflow.add_edge("write_brief", END)

brief_writer_graph = workflow.compile()

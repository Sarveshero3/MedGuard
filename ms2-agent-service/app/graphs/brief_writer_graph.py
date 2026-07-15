from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END

class BriefWriterState(TypedDict):
    active_medicines: List[Dict[str, Any]]
    interaction_flags: List[Dict[str, Any]]
    lab_trends: List[Dict[str, Any]]
    reason_for_visit: str | None
    brief_output: Dict[str, Any]

def write_visit_brief_node(state: BriefWriterState) -> Dict[str, Any]:
    active_meds = state.get("active_medicines", [])
    flags = state.get("interaction_flags", [])
    trends = state.get("lab_trends", [])
    reason = state.get("reason_for_visit", "")

    # Generate plain-language summary of medicines
    med_lines = []
    for med in active_meds:
        med_lines.append(f"{med.get('brand_name')} ({med.get('generic_name')}) - {med.get('dosage')} taken {med.get('frequency')}")
    meds_summary = "Current regimen includes: " + ", ".join(med_lines) if med_lines else "No active medicines."

    # Generate plain-language summary of changes & interactions
    change_parts = []
    if flags:
        change_parts.append("Upstream interaction warnings detected: " + "; ".join([f"{f.get('generic_a')} & {f.get('generic_b')} ({f.get('severity')}): {f.get('explanation')}" for f in flags]))
    
    for tr in trends:
        test = tr.get("test_type")
        val = tr.get("value")
        # Example trend
        change_parts.append(f"Lab test {test} recorded at {val} {tr.get('unit', '')}.")

    changes_summary = " ".join(change_parts) if change_parts else "No significant changes or alerts since last consultation."

    # Formulate exactly 3-4 neutral questions about significance/cause (never action)
    questions = []
    if flags:
        questions.append("Are there any precautions I should take when combining my current medicines?")
    if trends:
        for tr in trends[:2]:
            questions.append(f"My {tr.get('test_type')} was recorded at {tr.get('value')} {tr.get('unit')} — is this within a normal range for me?")
    
    if len(questions) < 3:
        questions.append("What indicators should we monitor closely before my next appointment?")
    if len(questions) < 3:
        questions.append("What life style or dietary modifications could help support my current vitals?")

    # Guarantee exactly 3-4 questions
    questions = questions[:4]

    return {
        "brief_output": {
            "summary": meds_summary,
            "changes_since_last_visit": changes_summary,
            "questions": questions,
            "disclaimer": "Discuss this with your doctor — this is not a diagnosis."
        }
    }

workflow = StateGraph(BriefWriterState)
workflow.add_node("write_brief", write_visit_brief_node)
workflow.set_entry_point("write_brief")
workflow.add_edge("write_brief", END)

brief_writer_graph = workflow.compile()

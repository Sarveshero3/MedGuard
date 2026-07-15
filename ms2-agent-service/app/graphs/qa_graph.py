from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END


class QaState(TypedDict):
    question: str
    active_medicines: List[Dict[str, Any]]
    interaction_flags: List[Dict[str, Any]]
    answer: str


def answer_question_node(state: QaState) -> Dict[str, Any]:
    question = state.get("question", "").lower()

    # Strictly non-diagnostic
    disclaimer = "\n\n*Discuss this with your doctor — this is not a diagnosis.*"

    if "interaction" in question or "safe" in question:
        ans = (
            "Upstream systems check medication interactions against a verified database. "
            "If you suspect any drug interaction side-effects, report them to your clinician immediately."
        )
    elif "hba1c" in question or "sugar" in question:
        ans = (
            "HbA1c reflects glucose levels over 3 months. Any sudden variations should "
            "be evaluated in context of your dietary habits and clinical history with your healthcare provider."
        )
    else:
        ans = (
            "I can help clarify details of your active medicines list or lab values trends. "
            "For any dosage adjustments or medical advice, please consult your physician."
        )

    return {
        "answer": ans + disclaimer
    }


workflow = StateGraph(QaState)
workflow.add_node("answer_question", answer_question_node)
workflow.set_entry_point("answer_question")
workflow.add_edge("answer_question", END)

qa_graph = workflow.compile()

from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
import json
from app.config import settings
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

class QaState(TypedDict):
    question: str
    active_medicines: List[Dict[str, Any]]
    interaction_flags: List[Dict[str, Any]]
    answer: str


def answer_question_node(state: QaState) -> Dict[str, Any]:
    question = state.get("question", "")
    active_meds = state.get("active_medicines", [])
    flags = state.get("interaction_flags", [])

    # Mock fallback
    q_low = question.lower()
    disclaimer = "\n\n*Discuss this with your doctor — this is not a diagnosis.*"
    if "interaction" in q_low or "safe" in q_low:
        ans = "Upstream systems check medication interactions against a verified database. If you suspect any drug interaction side-effects, report them to your clinician immediately."
    elif "hba1c" in q_low or "sugar" in q_low:
        ans = "HbA1c reflects glucose levels over 3 months. Any sudden variations should be evaluated in context of your dietary habits and clinical history with your healthcare provider."
    else:
        ans = "I can help clarify details of your active medicines list or lab values trends. For any dosage adjustments or medical advice, please consult your physician."
    mock_ans = ans + disclaimer

    if not settings.nvidia_api_key:
        return {"answer": mock_ans}

    try:
        client = ChatOpenAI(
            model=settings.orchestrator_model,
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url,
            temperature=0.0
        )
        
        prompt = f"""
        You are a clinical Q&A safety assistant answering patient follow-up queries.
        
        Patient's Question: {question}
        Active Medicines: {json.dumps(active_meds)}
        Active Alerts/Flags: {json.dumps(flags)}
        
        Provide a safe, supportive, plain-language answer.
        CRITICAL SAFETY RULES:
        - Never diagnose the patient.
        - Never suggest adjustments to their treatment, dosage, or schedule.
        - Always instruct them to consult their physician for clinical decisions.
        - You MUST append exactly this disclaimer at the very end of your response: "\n\n*Discuss this with your doctor — this is not a diagnosis.*"
        """
        
        response = client.invoke([
            SystemMessage(content="You are a clinical Q&A assistant. You answer patient safety queries strictly without providing diagnosis or suggesting treatment changes."),
            HumanMessage(content=prompt)
        ])
        
        answer = response.content.strip()
        
        if "*discuss this with your doctor" not in answer.lower():
            answer += disclaimer
            
        return {"answer": answer}
    except Exception:
        return {"answer": mock_ans}


workflow = StateGraph(QaState)
workflow.add_node("answer_question", answer_question_node)
workflow.set_entry_point("answer_question")
workflow.add_edge("answer_question", END)

qa_graph = workflow.compile()

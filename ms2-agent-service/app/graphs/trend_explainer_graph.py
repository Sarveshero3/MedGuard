from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END
from app.config import settings
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage


class TrendExplainerState(TypedDict):
    test_type: str
    values: List[float]
    dates: List[str]
    explanation: str


def explain_trend_node(state: TrendExplainerState) -> Dict[str, Any]:
    test_type = state.get("test_type", "Lab test")
    values = state.get("values", [])

    if not values:
        return {"explanation": "No laboratory values available to explain trends."}

    start_val = values[-1]
    end_val = values[0]
    diff = end_val - start_val

    disclaimer = "\n\n*Discuss this with your doctor — this is not a diagnosis.*"

    if diff > 0:
        msg = f"Your {test_type} values show a rising trend from {start_val} to {end_val}."
    elif diff < 0:
        msg = f"Your {test_type} values show a falling trend from {start_val} to {end_val}."
    else:
        msg = f"Your {test_type} values have remained stable at {end_val}."

    client = get_client(settings.orchestrator_model)

    prompt = f"""
    You are a clinical trend explainer. The system has calculated the following deterministic trend direction for the patient's lab test:
    
    Test Type: {test_type}
    Values list: {values}
    Trend Direction Description: {msg}
    
    Write a plain-language explanation of what this trend generally means (explain what '{test_type}' measures and why tracking its changes is useful).
    CRITICAL SAFETY RULES:
    - You must accept the trend description '{msg}' exactly. Do NOT override the trend direction or recheck the values math.
    - Explain in simple, clear, non-diagnostic terms.
    - Do not provide medical diagnosis or recommend specific therapy shifts.
    - Append exactly this disclaimer at the end of the explanation: "\n\n*Discuss this with your doctor — this is not a diagnosis.*"
    """

    response = client.invoke([
        SystemMessage(
            content="You are a clinical trend explainer describing laboratory panel trend directions in plain language."),
        HumanMessage(content=prompt)
    ])

    explanation = response.content.strip()

    if "*discuss this with your doctor" not in explanation.lower():
        explanation += disclaimer

    return {"explanation": explanation}


workflow = StateGraph(TrendExplainerState)
workflow.add_node("explain_trend", explain_trend_node)
workflow.set_entry_point("explain_trend")
workflow.add_edge("explain_trend", END)

trend_explainer_graph = workflow.compile()

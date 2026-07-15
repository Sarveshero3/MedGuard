from typing import TypedDict, List, Dict, Any
from langgraph.graph import StateGraph, END

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

    return {
        "explanation": msg + disclaimer
    }

workflow = StateGraph(TrendExplainerState)
workflow.add_node("explain_trend", explain_trend_node)
workflow.set_entry_point("explain_trend")
workflow.add_edge("explain_trend", END)

trend_explainer_graph = workflow.compile()

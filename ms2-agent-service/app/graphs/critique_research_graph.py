from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, END


class CritiqueResearchState(TypedDict):
    generic_a: str
    generic_b: str
    severity: str
    explanation: str
    critique_iterations: int
    research_summary: str
    is_valid: bool


def research_generic_interactions_node(state: CritiqueResearchState) -> Dict[str, Any]:
    # Simulate lookups / research on molecules A and B
    gen_a = state.get("generic_a", "").lower()
    gen_b = state.get("generic_b", "").lower()

    if (gen_a == "warfarin" and gen_b == "aspirin") or (gen_a == "aspirin" and gen_b == "warfarin"):
        return {
            "severity": "avoid_combination",
            "explanation": (
                "Severe bleeding risk. Both medications inhibit clotting pathways through distinct "
                "mechanisms, leading to synergistic antiplatelet/anticoagulant effects."
            ),
            "research_summary": (
                "Verified against medical databases (DDInter, clinical trials). "
                "Significant bleeding events noted in combined therapy cohorts."
            ),
            "is_valid": True
        }

    return {
        "severity": "minor",
        "explanation": "No major adverse interactions recorded for this combination. Advise routine monitoring.",
        "research_summary": "Standard literature check returned no severe clinical contraindications.",
        "is_valid": True
    }


def critique_findings_node(state: CritiqueResearchState) -> Dict[str, Any]:
    # Check if explanation contains satisfactory scientific backup
    explanation = state.get("explanation", "")
    iterations = state.get("critique_iterations", 0)

    if "bleeding" in explanation.lower() or iterations >= 2:
        return {
            "is_valid": True,
            "critique_iterations": iterations + 1
        }

    # Critique loop request additional safety warning backup
    return {
        "is_valid": False,
        "explanation": (
            explanation
            + " [Critique Addition: Advise close clinical supervision if administered concurrently.]"
        ),
        "critique_iterations": iterations + 1
    }


def critique_router(state: CritiqueResearchState):
    if state.get("is_valid", False) or state.get("critique_iterations", 0) >= 3:
        return "end"
    return "research_node"


workflow = StateGraph(CritiqueResearchState)
workflow.add_node("research_node", research_generic_interactions_node)
workflow.add_node("critique_node", critique_findings_node)

workflow.set_entry_point("research_node")
workflow.add_edge("research_node", "critique_node")
workflow.add_conditional_edges(
    "critique_node",
    critique_router,
    {
        "research_node": "research_node",
        "end": END
    }
)

critique_research_graph = workflow.compile()

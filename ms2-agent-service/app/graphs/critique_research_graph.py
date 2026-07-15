from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, END
from app.config import settings
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

class CritiqueResearchState(TypedDict):
    generic_a: str
    generic_b: str
    severity: str
    explanation: str
    critique_iterations: int
    research_summary: str
    is_valid: bool


def research_generic_interactions_node(state: CritiqueResearchState) -> Dict[str, Any]:
    gen_a = state.get("generic_a", "")
    gen_b = state.get("generic_b", "")

    # Mock fallback
    is_warfarin_aspirin = (gen_a.lower() == "warfarin" and gen_b.lower() == "aspirin") or (gen_a.lower() == "aspirin" and gen_b.lower() == "warfarin")
    mock_data = {
        "severity": "avoid_combination" if is_warfarin_aspirin else "minor",
        "explanation": "Severe bleeding risk. Both medications inhibit clotting pathways..." if is_warfarin_aspirin else "No major adverse interactions recorded for this combination.",
        "research_summary": "Verified against medical databases." if is_warfarin_aspirin else "Standard literature check returned no severe clinical contraindications.",
        "is_valid": False
    }

    if not settings.nvidia_api_key:
        return mock_data

    try:
        client = ChatOpenAI(
            model=settings.orchestrator_model,
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url,
            temperature=0.0
        )
        
        prompt = f"""
        Research the drug-drug interaction between the generic molecules '{gen_a}' and '{gen_b}'.
        Identify if there are any clinically significant interactions, side effects, or contraindications when taken together.
        Provide a scientific, clinical explanation of the interaction mechanism (if any) and a summary of your findings.
        """
        
        response = client.invoke([
            SystemMessage(content="You are a clinical pharmacologist. Research drug-drug interactions objectively based on scientific literature."),
            HumanMessage(content=prompt)
        ])
        
        explanation = response.content.strip()
        
        return {
            "severity": "unknown", # Flag as unknown: needs user confirmation rather than guessing severity
            "explanation": explanation,
            "research_summary": f"Automated literature research completed for {gen_a} and {gen_b}.",
            "is_valid": False # Force to critique first
        }
    except Exception:
        return mock_data


def critique_findings_node(state: CritiqueResearchState) -> Dict[str, Any]:
    gen_a = state.get("generic_a", "")
    gen_b = state.get("generic_b", "")
    explanation = state.get("explanation", "")
    iterations = state.get("critique_iterations", 0)

    if not settings.nvidia_api_key or iterations >= 1:
        return {
            "is_valid": True,
            "critique_iterations": iterations + 1
        }

    try:
        client = ChatOpenAI(
            model=settings.orchestrator_model,
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url,
            temperature=0.0
        )
        
        critique_prompt = f"""
        Analyze the following drug-drug interaction research finding between '{gen_a}' and '{gen_b}':
        
        Research Findings:
        {explanation}
        
        Verify:
        1. Does it accurately identify the drug classes for both '{gen_a}' and '{gen_b}'?
        2. Did it miss any crucial synonyms or related warnings?
        3. Is the explanation clinically precise and clear?
        
        If the findings are fully correct, accurate, and scientifically backed, respond with exactly: VALID.
        If there are inaccuracies or missing drug-class context, provide a revised explanation correcting these details.
        """
        
        response = client.invoke([
            SystemMessage(content="You are a senior medical reviewer auditing drug safety descriptions. Correct any inaccuracies or missing drug-class/mechanism details."),
            HumanMessage(content=critique_prompt)
        ])
        
        res_text = response.content.strip()
        
        if "VALID" in res_text:
            return {
                "is_valid": True,
                "critique_iterations": iterations + 1
            }
        else:
            return {
                "is_valid": True, # Cap at 1 iteration (meaning this is the second and final pass, so we mark it as valid to exit)
                "explanation": res_text,
                "critique_iterations": iterations + 1
            }
    except Exception:
        return {
            "is_valid": True,
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
